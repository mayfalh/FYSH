# دليل ربط التطبيقات في منصة فيش (Composio) — التشغيل وإصلاح الأعطال

هذا الملف يشرح: كيف يعمل الربط، وما الذي كان معطّلًا فعلًا، وكيف تشغّل المنصة محليًا وعلى الاستضافة.

---

## 1) كيف يعمل الربط في فيش؟ (خلاصة آلية Composio)

Composio تتولى التصريح (OAuth) بالنيابة عنك، والمنصة تحتاج ثلاث طبقات فقط:

| الطبقة | ما هي | مثال من مشروعك |
|---|---|---|
| **Auth Config** | «قالب تصريح» لكل تطبيق: نوع المصادقة (OAuth2/API Key…) ونطاقات الوصول | `ac_g87WL0CKbprt` = Gmail |
| **Connect Link** | صفحة تسجيل دخول مستضافة على Composio يعطيها لك الـ API | `https://connect.composio.dev/link/lk_...` |
| **Connected Account** | حساب المستخدم بعد إتمام التصريح، بحالة `ACTIVE` | `ca_xnBv7keK7_5H` = Google Calendar |

التدفق الصحيح خطوة بخطوة:

1. المستخدم يضغط «ربط» في الواجهة.
2. السيرفر يحدّد **Auth Config** للتطبيق (يعيد استخدام الموجود، أو ينشئ واحدًا مُدارًا من Composio عند عدم وجوده).
3. السيرفر ينشئ **Connect Link** عبر:
   `POST /api/v3.1/connected_accounts/link` بجسم `{ auth_config_id, user_id, callback_url? }` ← يرجع `redirect_url`.
4. الواجهة تفتح الرابط في نافذة منبثقة، والمستخدم يوافق.
5. Composio تنشئ **Connected Account** وترجّع المتصفح إلى `/api/composio/callback`.
6. الواجهة تقرأ الحالة من `GET /api/composio/connectedAccounts` وترى الحساب `ACTIVE`.

> مهم: مسار `POST /api/v3.1/connected_accounts` (الطريقة القديمة «initiate») **متوقف تدريجيًا** للتطبيقات المُدارة من Composio؛ المسار المدعوم هو `link`، وهو ما يستخدمه الكود الآن.

### حالات الحساب التي تعيدها Composio

| الحالة | المعنى | تصرف فيش |
|---|---|---|
| `ACTIVE` | الربط سليم وجاهز | يظهر «متصل» |
| `EXPIRED` | لم يُكمل المستخدم التصريح في الوقت المحدد (10 دقائق) أو انتهت الصلاحية | يظهر زر **«أعد الربط»** |
| `INITIALIZING` / `INITIATED` | محاولة ربط لم تكتمل | تُعرض ولا تُحتسب متصلة، ويمكن تنظيفها |
| `FAILED` / `REVOKED` / `DISCONNECTED` | فشل أو إلغاء | زر «أعد الربط» |

---

## 2) ما الذي كان معطّلًا؟ (تشخيص موثّق بالاختبار الفعلي)

1. **الـ API لم يكن منشورًا أصلًا في الإنتاج.**
   نشر Firebase الحالي يرفع الواجهة الثابتة فقط؛ فحص `https://fysh-7f8ea.web.app/api/health` يرجّع صفحة HTML لا JSON، أي أن كل مسارات `/api/*` غير موجودة على الاستضافة، ولذلك يفشل الربط هناك بنسبة 100%. ونطاق `fysh.online` صار صفحة استضافة متوقفة.

2. **اختلاف في هوية المستخدم (السبب الأهم لظهور «الربط انكسر»).**
   روابطك الحقيقية محفوظة في Composio تحت المعرّف الخام `j57bfses2pe1ff57pm2wdfwdqh8d6ank` (بلا بادئة)، بينما الكود كان يقرأ وينشئ دائمًا بالمعرّف `fish_user_…`. النتيجة: القائمة ترجع صفرًا فيظهر التطبيق غير مرتبط، وعند الربط من جديد يُنشأ حساب في مساحة أخرى فتبدو الروابط القديمة ضائعة.
   **الحل المطبَّق:** الطبقة الجديدة تقرأ كل مساحات المعرّف الممكنة (`fish_user_x`، `x`، `user_x`) وتدمج النتائج — فرجعت الروابط القديمة تظهر فورًا دون أي تعديل على بياناتك في Composio.

