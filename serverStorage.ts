/**
 * FYSH storage & security layer.
 *
 * الهدف:
 *  - مفاتيح العملاء تُحفظ في قاعدة بيانات (Supabase/Postgres) بدل ملف JSON،
 *    فتتحمّل أعدادًا كبيرة وتنجو من إعادة التشغيل ولا تتكرر عبر النسخ.
 *  - المفتاح يُخزَّن مشفّرًا (AES-256-GCM) + بصمة SHA-256 للبحث السريع،
 *    فلا يوجد نص صريح في قاعدة البيانات.
 *  - التحقق من هوية المستخدم عبر Firebase ID Token (RS256 + JWKS) بدون
 *    الحاجة إلى مفاتيح خدمة إضافية.
 *
 * كل شيء اختياري: إن لم تُضبط متغيّرات Supabase يعود التطبيق لسلوكه القديم.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* الإعدادات                                                          */
/* ------------------------------------------------------------------ */

export interface StorageConfig {
  supabaseUrl: string;
  supabaseKey: string;
  table: string;
}

export function storageConfig(): StorageConfig | null {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return { supabaseUrl: url, supabaseKey: key, table: "fysh_api_keys" };
}

export function storageMode(): "supabase" | "file" {
  return storageConfig() ? "supabase" : "file";
}

export function maxKeysPerUser(): number {
  const n = Number(process.env.FYSH_MAX_KEYS_PER_USER || 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export function requireAuthForKeys(): boolean {
  return String(process.env.FYSH_REQUIRE_AUTH_FOR_KEYS || "false").toLowerCase() === "true";
}

export function firebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
    const parsed = JSON.parse(raw);
    return String(parsed.projectId || "");
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* التشفير                                                            */
/* ------------------------------------------------------------------ */

let cachedKey: Buffer | null = null;

/** مفتاح التشفير: من البيئة، أو ملف محلي 600، أو يُنشأ مرة واحدة. */
export function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.FYSH_ENCRYPTION_KEY || "";
  if (fromEnv) {
    // يقبل base64 أو hex بطول 32 بايت
    const buf = /^[0-9a-f]{64}$/i.test(fromEnv) ? Buffer.from(fromEnv, "hex") : Buffer.from(fromEnv, "base64");
    if (buf.length === 32) {
      cachedKey = buf;
      return cachedKey;
    }
  }

  const keyFile = path.join(process.cwd(), "data", ".fysh-store-key");
  try {
    if (fs.existsSync(keyFile)) {
      const buf = Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "base64");
      if (buf.length === 32) {
        cachedKey = buf;
        return cachedKey;
      }
    }
    const fresh = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, fresh.toString("base64"), { mode: 0o600 });
    cachedKey = fresh;
    return cachedKey;
  } catch {
    cachedKey = crypto.createHash("sha256").update("fysh-ephemeral-fallback").digest();
    return cachedKey;
  }
}

/** بصمة للبحث فقط — لا يمكن استرجاع المفتاح منها. */
export function hashSecret(plain: string): string {
  return crypto.createHash("sha256").update(String(plain)).digest("hex");
}

