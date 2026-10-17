#!/usr/bin/env node
/**
 * إنشاء جداول فيش في Supabase تلقائيًا عبر Management API.
 *
 * يحتاج شيئًا واحدًا فقط: Personal Access Token (يبدأ بـ sbp_) من
 * Supabase → Account → Access Tokens.
 *
 * الاستخدام:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-supabase-schema.mjs
 *   أو ضعه في .env باسم SUPABASE_ACCESS_TOKEN ثم شغّل السكربت بلا وسائط.
 *
 * بعد الانتهاء: احذف التوكن من Supabase (Access Tokens → Revoke).
 */
import fs from 'node:fs';
import path from 'node:path';

function readEnv(file) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

const cwd = process.cwd();
const env = { ...readEnv(path.join(cwd, '.env')), ...readEnv(path.join(cwd, '.env.local')), ...process.env };

const token = (env.SUPABASE_ACCESS_TOKEN || '').trim();
const url = (env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

const ok = s => `\x1b[32m${s}\x1b[0m`;
const bad = s => `\x1b[31m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;

if (!token || !token.startsWith('sbp_')) {
  console.error(bad('✗ أحتاج Personal Access Token يبدأ بـ sbp_.'));
  console.error('  Supabase → Account (أعلى اليمين) → Access Tokens → Generate new token');
  process.exit(1);
}
if (!ref) {
  console.error(bad('✗ لم أجد رقم المشروع. ضع SUPABASE_URL في .env.'));
  process.exit(1);
}

const schemaPath = path.join(cwd, 'supabase', 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error(bad('✗ لم أجد supabase/schema.sql'));
  process.exit(1);
}
const sql = fs.readFileSync(schemaPath, 'utf8');

console.log(`المشروع: ${ref}`);
console.log(dim('تنفيذ مخطط قاعدة البيانات…'));

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const bodyText = await res.text();
if (!res.ok) {
  console.error(bad(`✗ فشل التنفيذ (HTTP ${res.status})`));
  console.error(bodyText.slice(0, 500));
  process.exit(1);
}
console.log(ok('✓ تم تنفيذ المخطط.'));

/* تحقّق: هل الجداول موجودة الآن؟ */
const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const checkKey = serviceKey || (env.SUPABASE_ANON_KEY || '').trim();
if (checkKey && url) {
  for (const table of ['fysh_api_keys', 'fysh_agent_sessions', 'fysh_key_usage']) {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: checkKey, Authorization: `Bearer ${checkKey}` },
    });
    if (r.ok) console.log(ok(`✓ جدول ${table} جاهز`));
    else {
      const t = await r.text();
      console.log(`• جدول ${table}: HTTP ${r.status} ${dim(t.slice(0, 100))}`);
    }
  }
} else {
  console.log(dim('تخطّيت التحقق: لا يوجد مفتاح secret/anon لاختبار القراءة.'));
}

console.log('\nالخطوة التالية: ضع SUPABASE_SERVICE_ROLE_KEY في .env ثم شغّل:');
console.log('  node scripts/check-supabase.mjs');
console.log('\nمهم: أبطِل التوكن من Supabase → Access Tokens بعد الانتهاء.');
