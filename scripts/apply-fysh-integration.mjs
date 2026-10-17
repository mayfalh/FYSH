#!/usr/bin/env node
/**
 * FYSH — تفعيل ربط التطبيقات (دمج طبقة Composio الموحّدة في server.ts)
 *
 * الاستخدام:
 *   node scripts/apply-fysh-integration.mjs            # يطبّق التعديلات
 *   node scripts/apply-fysh-integration.mjs --check    # يعرض ما سيغيّر فقط
 *   node scripts/apply-fysh-integration.mjs --revert   # يرجّع آخر نسخة احتياطية
 *
 * المبدأ: كل تعديل له نمط بحث دقيق متوقع العدد؛ إن اختلف أي نمط يفشل السكربت
 * دون كتابة أي شيء (لا تعديل جزئي). يُنشئ نسخة احتياطية server.ts.bak-<وقت>.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const REVERT = args.includes('--revert');

const root = process.cwd();
const serverPath = path.join(root, 'server.ts');
const modulePath = path.join(root, 'serverComposio.ts');

if (!fs.existsSync(serverPath)) {
  console.error('لم أجد server.ts في المجلد الحالي. شغّل السكربت من جذر المشروع.');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* الرجوع لآخر نسخة احتياطية                                            */
/* ------------------------------------------------------------------ */
if (REVERT) {
  const backups = fs
    .readdirSync(root)
    .filter(f => /^server\.ts\.bak-/.test(f))
    .sort();
  if (backups.length === 0) {
    console.error('لا توجد نسخة احتياطية للرجوع إليها.');
    process.exit(1);
  }
  const latest = backups[backups.length - 1];
  fs.copyFileSync(path.join(root, latest), serverPath);
  console.log(`تم الرجوع إلى النسخة الاحتياطية: ${latest}`);
  process.exit(0);
}

