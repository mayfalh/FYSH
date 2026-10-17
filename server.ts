import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Composio } from "@composio/core";
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
} from "./serverComposio";
import {
  storageMode,
  loadKeysFromDb,
  upsertKeyToDb,
  deleteKeyFromDb,
  userFromRequest,
  maxKeysPerUser,
  requireAuthForKeys,
  type PersistedKey,
} from "./serverStorage";

// تحميل ملفات البيئة: .env.local ثم .env (قيم البيئة الحقيقية لها الأولوية)
dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Security headers & CORS ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow frontend origin (same host, fysh.online, or localhost for dev)
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Simple in-memory rate limiter (production: use Redis) ---
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(windowMs: number, max: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({ error: "Too many requests, please try again later." });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitStore.entries()) if (now > v.resetAt) rateLimitStore.delete(k);
}, 60_000).unref();

// --- Unified Fish user ID helper (single source of truth) ---
// الصيغة القياسية fish_user_<raw>، وأي صيغة أخرى (UID خام أو user_*) تُعامل
// كمساحة قديمة يجب أن تبقى قابلة للقراءة حتى لا تختفي روابط المستخدمين.
export function normalizeFishUserId(raw: string): string {
  return canonicalFishUserId(raw);
}
export function extractGoogleUid(fishUserId: string): string {
  return rawFishId(fishUserId);
}

// Ensure environment variables are loaded and validated
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

if (!COMPOSIO_API_KEY) {
  console.warn("WARNING: COMPOSIO_API_KEY is not set in environment variables.");
}
if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY / GOOGLE_API_KEY is not set in environment variables.");
}

// Lazy initialization for Composio SDK
let composioClient: Composio<any> | null = null;
export function getComposio(): Composio<any> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY environment variable is required");
  }
  if (!composioClient) {
    composioClient = new Composio({
      apiKey,
      provider: new GoogleProvider(),
    });
  }
  return composioClient;
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

// In-memory/local Fish agent sessions database conforming to schema
export interface FishAgentSession {
  fishUserId: string;
  composioUserId: string;
  agentType: string;
  composioSessionId: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  mcpUrl?: string;
  mcpHeaders?: Record<string, string>;
}

export type StoredAgentSession = FishAgentSession & { sessionId?: string; updatedAt?: string };

export const fishAgentDatabase = new Map<string, FishAgentSession>();

// Map common or kebab-cased toolkit IDs to valid Composio SDK toolkit slugs
export function mapToolkitToComposioSlug(toolkitId: string): string {
  if (!toolkitId) return 'gmail';
  let clean = toolkitId.trim().toLowerCase();
  
  // Strip trailing -mcp, _mcp, or whitespace mcp
  clean = clean.replace(/[-_\s]+mcp$/i, '').trim();

  const mapping: Record<string, string> = {
    'google-calendar': 'googlecalendar',
    'google_calendar': 'googlecalendar',
    'calendar': 'googlecalendar',
    'googlecalendar': 'googlecalendar',

    'google-sheets': 'googlesheets',
    'google_sheets': 'googlesheets',
    'sheets': 'googlesheets',
    'googlesheets': 'googlesheets',

    'google-docs': 'googledocs',
    'google_docs': 'googledocs',
    'docs': 'googledocs',
    'googledocs': 'googledocs',

    'google-drive': 'googledrive',
    'google_drive': 'googledrive',
    'drive': 'googledrive',
    'googledrive': 'googledrive',

    'gmail': 'gmail',
    'google-mail': 'gmail',
    'googlemail': 'gmail',
    'google': 'gmail',

    'slack': 'slack',
    'slackbot': 'slack',
    'github': 'github',
    'githubapp': 'github',
    'stripe': 'stripe',
    'telegram': 'telegram',
    'notion': 'notion',
    'discord': 'discord',
    'discordbot': 'discord',
    'trello': 'trello',
    'jira': 'jira',
    'linear': 'linear',
    'asana': 'asana',
    'zoom': 'zoom',
    'airtable': 'airtable',
    'clickup': 'clickup',
    'hubspot': 'hubspot',
    'salesforce': 'salesforce',
    'mailchimp': 'mailchimp',
    'sendgrid': 'sendgrid',
    'zendesk': 'zendesk',
    'intercom': 'intercom',
    'todoist': 'todoist',
    'dropbox': 'dropbox',
    'box': 'box',
    'coda': 'coda',
    'monday': 'monday',
    'evernote': 'evernote',
    'onedrive': 'onedrive',
    'teams': 'teams',
    'microsoftteams': 'teams',
    'outlook': 'outlook',
    'microsoftoutlook': 'outlook',
    'whatsapp': 'whatsapp',
    'pipedrive': 'pipedrive',
    'zoho-crm': 'zohocrm',
    'zohocrm': 'zohocrm',
    'aws-s3': 'awss3',
    's3': 'awss3',
    'basecamp': 'basecamp',
    'googletasks': 'googletasks',
    'google_tasks': 'googletasks',
    'googlemaps': 'googlemaps',
    'google_maps': 'googlemaps',
    'snowflake': 'snowflake',
    'apollo': 'apollo',
    'peopledatalabs': 'peopledatalabs',
    'docusign': 'docusign',
    'youtube': 'youtube',
    'canvas': 'canvas',
    'reddit': 'reddit',
    'tavily': 'tavily',
    'exa': 'exa',
    'serpapi': 'serpapi',
    'firecrawl': 'firecrawl',
    'elevenlabs': 'elevenlabs',
    'wrike': 'wrike',
    'cal': 'cal',
    'calendly': 'calendly',
    'bitbucket': 'bitbucket',
    'gitlab': 'gitlab',
    'sentry': 'sentry',
    'supabase': 'supabase',
    'shopify': 'shopify',
    'perplexity': 'perplexity',
    'spotify': 'spotify',
    'twitter': 'twitter',
    'x': 'twitter',
    'figma': 'figma',
    'composio': 'composio',
    'composiosearch': 'composiosearch',
    'codeinterpreter': 'codeinterpreter',
    'hackernews': 'hackernews',
  };

  if (mapping[clean]) return mapping[clean];
  return clean.replace(/[-_]/g, '');
}

// Setup Fish User Agent with Composio MCP
export async function setupFishUserAgent(fishUserId: string, agentType: string) {
  const composio = getComposio();
  const googleUid = fishUserId.startsWith('fish_user_') ? fishUserId.replace('fish_user_', '') : fishUserId;
  const composioUserId = canonicalFishUserId(googleUid);

  // Query user's connected accounts to get toolkits (canonical + legacy namespaces)
  const connections = await loadUserConnectionsSafe(fishUserId);
  const activeToolkits: string[] = activeToolkitSlugs(connections.accounts);

  const sessionOptions: any = { mcp: true };
  if (activeToolkits.length > 0) {
    sessionOptions.toolkits = activeToolkits;
    sessionOptions.sessionPreset = "direct_tools";
  }

  let session: any;
  try {
    session = await composio.create(composioUserId, sessionOptions);
  } catch (err: any) {
    console.warn("[setupFishUserAgent] Session creation with preset failed, retrying simple:", err?.message);
    session = await composio.create(composioUserId, { mcp: true });
  }

  return { 
    agentType, 
    composioUserId, 
    sessionId: session.sessionId, 
    mcpUrl: session.mcp?.url || (session.mcp as any)?.url, 
    mcpHeaders: {}, // Never expose Composio API key to client
    session
  };
}

// Connect Fish User Toolkit authorization flow
export async function connectFishUserToolkit(fishUserId: string, toolkit: string, callbackUrl?: string) {
  const composio = getComposio();
  const googleUid = fishUserId.startsWith('fish_user_') ? fishUserId.replace('fish_user_', '') : fishUserId;
  const composioUserId = canonicalFishUserId(googleUid);
  const effectiveCallback = callbackUrl || "http://localhost:3000/api/composio/callback";
  const normalizedToolkit = mapToolkitToComposioSlug(toolkit);
  const session = await composio.create(composioUserId, { 
    mcp: true, 
    manageConnections: { callbackUrl: effectiveCallback } 
  });
  const request = await session.authorize(normalizedToolkit, { callbackUrl: effectiveCallback });
  return { oauthUrl: (request as any).redirectUrl || (request as any).url };
}

