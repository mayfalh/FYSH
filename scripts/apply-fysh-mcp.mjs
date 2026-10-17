#!/usr/bin/env node
/**
 * FYSH — المرحلة 2: نقطة MCP حقيقية بمفتاح فيش الموحّد
 *
 * ما تفعله:
 *  1) تجعل /api/agent/mcp يقرأ التطبيقات المرتبطة من كل مساحات المعرّف
 *     (وإلا تظهر القائمة فارغة والوكيل بلا أدوات).
 *  2) تضيف /api/fish/mcp: تتحقق من مفتاح فيش (ak_live_…) ثم تمرّر JSON-RPC
 *     إلى /api/agent/mcp — فيعمل Claude/Cursor بمفتاح واحد فقط.
 *
 * الاستخدام: node scripts/apply-fysh-mcp.mjs [--check] [--revert]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const REVERT = args.includes('--revert');
const root = process.cwd();
const serverPath = path.join(root, 'server.ts');

if (!fs.existsSync(serverPath)) {
  console.error('لم أجد server.ts — شغّل السكربت من جذر المشروع.');
  process.exit(1);
}

if (REVERT) {
  const backups = fs.readdirSync(root).filter(f => /^server\.ts\.bak-/.test(f)).sort();
  if (!backups.length) { console.error('لا توجد نسخة احتياطية.'); process.exit(1); }
  const latest = backups[backups.length - 1];
  fs.copyFileSync(path.join(root, latest), serverPath);
  console.log('تم الرجوع إلى: ' + latest);
  process.exit(0);
}

const MARKER = 'FYSH_AGENT_MCP_V2';

let source = fs.readFileSync(serverPath, 'utf8');
if (source.includes(MARKER)) {
  console.log('المرحلة 2 مطبَّقة مسبقًا — لا شيء للتنفيذ.');
  process.exit(0);
}
if (!source.includes('from "./serverComposio"')) {
  console.error('المرحلة 1 غير مطبَّقة. شغّل أولًا: node scripts/apply-fysh-integration.mjs');
  process.exit(1);
}

const problems = [];

/* ------------------------------------------------------------------ */
/* 1) قراءة تطبيقات الوكيل من كل مساحات المعرّف                          */
/* ------------------------------------------------------------------ */
{
  const find = `    // 2. Fetch user's active connected accounts
    let activeToolkits: string[] = [];
    let activeAccounts: any[] = [];
    try {
      const composio = getComposio();
      const list: any = await composio.connectedAccounts.list({ userIds: [composioUserId], userUuid: composioUserId } as any);
      const items = list?.items || (Array.isArray(list) ? list : []);
      activeAccounts = items.filter((a: any) => a.status === 'ACTIVE' || a.status === 'CONNECTED' || (!a.status && a.id));
      activeToolkits = Array.from(new Set(activeAccounts.map((a: any) => mapToolkitToComposioSlug(a.toolkit?.slug || a.toolkit || a.app || a.toolkitSlug)).filter(Boolean)));
    } catch (err: any) {
      if (!err?.message?.includes('401') && !err?.message?.includes('Invalid API key')) {
        console.warn("[/api/agent/mcp] Connected accounts query notice:", err?.message);
      }
    }`;

  const replace = `    // 2. التطبيقات المرتبطة بكل مساحات المعرّف (القياسية والقديمة)
    const connections = await loadUserConnectionsSafe(googleUid);
    const activeAccounts = connections.active;
    const activeToolkits = activeToolkitSlugs(connections.accounts);`;

  const count = source.split(find).length - 1;
  if (count !== 1) {
    problems.push(`كتلة قراءة تطبيقات الوكيل (وجدت ${count} مطابقة)`);
  } else {
    source = source.replace(find, replace);
  }
}

/* ------------------------------------------------------------------ */
/* 2) إضافة /api/fish/mcp                                              */
/* ------------------------------------------------------------------ */

