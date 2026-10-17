#!/usr/bin/env node
/**
 * ترحيل مفاتيح فيش من ملف JSON المحلي إلى Supabase (مرة واحدة).
 *
 * - يقرأ data/fysh_keys.json
 * - يشفّر كل مفتاح AES-256-GCM بنفس صيغة السيرفر (v1:iv:tag:cipher)
 * - يرفعها إلى جدول fysh_api_keys مع بصمة SHA-256
 * - لا يطبع أي مفتاح، فقط العدد والنتيجة
 *
 * الاستخدام: node scripts/migrate-keys-to-supabase.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const cwd = process.cwd();
const dry = process.argv.includes('--dry');

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
const env = { ...readEnv(path.join(cwd, '.env')), ...readEnv(path.join(cwd, '.env.local')), ...process.env };
const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !serviceKey) {
  console.error('✗ SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجود في .env');
  process.exit(1);
}

/* مفتاح التشفير: نفس مسار السيرفر */
function encryptionKey() {
  if (env.FYSH_ENCRYPTION_KEY) {
    const raw = env.FYSH_ENCRYPTION_KEY;
    return /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  }
  const file = path.join(cwd, 'data', '.fysh-store-key');
  if (fs.existsSync(file)) {
    const buf = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
    if (buf.length === 32) return buf;
  }
  const fresh = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, fresh.toString('base64'), { mode: 0o600 });
  console.log('أُنشئ مفتاح تشفير جديد في data/.fysh-store-key — احتفظ به.');
  return fresh;
}
const keyBuf = encryptionKey();
const seal = plain => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
};
const digest = plain => crypto.createHash('sha256').update(plain).digest('hex');

const filePath = path.join(cwd, 'data', 'fysh_keys.json');
if (!fs.existsSync(filePath)) {
  console.log('لا يوجد ملف مفاتيح محلي — لا شيء للترحيل (القاعدة تبدأ فارغة).');
  process.exit(0);
}
const keys = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (!Array.isArray(keys) || keys.length === 0) {
  console.log('ملف المفاتيح فارغ — لا شيء للترحيل.');
  process.exit(0);
}

const rows = keys
  .filter(k => k && k.id && k.token)
  .map(k => ({
    id: k.id,
    user_id: k.userId || 'mayalfalh_workspace',
    name: k.name || 'FYSH Key',
    masked: k.maskedToken || 'ak_**',
    access: k.access || 'Full access',
    ip_allowlist: k.ipAllowlist || 'No restriction',
    user_email: k.userEmail || null,
    secret_hash: digest(k.token),
    secret_cipher: seal(k.token),
    status: k.status || 'ACTIVE',
    created_at: k.createdAt && String(k.createdAt).includes('T') ? k.createdAt : new Date().toISOString(),
    last_used_at: k.lastUsedAt || null,
  }));

console.log(`سيتم ترحيل ${rows.length} مفتاحًا${dry ? ' (تجربة فقط)' : ''}.`);
if (dry) process.exit(0);

const res = await fetch(`${url}/rest/v1/fysh_api_keys?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  const t = await res.text();
  console.error('✗ فشل الترحيل:', res.status, t.slice(0, 300));
  process.exit(1);
}
console.log('✓ تم ترحيل المفاتيح وتشفيرها في القاعدة.');
console.log('  (النسخة القديمة في data/fysh_keys.json بقيت كما هي كنسخة احتياطية)');