// Retrieve existing Agent Session
export async function useExistingAgentSession(savedSessionId: string) {
  const composio = getComposio();
  let session: any;
  try {
    session = await composio.use(savedSessionId, { mcp: true });
  } catch (err: any) {
    console.warn("[useExistingAgentSession] composio.use failed for sessionId:", savedSessionId, err?.message);
    const saved = fishAgentDatabase.get(savedSessionId);
    const uid = saved?.composioUserId || "fish_user_default";
    session = await composio.create(uid, { mcp: true });
  }
  return {
    sessionId: session.sessionId,
    mcpUrl: session.mcp?.url || (session.mcp as any)?.url,
    mcpHeaders: {}, // Never expose Composio API key to client
    session
  };
}

// Lazy initialization for GoogleGenAI SDK
let geminiClient: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// Popular toolkits catalog for fast home page and fallback rendering
const POPULAR_TOOLKITS = [
  { id: "gmail", name: "Gmail", category: "Email & Communication", description: "Send, receive, and automate emails with Gmail workspace.", logo: "https://logos.composio.dev/api/gmail" },
  { id: "slack", name: "Slack", category: "Email & Communication", description: "Send alerts, triage messages, and orchestrate channels.", logo: "https://logos.composio.dev/api/slack" },
  { id: "googlecalendar", name: "Google Calendar", category: "Google Workspace & Productivity", description: "Manage events, meetings, and smart schedule automation.", logo: "https://logos.composio.dev/api/googlecalendar" },
  { id: "googlesheets", name: "Google Sheets", category: "Google Workspace & Productivity", description: "Read, write, and analyze spreadsheets and live data tables.", logo: "https://logos.composio.dev/api/googlesheets" },
  { id: "googledrive", name: "Google Drive", category: "Google Workspace & Productivity", description: "Upload, download, and organize files in Google Drive.", logo: "https://logos.composio.dev/api/googledrive" },
  { id: "googledocs", name: "Google Docs", category: "Google Workspace & Productivity", description: "Create and edit documents collaboratively.", logo: "https://logos.composio.dev/api/googledocs" },
  { id: "github", name: "GitHub", category: "Developer & Engineering", description: "Manage repositories, pull requests, issues, and code actions.", logo: "https://logos.composio.dev/api/github" },
  { id: "stripe", name: "Stripe", category: "Business, CRM & Sales", description: "Process payments, invoices, subscriptions, and payouts.", logo: "https://logos.composio.dev/api/stripe" },
  { id: "telegram", name: "Telegram", category: "Email & Communication", description: "Automated bots, channel notifications, and broadcasts.", logo: "https://logos.composio.dev/api/telegram" },
  { id: "notion", name: "Notion", category: "Google Workspace & Productivity", description: "Synchronize wikis, docs, tasks, and relational databases.", logo: "https://logos.composio.dev/api/notion" },
  { id: "discord", name: "Discord", category: "Email & Communication", description: "Community servers, bot triggers, and channel messages.", logo: "https://logos.composio.dev/api/discord" },
  { id: "outlook", name: "Microsoft Outlook", category: "Email & Communication", description: "Microsoft Outlook email, calendar, and contacts.", logo: "https://logos.composio.dev/api/outlook" },
  { id: "teams", name: "Microsoft Teams", category: "Email & Communication", description: "Team meetings, chat messages, and workspace collaboration.", logo: "https://logos.composio.dev/api/teams" },
  { id: "zoom", name: "Zoom", category: "Email & Communication", description: "Video conferences, meetings, and webinars.", logo: "https://logos.composio.dev/api/zoom" },
  { id: "hubspot", name: "HubSpot", category: "Business, CRM & Sales", description: "Inbound marketing, CRM leads, and customer service.", logo: "https://logos.composio.dev/api/hubspot" },
  { id: "airtable", name: "Airtable", category: "Google Workspace & Productivity", description: "Relational database and spreadsheet workflows.", logo: "https://logos.composio.dev/api/airtable" },
  { id: "jira", name: "Jira", category: "Developer & Engineering", description: "Issue tracking, agile sprints, and project management.", logo: "https://logos.composio.dev/api/jira" },
  { id: "linear", name: "Linear", category: "Developer & Engineering", description: "Streamlined issue tracking and software project planning.", logo: "https://logos.composio.dev/api/linear" },
  { id: "figma", name: "Figma", category: "Developer & Engineering", description: "Collaborative interface design and prototypes.", logo: "https://logos.composio.dev/api/figma" },
  { id: "youtube", name: "YouTube", category: "Media & Content", description: "Upload, manage, and analyze YouTube videos and playlists.", logo: "https://logos.composio.dev/api/youtube" },
  { id: "reddit", name: "Reddit", category: "Community & News", description: "Read, submit, and engage with Reddit communities and threads.", logo: "https://logos.composio.dev/api/reddit" }
];

// Helper to normalize category names into clean high-level categories
export function mapComposioCategory(rawCat: string, slug?: string): string {
  const lower = (rawCat || '').toLowerCase();
  const lowerSlug = (slug || '').toLowerCase();

  if (lowerSlug.includes('mcp') || lower.includes('mcp')) {
    return 'Custom & Community MCP';
  }
  if (lowerSlug.includes('scrap') || lowerSlug.includes('crawl') || lower.includes('scrape') || lower.includes('crawl') || lower.includes('spider')) {
    return 'Scraping & Web Tools';
  }
  if (lower.includes('email') || lower.includes('chat') || lower.includes('communication') || lower.includes('message') || lower.includes('slack') || lower.includes('discord') || lower.includes('telegram') || lower.includes('whatsapp') || lower.includes('sms') || lower.includes('phone') || lower.includes('call')) {
    return 'Email & Communication';
  }
  if (lower.includes('ai') || lower.includes('machine-learning') || lower.includes('llm') || lower.includes('search') || lower.includes('bot') || lower.includes('intelligence') || lower.includes('speech') || lower.includes('voice') || lower.includes('vision') || lower.includes('nlp')) {
    return 'AI, Search & LLMs';
  }
  if (lower.includes('crm') || lower.includes('sales') || lower.includes('marketing') || lower.includes('prospect') || lower.includes('outreach') || lower.includes('lead') || lower.includes('advertising') || lower.includes('social')) {
    return 'CRM, Sales & Marketing';
  }
  if (lower.includes('support') || lower.includes('desk') || lower.includes('ticket') || lower.includes('hr') || lower.includes('recruiting') || lower.includes('employee') || lower.includes('hiring')) {
    return 'HR & Customer Support';
  }
  if (lower.includes('finance') || lower.includes('payment') || lower.includes('billing') || lower.includes('invoice') || lower.includes('accounting') || lower.includes('commerce') || lower.includes('store') || lower.includes('shop') || lower.includes('checkout') || lower.includes('crypto')) {
    return 'Finance & E-commerce';
  }
  if (lower.includes('google') || lower.includes('productiv') || lower.includes('project-management') || lower.includes('document') || lower.includes('spreadsheet') || lower.includes('note') || lower.includes('schedul') || lower.includes('task') || lower.includes('calendar') || lower.includes('workspace')) {
    return 'Productivity & Workspace';
  }
  if (lower.includes('data') || lower.includes('analytic') || lower.includes('storage') || lower.includes('warehouse') || lower.includes('database') || lower.includes('sql') || lower.includes('postgres') || lower.includes('cloud')) {
    return 'Data, Analytics & Cloud';
  }
  if (lower.includes('media') || lower.includes('video') || lower.includes('audio') || lower.includes('image') || lower.includes('design') || lower.includes('content') || lower.includes('music') || lower.includes('photo')) {
    return 'Media, Design & Content';
  }
  if (lower.includes('developer') || lower.includes('devops') || lower.includes('code') || lower.includes('git') || lower.includes('package') || lower.includes('api') || lower.includes('engineering') || lower.includes('ci/cd') || lower.includes('build') || lower.includes('deploy')) {
    return 'Developer & DevOps';
  }
  if (lower.includes('security') || lower.includes('auth') || lower.includes('map') || lower.includes('geo') || lower.includes('weather') || lower.includes('utility') || lower.includes('tool')) {
    return 'Security, Utilities & APIs';
  }

  return 'Developer & DevOps';
}

