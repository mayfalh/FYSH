-- =====================================================================
--  FYSH — مخطط قاعدة البيانات على Supabase (Postgres)
--  الصق هذا الملف كاملًا في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
-- =====================================================================

-- مفاتيح العملاء
create table if not exists public.fysh_api_keys (
  id            text primary key,
  user_id       text not null,
  name          text not null default 'FYSH Key',
  masked        text not null default 'ak_**',
  access        text not null default 'Full access',
  ip_allowlist  text not null default 'No restriction',
  user_email    text,
  -- بصمة المفتاح للبحث السريع (sha256) — لا يمكن استرجاع المفتاح منها
  secret_hash   text not null unique,
  -- المفتاح مشفّرًا (AES-256-GCM) — لا يُخزَّن نصًّا صريحًا
  secret_cipher text,
  status        text not null default 'ACTIVE',
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists fysh_api_keys_user_idx on public.fysh_api_keys (user_id);
create index if not exists fysh_api_keys_status_idx on public.fysh_api_keys (status);

-- جلسات الوكلاء (MCP) لكل مستخدم
create table if not exists public.fysh_agent_sessions (
  cache_key        text primary key,
  user_id          text not null,
  composio_user_id text,
  agent_type       text default 'mcp',
  session_id       text,
  status           text default 'ACTIVE',
  mcp_url          text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists fysh_sessions_user_idx on public.fysh_agent_sessions (user_id);

-- سجل استخدام مختصر (اختياري لكنه مفيد للتوسّع والمراقبة)
create table if not exists public.fysh_key_usage (
  id         bigserial primary key,
  key_id     text not null,
  user_id    text not null,
  action     text not null,
  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists fysh_usage_key_idx on public.fysh_key_usage (key_id, created_at desc);

-- =====================================================================
--  الأمان: تفعيل RLS وإغلاق الوصول العام
--  السيرفر يستخدم مفتاح service_role فقط (يتجاوز RLS)،
--  أي طلب من المتصفح بمفتاح anon لن يرى أي صف.
-- =====================================================================
alter table public.fysh_api_keys         enable row level security;
alter table public.fysh_agent_sessions   enable row level security;
alter table public.fysh_key_usage        enable row level security;

-- لا نضيف أي policy ⇒ لا وصول إطلاقًا عبر anon/authenticated.
-- (service_role يتجاوز RLS تلقائيًا داخل السيرفر)

-- =====================================================================
--  (اختياري) سياسة الاحتفاظ: حذف سجل الاستخدام الأقدم من 90 يومًا
-- =====================================================================
-- delete from public.fysh_key_usage where created_at < now() - interval '90 days';
