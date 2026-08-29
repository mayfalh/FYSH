import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Composio } from "@composio/core";
import { GoogleProvider } from "@composio/google";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Security headers & CORS ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow frontend origin (same host or localhost for dev)
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
export function normalizeFishUserId(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith('fish_user_')) return trimmed;
  // If it's a Firebase UID or random id, prefix it
  return `fish_user_${trimmed.replace(/^fish_user_/, '')}`;
}
export function extractGoogleUid(fishUserId: string): string {
  return fishUserId.replace(/^fish_user_/, '');
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
  const composioUserId = `fish_user_${googleUid}`;
  const session = await composio.create(composioUserId, { mcp: true });
  return { 
    agentType, 
    composioUserId, 
    sessionId: session.sessionId, 
    mcpUrl: session.mcp?.url || (session.mcp as any)?.url, 
    mcpHeaders: session.mcp?.headers || (session.mcp as any)?.headers 
  };
}

// Connect Fish User Toolkit authorization flow
export async function connectFishUserToolkit(fishUserId: string, toolkit: string, callbackUrl?: string) {
  const composio = getComposio();
  const googleUid = fishUserId.startsWith('fish_user_') ? fishUserId.replace('fish_user_', '') : fishUserId;
  const composioUserId = `fish_user_${googleUid}`;
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
  const session = await composio.use(savedSessionId, { mcp: true });
  return {
    sessionId: session.sessionId,
    mcpUrl: session.mcp?.url || (session.mcp as any)?.url,
    mcpHeaders: session.mcp?.headers || (session.mcp as any)?.headers,
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
        console.warn(`[COMPOSIO ERROR] Failed to fetch toolkits page ${page}, status: ${res.status}`);
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
    console.error("[COMPOSIO ERROR] Error fetching catalog:", err.message);
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
    const composio = getComposio();
    const result: any = await composio.connectedAccounts.list({ userIds: ['test_probe_user'] } as any);
    const statusCode = result?.status || 200;
    console.log("Composio API health check status code:", statusCode);
    return res.json({ valid: true, message: "Composio API Key is working" });
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
app.get("/api/composio/connectedAccounts", async (req, res) => {
  try {
    const rawUserId = req.query.fishUserId as string;
    if (!rawUserId || !process.env.COMPOSIO_API_KEY) {
      return res.json({ accounts: [] });
    }

    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const composioUserId = `fish_user_${googleUid}`;
    const apiKey = process.env.COMPOSIO_API_KEY;

    // Use Composio v3.1 REST API directly for accurate connected accounts listing
    const fetchUrl = `https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${encodeURIComponent(composioUserId)}`;
    const response = await fetch(fetchUrl, {
      headers: { 'x-api-key': apiKey }
    });

    if (!response.ok) {
      console.warn(`[COMPOSIO ERROR] Connected accounts fetch returned status ${response.status}`);
      return res.json({ accounts: [] });
    }

    const data = await response.json();
    const rawItems = data.items || (Array.isArray(data) ? data : []);

    // Filter strictly active / valid connections for this user (ignore INITIATED, FAILED, PENDING attempts)
    const accounts = rawItems
      .filter((item: any) => {
        const s = (item.status || item.data?.status || item.state?.val?.status || '').toUpperCase();
        return s === 'ACTIVE' || s === 'CONNECTED';
      })
      .map((item: any) => {
        const slug = item.toolkit?.slug || item.toolkit_slug || item.app || '';
        const name = item.toolkit?.name || item.name || item.app || slug;
        return {
          id: item.id || item.connected_account_id,
          toolkit: slug,
          toolkitSlug: slug,
          appName: name,
          logo: item.toolkit?.logo || `https://logos.composio.dev/api/${slug}`,
          authScheme: item.auth_scheme || item.authScheme || 'OAUTH2',
          status: 'ACTIVE',
          userId: item.user_id || composioUserId,
          createdAt: item.created_at || item.createdAt || new Date().toISOString()
        };
      });

    res.json({ accounts });
  } catch (error: any) {
    console.error("[COMPOSIO ERROR] Failed to list connected accounts:", error.message);
    res.json({ accounts: [] });
  }
});

// Resolve or create Auth Config for any toolkit slug with strict slug and status matching
async function resolveComposioAuthConfig(toolkitSlug: string, apiKey: string): Promise<string> {
  const normSlug = mapToolkitToComposioSlug(toolkitSlug);
  console.log(`[COMPOSIO] Resolving auth config for toolkit: ${normSlug} (original: ${toolkitSlug})`);

  // 1. Query existing auth configs for the exact toolkit slug
  const getRes = await fetch(`https://backend.composio.dev/api/v3.1/auth_configs?limit=100`, {
    headers: { 'x-api-key': apiKey }
  });

  if (getRes.ok) {
    const getData = await getRes.json();
    const existing = getData.items || [];
    
    // Strict match by toolkit slug and enabled status
    const match = existing.find((item: any) => {
      const itemSlug = mapToolkitToComposioSlug(item.toolkit?.slug || item.slug || '');
      const isEnabled = item.status === 'ENABLED';
      return itemSlug === normSlug && isEnabled;
    });

    if (match && (match.id || match.nanoid)) {
      const authConfigId = match.id || match.nanoid;
      console.log(`[COMPOSIO] Auth config found: ${authConfigId} for ${normSlug} (name: ${match.name})`);
      return authConfigId;
    }
  }

  // 2. If not found, create an on-demand Composio-managed auth config
  console.log(`[COMPOSIO] Creating on-demand auth config for: ${normSlug}`);
  const createRes = await fetch('https://backend.composio.dev/api/v3/auth_configs', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      toolkit: { slug: normSlug },
      name: `auth_config_${normSlug}_${Date.now()}`,
      auth_scheme: 'OAUTH2',
      is_composio_managed: true
    })
  });

  if (createRes.ok) {
    const createData = await createRes.json();
    const authConfigId = createData.id || createData.auth_config?.id || createData.nanoid;
    if (authConfigId) {
      console.log(`[COMPOSIO] Auth config created: ${authConfigId} for ${normSlug}`);
      return authConfigId;
    }
  }

  const errBody = await createRes.text();
  console.error(`[COMPOSIO ERROR] Failed to create auth config for ${normSlug}:`, errBody);
  throw new Error(`Could not resolve or create Composio Auth Config for ${normSlug}`);
}

