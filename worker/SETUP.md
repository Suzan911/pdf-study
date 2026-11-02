# تشغيل التحليل الذكي على حسابك

هذا الوسيط يجعل موقع GitHub يستخدم Claude على حسابك في Anthropic.
من يملك رمز دخول صحيحاً يحصل على التحليل الذكي، وغيره يحصل على التحليل المحلي فقط.

## 1. مفتاح Claude API

1. ادخل إلى https://console.anthropic.com وأنشئ حساباً.
2. من **Billing** أضف رصيداً.
3. من **Limits** ضع حداً أقصى للإنفاق الشهري، مثلاً 10 دولارات.
4. من **API Keys** اضغط **Create Key** وانسخ المفتاح. يظهر مرة واحدة فقط، ولا ترسله لأحد.

## 2. إنشاء الوسيط على Cloudflare

1. ادخل إلى https://dash.cloudflare.com وأنشئ حساباً مجانياً.
2. من **Workers & Pages** اضغط **Create** ثم **Create Worker**.
3. سمِّه `pdf-study` ثم اضغط **Deploy**.
4. اضغط **Edit code**، واحذف الكود الموجود، والصق محتوى ملف `worker.js` كاملاً، ثم اضغط **Deploy**.
5. انسخ رابط الوسيط، ويكون بالشكل: `https://pdf-study.<اسمك>.workers.dev`

## 3. الإعدادات

من صفحة الوسيط: **Settings** ثم **Variables and Secrets** ثم **Add**:

| الاسم | النوع | القيمة |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secret | مفتاح الـ API من الخطوة 1 |
| `ACCESS_CODES` | Secret | رموز الدخول مفصولة بفواصل، مثل `suzan-7421,ahmad-3958` |
| `ALLOWED_ORIGIN` | Text | `https://suzan911.github.io` |

اضغط **Deploy** بعد الإضافة.

اجعل لكل شخص رمزاً خاصاً به. إذا أردت إيقاف شخص، احذف رمزه من `ACCESS_CODES`.

## 4. الحد اليومي (اختياري، وننصح به)

1. من **Storage & Databases** ثم **KV** اضغط **Create** وسمِّه `pdf-study-usage`.
2. في صفحة الوسيط: **Settings** ثم **Bindings** ثم **Add** ثم **KV namespace**.
3. اسم المتغير `USAGE`، واختر `pdf-study-usage`، ثم **Deploy**.

الحد الافتراضي 40 طلباً يومياً لكل رمز. لتغييره أضف متغيراً نصياً `DAILY_LIMIT` بالقيمة التي تريدها.

## 5. ربط الموقع

أرسل رابط الوسيط إلى من يدير المستودع، ليضعه في `API_URL` داخل `index.html`.

## النموذج والتكلفة

يستخدم الوسيط النموذج `claude-opus-5-5`. لتقليل التكلفة إلى النصف تقريباً أضف متغيراً نصياً
`MODEL` بالقيمة `claude-sonnet-5-5`.