// In-memory catalog cache with 15-minute TTL
let toolkitsCatalogCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function fetchFullComposioCatalog(): Promise<any[]> {
  const now = Date.now();
  if (toolkitsCatalogCache && (now - toolkitsCatalogCache.timestamp < CACHE_TTL_MS)) {
    return toolkitsCatalogCache.data;
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return POPULAR_TOOLKITS;
  }

  try {
    console.log("[COMPOSIO] Fetching toolkits from Composio API v3.1...");
    let page = 1;
    const allToolkits: any[] = [];
    let totalItems = 0;

    while (page <= 8) {
      const res = await fetch(`https://backend.composio.dev/api/v3.1/toolkits?limit=250&page=${page}`, {
        headers: { 'x-api-key': apiKey }
      });

      if (!res.ok) {
        if (res.status !== 401 && res.status !== 403) {
          console.warn(`[COMPOSIO] Failed to fetch toolkits page ${page}, status: ${res.status}`);
        }
        break;
      }

      const json = await res.json();
      const items = json.items || [];
      if (items.length === 0) break;

      totalItems = json.total_items || totalItems;
      for (const item of items) {
        const rawCategory = item.meta?.categories?.[0]?.name || item.meta?.categories?.[0]?.id || item.category || '';
        const mappedCat = mapComposioCategory(rawCategory);
        const logo = item.meta?.logo || `https://logos.composio.dev/api/${item.slug}`;

        allToolkits.push({
          id: item.slug,
          slug: item.slug,
          name: item.name || item.slug,
          category: mappedCat,
          rawCategory,
          description: item.meta?.description || `${item.name} integration via Composio MCP.`,
          logo,
          verified: item.is_local_toolkit === false,
          authSchemes: item.auth_schemes || [],
          composioManaged: item.composio_managed_auth_schemes || []
        });
      }

      if (!json.next_cursor && page >= (json.total_pages || 1)) {
        break;
      }
      page++;
    }

    console.log(`[COMPOSIO] Toolkit count: ${allToolkits.length} (Total in Composio: ${totalItems})`);
    
    if (allToolkits.length > 0) {
      toolkitsCatalogCache = { data: allToolkits, timestamp: now };
      return allToolkits;
    }
  } catch (err: any) {
    if (!err?.message?.includes('401') && !err?.message?.includes('Invalid API key')) {
      console.warn("[COMPOSIO] Error fetching catalog:", err.message);
    }
  }

  return POPULAR_TOOLKITS;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "FYSH Platform with Composio SDK & Gemini", uptime: process.uptime(), keys: fyshApiKeysDatabase.size, sessions: fishAgentDatabase.size });
});

app.get("/api/health/composio", async (req, res) => {
  try {
    if (!process.env.COMPOSIO_API_KEY) {
      return res.json({ valid: false, message: "Composio API Key is not set in environment variables" });
    }
    const report = await runDiagnostics(envComposioApiKey());
    if (!report.valid) {
      return res.json({ valid: false, message: "Composio rejected the project key", detail: report.reason });
    }
    return res.json({
      valid: true,
      message: "Composio project key is working",
      toolkitCount: report.toolkitCount,
      authConfigCount: report.authConfigs.length,
      checkedAt: report.checkedAt,
    });
  } catch (error: any) {
    const statusCode = error?.status || error?.statusCode || error?.response?.status || error?.code || 500;
    console.log("Composio API health check status code:", statusCode);
    return res.json({ valid: false, message: "Composio API Key is invalid or not loaded in env" });
  }
});

// Full toolkits endpoint supporting search, pagination, and category filtering
app.get("/api/composio/toolkits", async (req, res) => {
  try {
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const category = ((req.query.category as string) || '').trim();

    const catalog = await fetchFullComposioCatalog();
    let filtered = catalog;

    if (category && category !== 'All') {
      filtered = filtered.filter(t => t.category === category || t.rawCategory?.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(search) ||
        t.slug.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
      );
    }

    res.json({ 
      toolkits: filtered,
      total: filtered.length,
      fullCatalogCount: catalog.length 
    });
  } catch (error: any) {
    console.error("[COMPOSIO ERROR] /api/composio/toolkits error:", error.message);
    res.status(500).json({ toolkits: POPULAR_TOOLKITS, total: POPULAR_TOOLKITS.length, error: error.message });
  }
});

// Get connected accounts for a specific FYSH user
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

// Resolve or create Auth Config for a toolkit through the shared v3.1 layer
async function resolveComposioAuthConfig(toolkitSlug: string, projectKey: string): Promise<string> {
  return resolveAuthConfigId(projectKey, mapToolkitToComposioSlug(toolkitSlug), (m) => console.log(m));
}

// Connect endpoint: يحلّ auth config عبر v3.1 وينشئ رابط ربط (Connect Link)
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
    const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '') || `${isHttps ? 'https' : 'http'}://${host}`;
    const callbackUrl = req.body.callbackUrl || `${baseUrl}/api/composio/callback`;

    console.log(`[COMPOSIO] connect toolkit=${toolkitSlug} (raw: ${rawSlug}) user=${canonicalUserId} callback=${callbackUrl}`);

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
      console.warn(`[COMPOSIO] link creation failed for ${toolkitSlug}: ${linkErr?.message}`);
      if (linkErr instanceof ComposioApiError && [400, 404, 422].includes(linkErr.status)) {
        return res.status(linkErr.status).json({
          success: false,
          error: `تعذّر تجهيز الربط لـ ${toolkitSlug}: ${linkErr.message}`,
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
      console.error(`[COMPOSIO] SDK authorize failed for ${toolkitSlug}:`, sdkErr?.message);
      return res.status(500).json({
        success: false,
        error: `تعذّر بدء الربط لـ ${toolkitSlug}: ${sdkErr?.message || 'unknown error'}`,
        toolkitSlug,
      });
    }

    return res.status(500).json({
      success: false,
      error: `تعذّر بدء الربط لـ ${toolkitSlug}. تحقّق من حالة التكامل في Composio.`,
      toolkitSlug,
    });
  } catch (error: any) {
    console.error("[COMPOSIO] connect error:", error?.message);
    res.status(500).json({ success: false, error: error?.message || "Failed to initiate connection" });
  }
});

// Verify connection endpoint: يعتبر الحساب متصلًا فقط عندما يكون ACTIVE
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
    console.log(`[COMPOSIO] verify toolkit=${toolkit} account=${connectedAccountId || 'by-user'}`);

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

// Disconnect account: حذف حقيقي من Composio
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
    console.log(`[COMPOSIO] disconnected account ${targetAccountId}`);
    res.json({ success: true, disconnectedId: targetAccountId });
  } catch (error: any) {
    console.error("[COMPOSIO] disconnect error:", error?.message);
    res.status(error?.status && error.status < 500 ? error.status : 500).json({
      success: false,
      error: error?.message || "Failed to disconnect account",
    });
  }
});