/** تشفير AES-256-GCM → v1:<iv>:<tag>:<cipher> (كلها base64). */
export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function openSecret(sealed: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = String(sealed).split(":");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Supabase REST                                                      */
/* ------------------------------------------------------------------ */

async function sb(pathname: string, init: { method?: string; body?: any; prefer?: string } = {}) {
  const cfg = storageConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1${pathname}`, {
    method: init.method || "GET",
    headers: {
      apikey: cfg.supabaseKey,
      Authorization: `Bearer ${cfg.supabaseKey}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let json: any = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* ignore */ }
  }
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${json?.message || text.slice(0, 200)}`);
  }
  return json;
}

export interface PersistedKey {
  id: string;
  name: string;
  plain: string;
  masked: string;
  access: string;
  ipAllowlist: string;
  userId: string;
  userEmail?: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  lastUsedAt?: string;
}

export async function loadKeysFromDb(): Promise<PersistedKey[]> {
  const rows: any[] = (await sb("/fysh_api_keys?select=*&order=created_at.desc")) || [];
  const out: PersistedKey[] = [];
  for (const row of rows) {
    const plain = row.secret_cipher ? openSecret(row.secret_cipher) : null;
    if (!plain) {
      // صف قديم/غير قابل للفك — نتخطاه بدل تعطيل السيرفر
      console.warn("[STORAGE] skipped a key row that cannot be decrypted:", row.id);
      continue;
    }
    out.push({
      id: row.id,
      name: row.name,
      plain,
      masked: row.masked,
      access: row.access,
      ipAllowlist: row.ip_allowlist,
      userId: row.user_id,
      userEmail: row.user_email || undefined,
      status: (row.status || "ACTIVE") as "ACTIVE" | "REVOKED",
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at || undefined,
    });
  }
  return out;
}

export async function upsertKeyToDb(record: PersistedKey): Promise<void> {
  await sb("/fysh_api_keys?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [{
      id: record.id,
      user_id: record.userId,
      name: record.name,
      masked: record.masked,
      access: record.access,
      ip_allowlist: record.ipAllowlist,
      user_email: record.userEmail || null,
      secret_hash: hashSecret(record.plain),
      secret_cipher: sealSecret(record.plain),
      status: record.status,
      created_at: record.createdAt || new Date().toISOString(),
      last_used_at: record.lastUsedAt || null,
    }],
  });
}

export async function deleteKeyFromDb(id: string): Promise<void> {
  await sb(`/fysh_api_keys?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function touchKeyInDb(id: string, iso: string): Promise<void> {
  await sb(`/fysh_api_keys?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { last_used_at: iso },
  });
}

export async function logKeyUsage(keyId: string, userId: string, action: string, ip?: string): Promise<void> {
  try {
    await sb("/fysh_key_usage", {
      method: "POST",
      prefer: "return=minimal",
      body: [{ key_id: keyId, user_id: userId, action, ip: ip || null }],
    });
  } catch {
    // السجل ليس حرجًا — لا نُفشل الطلب بسببه
  }
}

/* ------------------------------------------------------------------ */
/* التحقق من هوية Firebase (بدون مفاتيح خدمة)                          */
/* ------------------------------------------------------------------ */

let jwksCache: { at: number; keys: Record<string, crypto.KeyObject> } | null = null;
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

async function loadJwks(): Promise<Record<string, crypto.KeyObject>> {
  if (jwksCache && Date.now() - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data: any = await res.json();
  const keys: Record<string, crypto.KeyObject> = {};
  for (const jwk of data.keys || []) {
    try {
      keys[jwk.kid] = crypto.createPublicKey({ key: jwk, format: "jwk" });
    } catch {
      // تجاهل المفاتيح غير الصالحة
    }
  }
  jwksCache = { at: Date.now(), keys };
  return keys;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
}

/** يتحقق من Firebase ID Token ويعيد المستخدم أو null. */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedUser | null> {
  try {
    const projectId = firebaseProjectId();
    if (!projectId) return null;
    const parts = String(idToken).split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

    if (header.alg !== "RS256") return null;
    const keys = await loadJwks();
    const pub = keys[header.kid];
    if (!pub) return null;

    const ok = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${headerB64}.${payloadB64}`),
      pub,
      Buffer.from(signatureB64, "base64url")
    );
    if (!ok) return null;

    const now = Math.floor(Date.now() / 1000);
    if (Number(payload.exp || 0) < now) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub) return null;

    return { uid: String(payload.sub), email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

/** يستخرج المستخدم من ترويسة Authorization: Bearer <idToken>. */
export async function userFromRequest(req: any): Promise<VerifiedUser | null> {
  const raw = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof raw !== "string" || !raw.startsWith("Bearer ")) return null;
  return verifyFirebaseIdToken(raw.slice(7).trim());
}
