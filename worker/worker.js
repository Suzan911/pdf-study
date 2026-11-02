// مُذاكِر PDF — وسيط Cloudflare Worker بين الموقع و Claude API.
// يحفظ مفتاح الـ API سراً، ويقبل الطلبات من الموقع فقط ومن يملك رمز دخول صحيحاً.
//
// المتغيرات (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  (Secret)  مفتاح Claude API
//   ACCESS_CODES       (Secret)  رموز الدخول مفصولة بفواصل، مثل: suzan-2026,ahmad-2026
//   ALLOWED_ORIGIN     (Text)    https://suzan911.github.io
//   MODEL              (Text, اختياري)  الافتراضي claude-opus-5-5
//   DAILY_LIMIT        (Text, اختياري)  عدد الطلبات اليومية لكل رمز، الافتراضي 40
// ربط اختياري (Bindings → KV namespace) باسم USAGE لتفعيل الحد اليومي.

const MAX_PROMPT_CHARS = 120000;
const SYSTEM = "You are the analysis engine of a study website. Students upload course PDFs; " +
  "you summarize them and write exam practice questions. Follow the requested JSON format exactly " +
  "and reply with the JSON value only, with no text before or after it.";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": okOrigin ? origin : allowed[0] || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
    });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
    if (!okOrigin) return reply(403, { error: "origin_not_allowed" });

    let body;
    try { body = await request.json(); } catch { return reply(400, { error: "bad_json" }); }
    const code = String(body.code || "").trim();
    const prompt = String(body.prompt || "");

    const codes = (env.ACCESS_CODES || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!code || !codes.includes(code)) return reply(401, { error: "bad_code" });
    if (body.check) return reply(200, { ok: true });
    if (!prompt) return reply(400, { error: "empty_prompt" });
    if (prompt.length > MAX_PROMPT_CHARS) return reply(413, { error: "too_large" });

    // الحد اليومي لكل رمز (يعمل فقط إذا رُبط KV باسم USAGE)
    if (env.USAGE) {
      const limit = parseInt(env.DAILY_LIMIT || "40", 10);
      const key = `${new Date().toISOString().slice(0, 10)}:${code}`;
      const used = parseInt((await env.USAGE.get(key)) || "0", 10);
      if (used >= limit) return reply(429, { error: "daily_limit", limit });
      await env.USAGE.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
    }

    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2026-10-21",
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify({
          model: env.MODEL || "claude-opus-5-5",
          max_tokens: 16000,
          output_config: { effort: "medium" },
          fallbacks: "default",
          system: SYSTEM,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch {
      return reply(502, { error: "upstream_unreachable" });
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const type = data?.error?.type || "api_error";
      const status = res.status === 429 || type === "rate_limit_error" ? 429 : 502;
      return reply(status, { error: type });
    }
    if (data.stop_reason === "refusal") return reply(422, { error: "refused" });
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    if (!text.trim()) return reply(502, { error: "empty_completion" });
    return reply(200, { text, truncated: data.stop_reason === "max_tokens" });
  },
};