// OAuth Callback route for Composio
app.get("/api/composio/callback", async (req, res) => {
  try {
    const { connectedAccountId, connected_account_id, userUuid, user_id, status, session_uri } = req.query;
    const accId = connectedAccountId || connected_account_id;
    const uUuid = userUuid || user_id;
    
    console.log("[COMPOSIO] OAuth Callback received:", { accId, uUuid, status, session_uri: !!session_uri });

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #191919; text-align: center; }
            .card { background: white; padding: 32px 24px; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 4px 16px rgba(0,0,0,0.06); max-width: 380px; width: 90%; }
            .icon { width: 48px; height: 48px; background: #ecfdf5; color: #059669; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 24px; font-weight: bold; }
            h2 { color: #111827; margin: 0 0 8px 0; font-size: 18px; font-weight: 600; }
            p { color: #6b7280; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5; }
            .badge { display: inline-block; background: #f3f4f6; color: #374151; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h2>Connection Successful</h2>
            <p>Your application account is now securely linked to FYSH.</p>
            <div class="badge">Window closing automatically...</div>
          </div>
          <script>
            (function() {
              var targetOrigin = window.location.origin;
              // Only post to same-origin opener; do not use '*'
              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage({ type: 'COMPOSIO_CONNECTED', status: 'success', accId: '${accId || ''}', sessionUri: '${session_uri || ''}' }, targetOrigin);
                  setTimeout(function() { try { window.close(); } catch(e) {} }, 900);
                } else {
                  setTimeout(function() { window.location.href = '/apps?connected=true'; }, 900);
                }
              } catch(e) {
                window.location.href = '/apps?connected=true';
              }
            })();
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("[COMPOSIO ERROR] Callback error:", error);
    res.redirect("/apps?connected=false&error=" + encodeURIComponent(error.message));
  }
});

// Legacy delete route compatibility
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

// Helper: Safe structured error response for agents
function formatAgentError(errorType: string, customMessage?: string) {
  const errorMap: Record<string, string> = {
    MISSING_API_KEY: "Composio service configuration is missing.",
    INVALID_API_KEY: "Composio service configuration is invalid or unauthorized.",
    USER_NOT_AUTHENTICATED: "Authentication required to connect agent.",
    INVALID_SESSION: "Agent session has expired or is invalid. Reconnecting...",
    NO_CONNECTED_ACCOUNT: "No connected application found for this agent. Please connect an app first.",
    INACTIVE_CONNECTED_ACCOUNT: "The connected account is inactive or revoked. Please reconnect.",
    MCP_CONNECTION_FAILED: "Unable to establish MCP connection. Please try again.",
    TOOL_DISCOVERY_FAILED: "Failed to discover available tools for this agent.",
    TOOL_EXECUTION_FAILED: "Failed to execute tool on the connected application.",
    OAUTH_CONNECTION_INCOMPLETE: "Application authorization is incomplete. Please finish the connection flow.",
    NO_ACTIVE_CONNECTION: "No active connection available for the requested tool.",
    AGENT_CONNECTION_FAILED: "Unable to connect the agent. Please reconnect the application."
  };

  return {
    success: false,
    error: errorType,
    message: customMessage || errorMap[errorType] || "An error occurred with the agent connection."
  };
}

// White-labeled app logo proxy
app.get("/api/logos/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const upstreamUrl = `https://logos.composio.dev/api/${encodeURIComponent(slug)}`;
    const imgRes = await fetch(upstreamUrl);
    if (!imgRes.ok) {
      return res.status(imgRes.status).send("Logo not found");
    }
    const contentType = imgRes.headers.get("content-type") || "image/svg+xml";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await imgRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (e: any) {
    res.status(500).send("Error loading logo");
  }
});

// GET and POST /api/agent/mcp:
// Secure per-user MCP endpoint. Authenticates user, loads connected accounts, creates/retrieves session,
// enables MCP, proxies JSON-RPC on POST without leaking COMPOSIO_API_KEY.
app.all("/api/agent/mcp", async (req, res) => {
  try {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      return res.status(503).json(formatAgentError("MISSING_API_KEY", "Composio configuration is missing on server"));
    }

    // 1. Authenticate / resolve user ID from query, body, or headers
    let rawUserId = (req.query.userId || req.query.fishUserId || req.query.googleUid || req.query.uid || req.body?.userId || req.body?.fishUserId || req.body?.googleUid || req.headers['x-user-id'] || req.headers['x-fish-user-id'] || req.headers['x-google-uid']) as string;

    // Check Authorization header for FYSH API token if present
    const authHeader = req.headers['authorization'];
    if (!rawUserId && authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.replace('Bearer ', '').trim();
      const apiKeyRecord = fyshApiKeysDatabase.get(bearerToken);
      if (apiKeyRecord?.userId) {
        rawUserId = apiKeyRecord.userId;
      }
    }

    // Check query param 'key'
    if (!rawUserId && req.query.key) {
      const apiKeyRecord = fyshApiKeysDatabase.get(String(req.query.key));
      if (apiKeyRecord?.userId) {
        rawUserId = apiKeyRecord.userId;
      }
    }

    // Fallback to active sessions or stable default user
    if (!rawUserId) {
      const firstEntry = Array.from(fishAgentDatabase.values())[0];
      rawUserId = firstEntry?.fishUserId || "default_user";
    }

    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const composioUserId = canonicalFishUserId(googleUid);

    // 2. التطبيقات المرتبطة بكل مساحات المعرّف (القياسية والقديمة)
    const connections = await loadUserConnectionsSafe(googleUid);
    const activeAccounts = connections.active;
    const activeToolkits = activeToolkitSlugs(connections.accounts);

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const fyshMcpUrl = `${proto}://${host}/api/agent/mcp?userId=${encodeURIComponent(googleUid)}`;

    // 3. Handle GET request: Return connection metadata immediately without creating an active session
    if (req.method === 'GET') {
      return res.json({
        url: fyshMcpUrl,
        headers: {}, // Do NOT expose COMPOSIO_API_KEY
        mcpUrl: fyshMcpUrl,
        fyshMcpUrl,
        fyshUserId: googleUid,
        connectedToolkits: activeToolkits,
        connectedAccountsCount: activeAccounts.length,
        success: true
      });
    }

    // 4. Handle POST request: Proxy JSON-RPC directly to session.mcp.url
    const composio = getComposio();
    let session: any = null;
    const cacheKey = `${googleUid}_default`;
    const savedRecord = fishAgentDatabase.get(cacheKey);

    if (savedRecord?.composioSessionId) {
      try {
        session = await composio.use(savedRecord.composioSessionId, { mcp: true });
      } catch {
        session = null;
      }
    }

    if (!session) {
      const sessionOptions: any = { mcp: true };
      if (activeToolkits.length > 0) {
        sessionOptions.toolkits = activeToolkits;
        sessionOptions.sessionPreset = "direct_tools";
      }

      try {
        session = await composio.create(composioUserId, sessionOptions);
      } catch (err: any) {
        const isAuth = err?.status === 401 || `${err?.message}`.includes('401') || `${err?.message}`.includes('Invalid API key');
        if (isAuth) {
          return res.status(401).json(formatAgentError("INVALID_API_KEY", "Composio service configuration is invalid or expired."));
        }
        try {
          session = await composio.create(composioUserId, { mcp: true });
        } catch (createErr: any) {
          const isCreateAuth = createErr?.status === 401 || `${createErr?.message}`.includes('401') || `${createErr?.message}`.includes('Invalid API key');
          if (isCreateAuth) {
            return res.status(401).json(formatAgentError("INVALID_API_KEY", "Composio service configuration is invalid or expired."));
          }
          console.warn("[/api/agent/mcp] Failed creating Composio MCP session:", createErr?.message);
          return res.status(502).json(formatAgentError("MCP_CONNECTION_FAILED", "Failed to establish agent session"));
        }
      }
    }

    const mcpUrl = session.mcp?.url || (session.mcp as any)?.url;
    if (!mcpUrl) {
      return res.status(502).json(formatAgentError("MCP_CONNECTION_FAILED", "MCP URL not provided by session"));
    }

    // Save session in database
    const sessionRecord: FishAgentSession = {
      fishUserId: googleUid,
      composioUserId,
      agentType: "default",
      composioSessionId: session.sessionId,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      mcpUrl,
      mcpHeaders: {}
    };
    fishAgentDatabase.set(cacheKey, sessionRecord);
    fishAgentDatabase.set(session.sessionId, sessionRecord);
    persistSessionsToDisk();

    try {
      const upstreamHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'x-api-key': apiKey
      };

      const forwardRes = await fetch(mcpUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(req.body || {})
      });

      const contentType = forwardRes.headers.get('content-type') || 'application/json';
      res.setHeader('Content-Type', contentType);
      res.status(forwardRes.status);
      const bodyText = await forwardRes.text();
      return res.send(bodyText);
    } catch (proxyErr: any) {
      console.warn("[/api/agent/mcp] Proxying error:", proxyErr?.message);
      return res.status(502).json(formatAgentError("TOOL_EXECUTION_FAILED", "Error executing MCP request"));
    }
  } catch (error: any) {
    const isAuth = error?.status === 401 || `${error?.message}`.includes('401') || `${error?.message}`.includes('Invalid API key');
    if (isAuth) {
      return res.status(401).json(formatAgentError("INVALID_API_KEY", "Composio service configuration is invalid or expired."));
    }
    console.error("[/api/agent/mcp] Top-level handler error:", error);
    return res.status(500).json(formatAgentError("AGENT_CONNECTION_FAILED", error.message));
  }
});

// --- Official Composio Agent Endpoints ---

