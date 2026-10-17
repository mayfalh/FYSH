# النشر وربط الدومين fysh.online

## 1) الحالة الحالية للدومين

الدومين مسجّل عند هوستنجر، لكنه حاليًا **موقوف على خدمة Parking** وليس على تطبيق:

```
fysh.online        A      2.57.91.91            (Hostinger parking — server: hcdn)
www.fysh.online    CNAME  fysh.online           (يشير إلى نفس الـ parking)
NS                 helios.dns-parking.com , aster.dns-parking.com
```

أي أن فتح `https://fysh.online` يعرض صفحة «Parked Domain name on Hostinger DNS system» ولا يعرض فيش.

### مهم جدًا
- **GitHub Pages لا يشغّل هذا المشروع**: المشروع React + سيرفر Express؛ Pages يخدم ملفات ثابتة فقط، وكل مسارات `/api/*` (الربط والمفاتيح والوكيل) ستعطّل.
- **Firebase Hosting وحده لا يكفي** لنفس السبب (نشر الواجهة فقط).
- لكي يعمل الدومين، يجب أن يشير إلى **خادم يشغّل Node** (Render / VPS / Cloud Run…)، ثم نعدّل سجلي A وCNAME.

---

## 2) الخيار (أ) — Render (الأسرع، بدون إدارة خادم)

1. ادفع المستودع إلى GitHub (تم) — `mayfalh/FYSH`.
2. من Render: **New → Blueprint** واختر المستودع (سيقرأ `render.yaml` تلقائيًا).
   أو **New → Web Service → Docker** بنفس المستودع.
3. أضف متغيّرات البيئة من لوحة Render:
   - `COMPOSIO_API_KEY`
   - `GEMINI_API_KEY`
   - `APP_BASE_URL = https://fysh.online` (موجود في `render.yaml`)
4. أضف **Disk** بمسار `/app/data` وحجم 1GB (ضروري لحفظ مفاتيح العملاء والجلسات).
5. من **Settings → Custom Domains** أضف:
   - `fysh.online`
   - `www.fysh.online`
6. ستظهر لك القيم المطلوبة (تختلف لكل خدمة، خذها كما هي من Render):

| النوع | الاسم | القيمة (مثال من Render) | TTL |
|---|---|---|---|
| A | `@` | `216.24.57.1` | 300 |
| CNAME | `www` | `fysh-xxxx.onrender.com` | 300 |

7. احذف سجل الـ parking القديم (`A @ → 2.57.91.91`) وإلا سيبقى الدومين معلّقًا.
8. شهادة HTTPS تُصدر تلقائيًا بعد انتشار DNS.

---

## 3) الخيار (ب) — VPS من هوستنجر (تحكّم كامل)

على الخادم (Ubuntu):

```bash
git clone https://github.com/mayfalh/FYSH.git && cd FYSH
cp .env.example .env && nano .env          # ضع COMPOSIO_API_KEY و GEMINI_API_KEY
docker compose up -d --build               # يبني ويشغّل على المنفذ 3000
```

ثم سجلات DNS:

| النوع | الاسم | القيمة | TTL |
|---|---|---|---|
| A | `@` | `<IP الخادم>` | 300 |
| CNAME | `www` | `fysh.online` | 300 |

وللـ HTTPS على الخادم، أسهل طريقة Caddy:

```bash
sudo apt install caddy -y
sudo caddy reverse-proxy --from fysh.online --to 127.0.0.1:3000
```

> بدون `volumes: ./data:/app/data` (موجود في `docker-compose.yml`) ستُفقد مفاتيح العملاء عند كل إعادة تشغيل.

---

## 4) تعديل السجلات في هوستنجر (خطوة بخطوة)

1. ادخل **hPanel → Domains → fysh.online → DNS / Nameservers**.
2. أبقِ خوادم الأسماء كما هي (`aster.dns-parking.com` و`helios.dns-parking.com`) — لا حاجة لتغييرها، يكفي تعديل المنطقة.
3. افتح **DNS Zone Editor** وعدّل:
   - `A` للاسم `@`: غيّر `2.57.91.91` إلى عنوان الخادم الجديد.
   - `CNAME` للاسم `www`: غيّر الهدف إلى عنوان الخدمة الجديدة.
4. احفظ، ثم انتظر من 5 دقائق إلى ساعة (TTL=300 يسرّع الانتشار).
5. تحقّق:

```bash
dig +short fysh.online
dig +short www.fysh.online
curl -s https://fysh.online/api/health
```

يجب أن يرجع الأخير JSON يحتوي `"status":"ok"`.

---

## 5) بعد الربط: قائمة تحقّق

- [ ] `https://fysh.online/api/health` يرجّع JSON وليس صفحة HTML.
- [ ] `https://fysh.online/api/health/composio` يرجّع `valid: true`.
- [ ] صفحة `/apps` تفتح رابط ربط حقيقي (Connect Link).
- [ ] مفتاح عميل جديد يعمل على `/api/fish/mcp?key=…` ويرجّع `status: ready`.
- [ ] شهادة HTTPS صالحة (قفل أخضر) على `fysh.online` و`www`.
- [ ] نسخ احتياطية دورية لمجلد `data/` (أو ترحيل المفاتيح إلى قاعدة بيانات — انظر قسم التوسّع).

---

## 6) ملاحظة عن التوسّع (قبل فتح التسجيلات للعامة)

التصميم الحالي يحفظ المفاتيح والجلسات في الذاكرة + ملف JSON داخل `data/`.
يناسب:
- عشرات المستخدمين المتزامنين ومئات المسجّلين على خادم واحد.
- لا يناسب آلاف المستخدمين النشطين أو أكثر من نسخة واحدة من التطبيق.

قبل فتح التسجيلات على نطاق واسع:
1. نقل المفاتيح والجلسات إلى قاعدة بيانات (Postgres/Redis أو Firestore عبر Admin SDK).
2. تخزين **بصمة** المفتاح (`sha256`) بدل نصّه الصريح، وعرضه مرة واحدة عند الإنشاء.
3. ربط إنشاء المفاتيح بهوية المستخدم المسجّل، ومنع أي مستخدم من إنشاء/قراءة مفاتيح غيره.
4. حدّ أقصى للمفاتيح لكل مستخدم + حصص استخدام (Quota).
5. تشغيل أكثر من نسخة خلف موازن تحميل مع Redis للحدود والمخازن المؤقتة.
