import { ALL_COMPOSIO_APPS, AppItem } from '../data/appsData';

export const FISH_USER_ID_KEY = 'fysh_composio_user_id';
export const CONNECTED_ACCOUNTS_EVENT = 'fysh:connected_accounts_changed';

export interface ConnectedAccountItem {
  id: string;
  toolkitSlug: string;
  appName?: string;
  name?: string;
  category?: string;
  logo?: string;
  status: 'ACTIVE' | 'CONNECTED' | 'DISCONNECTED' | 'INITIALIZING';
  authScheme?: string;
  userId?: string;
  createdAt?: string;
  appItem?: AppItem;
}

export function getOrCreateStableFishUserId(firebaseUid?: string | null): string {
  // Unified source: always return plain Firebase UID or stable random id WITHOUT prefix
  // Server will prefix with fish_user_
  let rawId = "";
  if (firebaseUid) {
    rawId = firebaseUid.trim();
  } else {
    try {
      // Migrate legacy keys: fish_permanent_uuid, fish_stable_user_id
      const legacy1 = localStorage.getItem('fish_permanent_uuid');
      const legacy2 = localStorage.getItem('fish_stable_user_id');
      const legacy3 = localStorage.getItem(FISH_USER_ID_KEY);
      rawId = legacy3 || legacy1?.replace(/^fish_user_/, '') || legacy2?.replace(/^fish_user_/, '') || "";
      if (legacy1) localStorage.removeItem('fish_permanent_uuid');
      if (legacy2) localStorage.removeItem('fish_stable_user_id');
      if (!rawId) {
        rawId = 'user_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      }
      localStorage.setItem(FISH_USER_ID_KEY, rawId);
    } catch (e) {
      rawId = 'user_default_stable_id';
    }
  }
  try { localStorage.setItem(FISH_USER_ID_KEY, rawId); } catch {}
  return rawId;
}

export function broadcastConnectedAccountsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONNECTED_ACCOUNTS_EVENT));
  }
}

export async function fetchUserConnectedAccounts(fishUserId?: string): Promise<ConnectedAccountItem[]> {
  try {
    const uid = fishUserId || getOrCreateStableFishUserId();
    const res = await fetch(`/api/composio/connectedAccounts?fishUserId=${encodeURIComponent(uid)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const accounts: any[] = data.accounts || [];

    // Filter strictly to ACTIVE or CONNECTED accounts
    const activeAccounts = accounts.filter((acc: any) => {
      const s = (acc.status || '').toUpperCase();
      return s === 'ACTIVE' || s === 'CONNECTED';
    });

    return activeAccounts.map((acc: any) => {
      const slug = (acc.toolkit || acc.toolkitSlug || acc.app || '').toLowerCase().trim().replace(/[-_]/g, '');
      const rawName = (acc.appName || acc.toolkit || '').toLowerCase().trim().replace(/[-_]/g, '');

      const matchedApp = ALL_COMPOSIO_APPS.find(a => {
        const aSlug = (a.composioSlug || a.id || '').toLowerCase().trim().replace(/[-_]/g, '');
        const aName = (a.name || '').toLowerCase().trim().replace(/[-_]/g, '');
        return aSlug === slug || a.id.toLowerCase().replace(/[-_]/g, '') === slug || aName === rawName;
      });

      return {
        id: acc.id,
        toolkitSlug: acc.toolkit || acc.toolkitSlug || acc.app || (matchedApp?.composioSlug || ''),
        appName: matchedApp ? matchedApp.name : (acc.appName || acc.toolkit || 'Connected App'),
        category: matchedApp ? matchedApp.category : (acc.category || 'Productivity & Workspace'),
        logo: matchedApp ? matchedApp.logo : (acc.logo || `https://logos.composio.dev/api/${acc.toolkit || 'composio'}`),
        status: 'ACTIVE',
        authScheme: acc.authScheme || 'OAUTH2',
        userId: acc.userId || uid,
        createdAt: acc.createdAt || new Date().toISOString(),
        appItem: matchedApp
      };
    });
  } catch (err) {
    console.warn('[COMPOSIO CLIENT] Error fetching connected accounts:', err);
    return [];
  }
}

export async function disconnectUserAccount(accountId: string, fishUserId?: string, toolkitSlug?: string): Promise<boolean> {
  try {
    const uid = fishUserId || getOrCreateStableFishUserId();
    
    // Try primary DELETE endpoint
    const res = await fetch(`/api/composio/connectedAccounts/${encodeURIComponent(accountId)}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      broadcastConnectedAccountsChanged();
      return true;
    }

    // Try fallback endpoint
    const fallbackRes = await fetch('/api/composio/disconnect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectedAccountId: accountId,
        fishUserId: uid,
        toolkitSlug: toolkitSlug || ''
      })
    });

    if (fallbackRes.ok) {
      broadcastConnectedAccountsChanged();
      return true;
    }

    return false;
  } catch (err) {
    console.error('[COMPOSIO CLIENT] Error disconnecting account:', err);
    return false;
  }
}

export async function initiateComposioConnect(
  app: AppItem | { id: string; name: string; composioSlug?: string; slug?: string },
  fishUserId?: string
): Promise<{ success: boolean; redirectUrl?: string; error?: string; connectedAccountId?: string }> {
  try {
    const uid = fishUserId || getOrCreateStableFishUserId();
    const slug = (app as any).composioSlug || (app as any).slug || app.id;

    const res = await fetch('/api/composio/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolkitSlug: slug,
        toolkitId: slug,
        appSlug: slug,
        appName: app.name,
        fishUserId: uid,
        callbackUrl: `${window.location.origin}/api/composio/callback`
      })
    });

    const data = await res.json();
    if (!res.ok || data.error || !data.success) {
      return {
        success: false,
        error: data.error || `Failed to initiate connection for ${app.name}`
      };
    }

    return {
      success: true,
      redirectUrl: data.redirectUrl,
      connectedAccountId: data.connectedAccountId
    };
  } catch (err: any) {
    console.error('[COMPOSIO CLIENT] Connect error:', err);
    return {
      success: false,
      error: err.message || 'Network error initiating connection'
    };
  }
}

export async function fetchFishUserMcpConfig(fishUserId?: string): Promise<{ url: string; headers: Record<string, string>; fyshMcpUrl?: string }> {
  const uid = fishUserId || getOrCreateStableFishUserId();
  try {
    const res = await fetch(`/api/agent/mcp?userId=${encodeURIComponent(uid)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        url: data.fyshMcpUrl || data.url || `${window.location.origin}/api/agent/mcp?userId=${encodeURIComponent(uid)}`,
        headers: data.headers || {},
        fyshMcpUrl: data.fyshMcpUrl
      };
    }
  } catch (e) {
    console.warn("Failed to fetch user MCP config:", e);
  }
  return {
    url: typeof window !== 'undefined' ? `${window.location.origin}/api/agent/mcp?userId=${encodeURIComponent(uid)}` : 'https://fysh.online/api/agent/mcp',
    headers: {}
  };
}