// POST /api/agents/connect: Accepts { fishUserId, agentType, googleUid }, creates session, saves to database, returns { success: true, mcpUrl, mcpHeaders }
app.post("/api/agents/connect", async (req, res) => {
  try {
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    const { agentType } = req.body;
    if (!rawUserId) {
      return res.status(400).json(formatAgentError("USER_NOT_AUTHENTICATED", "googleUid or fishUserId is required"));
    }
    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const resolvedAgentType = agentType || "default";
    const composioUserId = canonicalFishUserId(googleUid);

    const composio = getComposio();

    // Query active toolkits
    let activeToolkits: string[] = [];
    try {
      const list: any = await composio.connectedAccounts.list({ userIds: [composioUserId], userUuid: composioUserId } as any);
      const items = list?.items || (Array.isArray(list) ? list : []);
      const active = items.filter((a: any) => a.status === 'ACTIVE' || a.status === 'CONNECTED' || (!a.status && a.id));
      activeToolkits = Array.from(new Set(active.map((a: any) => mapToolkitToComposioSlug(a.toolkit?.slug || a.toolkit || a.app || a.toolkitSlug)).filter(Boolean)));
    } catch (e: any) {
      if (!e?.message?.includes('401') && !e?.message?.includes('Invalid API key')) {
        console.warn("[/api/agents/connect] List error:", e?.message);
      }
    }

    const sessionOptions: any = { mcp: true };
    if (activeToolkits.length > 0) {
      sessionOptions.toolkits = activeToolkits;
      sessionOptions.sessionPreset = "direct_tools";
    }

    let session: any;
    try {
      session = await composio.create(composioUserId, sessionOptions);
    } catch (err: any) {
      const isAuth = err?.status === 401 || `${err?.message}`.includes('401') || `${err?.message}`.includes('Invalid API key');
      if (isAuth) {
        return res.status(401).json(formatAgentError("INVALID_API_KEY", "Composio service configuration is invalid or unauthorized"));
      }
      try {
        session = await composio.create(composioUserId, { mcp: true });
      } catch (err2: any) {
        const isAuth2 = err2?.status === 401 || `${err2?.message}`.includes('401') || `${err2?.message}`.includes('Invalid API key');
        if (isAuth2) {
          return res.status(401).json(formatAgentError("INVALID_API_KEY", "Composio service configuration is invalid or unauthorized"));
        }
        throw err2;
      }
    }

    const mcpUrl = session.mcp?.url || (session.mcp as any)?.url;
    const mcpHeaders: Record<string, string> = {}; // Do not expose API key

    // Database record conforming to requested schema: { fishUserId, composioUserId, agentType, composioSessionId, status: "ACTIVE", createdAt }
    const sessionRecord: FishAgentSession = {
      fishUserId: googleUid,
      composioUserId,
      agentType: resolvedAgentType,
      composioSessionId: session.sessionId,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      mcpUrl,
      mcpHeaders,
    };

    const key = `${googleUid}_${resolvedAgentType}`;
    fishAgentDatabase.set(key, sessionRecord);
    fishAgentDatabase.set(session.sessionId, sessionRecord);
    persistSessionsToDisk();

    return res.json({
      success: true,
      mcpUrl,
      mcpHeaders: {},
      sessionId: session.sessionId,
      composioUserId,
      googleUid,
      agentType: resolvedAgentType,
    });
  } catch (error: any) {
    const isAuth = error?.status === 401 || `${error?.message}`.includes('401') || `${error?.message}`.includes('Invalid API key');
    if (isAuth) {
      return res.status(401).json(formatAgentError("INVALID_API_KEY", "Composio service configuration is invalid or unauthorized"));
    }
    console.error("Error in /api/agents/connect:", error);
    return res.status(500).json(formatAgentError("AGENT_CONNECTION_FAILED", error.message || "Failed to connect agent"));
  }
});

// POST /api/agents/retrieve: Accepts { fishUserId, agentType, googleUid }, reads saved composioSessionId from database, uses composio.use, returns { mcpUrl, mcpHeaders }
app.post("/api/agents/retrieve", async (req, res) => {
  try {
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    const { agentType } = req.body;
    if (!rawUserId) {
      return res.status(400).json(formatAgentError("USER_NOT_AUTHENTICATED", "googleUid or fishUserId is required"));
    }
    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const resolvedAgentType = agentType || "default";
    const key = `${googleUid}_${resolvedAgentType}`;
    let savedRecord = fishAgentDatabase.get(key);

    const composio = getComposio();
    let session: any;

    if (savedRecord?.composioSessionId) {
      try {
        session = await composio.use(savedRecord.composioSessionId, { mcp: true });
      } catch (err: any) {
        console.warn("[/api/agents/retrieve] composio.use failed, recreating session:", err?.message);
        session = null;
      }
    }

    if (!session) {
      // Re-create session on demand
      const composioUserId = canonicalFishUserId(googleUid);
      session = await composio.create(composioUserId, { mcp: true });
      savedRecord = {
        fishUserId: googleUid,
        composioUserId,
        agentType: resolvedAgentType,
        composioSessionId: session.sessionId,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        mcpUrl: session.mcp?.url,
        mcpHeaders: {},
      };
      fishAgentDatabase.set(key, savedRecord);
      fishAgentDatabase.set(session.sessionId, savedRecord);
      persistSessionsToDisk();
    }

    const mcpUrl = session.mcp?.url || (session.mcp as any)?.url || savedRecord?.mcpUrl;

    return res.json({
      success: true,
      mcpUrl,
      mcpHeaders: {},
      sessionId: session.sessionId,
      status: savedRecord?.status || "ACTIVE",
    });
  } catch (error: any) {
    console.error("Error in /api/agents/retrieve:", error);
    return res.status(500).json(formatAgentError("INVALID_SESSION", error.message || "Failed to retrieve agent session"));
  }
});

// POST /api/agents/revoke: Accepts { fishUserId, agentType, googleUid }, deletes session record from database
app.post("/api/agents/revoke", async (req, res) => {
  try {
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    const { agentType } = req.body;
    if (!rawUserId) {
      return res.status(400).json({ error: "googleUid or fishUserId is required" });
    }
    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const resolvedAgentType = agentType || "default";
    const key = `${googleUid}_${resolvedAgentType}`;
    const savedRecord = fishAgentDatabase.get(key);

    if (savedRecord) {
      fishAgentDatabase.delete(key);
      fishAgentDatabase.delete(savedRecord.composioSessionId);
      persistSessionsToDisk();
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error in /api/agents/revoke:", error);
    return res.status(500).json({ error: error.message || "Failed to revoke agent session" });
  }
});

// TASK 1: Connect Fish User Agent endpoint
app.post("/api/fish/connect-agent", async (req, res) => {
  try {
    const { fishUserId, agentType } = req.body;
    if (!fishUserId) {
      return res.status(400).json({ error: "fishUserId is required" });
    }
    const resolvedAgentType = agentType || "default";

    const agentData = await setupFishUserAgent(fishUserId, resolvedAgentType);

    // Save to Fish/Firebase database
    const sessionRecord: StoredAgentSession = {
      sessionId: agentData.sessionId,
      composioSessionId: agentData.sessionId,
      status: "ACTIVE",
      fishUserId,
      composioUserId: agentData.composioUserId,
      agentType: resolvedAgentType,
      mcpUrl: agentData.mcpUrl,
      mcpHeaders: agentData.mcpHeaders,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fishAgentDatabase.set(agentData.sessionId, sessionRecord);
    fishAgentDatabase.set(`user_${fishUserId}_${resolvedAgentType}`, sessionRecord);
    persistSessionsToDisk();

    // Return the JSON with mcpUrl and mcpHeaders to the frontend
    res.json({
      agentType: agentData.agentType,
      composioUserId: agentData.composioUserId,
      sessionId: agentData.sessionId,
      mcpUrl: agentData.mcpUrl,
      mcpHeaders: agentData.mcpHeaders,
    });
  } catch (error: any) {
    console.error("Error in /api/fish/connect-agent:", error);
    res.status(500).json({ error: error.message || "Failed to setup fish user agent" });
  }
});

// TASK 2: Connect Fish User App/Toolkit endpoint
app.post("/api/fish/connect-app", async (req, res) => {
  try {
    const { fishUserId, toolkit, callbackUrl } = req.body;
    if (!fishUserId) {
      return res.status(400).json({ error: "fishUserId is required" });
    }
    if (!toolkit) {
      return res.status(400).json({ error: "toolkit is required" });
    }

    const hostCallbackUrl = callbackUrl || `${req.protocol}://${req.get("host")}/api/composio/callback`;
    const result = await connectFishUserToolkit(fishUserId, toolkit, hostCallbackUrl);

    // Return oauthUrl to frontend
    res.json({
      oauthUrl: result.oauthUrl,
    });
  } catch (error: any) {
    console.error("Error in /api/fish/connect-app:", error);
    res.status(500).json({ error: error.message || "Failed to connect app toolkit" });
  }
});

// TASK 3: Retrieve or re-use existing agent session
app.post("/api/fish/use-session", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const sessionData = await useExistingAgentSession(sessionId);
    res.json({
      sessionId: sessionData.sessionId,
      mcpUrl: sessionData.mcpUrl,
      mcpHeaders: sessionData.mcpHeaders,
    });
  } catch (error: any) {
    console.error("Error in /api/fish/use-session:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve agent session" });
  }
});

app.get("/api/fish/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const sessionData = await useExistingAgentSession(sessionId);
    res.json({
      sessionId: sessionData.sessionId,
      mcpUrl: sessionData.mcpUrl,
      mcpHeaders: sessionData.mcpHeaders,
    });
  } catch (error: any) {
    console.error("Error in /api/fish/session/:sessionId:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve session" });
  }
});

