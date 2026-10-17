#!/usr/bin/env node
/**
 * فحص اتصال قاعدة البيانات (Supabase) من جهازك.
 * الاستخدام: node scripts/check-supabase.mjs
 *
 * يقرأ المتغيّرات من .env ثم .env.local ثم متغيّرات النظام.
 * لا يطبع أي مفتاح — يعرض فقط: متصل / غير متصل + سبب المشكلة.
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
const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY || '';

const ok = s => `\x1b[32m${s}\x1b[0m`;
const bad = s => `\x1b[31m${s}\x1b[0m`;
const warn = s => `\x1b[33m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;

console.log('🔌 فحص قاعدة البيانات (Supabase)\n');

if (!url || !key) {
  console.log(bad('✗ غير مُهيّأة بعد.'));
  console.log('  ضع في ملف .env داخل مجلد المشروع سطرين:');
  console.log('    SUPABASE_URL=https://xxxx.supabase.co');
  console.log('    SUPABASE_SERVICE_ROLE_KEY=eyJ...');
  process.exit(1);
}

console.log('العنوان:', url.replace(/\/\/([^.]+)\./, '//$1.').slice(0, 48) + '…');
console.log('المفتاح: موجود (' + key.length + ' حرفًا)');
console.log(dim('  نوع المفتاح: ' + (key.startsWith('sb_secret_') ? 'secret (جديد)' : key.startsWith('eyJ') ? 'service_role (JWT)' : 'غير معروف')) + '\n');

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function probe(label, pathname, required = true) {
  try {
    const res = await fetch(`${url}/rest/v1${pathname}`, { headers });
    const text = await res.text();
    if (res.ok) {
      console.log(`${ok('✓')} ${label}`);
      return true;
    }
    const msg = (() => { try { return JSON.parse(text).message; } catch { return text.slice(0, 120); } })();
    if (res.status === 404) {
      console.log(`${warn('•')} ${label} — الجدول غير موجود. نفّذ ملف supabase/schema.sql في SQL Editor.`);
    } else if (res.status === 401 || res.status === 403) {
      console.log(`${bad('✗')} ${label} — المفتاح مرفوض (${res.status}). تأكد أنه service_role وليس anon.`);
    } else {
      console.log(`${bad('✗')} ${label} — ${res.status}: ${msg}`);
    }
    return false;
  } catch (err) {
    console.log(`${bad('✗')} ${label} — تعذّر الاتصال: ${err.message}`);
    return false;
  }
}

const keysOk = await probe('جدول المفاتيح fysh_api_keys', '/fysh_api_keys?select=id&limit=1');
const sessionsOk = await probe('جدول الجلسات fysh_agent_sessions', '/fysh_agent_sessions?select=cache_key&limit=1');
const usageOk = await probe('جدول الاستخدام fysh_key_usage', '/fysh_key_usage?select=id&limit=1');

// هل الجداول محمية من الوصول العام؟ (اختبار بمفتاح anon غير ممكن هنا، لكن نطبع تذكيرًا)
console.log('');
if (keysOk && sessionsOk && usageOk) {
  console.log(ok('✓ القاعدة جاهزة تمامًا.'));
  console.log('  أعد تشغيل السيرفر ثم تحقّق من ظهور: [STORAGE] loaded N keys from Supabase');
} else {
  console.log(warn('لم تكتمل التهيئة بعد — راجع الرسائل أعلاه.'));
  process.exit(1);
}