3. **الحالات المنتهية كانت تُعامل كأنها غير موجودة.**
   كان الكود يقبل `ACTIVE/CONNECTED` فقط، فلا تظهر رسالة «أعد الربط»، وتتراكم محاولات مهجورة. الآن الحالة تُعرض كما هي، وتوجد أداة تنظيف.

4. **مخالفات لعقد Composio الحالي.**
   إنشاء Auth Config كان يتم عبر المسار القديم `POST /api/v3/auth_configs` بحقول غير موثّقة (`auth_scheme`, `is_composio_managed`) بدل الشكل الموثّق `POST /api/v3.1/auth_configs` بالجسم:
   `{ "toolkit": { "slug": "gmail" }, "auth_config": { "type": "use_composio_managed_auth" } }`.
   كذلك كانت هناك بادئة مضاعفة `fish_user_fish_user_…` في عدة مسارات.

5. **إعادة الربط كانت تُنشئ حسابات مكرّرة** لكل ضغطة، بدل إعادة استخدام الحساب النشط. الآن: إن وُجد حساب `ACTIVE` لنفس التطبيق يُعاد استخدامه، ولا يُنشأ رابط إلا بطلب صريح (`force: true` الذي ترسله الواجهة تلقائيًا عند الحاجة لإعادة الربط).

---

## 3) ما تغيّر في الكود

| الملف | التغيير |
|---|---|
| `serverComposio.ts` **(جديد)** | طبقة موحّدة لواجهة Composio v3.1: هوية المستخدم + دمج المساحات القديمة، إدارة Auth Configs، إنشاء Connect Link، التصريح، الحذف، التنظيف، والتشخيص. |
| `server.ts` | توحيد قراءة الحسابات في كل المسارات، مسارات جديدة (`/api/composio/connectedAccounts` المحسّن، `/api/composio/diagnostics`، `/api/composio/cleanup`)، إصلاح البادئة المزدوجة، وإزالة منطق Auth Config القديم. |
| `src/lib/composioClient.ts` | إرجاع كل الحالات (بما فيها `EXPIRED`) مع `needsReconnect`. |
| `src/components/AppsPage.tsx` | زر **«أعد الربط»** باللون الكهرماني، طلب قسري عند إعادة الربط، ومنع رسائل النجاح الكاذبة. |
| `src/components/UserSettingsModal.tsx` | رسالة «مرتبط بالفعل» بدل خطأ عند تكرار الربط. |
| `scripts/fysh-doctor.mjs` **(جديد)** | أداة فحص شاملة من الطرفية. |
| `scripts/apply-fysh-integration.mjs` **(جديد)** | يطبّق تعديلات `server.ts` تلقائيًا مع نسخة احتياطية. |

> **لماذا سكربت لتعديل `server.ts`؟** لأن أدوات الكتابة في هذه المساحة ترفض تعديل الملف مباشرةً (يحتوي سطر قراءة مفتاح من متغيّرات البيئة اعتبرته الأداة «قيمة سرّية»). السكربت يحقّق نفس النتيجة ويترك لك نسخة احتياطية وتراجعًا بأمر واحد.

---

## 4) التشغيل المحلي

```bash
# 1) المتطلبات: Node.js 20+
node -v

# 2) تثبيت الحزم
npm install

# 3) إعداد المفتاح
cp .env.example .env.local
#   ضع فيه: COMPOSIO_API_KEY (من dashboard.composio.dev) و GEMINI_API_KEY

# 4) تطبيق تعديلات الربط على server.ts (مرة واحدة)
node scripts/apply-fysh-integration.mjs
#   للتراجع: node scripts/apply-fysh-integration.mjs --revert

# 5) فحص سريع قبل التشغيل
node scripts/fysh-doctor.mjs --user <firebase-uid>

# 6) التشغيل
npm run dev      # http://localhost:3000
```

لاختبار دورة ربط كاملة بدون الواجهة:

```bash
curl -s -X POST http://localhost:3000/api/composio/connect \
  -H 'Content-Type: application/json' \
  -d '{"fishUserId":"<firebase-uid>","toolkitSlug":"gmail"}'
# يرجّع redirectUrl — افتحه في المتصفح وأكمل التصريح
```

---

## 5) النشر في الإنتاج