// ==========================================================
// API KEYS MANAGEMENT & UNIVERSAL AUTHENTICATION ENGINE
// ==========================================================
interface StoredApiKey {
  id: string;
  name: string;
  token: string;
  maskedToken: string;
  access: "Full access" | "Read only" | "Custom";
  ipAllowlist: string;
  userId: string;
  userEmail?: string;
  createdAt: string;
  lastUsedAt?: string;
  status: "ACTIVE" | "REVOKED";
  allowedToolkits?: string[];
}

const fyshApiKeysDatabase = new Map<string, StoredApiKey>();
const tokenIndex = new Map<string, string>(); // token -> keyId

// --- Persistent storage: Firestore primary, file fallback for single-instance & tests ---
const PERSIST_DIR = path.join(process.cwd(), "data");
const KEYS_PERSIST_FILE = path.join(PERSIST_DIR, "fysh_keys.json");
const SESSIONS_PERSIST_FILE = path.join(PERSIST_DIR, "fysh_sessions.json");

function ensurePersistDir() {
  try { if (!fs.existsSync(PERSIST_DIR)) fs.mkdirSync(PERSIST_DIR, { recursive: true }); } catch {}
}
let persistKeysPending = false;
function persistKeysToDisk() {
  // في وضع Supabase تُكتب المفاتيح صفًّا بصف عبر serverStorage (أسرع وأأمن).
  if (storageMode() === "supabase") return;
  if (persistKeysPending) return;
  persistKeysPending = true;
  setImmediate(() => {
    persistKeysPending = false;
    try {
      ensurePersistDir();
      const arr = Array.from(fyshApiKeysDatabase.values());
      const tmp = KEYS_PERSIST_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(arr, null, 2));
      fs.renameSync(tmp, KEYS_PERSIST_FILE);
    } catch (e) { console.warn("persistKeysToDisk failed", e); }
  });
}
function loadKeysFromDisk() {
  try {
    if (fs.existsSync(KEYS_PERSIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(KEYS_PERSIST_FILE, "utf-8"));
      if (Array.isArray(data)) {
        for (const k of data) {
          fyshApiKeysDatabase.set(k.id, k);
          tokenIndex.set(k.token, k.id);
        }
        console.log(`[PERSIST] Loaded ${data.length} API keys from disk`);
      }
    }
  } catch (e) { console.warn("loadKeysFromDisk failed", e); }
}
let persistSessionsPending = false;
function persistSessionsToDisk() {
  if (persistSessionsPending) return;
  persistSessionsPending = true;
  setImmediate(() => {
    persistSessionsPending = false;
    try {
      ensurePersistDir();
      const arr = Array.from(fishAgentDatabase.entries()).map(([k, v]) => ({ _mapKey: k, ...v }));
      const tmp = SESSIONS_PERSIST_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(arr, null, 2));
      fs.renameSync(tmp, SESSIONS_PERSIST_FILE);
    } catch (e) { console.warn("persistSessionsToDisk failed", e); }
  });
}
function loadSessionsFromDisk() {
  try {
    if (fs.existsSync(SESSIONS_PERSIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_PERSIST_FILE, "utf-8"));
      if (Array.isArray(data)) {
        for (const entry of data) {
          const { _mapKey, ...session } = entry;
          fishAgentDatabase.set(_mapKey, session as FishAgentSession);
        }
        console.log(`[PERSIST] Loaded ${data.length} agent sessions from disk`);
      }
    }
  } catch (e) { console.warn("loadSessionsFromDisk failed", e); }
}
// Load on boot
loadKeysFromDisk();
loadSessionsFromDisk();

/** يحوّل سجل المفتاح إلى الشكل الذي تُخزَّنه قاعدة البيانات. */
function toPersistedKey(record: StoredApiKey): PersistedKey {
  return {
    id: record.id,
    name: record.name,
    plain: record.token,
    masked: record.maskedToken,
    access: record.access,
    ipAllowlist: record.ipAllowlist,
    userId: record.userId,
    userEmail: record.userEmail,
    status: record.status,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  };
}

/** يستبدل الذاكرة بما في قاعدة البيانات (إن كانت مُهيّأة). */
async function hydrateKeysFromDb() {
  if (storageMode() !== "supabase") return;
  try {
    const rows = await loadKeysFromDb();
    fyshApiKeysDatabase.clear();
    tokenIndex.clear();
    for (const row of rows) {
      const record: StoredApiKey = {
        id: row.id,
        name: row.name,
        token: row.plain,
        maskedToken: row.masked,
        access: (row.access as StoredApiKey["access"]) || "Full access",
        ipAllowlist: row.ipAllowlist,
        userId: row.userId,
        userEmail: row.userEmail,
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
        status: row.status,
      };
      fyshApiKeysDatabase.set(record.id, record);
      tokenIndex.set(record.token, record.id);
    }
    console.log(`[STORAGE] loaded ${rows.length} keys from Supabase`);
  } catch (err: any) {
    console.warn("[STORAGE] failed to load keys from Supabase:", err?.message);
  }
}

void hydrateKeysFromDb();

function generateSecureApiKeyToken(): string {
  // Use crypto for production-grade entropy
  const randomPart = crypto.randomBytes(21).toString('base64url'); // 28 chars
  return `ak_live_${randomPart}`;
}

function maskToken(token: string): string {
  if (token.length <= 8) return token;
  const suffix = token.slice(-4);
  return `ak_**${suffix}`;
}

// Helper to seed initial workspace keys matching Composio experience
// NOTE: In production these demo keys should NOT be auto-created for real users.
// They are only for local demo / first-time workspace bootstrap when no keys exist.
function ensureInitialKeysForUser(userId: string, userEmail?: string) {
  const userKeys = Array.from(fyshApiKeysDatabase.values()).filter(k => k.userId === userId && k.status === 'ACTIVE');
  if (userKeys.length === 0) {
    // Only seed for the demo workspace; for any other userId generate a single secure key
    const isDemo = userId === 'mayalfalh_workspace' || userId === 'mayalfalh@gmail.com';
    if (isDemo && fyshApiKeysDatabase.size === 0) {
      // Seed demo keys once — use deterministic IDs so disk reload is stable
      const seeds: StoredApiKey[] = [
        { id: `key_demo_1`, name: "FYSH", token: "ak_live_fysh_7x8q9w2e3r4t5y6u_YP6X", maskedToken: "ak_**YP6X", access: "Full access", ipAllowlist: "No restriction", userId, userEmail: userEmail || "mayalfalh@gmail.com", createdAt: "2026-08-27 05:43 UTC", status: "ACTIVE" },
        { id: `key_demo_2`, name: "FYSH1", token: "ak_live_fysh_1a2b3c4d5e6f7g8h_5_aS", maskedToken: "ak_**5_aS", access: "Full access", ipAllowlist: "No restriction", userId, userEmail: userEmail || "mayalfalh@gmail.com", createdAt: "2026-08-27 06:08 UTC", status: "ACTIVE" },
        { id: `key_demo_3`, name: "وكيلي", token: "ak_live_fysh_9k8j7h6g5f4d3s2a_9zMk", maskedToken: "ak_**9zMk", access: "Full access", ipAllowlist: "No restriction", userId, userEmail: userEmail || "mayalfalh@gmail.com", createdAt: "2026-08-29 14:05 UTC", status: "ACTIVE" },
      ];
      for (const k of seeds) {
        if (!fyshApiKeysDatabase.has(k.id)) {
          fyshApiKeysDatabase.set(k.id, k);
          tokenIndex.set(k.token, k.id);
        }
      }
      persistKeysToDisk();
    } else if (!isDemo) {
      // For new real users, do not auto-seed — they will create their own key via /create
      return;
    }
  }
}

