/**
 * Fysh ↔ Composio integration layer (REST v3.1 only).
 *
 * Why this file exists:
 *  - One canonical user identity + legacy candidates, so connections created by
 *    older builds (raw Firebase UID without the `fish_user_` prefix) are still found.
 *  - Only the documented v3.1 endpoints, with the request shapes Composio documents.
 *  - Account statuses are normalised (ACTIVE / EXPIRED / INITIALIZING ...) so the UI can
 *    ask the user to reconnect instead of silently showing "not connected".
 *
 * Every function takes the Composio project key explicitly, so they can be unit tested
 * or scripted (see scripts/fysh-doctor.mjs) without booting the whole server.
 */

export const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3.1";

/** Composio project key from the environment (never hard-coded). */
export function envComposioApiKey(): string {
  return process.env.COMPOSIO_API_KEY ?? "";
}

/* ------------------------------------------------------------------ */
/* Identity                                                           */
/* ------------------------------------------------------------------ */

export const FISH_USER_PREFIX = "fish_user_";

export function rawFishId(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith(FISH_USER_PREFIX)
    ? trimmed.slice(FISH_USER_PREFIX.length)
    : trimmed;
}

export function canonicalFishUserId(raw: string): string {
  const base = rawFishId(raw);
  return base ? `${FISH_USER_PREFIX}${base}` : "";
}

/**
 * All user ids that may hold connections for this person.
 * Order matters: canonical first, then legacy namespaces created by older builds.
 */
export function candidateFishUserIds(raw: string): string[] {
  const base = rawFishId(raw);
  if (!base) return [];
  const ids = [`${FISH_USER_PREFIX}${base}`, base, `user_${base}`];
  return Array.from(new Set(ids.filter(Boolean)));
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                       */
/* ------------------------------------------------------------------ */

export class ComposioApiError extends Error {
  status: number;
  body?: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.name = "ComposioApiError";
    this.status = status;
    this.body = body;
  }
}

/** Builds the request headers Composio expects for project-scoped calls. */
export function composioHeaders(projectKey: string, json = true): Headers {
  const headers = new Headers();
  headers.set("x-api-key", projectKey);
  if (json) headers.set("Content-Type", "application/json");
  return headers;
}

export async function composioFetch(
  projectKey: string,
  path: string,
  init: { method?: string; body?: any; timeoutMs?: number } = {}
): Promise<any> {
  if (!projectKey) throw new ComposioApiError("Composio project key is missing", 500);
  const url = path.startsWith("http") ? path : `${COMPOSIO_API_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      method: init.method || "GET",
      headers: composioHeaders(projectKey, init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any = null;
    if (text) {
      try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    }
    if (!res.ok) {
      const detail =
        json?.error?.message || json?.message || json?.error || text?.slice(0, 300) ||
        `Composio request failed with status ${res.status}`;
      throw new ComposioApiError(String(detail), res.status, json);
    }
    return json ?? {};
  } catch (err: any) {
    if (err instanceof ComposioApiError) throw err;
    if (err?.name === "AbortError") {
      throw new ComposioApiError("Composio request timed out", 504);
    }
    throw new ComposioApiError(err?.message || "Composio request failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/* Connected accounts                                                 */
/* ------------------------------------------------------------------ */

export interface NormalizedAccount {
  id: string;
  toolkitSlug: string;
  toolkitName: string;
  status: string;
  isActive: boolean;
  /** True when the user must redo the authorization flow for this account. */
  needsReconnect: boolean;
  authScheme: string;
  userId: string;
  alias?: string;
  createdAt?: string;
  statusReason?: string;
  logo: string;
  raw: any;
}

function readStatus(item: any): string {
  return String(
    item?.status || item?.data?.status || item?.state?.val?.status || item?.connection?.status || ""
  ).toUpperCase();
}

export function normalizeAccount(item: any): NormalizedAccount {
  const toolkitSlug: string = item?.toolkit?.slug || item?.toolkit_slug || item?.toolkitSlug || item?.app || "";
  const status = readStatus(item);
  const isActive = status === "ACTIVE" || status === "CONNECTED" || (!status && !!item?.id);
  const needsReconnect =
    status === "EXPIRED" || status === "FAILED" || status === "REVOKED" || status === "DISCONNECTED";
  return {
    id: item?.id || item?.connected_account_id || item?.nanoid || "",
    toolkitSlug,
    toolkitName: item?.toolkit?.name || item?.toolkit_name || toolkitSlug,
    status: status || "UNKNOWN",
    isActive,
    needsReconnect,
    authScheme: item?.auth_scheme || item?.authScheme || "OAUTH2",
    userId: item?.user_id || item?.userId || "",
    alias: item?.alias,
    createdAt: item?.created_at || item?.createdAt,
    statusReason: item?.status_reason || item?.statusReason,
    logo: item?.toolkit?.logo || `https://logos.composio.dev/api/${toolkitSlug || "composio"}`,
    raw: item,
  };
}