const KEY_ROUTE = `/* ${MARKER} — نقطة مفتاح فيش الموحّد
   تتحقق من مفتاح ak_live_… ثم تمرّر JSON-RPC إلى /api/agent/mcp،
   فيعمل Claude Desktop وCursor وأي عميل MCP بمفتاح واحد. */

function resolveFishKey(value: string) {
  if (!value) return null;
  const keyId = tokenIndex.get(value);
  const record = keyId ? fyshApiKeysDatabase.get(keyId) : Array.from(fyshApiKeysDatabase.values()).find(k => k.token === value);
  return record && record.status === "ACTIVE" ? record : null;
}

app.all("/api/fish/mcp", rateLimit(60_000, 120), async (req: any, res) => {
  const requestId = req.body?.id ?? null;
  try {
    const rawHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const headerValue = typeof rawHeader === "string" ? rawHeader.replace(/^Bearer\\s+/i, "") : null;
    const incoming = String(req.query?.key || req.query?.apiKey || headerValue || req.body?.apiKey || "").trim();
    const record = resolveFishKey(incoming);
    if (!record) {
      return res.status(401).json({ jsonrpc: "2.0", id: requestId, error: { code: -32001, message: "Invalid or missing FYSH API key" } });
    }

    record.lastUsedAt = new Date().toISOString();
    fyshApiKeysDatabase.set(record.id, record);
    persistKeysToDisk();

    const connections = await loadUserConnectionsSafe(record.userId);
    const toolkits = activeToolkitSlugs(connections.accounts);
    const base = \`\${req.get("x-forwarded-proto") || req.protocol}://\${req.get("x-forwarded-host") || req.get("host")}\`;
    const selfUrl = \`\${base}/api/fish/mcp?key=\${incoming}\`;
    const agentUrl = \`\${base}/api/agent/mcp?userId=\${encodeURIComponent(rawFishId(record.userId))}\`;

    if (req.method === "GET") {
      return res.json({
        protocol: "mcp",
        transport: "http-sse",
        status: toolkits.length > 0 ? "ready" : "no_connections",
        keyName: record.name,
        fyshUserId: rawFishId(record.userId),
        connectedToolkits: toolkits,
        connectedCount: connections.active.length,
        mcpUrl: selfUrl,
        usage: {
          claude_desktop: {
            file: "claude_desktop_config.json",
            snippet: { mcpServers: { fysh: { type: "http", url: selfUrl } } },
          },
          cursor: { step: "Settings → MCP → Add new MCP server (type: http)", url: selfUrl },
          chatgpt_connector: { type: "MCP (streamable HTTP)", url: selfUrl },
          test: \`curl -X POST "\${selfUrl}" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'\`,
        },
      });
    }

    if (toolkits.length === 0) {
      return res.json({
        jsonrpc: "2.0",
        id: requestId,
        error: { code: -32002, message: "No connected apps for this FYSH key. Connect an app in /apps first." },
      });
    }

    const upstream = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": String(req.headers["accept"] || "application/json, text/event-stream"),
      },
      body: JSON.stringify(req.body || {}),
    });

    const upstreamType = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status);
    res.setHeader("Content-Type", upstreamType);
    if (upstreamType.includes("text/event-stream")) res.setHeader("Cache-Control", "no-cache");
    console.log(\`[FYSH_MCP] method=\${req.body?.method} status=\${upstream.status} user=\${rawFishId(record.userId)} toolkits=\${toolkits.length}\`);
    return res.send(await upstream.text());
  } catch (error: any) {
    console.error("[/api/fish/mcp] error:", error?.message);
    return res.status(500).json({ jsonrpc: "2.0", id: requestId, error: { code: -32603, message: error?.message || "MCP proxy failed" } });
  }
});

`;

{
  const startMarker = '// 4b. MCP Universal Endpoint';
  const endMarker = '// 5. Universal Execution via Single FYSH API Key';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    problems.push('نطاق /api/fish/mcp القديم (لم أجد بدايته أو نهايته)');
  } else {
    source = source.slice(0, start) + KEY_ROUTE + source.slice(end);
  }
}

if (problems.length > 0) {
  console.error('فشل، لم أكتب أي تغيير:');
  problems.forEach(p => console.error(' - ' + p));
  process.exit(1);
}

if (CHECK_ONLY) {
  console.log('وضع الفحص: الأنماط متطابقة، جاهز للتطبيق.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(serverPath, `${serverPath}.bak-${stamp}`);
fs.writeFileSync(serverPath, source, 'utf8');
console.log('تمت إضافة نقطة MCP الحقيقية (/api/fish/mcp) وربطها بقراءة التطبيقات الموحّدة.');
console.log('النسخة الاحتياطية: server.ts.bak-' + stamp);
console.log('\nللتجربة: GET /api/fish/mcp?key=<مفتاحك> ثم POST بنفس الرابط مع {"jsonrpc":"2.0","id":1,"method":"initialize",...}');