// 1. List API Keys for user
app.get("/api/fish/keys", async (req, res) => {
  try {
    const userId = (req.query.fishUserId as string) || "mayalfalh_workspace";
    const userEmail = (req.query.userEmail as string) || "mayalfalh@gmail.com";
    ensureInitialKeysForUser(userId, userEmail);

    const keys = Array.from(fyshApiKeysDatabase.values())
      .filter(k => k.userId === userId && k.status === 'ACTIVE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const viewer = await userFromRequest(req).catch(() => null);
    const canReveal = !!viewer && viewer.uid === userId;
    const safeKeys = keys.map(k => ({ ...k, token: canReveal ? k.token : undefined }));
    res.json({ success: true, keys: safeKeys, canReveal, storage: storageMode() });
  } catch (error: any) {
    console.error("Error in /api/fish/keys:", error);
    res.status(500).json({ error: error.message || "Failed to list API keys" });
  }
});

// 2. Create a new API Key
app.post("/api/fish/keys/create", rateLimit(60_000, 50), async (req, res) => {
  try {
    const { fishUserId, name, access, ipAllowlist, userEmail } = req.body;

    // الهوية: إن أرسل العميل Firebase ID Token نتحقق منه ونربط المفتاح به
    const viewer = await userFromRequest(req).catch(() => null);
    if (requireAuthForKeys() && !viewer) {
      return res.status(401).json({ error: "Authentication required to create an API key" });
    }
    if (viewer && fishUserId && fishUserId !== viewer.uid) {
      return res.status(403).json({ error: "You can only create keys for your own account" });
    }

    const resolvedUserId = viewer?.uid || fishUserId || "mayalfalh_workspace";
    const resolvedEmail = viewer?.email || userEmail;
    const resolvedName = name?.trim() || "FYSH_Agent_Key";
    const resolvedAccess = access || "Full access";
    const resolvedIp = ipAllowlist?.trim() || "No restriction";

    // حد أقصى للمفاتيح النشطة لكل مستخدم (حماية من الإساءة والنمو غير المحدود)
    const ownedActive = Array.from(fyshApiKeysDatabase.values())
      .filter(k => k.userId === resolvedUserId && k.status === "ACTIVE");
    if (ownedActive.length >= maxKeysPerUser()) {
      return res.status(429).json({
        error: `Key limit reached (${maxKeysPerUser()}). Delete an existing key first.`,
        limit: maxKeysPerUser(),
      });
    }

    const rawToken = generateSecureApiKeyToken();
    const masked = maskToken(rawToken);

    const now = new Date();
    const formattedUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;

    const newKey: StoredApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: resolvedName,
      token: rawToken,
      maskedToken: masked,
      access: resolvedAccess,
      ipAllowlist: resolvedIp,
      userId: resolvedUserId,
      userEmail: resolvedEmail || "mayalfalh@gmail.com",
      createdAt: formattedUtc,
      status: "ACTIVE"
    };

    fyshApiKeysDatabase.set(newKey.id, newKey);
    tokenIndex.set(rawToken, newKey.id);
    persistKeysToDisk();
    void upsertKeyToDb(toPersistedKey(newKey)).catch(err =>
      console.warn("[STORAGE] failed to persist key:", err?.message)
    );

    res.json({
      success: true,
      key: newKey,
      token: rawToken,
      message: "API Key created successfully. Store this key securely as you will not be able to see the full token again."
    });
  } catch (error: any) {
    console.error("Error creating API key:", error);
    res.status(500).json({ error: error.message || "Failed to create API key" });
  }
});

