# فِيشْ — منصة الربط الموحّدة للتطبيقات والوكلاء الأذكياء

> 🌐 **النسخة الحيّة:** https://fysh.online — منصة فيش تعمل الآن على Render + Supabase.


> «فيش» كلمة سعودية تعني **المُوصِّل** (أو التخويل الكهربائي) — وهي الفكرة نفسها: وصلة واحدة تربط تطبيقاتك ووكلاءك الذكاء الاصطناعي بواجهة واحدة.

منصة عربية لربط التطبيقات (Gmail، Google Calendar، Slack، GitHub، Notion، وأكثر من 1600 تطبيق) مبنية على واجهة Composio، مع واجهة عربية مبسّطة للربط وإدارة المفاتيح وتشغيل الوكلاء.

---

## المكوّنات

- **الواجهة:** React + Vite + Tailwind (عربية أولًا، RTL).
- **السيرفر:** Express (`server.ts`) يقدّم الواجهة وواجهة `/api/*` معًا.
- **الربط:** Composio REST v3.1 عبر طبقة موحّدة في `serverComposio.ts`.
- **الوكلاء:** جلسات Composio + Gemini (`@google/genai`).
- **البيانات:** Firebase (مصادقة + Firestore) وتخزين محلي لسجلات المفاتيح والجلسات في `data/`.

---

## تشغيل سريع

```bash
npm install
cp .env.example .env.local     # ضع فيه COMPOSIO_API_KEY و GEMINI_API_KEY

# تطبيق تعديلات تفعيل الربط على server.ts (مرة واحدة، مع نسخة احتياطية)
node scripts/apply-fysh-integration.mjs

# فحص الحالة قبل التشغيل
node scripts/fysh-doctor.mjs --user <firebase-uid>

npm run dev                    # http://localhost:3000
```

للإنتاج:

```bash
npm run build && NODE_ENV=production npm start
# أو بالحاويات: docker build -t fysh . && docker run -p 3000:3000 --env-file .env.local fysh
```

⚠️ **مهم:** نشر Firebase Hosting في إعداداته الحالية يخدم الواجهة الثابتة فقط، ولا يشغّل سيرفر `/api/*`. لتشغيل الربط في الإنتاج شغّل السيرفر على أي مضيف Node (Render/Railway/VPS/Cloud Run) — التفاصيل في [دليل التشغيل](docs/COMPOSIO-SETUP-AR.md).

---

## أداة الفحص الذاتي

```bash
node scripts/fysh-doctor.mjs                          # فحص المفتاح والإعدادات وكل الحسابات
node scripts/fysh-doctor.mjs --user <uid>             # فحص مستخدم ومساحات معرّفاته
node scripts/fysh-doctor.mjs --user <uid> --cleanup   # تنظيف المحاولات المهجورة
node scripts/fysh-doctor.mjs --user <uid> --link gmail # اختبار إنشاء رابط ربط حقيقي
```

---

## مسارات الـ API الأساسية

| المسار | الوظيفة |
|---|---|
| `GET /api/composio/toolkits` | كتالوج التطبيقات (بحث وتصنيفات) |
| `GET /api/composio/connectedAccounts?fishUserId=…` | روابط المستخدم مع حالتها |
| `POST /api/composio/connect` | إنشاء رابط ربط (Connect Link) |
| `POST /api/composio/verify` | التحقق من حالة تطبيق |
| `DELETE /api/composio/disconnect` | إلغاء الربط |
| `GET /api/composio/diagnostics` | تشخيص شامل بلا كشف أي مفتاح |
| `POST /api/composio/cleanup` | حذف المحاولات المهجورة |
| `GET /api/health/composio` | فحص صحة المفتاح |

---

## التوثيق

- [دليل ربط التطبيقات والتشغيل واستكشاف الأخطاء](docs/COMPOSIO-SETUP-AR.md)
- [النشر وربط الدومين fysh.online](docs/DEPLOY-DOMAIN-AR.md)

## الترخيص والاستخدام

مشروع خاص بمنصة فِيشْ — © ماي ظافر 2026.