/** Raw v3.1 list call (paginated). */
export async function listConnectedAccountsRaw(
  projectKey: string,
  userIds: string[],
  opts: { statuses?: string[]; toolkitSlugs?: string[]; maxPages?: number } = {}
): Promise<any[]> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return [];
  const out: any[] = [];
  let cursor: string | undefined;
  const maxPages = opts.maxPages ?? 2;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams();
    params.set("user_ids", ids.join(","));
    params.set("limit", "100");
    if (cursor) params.set("cursor", cursor);
    if (opts.statuses?.length) params.set("statuses", opts.statuses.join(","));
    if (opts.toolkitSlugs?.length) params.set("toolkit_slugs", opts.toolkitSlugs.join(","));
    const data = await composioFetch(projectKey, `/connected_accounts?${params.toString()}`);
    const items: any[] = data.items || (Array.isArray(data) ? data : []);
    out.push(...items);
    cursor = data.next_cursor || data.nextCursor;
    if (!cursor || items.length === 0) break;
  }
  return out;
}

export interface UserAccountsResult {
  canonicalUserId: string;
  candidates: string[];
  /** Accounts found under any candidate id (deduped, active first). */
  accounts: NormalizedAccount[];
  active: NormalizedAccount[];
  needsReconnect: NormalizedAccount[];
}

/**
 * Lists every connection that belongs to this user, across the canonical id and the
 * legacy namespaces older builds used. This is the migration path: connections that
 * "disappeared" because of the id-prefix change reappear here.
 */
export async function fetchConnectedAccountsForUser(
  projectKey: string,
  rawUserId: string
): Promise<UserAccountsResult> {
  const candidates = candidateFishUserIds(rawUserId);
  const canonicalUserId = canonicalFishUserId(rawUserId);
  const rawItems = await listConnectedAccountsRaw(projectKey, candidates);
  const byId = new Map<string, NormalizedAccount>();
  for (const item of rawItems) {
    const normalized = normalizeAccount(item);
    if (!normalized.id || byId.has(normalized.id)) continue;
    byId.set(normalized.id, normalized);
  }
  const accounts = Array.from(byId.values()).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
  return {
    canonicalUserId,
    candidates,
    accounts,
    active: accounts.filter(a => a.isActive),
    needsReconnect: accounts.filter(a => a.needsReconnect),
  };
}