// 3. Delete / Revoke an API Key
app.delete("/api/fish/keys/:keyId", async (req, res) => {
  try {
    const { keyId } = req.params;
    const existing = fyshApiKeysDatabase.get(keyId);
    const viewer = await userFromRequest(req).catch(() => null);
    if (viewer && existing && existing.userId !== viewer.uid) {
      return res.status(403).json({ error: "You can only delete your own keys" });
    }
    if (existing) {
      existing.status = "REVOKED";
      tokenIndex.delete(existing.token);
      fyshApiKeysDatabase.delete(keyId);
      persistKeysToDisk();
      void deleteKeyFromDb(keyId).catch(err =>
        console.warn("[STORAGE] failed to delete key:", err?.message)
      );
    }
    res.json({ success: true, message: "API key deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting API key:", error);
    res.status(500).json({ error: error.message || "Failed to delete API key" });
  }
});

// 4. Verify API Key and list connected toolkits
app.post("/api/fish/keys/verify", rateLimit(60_000, 30), async (req, res) => {
  try {
    const rawHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const headerToken = typeof rawHeader === "string" ? rawHeader.replace(/^Bearer\s+/i, "") : null;
    const token = req.body?.apiKey || headerToken;

    if (!token) {
      return res.status(401).json({ valid: false, error: "API Key is required" });
    }

    let keyRecord: StoredApiKey | undefined;
    const keyId = tokenIndex.get(token);
    if (keyId) {
      keyRecord = fyshApiKeysDatabase.get(keyId);
    } else {
      keyRecord = Array.from(fyshApiKeysDatabase.values()).find(k => k.token === token && k.status === "ACTIVE");
    }

    // STRICT VALIDATION: only keys that exist in DB are valid — no prefix bypass
    if (!keyRecord) {
      return res.status(401).json({ valid: false, error: "Invalid API Key — not found or revoked" });
    }
    // Enforce IP allowlist if configured
    if (keyRecord.ipAllowlist && keyRecord.ipAllowlist !== "No restriction") {
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
      const allowedIps = keyRecord.ipAllowlist.split(",").map(s => s.trim()).filter(Boolean);
      if (allowedIps.length > 0 && !allowedIps.includes(clientIp) && clientIp) {
        // Check CIDR / exact match — simple exact check for now
        const isAllowed = allowedIps.some(allowed => clientIp === allowed || clientIp.endsWith(allowed));
        if (!isAllowed) {
          return res.status(403).json({ valid: false, error: `IP ${clientIp} not in allowlist` });
        }
      }
    }
    // Update lastUsedAt
    keyRecord.lastUsedAt = new Date().toISOString();
    fyshApiKeysDatabase.set(keyRecord.id, keyRecord);
    persistKeysToDisk();

    const isValid = true;
    const resolvedUserId = keyRecord.userId;

    // Fetch active connected accounts for this user
    let connectedAccountsCount = 0;
    let connectedToolkits: string[] = [];

    try {
      const composio = getComposio();
      const composioUserId = canonicalFishUserId(resolvedUserId);
      const result: any = await composio.connectedAccounts.list({
        userIds: [composioUserId],
        userUuid: composioUserId
      } as any);

      const items = result?.items || (Array.isArray(result) ? result : []);
      const active = items.filter((a: any) => a.status === "ACTIVE" || a.status === "CONNECTED" || (!a.status && a.id));
      connectedAccountsCount = active.length;
      connectedToolkits = active.map((a: any) => a.toolkit || a.app || a.appName || "tool");
    } catch (err) {
      console.warn("Connected accounts lookup warning:", err);
    }

    res.json({
      valid: isValid,
      keyName: keyRecord?.name || "FYSH Unified Key",
      access: keyRecord?.access || "Full access",
      userId: resolvedUserId,
      connectedAccountsCount,
      connectedToolkits,
      mcpEndpoint: `${req.protocol}://${req.get("host")}/api/fish/mcp?key=${token}`
    });
  } catch (error: any) {
    console.error("Error verifying API key:", error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

/* FYSH_AGENT_MCP_V2 — نقطة مفتاح فيش الموحّد
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
    const headerValue = typeof rawHeader === "string" ? rawHeader.replace(/^Bearer\s+/i, "") : null;
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
    const base = `${req.get("x-forwarded-proto") || req.protocol}://${req.get("x-forwarded-host") || req.get("host")}`;
    const selfUrl = `${base}/api/fish/mcp?key=${incoming}`;
    const agentUrl = `${base}/api/agent/mcp?userId=${encodeURIComponent(rawFishId(record.userId))}`;

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
          test: `curl -X POST "${selfUrl}" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
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
    console.log(`[FYSH_MCP] method=${req.body?.method} status=${upstream.status} user=${rawFishId(record.userId)} toolkits=${toolkits.length}`);
    return res.send(await upstream.text());
  } catch (error: any) {
    console.error("[/api/fish/mcp] error:", error?.message);
    return res.status(500).json({ jsonrpc: "2.0", id: requestId, error: { code: -32603, message: error?.message || "MCP proxy failed" } });
  }
});

// 5. Universal Execution via Single FYSH API Key
app.post("/api/fish/v1/execute", rateLimit(60_000, 30), async (req, res) => {
  try {
    const rawHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const headerToken = typeof rawHeader === "string" ? rawHeader.replace(/^Bearer\s+/i, "") : null;
    const token = req.body?.apiKey || headerToken;
    const { prompt, action, params } = req.body;

    if (!token) {
      return res.status(401).json({ error: "Missing FYSH API Key in header x-api-key or body apiKey" });
    }

    let keyRecord: StoredApiKey | undefined;
    const keyId = tokenIndex.get(token);
    if (keyId) {
      keyRecord = fyshApiKeysDatabase.get(keyId);
    } else {
      keyRecord = Array.from(fyshApiKeysDatabase.values()).find(k => k.token === token && k.status === "ACTIVE");
    }
    if (!keyRecord || keyRecord.status !== "ACTIVE") {
      return res.status(401).json({ success: false, error: "Invalid or revoked FYSH API Key" });
    }
    // IP allowlist enforcement
    if (keyRecord.ipAllowlist && keyRecord.ipAllowlist !== "No restriction") {
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
      const allowedIps = keyRecord.ipAllowlist.split(",").map(s => s.trim()).filter(Boolean);
      if (allowedIps.length > 0 && clientIp && !allowedIps.includes(clientIp)) {
        return res.status(403).json({ success: false, error: `IP ${clientIp} not allowed for this key` });
      }
    }
    // Access scope enforcement: Read only keys cannot execute writes
    if (keyRecord.access === "Read only" && action && !["read", "list", "get", "search"].some(v => action.toLowerCase().includes(v))) {
      return res.status(403).json({ success: false, error: "Read only key cannot perform write actions" });
    }
    keyRecord.lastUsedAt = new Date().toISOString();
    fyshApiKeysDatabase.set(keyRecord.id, keyRecord);
    persistKeysToDisk();

    const resolvedUserId = keyRecord.userId;
    const composioUserId = canonicalFishUserId(resolvedUserId);

    const composio = getComposio();
    const ai = getGemini();

    // Check user's connected accounts
    const resultList: any = await composio.connectedAccounts.list({
      userIds: [composioUserId],
      userUuid: composioUserId
    } as any).catch(() => ({ items: [] }));

    const items = resultList?.items || (Array.isArray(resultList) ? resultList : []);
    const activeApps = items.filter((a: any) => a.status === "ACTIVE" || a.status === "CONNECTED" || (!a.status && a.id));

    if (activeApps.length === 0) {
      return res.status(400).json({ success: false, error: "No connected apps for this user. Connect at least one toolkit via /api/composio/connect first." });
    }

    // Create session and execute
    const session = await composio.create(composioUserId);
    const tools = await session.tools();

    const taskPrompt = prompt || `Execute action ${action || "status check"} using connected tools.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: taskPrompt }] }],
      config: {
        tools: tools.length > 0 ? (tools as any) : undefined,
        temperature: 0.5,
      }
    });

    res.json({
      success: true,
      apiKeyUsed: keyRecord.maskedToken,
      connectedAppsFound: activeApps.length,
      response: response.text || "Executed successfully through FYSH unified gateway",
    });
  } catch (error: any) {
    console.error("Execute error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Test agent endpoint
app.post("/api/test/run-agent", async (req, res) => {
  try {
    const { prompt, fishUserId } = req.body;
    const resolvedPrompt = prompt || "How many unread emails do I have?";
    const resolvedUserId = fishUserId || "test_user_123";

    const composio = getComposio();
    const ai = getGemini();
    const composioUserId = canonicalFishUserId(resolvedUserId);

    // Step 1: Check account status
    let isOAuthValid = false;
    let targetToolkit = 'gmail';

    try {
      const result: any = await composio.connectedAccounts.list({ 
        userIds: [composioUserId],
        userUuid: composioUserId 
      } as any);

      const items = result?.items || (Array.isArray(result) ? result : []);
      const activeAccount = items.find((acc: any) => 
        acc.status === 'ACTIVE' || acc.status === 'CONNECTED' || (!acc.status && acc.id)
      );

      if (activeAccount) {
        isOAuthValid = true;
        targetToolkit = activeAccount.toolkit || activeAccount.app || 'gmail';
      }
    } catch (err) {
      console.warn("Connected accounts list check warning:", err);
    }

    if (!isOAuthValid) {
      return res.status(400).json({ 
        success: false, 
        error: "OAUTH_NOT_ACTIVE", 
        message: "User account is not active or connected. Please connect first." 
      });
    }

    // Step 2: Run agent session & Gemini
    const session = await composio.create(composioUserId);
    const tools = await session.tools();

    let chatHistory: any[] = [
      { role: "user", parts: [{ text: resolvedPrompt }] }
    ];

    let finalResponseText = "";
    let maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: chatHistory,
        config: {
          tools: tools.length > 0 ? (tools as any) : undefined,
          temperature: 0.7,
        }
      });

      const functionCalls = (response as any).functionCalls || [];

      if (functionCalls && functionCalls.length > 0) {
        chatHistory.push({
          role: "model",
          parts: (response as any).candidates?.[0]?.content?.parts || []
        });

        for (const call of functionCalls) {
          const toolResult = await composio.provider.executeToolCall(composioUserId, call as any);
          
          chatHistory.push({
            role: "tool",
            parts: [{
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            }]
          });
        }
      } else {
        finalResponseText = (response as any).text || "";
        break;
      }
    }

    res.json({ success: true, response: finalResponseText, composioUserId });
  } catch (error: any) {
    console.error("Test agent execution error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Agent Chat endpoint with official SDK status check and failsafe
app.post("/api/fish/agent", rateLimit(60_000, 20), async (req, res) => {
  try {
    const { prompt, fishUserId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!fishUserId) {
      return res.status(400).json({ error: "fishUserId is required" });
    }

    const composio = getComposio();
    const ai = getGemini();
    const composioUserId = canonicalFishUserId(fishUserId);

    // Step 2 & 3: Check status using composio.connectedAccounts.list({ userIds: [composioUserId] })
    let isOAuthValid = false;
    let targetToolkit = 'gmail';

    try {
      const result: any = await composio.connectedAccounts.list({ 
        userIds: [composioUserId],
        userUuid: composioUserId 
      } as any);

      const items = result?.items || (Array.isArray(result) ? result : []);
      
      const activeAccount = items.find((acc: any) => 
        acc.status === 'ACTIVE' || acc.status === 'CONNECTED' || (!acc.status && acc.id)
      );

      const expiredAccount = items.find((acc: any) => 
        acc.status === 'EXPIRED' || acc.status === 'REVOKED' || acc.status === 'DISABLED'
      );

      if (activeAccount) {
        isOAuthValid = true;
        targetToolkit = activeAccount.toolkit || activeAccount.app || 'gmail';
      } else if (expiredAccount) {
        targetToolkit = expiredAccount.toolkit || expiredAccount.app || 'gmail';
      }
    } catch (err) {
      console.warn("Connected accounts list check warning:", err);
    }

    // If status is EXPIRED or NOT_FOUND, return exact JSON with redirectUrl
    if (!isOAuthValid) {
      try {
        const callbackUrl = `${req.protocol}://${req.get('host')}/api/composio/callback`;
        const session = await composio.create(composioUserId, { manageConnections: { callbackUrl } });
        const normalizedTarget = mapToolkitToComposioSlug(targetToolkit);
        const authRequest = await session.authorize(normalizedTarget, { callbackUrl });
        const redirectUrl = (authRequest as any).redirectUrl || (authRequest as any).url || `${req.protocol}://${req.get('host')}/`;

        return res.json({
          success: false,
          error: "OAUTH_EXPIRED",
          redirectUrl
        });
      } catch (authErr: any) {
        return res.json({
          success: false,
          error: "OAUTH_EXPIRED",
          redirectUrl: `${req.protocol}://${req.get('host')}/`
        });
      }
    }

    // Proceed with agent execution if valid
    const session = await composio.create(composioUserId, { mcp: true });
    const tools = await session.tools();

    let chatHistory: any[] = [
      { role: "user", parts: [{ text: prompt }] }
    ];

    let finalResponseText = "";
    let maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: chatHistory,
        config: {
          tools: tools.length > 0 ? (tools as any) : undefined,
          temperature: 0.7,
        }
      });

      const functionCalls = (response as any).functionCalls || [];

      if (functionCalls && functionCalls.length > 0) {
        chatHistory.push({
          role: "model",
          parts: (response as any).candidates?.[0]?.content?.parts || []
        });

        for (const call of functionCalls) {
          let toolResult: any;
          try {
            if (typeof (session as any).execute === 'function') {
              toolResult = await (session as any).execute(call.name, call.args || {});
            } else {
              toolResult = await composio.provider.executeToolCall(composioUserId, call as any);
            }
          } catch (callErr: any) {
            try {
              toolResult = await composio.provider.executeToolCall(composioUserId, call as any);
            } catch (fallbackErr: any) {
              toolResult = { error: callErr.message || fallbackErr.message };
            }
          }
          
          chatHistory.push({
            role: "tool",
            parts: [{
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            }]
          });
        }
      } else {
        finalResponseText = response.text || "";
        break;
      }
    }

    res.json({ success: true, response: finalResponseText, composioUserId });
  } catch (error: any) {
    console.error("Fish Agent execution error:", error);
    res.status(500).json(formatAgentError("TOOL_EXECUTION_FAILED", error.message));
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fish Platform Server running on http://localhost:${PORT}`);
  });
}

startServer();
