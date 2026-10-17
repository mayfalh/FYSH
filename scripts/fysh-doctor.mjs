#!/usr/bin/env node
/**
 * FYSH Doctor — فحص شامل لربط التطبيقات عبر Composio
 *
 * الاستخدام:
 *   node scripts/fysh-doctor.mjs                                  فحص عام (المفتاح + الإعدادات + كل الحسابات)
 *   node scripts/fysh-doctor.mjs --user <معرّف المستخدم>           فحص مستخدم معيّن ومساحات معرّفاته
 *   node scripts/fysh-doctor.mjs --user <uid> --cleanup            حذف المحاولات المهجورة (منتهية/معلّقة)
 *   node scripts/fysh-doctor.mjs --user <uid> --link notion        اختبار إنشاء رابط ربط حقيقي
 *
 * يقرأ المفتاح من متغيّرات البيئة أو من .env.local ثم .env في مجلد المشروع.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://backend.composio.dev/api/v3.1';
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(name);

/* ------------------------------------------------------------------ */
/* تحميل المفتاح                                                       */
/* ------------------------------------------------------------------ */
function readEnvFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

const cwd = process.cwd();
const env = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};
const projectKey = (env.COMPOSIO_API_KEY || '').trim();

const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

if (!projectKey) {
  console.error(bad('✗ لم أجد مفتاح Composio.'));
  console.error('  ضع COMPOSIO_API_KEY في ملف .env أو .env.local في جذر المشروع.');
  process.exit(1);
}

async function call(method, urlPath, body) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { 'x-api-key': projectKey, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* صفحة خطأ غير JSON */ }
  return { status: res.status, json, text };
}

const raw = (id) => (id || '').replace(/^fish_user_/, '');
const candidateIds = (id) => {
  const base = raw(id);
  return [...new Set([`fish_user_${base}`, base, `user_${base}`])];
};

console.log('🩺 فحص منصة فيش — طبقة الربط Composio');
console.log(`   المفتاح: ${projectKey.slice(0, 4)}… (${projectKey.length} حرفًا)\n`);

/* ------------------------------------------------------------------ */
/* 1) المفتاح                                                          */
/* ------------------------------------------------------------------ */
console.log('1) التحقق من المفتاح');
const toolkits = await call('GET', '/toolkits?limit=1');
if (toolkits.status !== 200) {
  console.error(`   ${bad('✗ المفتاح مرفوض')} (HTTP ${toolkits.status}): ${toolkits.json?.message || toolkits.text.slice(0, 120)}`);
  process.exit(1);
}
console.log(`   ${ok('✓ المفتاح صالح')} — عدد التطبيقات المتاحة: ${toolkits.json?.total_items ?? '؟'}`);

/* ------------------------------------------------------------------ */
/* 2) إعدادات الربط (auth configs)                                      */
/* ------------------------------------------------------------------ */
console.log('\n2) إعدادات المصادقة (Auth Configs)');
const configs = await call('GET', '/auth_configs?limit=200');
const configItems = configs.json?.items || [];
console.log(`   العدد: ${configItems.length}`);
for (const c of configItems) {
  const slug = c.toolkit?.slug || c.toolkit_slug || '؟';
  const enabled = c.is_enabled_for_tool_router === false ? warn('غير مفعّل للجلسات') : ok('مفعّل');
  console.log(`   - ${slug.padEnd(18)} ${c.status || ''} ${dim(c.id)} ${enabled}`);
}
if (configItems.length === 0) {
  console.log(dim('   (لا يوجد أي إعداد بعد — سيُنشأ تلقائيًا عند أول عملية ربط)'));
}

/* ------------------------------------------------------------------ */
/* 3) كل الحسابات المرتبطة                                              */
/* ------------------------------------------------------------------ */
console.log('\n3) الحسابات المرتبطة في المشروع');
const accounts = await call('GET', '/connected_accounts?limit=100');
const items = accounts.json?.items || [];
const byUser = new Map();
for (const a of items) {
  const uid = a.user_id || a.userId || '؟';
  if (!byUser.has(uid)) byUser.set(uid, []);
  byUser.get(uid).push(a);
}
const active = items.filter((a) => ['ACTIVE', 'CONNECTED'].includes(String(a.status || '').toUpperCase()));
const stale = items.filter((a) => ['EXPIRED', 'FAILED', 'INITIALIZING', 'INITIATED'].includes(String(a.status || '').toUpperCase()));
console.log(`   الإجمالي: ${items.length} | نشطة: ${ok(active.length)} | تحتاج إعادة ربط أو مهجورة: ${warn(stale.length)}`);
for (const [uid, list] of byUser) {
  const legacy = /^fish_user_/.test(uid) ? '' : warn('  ← معرّف قديم بدون بادئة fish_user_');
  console.log(`\n   المستخدم: ${uid}${legacy}`);
  for (const a of list) {
    const slug = a.toolkit?.slug || a.toolkit_slug || '؟';
    const s = String(a.status || '').toUpperCase();
    const mark = ['ACTIVE', 'CONNECTED'].includes(s) ? ok('ACTIVE') : warn(s);
    const reason = a.status_reason ? dim(` (${a.status_reason})`) : '';
    console.log(`     - ${slug.padEnd(16)} ${mark}${reason} ${dim(a.id)}`);
  }
}