// Connect endpoint: Resolves Auth Config and creates a Composio Connect Link
app.post("/api/composio/connect", rateLimit(60_000, 20), async (req, res) => {
  try {
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    if (!rawUserId) {
      return res.status(400).json({ success: false, error: "fishUserId is required" });
    }

    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "COMPOSIO_API_KEY is not configured on server" });
    }

    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const composioUserId = `fish_user_${googleUid}`;
    
    // Extract raw slug from any parameter provided by client
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
    
    const normalizedToolkit = mapToolkitToComposioSlug(rawSlug);

    // Construct Safe Callback URL
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const isHttps = proto === 'https' || (!host.includes('localhost') && !host.includes('127.0.0.1'));
    const defaultCallback = `${isHttps ? 'https' : 'http'}://${host}/api/composio/callback`;
    const callbackUrl = req.body.callbackUrl || defaultCallback;

    console.log(`[COMPOSIO] COMPOSIO_CONNECT_REQUEST toolkit=${normalizedToolkit} (raw: ${rawSlug}) user_id=${composioUserId} callback=${callbackUrl}`);

    // Try Method 1: Resolve Auth Config and use REST connected_accounts/link
    try {
      const authConfigId = await resolveComposioAuthConfig(normalizedToolkit, apiKey);
      const linkRes = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts/link', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth_config_id: authConfigId,
          user_id: composioUserId,
          callback_url: callbackUrl
        })
      });

      if (linkRes.ok) {
        const linkData = await linkRes.json();
        console.log(`[COMPOSIO] Connect link created successfully for ${normalizedToolkit}:`, {
          connected_account_id: linkData.connected_account_id,
          has_redirect: !!linkData.redirect_url
        });

        return res.json({
          success: true,
          redirectUrl: linkData.redirect_url,
          linkToken: linkData.link_token,
          connectedAccountId: linkData.connected_account_id,
          composioUserId,
          toolkitSlug: normalizedToolkit
        });
      } else {
        const errText = await linkRes.text();
        console.warn(`[COMPOSIO WARNING] REST link creation returned ${linkRes.status}: ${errText}. Attempting SDK fallback...`);
      }
    } catch (authConfigErr: any) {
      console.warn(`[COMPOSIO WARNING] Auth config resolution error for ${normalizedToolkit}: ${authConfigErr.message}. Attempting SDK fallback...`);
    }

    // Method 2 Fallback: Use Composio SDK session.authorize
    try {
      const composio = getComposio();
      const session = await composio.create(composioUserId, { 
        mcp: true, 
        manageConnections: { callbackUrl } 
      });
      const request: any = await session.authorize(normalizedToolkit, { callbackUrl });
      const redirectUrl = request?.redirectUrl || request?.url;
      
      if (redirectUrl) {
        console.log(`[COMPOSIO SDK] Authorize created redirectUrl for ${normalizedToolkit}`);
        return res.json({
          success: true,
          redirectUrl,
          connectedAccountId: request?.connectedAccountId || request?.id,
          composioUserId,
          toolkitSlug: normalizedToolkit
        });
      }
    } catch (sdkErr: any) {
      console.error(`[COMPOSIO SDK ERROR] Authorize failed for ${normalizedToolkit}:`, sdkErr.message);
    }

    return res.status(500).json({
      success: false,
      error: `Could not initialize connection for ${normalizedToolkit}. Please verify integration status in Composio.`
    });
  } catch (error: any) {
    console.error("[COMPOSIO ERROR] Connect error:", error.message);
    res.status(500).json({ success: false, error: error.message || "Failed to initiate Composio connection" });
  }
});