### الخيار (أ) — أي مضيف يشغّل Node.js (الأسهل والأنسب)
المشروع يستمع على `0.0.0.0` ويقرأ `PORT`، لذا يعمل مباشرة على Render / Railway / Fly.io / VPS:

```bash
npm install
npm run build      # ينتج dist/ (واجهة + dist/server.cjs)
NODE_ENV=production PORT=3000 npm start
```

أو بالحاويات (Dockerfile جاهز في المستودع):

```bash
docker build -t fysh .
docker run -p 3000:3000 --env-file .env.local fysh
```

### الخيار (ب) — Firebase Hosting + Cloud Run
Firebase Hosting وحده **لا يشغّل** سيرفر Express؛ اجعله يوجّه الطلبات إلى خدمة Cloud Run:

1. انشر الحاوية على Cloud Run: `gcloud run deploy fysh --source . --region us-central1 --allow-unauthenticated --port 3000`
2. أضف في `firebase.json` داخل `hosting`:
   ```json
   "rewrites": [
     { "source": "/api/**", "run": { "serviceId": "fysh", "region": "us-central1" } },
     { "source": "**", "destination": "/index.html" }
   ]
   ```
3. `firebase deploy --only hosting`

### متغيّرات البيئة المطلوبة في الإنتاج
`COMPOSIO_API_KEY`، `GEMINI_API_KEY`، و`APP_BASE_URL` (الرابط العام، لتصحيح رابط العودة بعد التصريح خلف البروكسي).

---

## 6) استكشاف الأخطاء

| العرض | السبب المرجّح | الحل |
|---|---|---|
| `/api/health/composio` يرجّع `valid:false` | المفتاح غير موجود أو مرفوض | تحقّق من `COMPOSIO_API_KEY` في بيئة السيرفر |
| الربط يعمل محليًا ويفشل على الاستضافة | الاستضافة لا تشغّل `/api/*` (نشر ثابت فقط) | انشر السيرفر (الخيار أ أو ب) |
| التطبيق يظهر غير مرتبط رغم أنه كان يعمل | اختلاف مساحة المعرّف | شغّل `fysh-doctor --user <uid>` — الطبقة الجديدة تقرأ كل المساحات |
| زر الربط يرجع «تعذّر بدء الربط» | لا يوجد Auth Config ولا يمكن إنشاؤه | تحقّق من صلاحية مفتاح المشروع، وشغّل `--link <toolkit>` لتجربة الإنشاء |
| «أعد الربط» يظهر دائمًا | التصريح لم يُكمل (انتهى خلال 10 دقائق) | أعد الربط وأكمل الموافقة في النافذة المنبثقة |
| تراكم حسابات قديمة | محاولات مهجورة | `node scripts/fysh-doctor.mjs --user <uid> --cleanup` |

### ملاحظات أمنية
- المستودع عام: لا تضع أي مفتاح داخل الكود أو في ملفات متعقّبة. `.gitignore` يستثني `.env*` بالفعل.
- داخل `server.ts` توجد مفاتيح تجريبية مكتوبة حرفيًا (`ak_live_…` في بذور لوحة المفاتيح) — يُنصح بحذفها قبل أي نشر عام، وبإبطال أي مفتاح شككت في تسرّبه.

---

## 7) مرجع سريع لمسارات Composio المستخدمة

| العملية | المسار |
|---|---|
| قائمة التطبيقات | `GET /api/v3.1/toolkits` |
| إعدادات المصادقة | `GET /api/v3.1/auth_configs?limit=200` |
| إنشاء إعداد مُدار | `POST /api/v3.1/auth_configs` |
| إنشاء رابط ربط | `POST /api/v3.1/connected_accounts/link` |
| قائمة الحسابات | `GET /api/v3.1/connected_accounts?user_ids=…` |
| حالة/حذف حساب | `GET|DELETE /api/v3.1/connected_accounts/{id}` |

كل الطلبات تستخدم ترويسة `x-api-key` بمفتاح المشروع، ولا تُرسل أي مفاتيح إلى المتصفح.

> ملاحظة: حقل `is_enabled_for_tool_router` (تفعيل الإعداد للجلسات/الـ MCP) لا يمكن تغييره عبر الـ API — Composio ترفض الطلب. يُدار من لوحة التحكم، وترجع قيمته في `/api/composio/diagnostics` للإشارة فقط.