/* ------------------------------------------------------------------ */
/* 4) فحص مستخدم معيّن                                                  */
/* ------------------------------------------------------------------ */
const userId = flag('--user');
if (userId) {
  console.log(`\n4) فحص المستخدم: ${userId}`);
  const ids = candidateIds(userId);
  console.log(`   المساحات المفحوصة: ${ids.join(' , ')}`);
  const userAccounts = await call('GET', `/connected_accounts?user_ids=${encodeURIComponent(ids.join(','))}`);
  const list = userAccounts.json?.items || [];
  if (list.length === 0) {
    console.log(`   ${warn('لا توجد أي روابط لهذا المستخدم')} — إن كان مرتبطًا سابقًا فتأكد من صحة المعرّف.`);
  } else {
    console.log(`   وجدت ${ok(list.length)} رابطًا:`);
    for (const a of list) {
      const slug = a.toolkit?.slug || a.toolkit_slug || '؟';
      const s = String(a.status || '').toUpperCase();
      const mark = ['ACTIVE', 'CONNECTED'].includes(s) ? ok('ACTIVE') : warn(s);
      console.log(`     - ${slug.padEnd(16)} ${mark}  المعرّف المستخدم في Composio: ${a.user_id}`);
    }
    const namespaces = [...new Set(list.map((a) => a.user_id))];
    if (namespaces.some((n) => !/^fish_user_/.test(n))) {
      console.log(`   ${ok('✓ الطبقة الجديدة تقرأ هذه المساحات تلقائيًا')} — لن تختفي هذه الروابط من الواجهة.`);
    }
  }

  if (has('--cleanup')) {
    console.log('\n   تنظيف المحاولات المهجورة…');
    const doomed = list.filter((a) => ['EXPIRED', 'FAILED', 'INITIALIZING', 'INITIATED'].includes(String(a.status || '').toUpperCase()));
    if (doomed.length === 0) console.log(dim('   لا شيء للحذف.'));
    for (const a of doomed) {
      const del = await call('DELETE', `/connected_accounts/${a.id}`);
      console.log(`   ${del.status < 300 ? ok('حُذف') : bad('فشل')} ${a.toolkit?.slug || ''} ${a.id}`);
    }
  }

  const toolkit = flag('--link');
  if (toolkit) {
    console.log(`\n   اختبار إنشاء رابط ربط لـ ${toolkit}…`);
    const cfg = await call('GET', '/auth_configs?limit=200');
    const slugNorm = toolkit.toLowerCase().replace(/[-_]/g, '');
    const match = (cfg.json?.items || []).find(
      (c) => String(c.toolkit?.slug || '').toLowerCase().replace(/[-_]/g, '') === slugNorm && c.status === 'ENABLED'
    );
    if (!match) {
      console.log(`   ${warn('لا يوجد إعداد مصادقة لهذا التطبيق')} — أنشئ واحدًا من لوحة Composio أو من الواجهة.`);
    } else {
      const link = await call('POST', '/connected_accounts/link', {
        auth_config_id: match.id,
        user_id: `fish_user_${raw(userId)}`,
      });
      if (link.status < 300) {
        console.log(`   ${ok('✓ نجح إنشاء الرابط')}: ${link.json?.redirect_url}`);
        console.log(dim(`   (حساب مؤقت ${link.json?.connected_account_id} — احذفه بالخيار --cleanup إن لم تُكمل الربط)`));
      } else {
        console.log(`   ${bad('✗ فشل')} (HTTP ${link.status}): ${link.json?.message || link.text.slice(0, 200)}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 5) الخلاصة                                                          */
/* ------------------------------------------------------------------ */
console.log('\n5) الخلاصة');
const problems = [];
if (configItems.length === 0) problems.push('لا توجد إعدادات مصادقة — ستُنشأ تلقائيًا عند أول ربط.');
if (items.length === 0) problems.push('لا توجد أي حسابات مرتبطة في المشروع بعد.');
if (accounts.status !== 200) problems.push(`قراءة الحسابات رجعت HTTP ${accounts.status}.`);
if (stale.length > 0) problems.push(`يوجد ${stale.length} حسابًا منتهيًا أو معلّقًا — شغّل --cleanup لتنظيفها.`);
const legacyNamespaces = [...byUser.keys()].filter((u) => !/^fish_user_/.test(u));
if (legacyNamespaces.length > 0) {
  problems.push(
    `يوجد ${legacyNamespaces.length} مساحة معرّفات قديمة (بدون بادئة fish_user_) — الطبقة الجديدة تقرأها، فلا حاجة لتعديلها.`
  );
}
if (problems.length === 0) {
  console.log(`   ${ok('✓ كل شيء سليم: المفتاح يعمل، الإعدادات موجودة، والحسابات مرتبة.')}`);
} else {
  problems.forEach((p) => console.log(`   ${warn('•')} ${p}`));
}
console.log(dim('\nملاحظة: هذا الفحص للقراءة فقط، ولا يعدّل شيئًا إلا مع --cleanup أو --link.'));