// Verify connection endpoint to check if an account is strictly ACTIVE
app.post("/api/composio/verify", async (req, res) => {
  try {
    const { toolkitSlug, connectedAccountId } = req.body;
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    if (!rawUserId) {
      return res.status(400).json({ error: "fishUserId is required" });
    }

    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      return res.json({ status: "DISCONNECTED", active: false });
    }

    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const composioUserId = `fish_user_${googleUid}`;
    const normSlug = mapToolkitToComposioSlug(toolkitSlug || '');

    console.log(`[COMPOSIO] Verifying connection: ${normSlug} (account: ${connectedAccountId || 'query'}, user: ${composioUserId})...`);

    // 1. If specific connectedAccountId is provided, check directly
    if (connectedAccountId) {
      const accRes = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(connectedAccountId)}`, {
        headers: { 'x-api-key': apiKey }
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        const status = accData.status || accData.data?.status || accData.state?.val?.status;
        console.log(`[COMPOSIO] Account ${connectedAccountId} status: ${status}`);
        if (status === 'ACTIVE' || status === 'CONNECTED') {
          console.log("[COMPOSIO] Connected account verified - Status: ACTIVE");
          return res.json({ status: "ACTIVE", active: true, account: accData });
        }
      }
    }

    // 2. Query all accounts for user and match toolkit
    const listRes = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${encodeURIComponent(composioUserId)}`, {
      headers: { 'x-api-key': apiKey }
    });

    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData.items || [];
      const match = items.find((i: any) => {
        const itemSlug = mapToolkitToComposioSlug(i.toolkit?.slug || i.toolkit_slug || '');
        const itemStatus = i.status || i.data?.status || i.state?.val?.status;
        return (itemSlug === normSlug || !normSlug) && (itemStatus === 'ACTIVE' || itemStatus === 'CONNECTED');
      });

      if (match) {
        console.log(`[COMPOSIO] Connected account verified for ${normSlug} - Status: ACTIVE`);
        return res.json({ status: "ACTIVE", active: true, account: match });
      }
    }

    return res.json({ status: "INITIALIZING", active: false });
  } catch (error: any) {
    console.error("[COMPOSIO ERROR] Verify error:", error.message);
    res.status(500).json({ error: error.message, active: false });
  }
});