if (!fs.existsSync(modulePath)) {
  console.error(
    'ملف serverComposio.ts غير موجود. انسخه إلى جذر المشروع بجوار server.ts ثم أعد المحاولة.'
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* التعديلات                                                          */
/* ------------------------------------------------------------------ */

const UNIFIED_HELPERS = `  return composioClient;
}

/* ------------------------------------------------------------------ */
/* Unified connection loading                                           */
/* ------------------------------------------------------------------ */

/**
 * كل الروابط التي تخص هذا المستخدم: المعرّف القياسي أولًا ثم المساحات القديمة
 * التي كتبت فيها الإصدارات السابقة (بلا بادئة fish_user_). لا يرمي أبدًا.
 */
export async function loadUserConnectionsSafe(rawUserId: string): Promise<UserAccountsResult> {
  try {
    const projectKey = envComposioApiKey();
    if (!projectKey) throw new Error("Composio project key is missing on the server");
    return await fetchConnectedAccountsForUser(projectKey, rawUserId);
  } catch (err: any) {
    console.warn("[COMPOSIO] connection lookup failed:", err?.message);
    return {
      canonicalUserId: canonicalFishUserId(rawUserId),
      candidates: candidateFishUserIds(rawUserId),
      accounts: [],
      active: [],
      needsReconnect: [],
    };
  }
}

/** صلاحيات التطبيقات النشطة بصيغة Composio القياسية. */
export function activeToolkitSlugs(accounts: NormalizedAccount[]): string[] {
  return Array.from(
    new Set(
      accounts
        .filter(a => a.isActive)
        .map(a => mapToolkitToComposioSlug(a.toolkitSlug))
        .filter(Boolean)
    )
  );
}

/** أول حساب نشط لتطبيق معيّن (أو null). */
export function findActiveAccount(
  accounts: NormalizedAccount[],
  toolkitSlug: string
): NormalizedAccount | null {
  const wanted = mapToolkitToComposioSlug(toolkitSlug);
  return accounts.find(a => a.isActive && mapToolkitToComposioSlug(a.toolkitSlug) === wanted) || null;
}
`;

const NEW_LIST_ROUTE = `// Get connected accounts for a specific FYSH user
// يقرأ القائمة من كل مساحات المعرّفات (القياسية والقديمة) حتى لا تختفي روابط المستخدم.
app.get("/api/composio/connectedAccounts", async (req, res) => {
  try {
    const rawUserId = (req.query.fishUserId || req.query.userId || req.query.uid) as string;
    const projectKey = envComposioApiKey();
    if (!rawUserId || !projectKey) {
      return res.json({ accounts: [], active: [], needsReconnect: [], candidates: [] });
    }

    const connections = await fetchConnectedAccountsForUser(projectKey, rawUserId);

    // نفس شكل الاستجابة القديم + حقول إضافية تفهمها الواجهة الجديدة.
    const accounts = connections.accounts.map(a => ({
      id: a.id,
      toolkit: a.toolkitSlug,
      toolkitSlug: a.toolkitSlug,
      appName: a.toolkitName,
      logo: a.logo,
      authScheme: a.authScheme,
      status: a.status,
      userId: a.userId,
      alias: a.alias,
      createdAt: a.createdAt,
      statusReason: a.statusReason,
      needsReconnect: a.needsReconnect,
      isActive: a.isActive,
    }));

    res.json({
      accounts,
      active: accounts.filter(a => a.isActive),
      needsReconnect: accounts.filter(a => a.needsReconnect),
      canonicalUserId: connections.canonicalUserId,
      candidates: connections.candidates,
    });
  } catch (error: any) {
    console.warn("[COMPOSIO] Failed to list connected accounts:", error?.message);
    res.json({ accounts: [], active: [], needsReconnect: [], candidates: [] });
  }
});

// تشخيص شامل لحالة التكامل (بدون كشف أي مفتاح)
app.get("/api/composio/diagnostics", async (req, res) => {
  try {
    const projectKey = envComposioApiKey();
    const rawUserId = (req.query.fishUserId || req.query.userId || "") as string;
    const report = await runDiagnostics(projectKey, rawUserId || undefined);
    res.json({
      ...report,
      authConfigs: report.authConfigs.map(c => ({
        id: c.id,
        toolkit: c.toolkitSlug,
        name: c.name,
        status: c.status,
        authScheme: c.authScheme,
        enabledForSessions: c.isEnabledForToolRouter !== false,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "diagnostics failed" });
  }
});

// تنظيف المحاولات المهجورة (منتهية/معلّقة) لمستخدم معيّن
app.post("/api/composio/cleanup", async (req, res) => {
  try {
    const projectKey = envComposioApiKey();
    const rawUserId = (req.body?.fishUserId || req.body?.userId || "") as string;
    if (!projectKey) return res.status(500).json({ success: false, error: "Composio is not configured" });
    if (!rawUserId) return res.status(400).json({ success: false, error: "fishUserId is required" });
    const result = await cleanupAbandonedAccounts(projectKey, rawUserId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "cleanup failed" });
  }
});
`;

const NEW_CONNECT_ROUTE = `// Connect endpoint: يحلّ auth config عبر v3.1 وينشئ رابط ربط (Connect Link)
app.post("/api/composio/connect", rateLimit(60_000, 20), async (req, res) => {
  try {
    const rawUserId = req.body.googleUid || req.body.fishUserId || req.body.userId;
    if (!rawUserId) {
      return res.status(400).json({ success: false, error: "fishUserId is required" });
    }

    const projectKey = envComposioApiKey();
    if (!projectKey) {
      return res.status(500).json({ success: false, error: "Composio is not configured on the server" });
    }

    const canonicalUserId = canonicalFishUserId(rawUserId);

    // استخراج مُعرِّف التطبيق من أي حقل يرسله العميل
    const rawSlug = (
      req.body.toolkitSlug ||
      req.body.toolkitId ||
      req.body.appSlug ||
      req.body.slug ||
      req.body.id ||
      req.body.appName ||
      ''
    ).toString().trim();

    if (!rawSlug) {
      return res.status(400).json({ success: false, error: "Toolkit slug or app ID is required" });
    }

    const toolkitSlug = mapToolkitToComposioSlug(rawSlug);

    // رابط العودة: env صريح ثم رؤوس البروكسي ثم المضيف الحالي
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const isHttps = proto === 'https' || (!host.includes('localhost') && !host.includes('127.0.0.1'));
    const baseUrl = (process.env.APP_BASE_URL || '').replace(/\\/$/, '') || \`\${isHttps ? 'https' : 'http'}://\${host}\`;
    const callbackUrl = req.body.callbackUrl || \`\${baseUrl}/api/composio/callback\`;

    console.log(\`[COMPOSIO] connect toolkit=\${toolkitSlug} (raw: \${rawSlug}) user=\${canonicalUserId} callback=\${callbackUrl}\`);

    // إعادة استخدام رابط نشط بدل إنشاء حساب مكرر
    if (!req.body.force) {
      try {
        const existing = await fetchConnectedAccountsForUser(projectKey, canonicalUserId);
        const already = findActiveAccount(existing.accounts, toolkitSlug);
        if (already) {
          return res.json({
            success: true,
            alreadyConnected: true,
            connectedAccountId: already.id,
            account: { id: already.id, toolkit: already.toolkitSlug, status: already.status },
            composioUserId: canonicalUserId,
            toolkitSlug,
          });
        }
      } catch (lookupErr: any) {
        console.warn("[COMPOSIO] existing-account check skipped:", lookupErr?.message);
      }
    }

    // المسار الرسمي: Connect Link عبر v3.1
    try {
      const link = await createConnectLink(projectKey, {
        userId: canonicalUserId,
        toolkitSlug,
        callbackUrl,
        alias: req.body.alias,
        log: (m) => console.log(m),
      });
      return res.json({
        success: true,
        redirectUrl: link.redirectUrl,
        connectedAccountId: link.connectedAccountId,
        authConfigId: link.authConfigId,
        composioUserId: canonicalUserId,
        toolkitSlug,
      });
    } catch (linkErr: any) {
      console.warn(\`[COMPOSIO] link creation failed for \${toolkitSlug}: \${linkErr?.message}\`);
      if (linkErr instanceof ComposioApiError && [400, 404, 422].includes(linkErr.status)) {
        return res.status(linkErr.status).json({
          success: false,
          error: \`تعذّر تجهيز الربط لـ \${toolkitSlug}: \${linkErr.message}\`,
          detail: linkErr.body ?? null,
          toolkitSlug,
        });
      }
    }

    // احتياطي: جلسة SDK مع نفس المعرّف القياسي (يتجنّب الازدواج)
    try {
      const composio = getComposio();
      const session = await composio.create(canonicalUserId, {
        mcp: true,
        manageConnections: { callbackUrl }
      });
      const request: any = await session.authorize(toolkitSlug, { callbackUrl });
      const redirectUrl = request?.redirectUrl || request?.url;
      if (redirectUrl) {
        return res.json({
          success: true,
          redirectUrl,
          connectedAccountId: request?.connectedAccountId || request?.id,
          composioUserId: canonicalUserId,
          toolkitSlug,
        });
      }
    } catch (sdkErr: any) {
      console.error(\`[COMPOSIO] SDK authorize failed for \${toolkitSlug}:\`, sdkErr?.message);
      return res.status(500).json({
        success: false,
        error: \`تعذّر بدء الربط لـ \${toolkitSlug}: \${sdkErr?.message || 'unknown error'}\`,
        toolkitSlug,
      });
    }

    return res.status(500).json({
      success: false,
      error: \`تعذّر بدء الربط لـ \${toolkitSlug}. تحقّق من حالة التكامل في Composio.\`,
      toolkitSlug,
    });
  } catch (error: any) {
    console.error("[COMPOSIO] connect error:", error?.message);
    res.status(500).json({ success: false, error: error?.message || "Failed to initiate connection" });
  }
});
`;

const NEW_VERIFY_ROUTE = `// Verify connection endpoint: يعتبر الحساب متصلًا فقط عندما يكون ACTIVE
app.post("/api/composio/verify", async (req, res) => {
  try {
    const { toolkitSlug, connectedAccountId } = req.body;
    const rawUserId = req.body.googleUid || req.body.fishUserId || req.body.userId;
    if (!rawUserId) {
      return res.status(400).json({ error: "fishUserId is required" });
    }

    const projectKey = envComposioApiKey();
    if (!projectKey) {
      return res.json({ status: "DISCONNECTED", active: false });
    }

    const toolkit = mapToolkitToComposioSlug(toolkitSlug || '');
    console.log(\`[COMPOSIO] verify toolkit=\${toolkit} account=\${connectedAccountId || 'by-user'}\`);

    if (connectedAccountId) {
      const direct = await getConnectedAccount(projectKey, connectedAccountId).catch(() => null);
      if (direct) {
        return res.json({
          status: direct.status,
          active: direct.isActive,
          needsReconnect: direct.needsReconnect,
          statusReason: direct.statusReason,
          account: direct.raw,
        });
      }
    }

    const connections = await fetchConnectedAccountsForUser(projectKey, rawUserId);
    const match =
      connections.accounts.find(a => a.isActive && (!toolkit || mapToolkitToComposioSlug(a.toolkitSlug) === toolkit)) ||
      connections.accounts.find(a => !toolkit || mapToolkitToComposioSlug(a.toolkitSlug) === toolkit);

    if (!match) {
      return res.json({ status: "DISCONNECTED", active: false, needsReconnect: false });
    }
    return res.json({
      status: match.status,
      active: match.isActive,
      needsReconnect: match.needsReconnect,
      statusReason: match.statusReason,
      account: match.raw,
    });
  } catch (error: any) {
    console.error("[COMPOSIO] verify error:", error?.message);
    res.status(500).json({ error: error?.message, active: false });
  }
});
`;

const NEW_DISCONNECT_ROUTE = `// Disconnect account: حذف حقيقي من Composio
app.delete("/api/composio/disconnect", async (req, res) => {
  try {
    const { connectedAccountId, toolkitSlug } = req.body;
    const rawUserId = req.body.googleUid || req.body.fishUserId || req.body.userId;
    const projectKey = envComposioApiKey();

    if (!projectKey) {
      return res.status(500).json({ success: false, error: "Composio is not configured" });
    }

    let targetAccountId = connectedAccountId;

    if (!targetAccountId && rawUserId && toolkitSlug) {
      const toolkit = mapToolkitToComposioSlug(toolkitSlug);
      const connections = await fetchConnectedAccountsForUser(projectKey, rawUserId);
      const match = connections.accounts.find(a => mapToolkitToComposioSlug(a.toolkitSlug) === toolkit);
      if (match) targetAccountId = match.id;
    }

    if (!targetAccountId) {
      return res.status(400).json({ success: false, error: "connectedAccountId or (fishUserId + toolkitSlug) required" });
    }

    await deleteConnectedAccount(projectKey, targetAccountId);
    console.log(\`[COMPOSIO] disconnected account \${targetAccountId}\`);
    res.json({ success: true, disconnectedId: targetAccountId });
  } catch (error: any) {
    console.error("[COMPOSIO] disconnect error:", error?.message);
    res.status(error?.status && error.status < 500 ? error.status : 500).json({
      success: false,
      error: error?.message || "Failed to disconnect account",
    });
  }
});
`;

const NEW_DELETE_BY_ID_ROUTE = `// Legacy delete route compatibility
app.delete("/api/composio/connectedAccounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const projectKey = envComposioApiKey();
    if (projectKey) {
      await deleteConnectedAccount(projectKey, id);
    }
    res.json({ success: true, disconnectedId: id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});
`;

/**
 * كل خطوة: { name, find, replace, count }
 * find/replace نصوص حرفية دقيقة. count = عدد مرات التكرار المتوقع.
 */
const STEPS = [
  {
    name: 'env: load .env.local as well as .env',
    count: 1,
    find: `dotenv.config();`,
    replace: `// تحميل ملفات البيئة: .env.local ثم .env (قيم البيئة الحقيقية لها الأولوية)
dotenv.config({ path: ".env.local" });
dotenv.config();`,
  },
  {
    name: 'imports: serverComposio layer',
    count: 1,
    find: `import { Composio } from "@composio/core";
import { GoogleProvider } from "@composio/google";
import { GoogleGenAI } from "@google/genai";`,
    replace: `import { Composio } from "@composio/core";
import { GoogleProvider } from "@composio/google";
import { GoogleGenAI } from "@google/genai";
import {
  candidateFishUserIds,
  canonicalFishUserId,
  rawFishId,
  fetchConnectedAccountsForUser,
  getConnectedAccount,
  deleteConnectedAccount,
  cleanupAbandonedAccounts,
  createConnectLink,
  resolveAuthConfigId,
  runDiagnostics,
  envComposioApiKey,
  ComposioApiError,
  type NormalizedAccount,
  type UserAccountsResult,
} from "./serverComposio";`,
  },
  {
    name: 'identity: delegate to the shared layer',
    count: 1,
    find: `// --- Unified Fish user ID helper (single source of truth) ---
export function normalizeFishUserId(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith('fish_user_')) return trimmed;
  // If it's a Firebase UID or random id, prefix it
  return \`fish_user_\${trimmed.replace(/^fish_user_/, '')}\`;
}
export function extractGoogleUid(fishUserId: string): string {
  return fishUserId.replace(/^fish_user_/, '');
}`,
    replace: `// --- Unified Fish user ID helper (single source of truth) ---
// الصيغة القياسية fish_user_<raw>، وأي صيغة أخرى (UID خام أو user_*) تُعامل
// كمساحة قديمة يجب أن تبقى قابلة للقراءة حتى لا تختفي روابط المستخدمين.
export function normalizeFishUserId(raw: string): string {
  return canonicalFishUserId(raw);
}
export function extractGoogleUid(fishUserId: string): string {
  return rawFishId(fishUserId);
}`,
  },
  {
    name: 'helpers: unified connection loading',
    count: 1,
    find: `  return composioClient;
}
`,
    replace: UNIFIED_HELPERS,
  },
  {
    name: 'setupFishUserAgent: read connections through the helper',
    count: 1,
    find: `  // Query user's connected accounts to get toolkits
  let activeToolkits: string[] = [];
  try {
    const list: any = await composio.connectedAccounts.list({ userIds: [composioUserId], userUuid: composioUserId } as any);
    const items = list?.items || (Array.isArray(list) ? list : []);
    const active = items.filter((a: any) => a.status === 'ACTIVE' || a.status === 'CONNECTED' || (!a.status && a.id));
    activeToolkits = Array.from(new Set(active.map((a: any) => mapToolkitToComposioSlug(a.toolkit?.slug || a.toolkit || a.app || a.toolkitSlug)).filter(Boolean)));
  } catch (e) {
    console.warn("[setupFishUserAgent] Failed listing connected accounts:", e);
  }
`,
    replace: `  // Query user's connected accounts to get toolkits (canonical + legacy namespaces)
  const connections = await loadUserConnectionsSafe(fishUserId);
  const activeToolkits: string[] = activeToolkitSlugs(connections.accounts);
`,
  },
  {
    name: 'health: real Composio diagnostics',
    count: 1,
    find: `    const composio = getComposio();
    const result: any = await composio.connectedAccounts.list({ userIds: ['test_probe_user'] } as any);
    const statusCode = result?.status || 200;
    console.log("Composio API health check status code:", statusCode);
    return res.json({ valid: true, message: "Composio API Key is working" });`,
    replace: `    const report = await runDiagnostics(envComposioApiKey());
    if (!report.valid) {
      return res.json({ valid: false, message: "Composio rejected the project key", detail: report.reason });
    }
    return res.json({
      valid: true,
      message: "Composio project key is working",
      toolkitCount: report.toolkitCount,
      authConfigCount: report.authConfigs.length,
      checkedAt: report.checkedAt,
    });`,
  },
];

/* ------------------------------------------------------------------ */
/* استبدال المسارات الكاملة (بحث بالعنوان حتى العنوان التالي)             */
/* ------------------------------------------------------------------ */

function replaceRoute(source, { startMarker, endMarker, replacement, name }) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`لم أجد بداية المسار: ${name}`);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error(`لم أجد نهاية المسار: ${name}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const ROUTE_STEPS = [
  {
    name: 'route: /api/composio/connectedAccounts (+ diagnostics/cleanup)',
    startMarker: '// Get connected accounts for a specific FYSH user',
    endMarker: '// Resolve or create Auth Config for a toolkit through the shared v3.1 layer',
    replacement: NEW_LIST_ROUTE + '\n',
  },
  {
    name: 'route: /api/composio/connect',
    startMarker: '// Connect endpoint: Resolves Auth Config and creates a Composio Connect Link',
    endMarker: '// Verify connection endpoint to check if an account is strictly ACTIVE',
    replacement: NEW_CONNECT_ROUTE + '\n',
  },
  {
    name: 'route: /api/composio/verify',
    startMarker: '// Verify connection endpoint to check if an account is strictly ACTIVE',
    endMarker: '// Disconnect account: Real deletion on Composio backend',
    replacement: NEW_VERIFY_ROUTE + '\n',
  },
  {
    name: 'route: /api/composio/disconnect',
    startMarker: '// Disconnect account: Real deletion on Composio backend',
    endMarker: '// OAuth Callback route for Composio',
    replacement: NEW_DISCONNECT_ROUTE + '\n',
  },
  {
    name: 'route: DELETE /api/composio/connectedAccounts/:id',
    startMarker: '// Legacy delete route compatibility',
    endMarker: '// Helper: Safe structured error response for agents',
    replacement: NEW_DELETE_BY_ID_ROUTE + '\n',
  },
];

/* ------------------------------------------------------------------ */
/* التنفيذ                                                            */
/* ------------------------------------------------------------------ */

let source = fs.readFileSync(serverPath, 'utf8');

if (source.includes('from "./serverComposio"')) {
  console.log('التكامل مطبَّق مسبقًا على server.ts — لا شيء للتنفيذ.');
  process.exit(0);
}

const problems = [];

// 1) طبقة resolveComposioAuthConfig القديمة تُستبدل بمناداة الطبقة الجديدة
{
  const startMarker = '// Resolve or create Auth Config for any toolkit slug with strict slug and status matching';
  const endMarker = '// Connect endpoint: Resolves Auth Config and creates a Composio Connect Link';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    problems.push('طبقة auth config القديمة (resolveComposioAuthConfig)');
  } else {
    const replacement = `// Resolve or create Auth Config for a toolkit through the shared v3.1 layer
async function resolveComposioAuthConfig(toolkitSlug: string, projectKey: string): Promise<string> {
  return resolveAuthConfigId(projectKey, mapToolkitToComposioSlug(toolkitSlug), (m) => console.log(m));
}

`;
    source = source.slice(0, start) + replacement + source.slice(end);
  }
}

// 2) بقية الخطوات النصية
for (const step of STEPS) {
  const occurrences = source.split(step.find).length - 1;
  if (occurrences !== step.count) {
    problems.push(`${step.name} (وجدت ${occurrences} مطابقة، المتوقع ${step.count})`);
    continue;
  }
  source = source.replace(step.find, step.replace);
}

// 3) المسارات الكاملة
for (const step of ROUTE_STEPS) {
  try {
    source = replaceRoute(source, step);
  } catch (err) {
    problems.push(`${step.name} — ${err.message}`);
  }
}

if (problems.length > 0) {
  console.error('فشل الدمج، لم أكتب أي تغيير. المشاكل:');
  problems.forEach(p => console.error(' - ' + p));
  console.error(
    '\nغالبًا ملف server.ts تغيّر عن النسخة التي بُني عليها هذا السكربت. أرسل لي الملف لأحدّث الأنماط.'
  );
  process.exit(1);
}

// 4) تصحيح البادئة المزدوجة في بقية المسارات (fish_user_fish_user_)
const doublePrefixFixed = [
  ['const composioUserId = `fish_user_${fishUserId}`;', 'const composioUserId = canonicalFishUserId(fishUserId);'],
  ['const composioUserId = `fish_user_${resolvedUserId}`;', 'const composioUserId = canonicalFishUserId(resolvedUserId);'],
  ['const composioUserId = `fish_user_${googleUid}`;', 'const composioUserId = canonicalFishUserId(googleUid);'],
];

if (CHECK_ONLY) {
  console.log('وضع الفحص: كل الأنماط متطابقة، التعديلات جاهزة للتطبيق.');
  console.log(`عدد إصلاحات البادئة المزدوجة المتاحة: ${doublePrefixFixed.filter(([f]) => source.includes(f)).length}`);
  process.exit(0);
}

let prefixFixed = 0;
for (const [find, replace] of doublePrefixFixed) {
  const count = source.split(find).length - 1;
  if (count > 0) {
    source = source.split(find).join(replace);
    prefixFixed += count;
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `${serverPath}.bak-${stamp}`;
fs.copyFileSync(serverPath, backupPath);
fs.writeFileSync(serverPath, source, 'utf8');

console.log('تم دمج طبقة Composio الموحّدة في server.ts بنجاح.');
console.log(`النسخة الاحتياطية: ${path.basename(backupPath)}`);
console.log(`عدد مسارات البادئة المزدوجة المُصلَحة: ${prefixFixed}`);
console.log('\nالخطوة التالية:');
console.log('  1) npm run lint     (فحص الأنواع)');
console.log('  2) npm run dev      ثم افتح http://localhost:3000/apps واختبر الربط');
console.log('  3) node scripts/fysh-doctor.mjs   (فحص المفاتيح والحسابات)');