export async function getConnectedAccount(
  projectKey: string,
  accountId: string
): Promise<NormalizedAccount | null> {
  try {
    const data = await composioFetch(projectKey, `/connected_accounts/${encodeURIComponent(accountId)}`);
    const item = data?.data?.id ? data.data : data?.item || data;
    if (!item?.id) return null;
    return normalizeAccount(item);
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export async function deleteConnectedAccount(projectKey: string, accountId: string): Promise<void> {
  await composioFetch(projectKey, `/connected_accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
  });
}

/**
 * Removes abandoned attempts (started-but-never-finished or expired authorizations)
 * so they stop piling up. Active connections are never touched.
 */
export async function cleanupAbandonedAccounts(
  projectKey: string,
  rawUserId: string
): Promise<{ deleted: string[]; failed: { id: string; error: string }[] }> {
  const { accounts } = await fetchConnectedAccountsForUser(projectKey, rawUserId);
  const doomed = accounts.filter(a =>
    ["EXPIRED", "FAILED", "INITIALIZING", "INITIATED", "DISCONNECTED", "REVOKED"].includes(a.status)
  );
  const deleted: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const acc of doomed) {
    try {
      await deleteConnectedAccount(projectKey, acc.id);
      deleted.push(acc.id);
    } catch (err: any) {
      failed.push({ id: acc.id, error: err?.message || "delete failed" });
    }
  }
  return { deleted, failed };
}

/* ------------------------------------------------------------------ */
/* Auth configs                                                       */
/* ------------------------------------------------------------------ */

export interface AuthConfigItem {
  id: string;
  toolkitSlug: string;
  name?: string;
  status?: string;
  authScheme?: string;
  isEnabledForToolRouter?: boolean;
  raw: any;
}

function normalizeAuthConfig(item: any): AuthConfigItem {
  return {
    id: item?.id || item?.nanoid || "",
    toolkitSlug: item?.toolkit?.slug || item?.toolkit_slug || item?.slug || "",
    name: item?.name,
    status: item?.status,
    authScheme: item?.auth_scheme,
    isEnabledForToolRouter: item?.is_enabled_for_tool_router,
    raw: item,
  };
}

let authConfigCache: { at: number; items: AuthConfigItem[] } | null = null;
const AUTH_CONFIG_TTL_MS = 5 * 60 * 1000;

export async function listAuthConfigs(
  projectKey: string,
  force = false,
  toolkitSlug?: string
): Promise<AuthConfigItem[]> {
  if (!toolkitSlug && !force && authConfigCache && Date.now() - authConfigCache.at < AUTH_CONFIG_TTL_MS) {
    return authConfigCache.items;
  }

  // The project can have thousands of auth configs after enabling the full
  // Composio catalog. Fetch every page instead of silently stopping at 200.
  let cursor: string | undefined;
  const items: any[] = [];
  do {
    const params = new URLSearchParams({ limit: "200" });
    if (toolkitSlug) params.set("toolkit_slug", toolkitSlug);
    if (cursor) params.set("cursor", cursor);
    const data = await composioFetch(projectKey, `/auth_configs?${params.toString()}`);
    items.push(...(data.items || (Array.isArray(data) ? data : [])));
    cursor = data.next_cursor || undefined;
  } while (cursor);

  const normalized = items.map(normalizeAuthConfig).filter(a => a.id);
  if (!toolkitSlug) authConfigCache = { at: Date.now(), items: normalized };
  return normalized;
}

/**
 * Picks the auth config that should be used for a toolkit, creating a Composio-managed
 * one when the project has none yet.
 *
 * The create call uses the documented v3.1 body:
 *   { toolkit: { slug }, auth_config: { type: "use_composio_managed_auth" } }
 * Older builds sent `auth_scheme`/`is_composio_managed`, which is not part of the contract.
 */
export async function resolveAuthConfigId(
  projectKey: string,
  toolkitSlug: string,
  log: (msg: string) => void = () => {}
): Promise<string> {
  const slug = (toolkitSlug || "").trim();
  if (!slug) throw new ComposioApiError("Toolkit slug is required to resolve an auth config", 400);

  const configs = await listAuthConfigs(projectKey, true, slug);
  const matches = configs.filter(c => c.toolkitSlug === slug);
  const enabled = matches.filter(c => (c.status || "ENABLED").toUpperCase() === "ENABLED");
  const preferred = enabled.find(c => c.isEnabledForToolRouter !== false) || enabled[0] || matches[0];

  if (preferred) {
    // ملاحظة: Composio لا تسمح بتغيير is_enabled_for_tool_router عبر الـ API
    // (ترفض PATCH بحقل غير معروف)، لذا لا نحاول تعديله هنا — يُدار من لوحة التحكم.
    log(`[composio] auth config ${preferred.id} reused for ${slug}`);
    return preferred.id;
  }

  log(`[composio] no auth config for ${slug} — creating a Composio-managed one`);
  let created: any;
  try {
    created = await composioFetch(projectKey, "/auth_configs", {
      method: "POST",
      body: {
        toolkit: { slug },
        auth_config: {
          type: "use_composio_managed_auth",
          credentials: {},
          restrict_to_following_tools: [],
        },
      },
    });
  } catch (err: any) {
    const slugCode = err?.body?.error?.slug;
    if (slugCode === "Auth_Config_DefaultAuthConfigNotFound" || String(err?.message || "").includes("does not have managed credentials")) {
      throw new ComposioApiError(
        langSafeOauthMessage(slug),
        409,
        err?.body
      );
    }
    throw err;
  }
  const id = created?.id || created?.auth_config?.id || created?.nanoid;
  if (!id) {
    throw new ComposioApiError(`Composio did not return an auth config id for ${slug}`, 502, created);
  }
  authConfigCache = null; // invalidate
  log(`[composio] auth config ${id} created for ${slug}`);
  return id;
}

function langSafeOauthMessage(slug: string): string {
  return `هذا التطبيق (${slug}) يحتاج بيانات OAuth خاصة مثل Client ID وClient Secret تُضاف من لوحة Composio قبل الربط. This app needs its own OAuth credentials.`;
}

/* ------------------------------------------------------------------ */
/* Connect links                                                      */
/* ------------------------------------------------------------------ */

export interface ConnectLinkResult {
  redirectUrl: string;
  connectedAccountId: string;
  expiresAt?: string;
  authConfigId: string;
  userId: string;
}

/**
 * Creates a Composio Connect Link — the hosted sign-in page for the user.
 * This is the only supported path for Composio-managed OAuth toolkits.
 */
export async function createConnectLink(
  projectKey: string,
  params: {
    userId: string;
    toolkitSlug: string;
    callbackUrl?: string;
    alias?: string;
    log?: (msg: string) => void;
  }
): Promise<ConnectLinkResult> {
  const log = params.log || (() => {});
  const authConfigId = await resolveAuthConfigId(projectKey, params.toolkitSlug, log);
  const body: Record<string, any> = {
    auth_config_id: authConfigId,
    user_id: params.userId,
  };
  if (params.callbackUrl) body.callback_url = params.callbackUrl;
  if (params.alias) body.alias = params.alias;

  const data = await composioFetch(projectKey, "/connected_accounts/link", { method: "POST", body });
  const redirectUrl = data?.redirect_url || data?.redirectUrl;
  if (!redirectUrl) {
    throw new ComposioApiError(`Composio did not return a redirect url for ${params.toolkitSlug}`, 502, data);
  }
  return {
    redirectUrl,
    connectedAccountId: data?.connected_account_id || data?.connectedAccountId || "",
    expiresAt: data?.expires_at,
    authConfigId,
    userId: params.userId,
  };
}

/* ------------------------------------------------------------------ */
/* Toolkits                                                           */
/* ------------------------------------------------------------------ */

export async function fetchToolkitMeta(projectKey: string, slug: string): Promise<any | null> {
  try {
    const data = await composioFetch(projectKey, `/toolkits/${encodeURIComponent(slug)}`);
    return data?.data?.slug ? data.data : data;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Diagnostics                                                        */
/* ------------------------------------------------------------------ */

export interface DiagnosticsResult {
  configured: boolean;
  valid: boolean;
  reason?: string;
  toolkitCount?: number;
  authConfigs: AuthConfigItem[];
  user?: {
    canonicalUserId: string;
    candidates: string[];
    accounts: NormalizedAccount[];
  };
  checkedAt: string;
}

export async function runDiagnostics(projectKey: string, rawUserId?: string): Promise<DiagnosticsResult> {
  const result: DiagnosticsResult = {
    configured: !!projectKey,
    valid: false,
    authConfigs: [],
    checkedAt: new Date().toISOString(),
  };
  if (!projectKey) {
    result.reason = "Composio project key is not set in the environment";
    return result;
  }
  try {
    const toolkits = await composioFetch(projectKey, "/toolkits?limit=1");
    result.valid = true;
    result.toolkitCount = toolkits?.total_items ?? toolkits?.total ?? undefined;
  } catch (err: any) {
    result.reason = err?.message || "Composio rejected the project key";
    return result;
  }
  try {
    result.authConfigs = await listAuthConfigs(projectKey, true);
  } catch (err: any) {
    result.reason = result.reason || err?.message;
  }
  if (rawUserId) {
    const user = await fetchConnectedAccountsForUser(projectKey, rawUserId);
    result.user = {
      canonicalUserId: user.canonicalUserId,
      candidates: user.candidates,
      accounts: user.accounts,
    };
  }
  return result;
}