// Disconnect account: Real deletion on Composio backend
app.delete("/api/composio/disconnect", async (req, res) => {
  try {
    const { connectedAccountId, toolkitSlug } = req.body;
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    const apiKey = process.env.COMPOSIO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Missing API key" });
    }

    let targetAccountId = connectedAccountId;

    // If account ID not passed directly, find it by toolkit and user
    if (!targetAccountId && rawUserId && toolkitSlug) {
      const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
      const composioUserId = `fish_user_${googleUid}`;
      const normSlug = mapToolkitToComposioSlug(toolkitSlug);

      const listRes = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=${encodeURIComponent(composioUserId)}`, {
        headers: { 'x-api-key': apiKey }
      });

      if (listRes.ok) {
        const listData = await listRes.json();
        const items = listData.items || [];
        const match = items.find((i: any) => mapToolkitToComposioSlug(i.toolkit?.slug || '') === normSlug);
        if (match) targetAccountId = match.id;
      }
    }

    if (!targetAccountId) {
      return res.status(400).json({ success: false, error: "connectedAccountId or (fishUserId + toolkitSlug) required" });
    }

    console.log(`[COMPOSIO] Disconnecting connected account: ${targetAccountId}`);
    const delRes = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(targetAccountId)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': apiKey }
    });

    if (!delRes.ok) {
      const errText = await delRes.text();
      console.error(`[COMPOSIO ERROR] Delete account ${targetAccountId} failed:`, errText);
      return res.status(delRes.status).json({ success: false, error: "Failed to disconnect account" });
    }

    console.log(`[COMPOSIO] Connected account ${targetAccountId} disconnected successfully.`);
    res.json({ success: true, disconnectedId: targetAccountId });
  } catch (error: any) {
    console.error("[COMPOSIO ERROR] Disconnect error:", error.message);
    res.status(500).json({ success: false, error: error.message });
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
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (apiKey) {
      await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey }
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Official Composio Agent Endpoints ---

// POST /api/agents/connect: Accepts { fishUserId, agentType, googleUid }, creates session, saves to database, returns { success: true, mcpUrl, mcpHeaders }
app.post("/api/agents/connect", async (req, res) => {
  try {
    const rawUserId = req.body.googleUid || req.body.fishUserId;
    const { agentType } = req.body;
    if (!rawUserId) {
      return res.status(400).json({ error: "googleUid or fishUserId is required" });
    }
    const googleUid = rawUserId.startsWith('fish_user_') ? rawUserId.replace('fish_user_', '') : rawUserId;
    const resolvedAgentType = agentType || "default";
    const composioUserId = `fish_user_${googleUid}`;

    const composio = getComposio();
    const session = await composio.create(composioUserId, { mcp: true });

    const mcpUrl = session.mcp?.url || (session.mcp as any)?.url;
    const mcpHeaders = session.mcp?.headers || (session.mcp as any)?.headers;

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
      mcpHeaders,
      sessionId: session.sessionId,
      composioUserId,
      googleUid,
      agentType: resolvedAgentType,
    });
  } catch (error: any) {
    console.error("Error in /api/agents/connect:", error);
    return res.status(500).json({ error: error.message || "Failed to connect agent" });
  }
});

// POST /api/agents/retrieve: Accepts { fishUserId, agentType, googleUid }, reads saved composioSessionId from database, uses composio.use, returns { mcpUrl, mcpHeaders }
app.post("/api/agents/retrieve", async (req, res) => {
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

    if (!savedRecord || !savedRecord.composioSessionId || savedRecord.status !== "ACTIVE") {
      return res.status(404).json({ error: "No active agent session found for this user and agent type" });
    }

    const composio = getComposio();
    const session = await composio.use(savedRecord.composioSessionId, { mcp: true });

    const mcpUrl = session.mcp?.url || (session.mcp as any)?.url || savedRecord.mcpUrl;
    const mcpHeaders = session.mcp?.headers || (session.mcp as any)?.headers || savedRecord.mcpHeaders;

    return res.json({
      mcpUrl,
      mcpHeaders,
      sessionId: session.sessionId,
      status: savedRecord.status,
    });
  } catch (error: any) {
    console.error("Error in /api/agents/retrieve:", error);
    return res.status(500).json({ error: error.message || "Failed to retrieve agent session" });
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
app.get("/api/fish/keys", (req, res) => {
  try {
    const userId = (req.query.fishUserId as string) || "mayalfalh_workspace";
    const userEmail = (req.query.userEmail as string) || "mayalfalh@gmail.com";
    ensureInitialKeysForUser(userId, userEmail);

    const keys = Array.from(fyshApiKeysDatabase.values())
      .filter(k => k.userId === userId && k.status === 'ACTIVE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, keys });
  } catch (error: any) {
    console.error("Error in /api/fish/keys:", error);
    res.status(500).json({ error: error.message || "Failed to list API keys" });
  }
});

// 2. Create a new API Key
app.post("/api/fish/keys/create", rateLimit(60_000, 50), (req, res) => {
  try {
    const { fishUserId, name, access, ipAllowlist, userEmail } = req.body;
    const resolvedUserId = fishUserId || "mayalfalh_workspace";
    const resolvedName = name?.trim() || "FYSH_Agent_Key";
    const resolvedAccess = access || "Full access";
    const resolvedIp = ipAllowlist?.trim() || "No restriction";

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
      userEmail: userEmail || "mayalfalh@gmail.com",
      createdAt: formattedUtc,
      status: "ACTIVE"
    };

    fyshApiKeysDatabase.set(newKey.id, newKey);
    tokenIndex.set(rawToken, newKey.id);
    persistKeysToDisk();

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
app.delete("/api/fish/keys/:keyId", (req, res) => {
  try {
    const { keyId } = req.params;
    const existing = fyshApiKeysDatabase.get(keyId);
    if (existing) {
      existing.status = "REVOKED";
      tokenIndex.delete(existing.token);
      fyshApiKeysDatabase.delete(keyId);
      persistKeysToDisk();
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
      const composioUserId = `fish_user_${resolvedUserId}`;
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

// 4b. MCP Universal Endpoint — single key unlocks all connected toolkits (GET for discovery, POST for JSON-RPC)
// Works with Claude Desktop, Cursor, and any MCP client via: https://yourdomain/api/fish/mcp?key=ak_live_xxx
app.all("/api/fish/mcp", rateLimit(60_000, 60), async (req: any, res) => {
  try {
    const rawHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const headerToken = typeof rawHeader === "string" ? rawHeader.replace(/^Bearer\s+/i, "") : null;
    const token = (req.query?.key as string) || (req.query?.apiKey as string) || headerToken || req.body?.apiKey;
    if (!token) {
      return res.status(401).json({ error: "Missing FYSH API Key. Use ?key=ak_live_... or header x-api-key" });
    }
    let keyRecord = tokenIndex.get(token) ? fyshApiKeysDatabase.get(tokenIndex.get(token)!) : Array.from(fyshApiKeysDatabase.values()).find(k => k.token === token && k.status === "ACTIVE");
    if (!keyRecord || keyRecord.status !== "ACTIVE") {
      return res.status(401).json({ error: "Invalid or revoked FYSH API Key" });
    }
    const composioUserId = normalizeFishUserId(keyRecord.userId);
    // Return MCP discovery info on GET
    if (req.method === "GET") {
      let active: any[] = [];
      try {
        const composio = getComposio();
        const list: any = await composio.connectedAccounts.list({ userIds: [composioUserId], userUuid: composioUserId } as any);
        const items = list?.items || (Array.isArray(list) ? list : []);
        active = items.filter((a: any) => a.status === "ACTIVE" || a.status === "CONNECTED" || (!a.status && a.id));
      } catch (e: any) {
        // If COMPOSIO_API_KEY missing or API down, return empty but valid response — do not fail MCP discovery
        if (e.message?.includes("COMPOSIO_API_KEY")) {
          console.warn("[MCP] Composio not configured, returning empty toolkit list");
        } else {
          console.warn("[MCP] connectedAccounts.list failed", e.message);
        }
        active = [];
      }
      return res.json({
        protocol: "mcp",
        version: "1.0",
        fyshUserId: keyRecord.userId,
        composioUserId,
        keyName: keyRecord.name,
        connectedToolkits: active.map((a: any) => a.toolkit || a.app || a.toolkitSlug),
        connectedCount: active.length,
        mcpUrl: `${req.protocol}://${req.get("host")}/api/fish/mcp?key=${token}`,
        usage: {
          claude_desktop: `Add to claude_desktop_config.json -> mcpServers.fysh.args = ["-y","@composio/mcp@latest","--api-key","${token}"]`,
          cursor: `Cursor Settings -> MCP -> Add Server -> URL: ${req.protocol}://${req.get("host")}/api/fish/mcp?key=${token}`,
          curl: `curl -H "x-api-key: ${token}" ${req.protocol}://${req.get("host")}/api/fish/mcp`
        }
      });
    }
    // JSON-RPC passthrough for MCP clients (POST)
    try {
      const composio = getComposio();
      const session = await composio.create(composioUserId);
      const tools = await session.tools();
      return res.json({ jsonrpc: "2.0", id: (req.body as any)?.id || 1, result: { tools, composioUserId, keyName: keyRecord.name } });
    } catch (e: any) {
      return res.status(503).json({ error: "Composio not configured or unavailable", detail: e.message });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
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
    const composioUserId = `fish_user_${resolvedUserId}`;

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
    const composioUserId = `fish_user_${resolvedUserId}`;

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
    const composioUserId = `fish_user_${fishUserId}`;

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
    const session = await composio.create(composioUserId);
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
        finalResponseText = response.text || "";
        break;
      }
    }

    res.json({ success: true, response: finalResponseText, composioUserId });
  } catch (error: any) {
    console.error("Fish Agent execution error:", error);
    res.status(500).json({ success: false, error: error.message });
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
