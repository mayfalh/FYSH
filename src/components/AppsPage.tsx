import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  Plus, 
  ExternalLink, 
  Check, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  Key, 
  ChevronDown,
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  X, 
  User,
  SlidersHorizontal,
  Info,
  Globe,
  Radio,
  CheckCircle2,
  Trash2,
  Lock,
  LayoutGrid,
  ListFilter,
  Minus,
  MessageSquare,
  Cpu,
  Terminal,
  Calendar,
  Users,
  Database,
  Palette,
  CreditCard,
  Globe2,
  Headphones,
  Shield,
  Plug
} from 'lucide-react';
import { ALL_COMPOSIO_APPS, APPS_CATEGORIES, AppCategory, AppItem } from '../data/appsData';
import { Lang, t } from '../translations';
import { GlobalSearchModal } from './GlobalSearchModal';
import { getOrCreateStableFishUserId } from '../lib/composioClient';
import { auth } from '../lib/firebase';

interface AppsPageProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onNavigateHome: () => void;
  onNavigateToAgents?: () => void;
  onNavigateToApiKeys?: () => void;
  onOpenLogin: () => void;
  isLoggedIn: boolean;
}

type SortOption = 'popular' | 'name-asc' | 'name-desc' | 'recent';
type ShowOption = 'all' | 'composio' | 'connected';

export function AppsPage({
  lang,
  setLang,
  onNavigateHome,
  onNavigateToAgents,
  onNavigateToApiKeys,
  onOpenLogin,
  isLoggedIn,
}: AppsPageProps) {
  const currentT = t[lang];

  // Filtering and view states
  const [activeTab, setActiveTab] = useState<'all' | 'connected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');

  // Sort & Show Dropdown states (Matching user screenshot)
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('popular');
  const [showOption, setShowOption] = useState<ShowOption>('all');
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic Apps Catalog State
  const [appsList, setAppsList] = useState<AppItem[]>(ALL_COMPOSIO_APPS);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [customMcps, setCustomMcps] = useState<{ id: string; name: string; url: string; category: AppCategory }[]>([]);

  // Connected accounts from Composio
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  // Connection process states
  const [connectionStates, setConnectionStates] = useState<Record<string, 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'FAILED'>>({});
  const [errorMsg, setErrorMsg] = useState<{ id?: string; message: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Modal states
  const [isAddMcpOpen, setIsAddMcpOpen] = useState(false);
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpCategory, setMcpCategory] = useState<AppCategory>('Custom & Community MCP');

  // Close view dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load dynamic catalog from Composio backend endpoint with robust deduplication
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      setIsLoadingCatalog(true);
      try {
        const res = await fetch('/api/composio/toolkits');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.toolkits && Array.isArray(data.toolkits) && data.toolkits.length > 0) {
            const knownIdentifiers = new Set<string>();
            ALL_COMPOSIO_APPS.forEach(a => {
              if (a.id) knownIdentifiers.add(a.id.toLowerCase().replace(/[^a-z0-9]/g, ''));
              if (a.composioSlug) knownIdentifiers.add(a.composioSlug.toLowerCase().replace(/[^a-z0-9]/g, ''));
              if (a.name) {
                knownIdentifiers.add(a.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
                knownIdentifiers.add(a.name.toLowerCase().replace(/\s+mcp$/i, '').replace(/[^a-z0-9]/g, ''));
              }
            });

            const extraApps: AppItem[] = [];

            data.toolkits.forEach((t: any) => {
              const rawSlug = t.slug || t.id || '';
              const rawName = t.name || t.slug || '';
              const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanBaseName = rawName.toLowerCase().replace(/\s+mcp$/i, '').replace(/[^a-z0-9]/g, '');

              if (
                cleanSlug &&
                !knownIdentifiers.has(cleanSlug) &&
                !knownIdentifiers.has(cleanName) &&
                !knownIdentifiers.has(cleanBaseName)
              ) {
                knownIdentifiers.add(cleanSlug);
                knownIdentifiers.add(cleanName);
                knownIdentifiers.add(cleanBaseName);

                let cat: AppCategory = 'Developer & DevOps';
                const nameLower = rawName.toLowerCase();
                const rawCat = (t.category || '').toLowerCase();

                if (nameLower.includes('mail') || nameLower.includes('chat') || nameLower.includes('message') || nameLower.includes('social') || nameLower.includes('slack') || rawCat.includes('communication')) {
                  cat = 'Communication';
                } else if (nameLower.includes('ai') || nameLower.includes('llm') || nameLower.includes('gpt') || nameLower.includes('search') || rawCat.includes('ai')) {
                  cat = 'AI, Search & LLMs';
                } else if (nameLower.includes('crm') || nameLower.includes('sales') || nameLower.includes('market') || rawCat.includes('sales') || rawCat.includes('crm')) {
                  cat = 'CRM, Sales & Marketing';
                } else if (nameLower.includes('data') || nameLower.includes('sql') || nameLower.includes('db') || nameLower.includes('cloud') || rawCat.includes('data')) {
                  cat = 'Data, Analytics & Cloud';
                } else if (nameLower.includes('scrape') || nameLower.includes('crawl') || nameLower.includes('web') || rawCat.includes('scrape')) {
                  cat = 'Scraping & Web Tools';
                } else if (nameLower.includes('doc') || nameLower.includes('sheet') || nameLower.includes('task') || nameLower.includes('project') || rawCat.includes('productiv')) {
                  cat = 'Productivity & Workspace';
                } else if (nameLower.includes('pay') || nameLower.includes('bank') || nameLower.includes('invoice') || nameLower.includes('shop') || rawCat.includes('finance')) {
                  cat = 'Finance & E-commerce';
                } else if (nameLower.includes('support') || nameLower.includes('desk') || nameLower.includes('ticket') || nameLower.includes('hr') || rawCat.includes('support')) {
                  cat = 'HR & Customer Support';
                } else if (nameLower.includes('security') || nameLower.includes('auth') || rawCat.includes('security')) {
                  cat = 'Security, Utilities & APIs';
                }

                extraApps.push({
                  id: rawSlug,
                  name: rawName,
                  category: cat,
                  logo: t.logo || `https://logos.composio.dev/api/${rawSlug}`,
                  verified: t.verified ?? true,
                  isBuiltInActive: false,
                  composioSlug: rawSlug,
                  description: t.description || `${rawName} integration via Composio MCP.`,
                  popularityRank: 999
                });
              }
            });

            // Preserve local top order first, then append extra tools
            const uniqueMap = new Map<string, AppItem>();
            ALL_COMPOSIO_APPS.forEach(app => uniqueMap.set(app.id, app));
            extraApps.forEach(app => {
              if (!uniqueMap.has(app.id)) {
                uniqueMap.set(app.id, app);
              }
            });

            setAppsList(Array.from(uniqueMap.values()));
          }
        }
      } catch (err) {
        console.warn("Could not fetch remote Composio toolkits, using built-in catalog:", err);
      } finally {
        if (isMounted) setIsLoadingCatalog(false);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  // Load custom MCPs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fysh_custom_mcps');
      if (saved) {
        setCustomMcps(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load custom MCPs", e);
    }
  }, []);

  // Fetch connected accounts from Composio — unified identity (prefers Firebase UID)
  const fetchConnectedAccounts = useCallback(async () => {
    try {
      const rawId = auth.currentUser?.uid || getOrCreateStableFishUserId();
      const fishUserId = typeof rawId === 'string' ? rawId : await rawId;
      const res = await fetch(`/api/composio/connectedAccounts?fishUserId=${encodeURIComponent(fishUserId)}`);
      const data = await res.json();
      if (data.accounts && Array.isArray(data.accounts)) {
        setConnectedAccounts(data.accounts);
      }
    } catch (err) {
      console.warn("Failed to fetch connected accounts", err);
    }
  }, []);

  useEffect(() => {
    fetchConnectedAccounts();
  }, [fetchConnectedAccounts]);

  // Listen to global changes and postMessage
  useEffect(() => {
    const handleGlobalSync = () => {
      fetchConnectedAccounts();
    };
    window.addEventListener('fysh:connected_accounts_changed', handleGlobalSync);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'COMPOSIO_AUTH_SUCCESS' || event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const appSlug = event.data?.appSlug || event.data?.appName;
        if (appSlug) {
          setConnectionStates(prev => ({ ...prev, [appSlug]: 'CONNECTED' }));
        }
        fetchConnectedAccounts();
        setSuccessMsg(lang === 'ar' ? 'تم ربط التطبيق بنجاح!' : 'App connected successfully!');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    };

    window.addEventListener('message', handleMessage);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchConnectedAccounts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('fysh:connected_accounts_changed', handleGlobalSync);
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchConnectedAccounts, lang]);

  // Helper to check if an app has a strictly active connected account via Composio
  const getConnectedAccount = useCallback((app: AppItem) => {
    const slug = (app.composioSlug || app.id).toLowerCase().trim().replace(/[-_]/g, '');
    const appName = app.name.toLowerCase().trim().replace(/[-_]/g, '');
    
    return connectedAccounts.find(acc => {
      const isStatusActive = (acc.status || '').toUpperCase() === 'ACTIVE' || (acc.status || '').toUpperCase() === 'CONNECTED';
      if (!isStatusActive) return false;

      const accSlug = (acc.toolkitSlug || acc.toolkit || acc.appSlug || '').toLowerCase().trim().replace(/[-_]/g, '');
      const accName = (acc.appName || '').toLowerCase().trim().replace(/[-_]/g, '');

      return (
        (accSlug && accSlug === slug) ||
        (accName && accName === appName) ||
        (accSlug && app.id.toLowerCase().replace(/[-_]/g, '') === accSlug)
      );
    });
  }, [connectedAccounts]);

  // Trigger app connection
  const handleConnectApp = async (app: AppItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (app.isBuiltInActive) {
      setSuccessMsg(lang === 'ar' ? `${app.nameAr || app.name} نشط وجاهز للاستخدام الفوري` : `${app.name} is active and ready to use`);
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }

    const appId = app.id;
    setConnectionStates(prev => ({ ...prev, [appId]: 'CONNECTING' }));
    setErrorMsg(null);

    try {
      const fishUserId = auth.currentUser?.uid || getOrCreateStableFishUserId();
      const slug = app.composioSlug || app.id;
      
      const res = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolkitSlug: slug,
          toolkitId: slug,
          appSlug: slug,
          appName: app.name,
          fishUserId: fishUserId,
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to initiate authorization');
      }

      if (data.redirectUrl || data.oauthUrl || data.connectUrl || data.url) {
        const authUrl = data.redirectUrl || data.oauthUrl || data.connectUrl || data.url;
        const width = 640;
        const height = 750;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const authWindow = window.open(
          authUrl,
          `Connect_${app.name}`,
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
        );

        const pollInterval = setInterval(async () => {
          if (authWindow && authWindow.closed) {
            clearInterval(pollInterval);
            await fetchConnectedAccounts();
            window.dispatchEvent(new CustomEvent('fysh:connected_accounts_changed'));
            setConnectionStates(prev => ({ ...prev, [appId]: 'IDLE' }));
          }
        }, 1200);
      } else {
        setConnectionStates(prev => ({ ...prev, [appId]: 'CONNECTED' }));
        fetchConnectedAccounts();
        window.dispatchEvent(new CustomEvent('fysh:connected_accounts_changed'));
        setSuccessMsg(lang === 'ar' ? `تم ربط ${app.nameAr || app.name} بنجاح!` : `${app.name} connected successfully!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error("Connect error", err);
      setConnectionStates(prev => ({ ...prev, [appId]: 'FAILED' }));
      setErrorMsg({
        id: appId,
        message: lang === 'ar' 
          ? `تعذر بدء عملية ربط ${app.nameAr || app.name}. يرجى التحقق من الاتصال والمحاولة مجدداً.` 
          : `Failed to connect ${app.name}. Please try again.`
      });
      setTimeout(() => setConnectionStates(prev => ({ ...prev, [appId]: 'IDLE' })), 3000);
    }
  };

  // Disconnect app handler
  const handleDisconnectApp = async (app: AppItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const conn = getConnectedAccount(app);
    if (!conn || !conn.id) return;

    try {
      const fishUserId = auth.currentUser?.uid || getOrCreateStableFishUserId();
      const res = await fetch(`/api/composio/connectedAccounts/${conn.id}?fishUserId=${encodeURIComponent(fishUserId)}&toolkitSlug=${encodeURIComponent(app.composioSlug || app.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchConnectedAccounts();
        window.dispatchEvent(new CustomEvent('fysh:connected_accounts_changed'));
        setSuccessMsg(lang === 'ar' ? `تم إلغاء ربط ${app.nameAr || app.name}` : `Disconnected ${app.name}`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Disconnect error", err);
    }
  };

  // Add Custom MCP handler
  const handleAddCustomMcp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpName.trim() || !mcpUrl.trim()) return;

    const newMcp = {
      id: `custom-mcp-${Date.now()}`,
      name: mcpName.trim(),
      url: mcpUrl.trim(),
      category: mcpCategory,
    };

    const updated = [...customMcps, newMcp];
    setCustomMcps(updated);
    try {
      localStorage.setItem('fysh_custom_mcps', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage error", e);
    }

    setMcpName('');
    setMcpUrl('');
    setIsAddMcpOpen(false);
    setSuccessMsg(lang === 'ar' ? 'تمت إضافة خادم MCP المخصص بنجاح!' : 'Custom MCP server added successfully!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Combine built-in apps with custom MCPs, strictly deduplicating by id
  const combinedApps: AppItem[] = useMemo(() => {
    const map = new Map<string, AppItem>();
    appsList.forEach(a => {
      if (a.id) map.set(a.id, a);
    });

    customMcps.forEach(m => {
      if (!map.has(m.id)) {
        map.set(m.id, {
          id: m.id,
          name: m.name,
          nameAr: m.name,
          category: m.category,
          logo: 'https://logos.composio.dev/api/composio',
          verified: false,
          description: `Custom MCP Server: ${m.url}`,
          descriptionAr: `خادم بروتوكول MCP مخصص: ${m.url}`,
          popularityRank: 1000
        });
      }
    });

    return Array.from(map.values());
  }, [appsList, customMcps]);

  // Compute category counts for pills - dynamic based on whether viewing All or Connected
  const categoryCounts = useMemo(() => {
    const targetApps = activeTab === 'connected' || showOption === 'connected'
      ? combinedApps.filter(app => !!getConnectedAccount(app))
      : combinedApps;

    const counts: Record<string, number> = { All: targetApps.length };
    APPS_CATEGORIES.forEach(cat => {
      if (cat !== 'All') {
        if (cat === 'Communication') {
          counts[cat] = targetApps.filter(
            app => app.category === 'Communication' || app.category === 'Email & Communication'
          ).length;
        } else {
          counts[cat] = targetApps.filter(app => app.category === cat).length;
        }
      }
    });
    return counts;
  }, [combinedApps, activeTab, showOption, getConnectedAccount]);

  // Precise category, search, show option, and sorting
  const filteredAndSortedApps = useMemo(() => {
    let result = combinedApps.filter(app => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        app.name.toLowerCase().includes(q) ||
        (app.nameAr && app.nameAr.toLowerCase().includes(q)) ||
        app.category.toLowerCase().includes(q) ||
        (app.description && app.description.toLowerCase().includes(q)) ||
        (app.descriptionAr && app.descriptionAr.toLowerCase().includes(q)) ||
        (app.composioSlug && app.composioSlug.toLowerCase().includes(q))
      );

      let matchesCategory = false;
      if (selectedCategory === 'All') {
        matchesCategory = true;
      } else if (selectedCategory === 'Communication') {
        matchesCategory = app.category === 'Communication' || app.category === 'Email & Communication';
      } else {
        matchesCategory = app.category === selectedCategory;
      }

      // Strictly only apps with verified ACTIVE status from Composio
      const isConn = !!getConnectedAccount(app);
      const matchesTab = activeTab === 'all' || (activeTab === 'connected' && isConn);

      // Show filter dropdown options
      let matchesShow = true;
      if (showOption === 'composio') {
        matchesShow = !app.id.startsWith('custom-mcp-') && !!app.composioSlug;
      } else if (showOption === 'connected') {
        matchesShow = isConn;
      }

      return matchesSearch && matchesCategory && matchesTab && matchesShow;
    });

    // Apply Sorting
    return result.sort((a, b) => {
      if (sortOption === 'popular') {
        const rankA = a.popularityRank ?? 999;
        const rankB = b.popularityRank ?? 999;
        return rankA - rankB;
      }
      if (sortOption === 'name-asc') {
        const nameA = lang === 'ar' ? (a.nameAr || a.name) : a.name;
        const nameB = lang === 'ar' ? (b.nameAr || b.name) : b.name;
        return nameA.localeCompare(nameB, lang === 'ar' ? 'ar' : 'en');
      }
      if (sortOption === 'name-desc') {
        const nameA = lang === 'ar' ? (a.nameAr || a.name) : a.name;
        const nameB = lang === 'ar' ? (b.nameAr || b.name) : b.name;
        return nameB.localeCompare(nameA, lang === 'ar' ? 'ar' : 'en');
      }
      if (sortOption === 'recent') {
        // Custom MCPs and newly connected apps first
        const aRecent = a.id.startsWith('custom-mcp-') ? 1 : 0;
        const bRecent = b.id.startsWith('custom-mcp-') ? 1 : 0;
        return bRecent - aRecent;
      }
      return 0;
    });
  }, [combinedApps, searchQuery, selectedCategory, activeTab, showOption, sortOption, getConnectedAccount, lang]);

  const connectedCount = useMemo(() => {
    return combinedApps.filter(app => !!getConnectedAccount(app)).length;
  }, [combinedApps, getConnectedAccount]);

  // Category Translation Mapping
  const getCategoryLabel = (category: AppCategory) => {
    if (lang !== 'ar') {
      if (category === 'Communication') return 'Communication';
      return category;
    }
    switch (category) {
      case 'All': return 'الكل';
      case 'Communication': 
      case 'Email & Communication': 
        return 'التواصل';
      case 'AI, Search & LLMs': return 'الذكاء الاصطناعي والبحث';
      case 'Developer & DevOps': return 'المطورين والبرمجة';
      case 'Productivity & Workspace': return 'الإنتاجية ومساحات العمل';
      case 'CRM, Sales & Marketing': return 'المبيعات وإدارة العملاء';
      case 'Data, Analytics & Cloud': return 'البيانات والسحابة والتحليلات';
      case 'Media, Design & Content': return 'التصميم والوسائط والمحتوى';
      case 'Finance & E-commerce': return 'المالية والتجارة الإلكترونية';
      case 'Scraping & Web Tools': return 'الاستخراج وأدوات الويب';
      case 'HR & Customer Support': return 'الموارد البشرية والدعم';
      case 'Security, Utilities & APIs': return 'الأمان والأدوات وAPIs';
      case 'Custom & Community MCP': return 'خوادم MCP المخصصة';
      default: return category;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#191919] selection:bg-[#191919] selection:text-white font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Standalone Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-8 md:px-12 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 hover:text-[#8B0000] transition-colors group cursor-pointer"
            title={lang === 'ar' ? 'الرجوع إلى الصفحة الرئيسية' : 'Return to Home'}
          >
            {lang === 'ar' ? <ArrowRight className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> : <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />}
            <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </button>

          <div className="h-4 w-px bg-gray-300 mx-1 hidden sm:block" />

          <a
            href="/"
            onClick={(e) => { e.preventDefault(); onNavigateHome(); }}
            className="flex items-center"
          >
            <img
              src="https://res.cloudinary.com/dd3as4ova/image/upload/v1787885428/logo1_edjwuq.png"
              alt="FYSH Logo"
              className="h-8 sm:h-10 md:h-11 w-auto object-contain transition-all duration-200"
            />
          </a>
        </div>

        {/* Global Search trigger in header */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onNavigateToApiKeys && (
            <button
              onClick={onNavigateToApiKeys}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0E1015] hover:bg-[#1E2333] rounded-lg transition-all shadow-2xs cursor-pointer border border-[#2D344B]"
              title={lang === 'ar' ? 'إدارة مفاتيح API' : 'Manage API Keys'}
            >
              <Key className="w-3.5 h-3.5 text-[#818CF8]" />
              <span>{lang === 'ar' ? 'مفاتيح API' : 'API Keys'}</span>
            </button>
          )}

          <button
            onClick={() => setIsGlobalSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200/80 border border-gray-200 rounded-lg text-xs text-gray-500 hover:text-gray-900 transition-all cursor-pointer shadow-2xs"
            title={lang === 'ar' ? 'البحث بالمنصة كاملة' : 'Search platform & apps'}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'البحث بالمنصة كاملة...' : 'Search platform & apps...'}</span>
            <kbd className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.2 rounded font-mono text-gray-400">⌘K</kbd>
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>

          {/* Login / User Status */}
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-black transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>{isLoggedIn ? (lang === 'ar' ? 'حسابي' : 'Account') : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Banner notifications */}
        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg.message}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Composio Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200/80 mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              {lang === 'ar' ? 'التطبيقات' : 'Apps'}
            </h1>

            {/* Filter Pills: All / Connected */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200/80">
              <button
                onClick={() => { setActiveTab('all'); setShowOption('all'); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'all' && showOption !== 'connected'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {lang === 'ar' ? 'الكل' : 'All'}
              </button>
              <button
                onClick={() => { setActiveTab('connected'); setShowOption('connected'); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'connected' || showOption === 'connected'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{lang === 'ar' ? 'المتصلة' : 'Connected'}</span>
                {connectedCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {connectedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-gray-400 pointer-events-none`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث في أكثر من 300 تطبيق وخادم MCP...' : 'Search 300+ apps & MCP servers...'}
              className={`w-full ${lang === 'ar' ? 'pr-9 pl-8 text-right' : 'pl-9 pr-8 text-left'} py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 shadow-2xs transition-all`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute ${lang === 'ar' ? 'left-2.5' : 'right-2.5'} top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Actions & View/Sort Dropdown */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* View & Sort Dropdown Button (Matching Screenshot) */}
            <div className="relative" ref={viewDropdownRef}>
              <button
                onClick={() => setIsViewDropdownOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                  isViewDropdownOpen 
                    ? 'bg-gray-900 text-white border-gray-900' 
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'عرض' : 'View'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Sleek Dark Dropdown Menu (Exact Replica of Screenshot) */}
              {isViewDropdownOpen && (
                <div 
                  className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} mt-2 w-56 bg-[#18181B] text-gray-200 rounded-xl shadow-2xl border border-[#27272A] p-2 z-50 animate-in fade-in slide-in-from-top-1`}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {/* Section: Sort */}
                  <div className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {lang === 'ar' ? 'الترتيب' : 'Sort'}
                  </div>

                  <button
                    onClick={() => { setSortOption('popular'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'الأكثر شهرة والأهم' : 'Most popular'}</span>
                    {sortOption === 'popular' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => { setSortOption('name-asc'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'حسب الاسم (أ - ي)' : 'Name (A–Z)'}</span>
                    {sortOption === 'name-asc' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => { setSortOption('name-desc'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'حسب الاسم (ي - أ)' : 'Name (Z–A)'}</span>
                    {sortOption === 'name-desc' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => { setSortOption('recent'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'الأحدث إضافة' : 'Recently added'}</span>
                    {sortOption === 'recent' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  {/* Divider */}
                  <div className="my-1.5 border-t border-[#27272A]" />

                  {/* Section: Show */}
                  <div className="px-2 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {lang === 'ar' ? 'إظهار' : 'Show'}
                  </div>

                  <button
                    onClick={() => { setShowOption('all'); setActiveTab('all'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'جميع الأدوات' : 'All toolkits'}</span>
                    {showOption === 'all' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => { setShowOption('composio'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'أدوات كومبوزو المدمجة' : 'Composio'}</span>
                    {showOption === 'composio' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => { setShowOption('connected'); setActiveTab('connected'); setIsViewDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-[#27272A] transition-colors cursor-pointer text-gray-200"
                  >
                    <span>{lang === 'ar' ? 'أدواتك المتصلة' : 'Your toolkits'}</span>
                    {showOption === 'connected' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle: Grid vs Cards */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title={lang === 'ar' ? 'عرض الأيقونات (الافتراضي)' : 'Compact Icon Grid'}
              >
                <ListFilter className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
                title={lang === 'ar' ? 'عرض البطاقات المفصلة' : 'Card View'}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Add Custom MCP Button */}
            <button
              onClick={() => setIsAddMcpOpen(true)}
              className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#1E40AF] text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? '+ إضافة MCP مخصص' : '+ Add Custom MCP'}</span>
            </button>

            {/* Request App Button */}
            <a
              href="mailto:may@wakeli.online?subject=Request%20New%20App%20Integration"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
            >
              <span>{lang === 'ar' ? 'طلب تطبيق جديد' : 'Request App'}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>

        {/* Category Pills Bar: "All", then "Communication" right after, followed by other categories */}
        <div className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-gray-200/80 pt-1">
          {APPS_CATEGORIES.map((category) => {
            const count = categoryCounts[category] || 0;
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gray-900 text-white shadow-2xs'
                    : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200/70'
                }`}
              >
                <span>{getCategoryLabel(category)}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Applications List Rendering */}
        {filteredAndSortedApps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 sm:p-14 text-center shadow-2xs max-w-lg mx-auto mt-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
              {activeTab === 'connected' ? <Plug className="w-6 h-6 text-gray-400" /> : <Search className="w-6 h-6 text-gray-400" />}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              {activeTab === 'connected'
                ? (lang === 'ar' ? 'لا توجد تطبيقات متصلة حتى الآن' : 'No connected apps yet')
                : (lang === 'ar' ? 'لم يتم العثور على تطبيقات مطابقة' : 'No applications found')}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {activeTab === 'connected'
                ? (lang === 'ar' 
                    ? 'لم تقم بربط أي تطبيقات بعد. اختر تطبيقاً من قائمة التطبيقات المتاحة لربطه وبدء استخدامه فوراً.'
                    : 'You haven’t connected any apps yet. Browse the catalog to link an app via Composio.')
                : (lang === 'ar' 
                    ? 'جرب اختيار تصنيف آخر أو مسح عبارة البحث.' 
                    : 'Try selecting another category or clearing your search term.')}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              {activeTab === 'connected' ? (
                <button
                  onClick={() => { setActiveTab('all'); setShowOption('all'); setSelectedCategory('All'); }}
                  className="px-5 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'استعراض وربط التطبيقات' : 'Browse & Connect Apps'}</span>
                </button>
              ) : (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setActiveTab('all'); setShowOption('all'); }}
                  className="px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-black transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'cards' ? (
          /* Detailed 3-Column Card Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredAndSortedApps.map((app) => {
              const connectedAcc = getConnectedAccount(app);
              const isConnected = !!connectedAcc;
              const appState = connectionStates[app.id] || (isConnected ? 'CONNECTED' : 'IDLE');
              const isConnecting = appState === 'CONNECTING';
              const isBuiltIn = !!app.isBuiltInActive;
              const appDisplayName = lang === 'ar' ? (app.nameAr || app.name) : app.name;
              const appDisplayDesc = lang === 'ar' ? (app.descriptionAr || app.description || getCategoryLabel(app.category)) : (app.description || app.category);

              return (
                <div
                  key={app.id}
                  id={`app-card-${app.id}`}
                  onClick={() => {
                    setSelectedApp(app);
                    setIsDetailOpen(true);
                  }}
                  className="bg-white hover:bg-[#FAFBFD] border border-gray-200/90 hover:border-gray-300 rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all duration-150 shadow-2xs hover:shadow-xs group cursor-pointer"
                >
                  {/* Left: App Logo & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-gray-200/80 flex items-center justify-center p-2 shrink-0 group-hover:border-gray-300 transition-colors">
                      <img
                        src={app.logo}
                        alt={app.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {appDisplayName}
                        </span>
                        {app.verified && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium border border-blue-200">
                            {lang === 'ar' ? 'موثوق' : 'Verified'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {appDisplayDesc}
                      </p>
                    </div>
                  </div>

                  {/* Right: Connect Action Button */}
                  <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isBuiltIn ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{lang === 'ar' ? 'نشط' : 'Active'}</span>
                      </span>
                    ) : isConnected ? (
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 select-none">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{lang === 'ar' ? 'متصل' : 'Connected'}</span>
                        </span>
                        <button
                          onClick={(e) => handleDisconnectApp(app, e)}
                          title={lang === 'ar' ? 'إلغاء الربط' : 'Disconnect'}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleConnectApp(app, e)}
                        disabled={isConnecting}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          isConnecting
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white hover:bg-gray-900 text-gray-900 hover:text-white border border-gray-300 hover:border-gray-900 shadow-2xs'
                        }`}
                      >
                        {isConnecting ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>{lang === 'ar' ? 'جارٍ الربط...' : 'Connecting...'}</span>
                          </>
                        ) : (
                          <span>{lang === 'ar' ? 'ربط' : 'Connect'}</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact Circular Icon Grid Layout (Matching Platform Identity) */
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 shadow-2xs">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-x-4 gap-y-7 sm:gap-x-6 sm:gap-y-9 justify-items-center">
              {filteredAndSortedApps.map((app) => {
                const connectedAcc = getConnectedAccount(app);
                const isConnected = !!connectedAcc;
                const appState = connectionStates[app.id] || (isConnected ? 'CONNECTED' : 'IDLE');
                const isConnecting = appState === 'CONNECTING';
                const isBuiltIn = !!app.isBuiltInActive;
                const appDisplayName = lang === 'ar' ? (app.nameAr || app.name) : app.name;

                return (
                  <div
                    key={app.id}
                    id={`app-item-${app.id}`}
                    className="flex flex-col items-center group cursor-pointer"
                    onClick={() => {
                      setSelectedApp(app);
                      setIsDetailOpen(true);
                    }}
                  >
                    {/* Circular Logo Container */}
                    <div className="relative">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border flex items-center justify-center p-3 sm:p-3.5 transition-all duration-200 shadow-2xs group-hover:scale-105 group-hover:shadow-md ${
                          isConnected || isBuiltIn
                            ? 'border-emerald-300 ring-2 ring-emerald-500/20'
                            : 'border-gray-200/90 group-hover:border-gray-400'
                        }`}
                      >
                        <img
                          src={app.logo}
                          alt={app.name}
                          className="w-full h-full object-contain pointer-events-none select-none transition-transform group-hover:scale-110"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      {/* Plus (+) or Minus (-) Action Badge */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isConnected) {
                            handleDisconnectApp(app, e);
                          } else if (!isBuiltIn) {
                            handleConnectApp(app, e);
                          }
                        }}
                        disabled={isConnecting || (isBuiltIn && !isConnected)}
                        title={
                          isConnecting
                            ? (lang === 'ar' ? 'جارٍ الربط...' : 'Connecting...')
                            : isConnected
                            ? (lang === 'ar' ? 'إلغاء الربط' : 'Disconnect')
                            : isBuiltIn
                            ? (lang === 'ar' ? 'نشط تلقائياً' : 'Built-in Active')
                            : (lang === 'ar' ? 'ربط التطبيق' : 'Connect')
                        }
                        className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ring-2 ring-white shadow-xs transition-transform duration-150 hover:scale-115 active:scale-95 cursor-pointer z-10 ${
                          isConnecting
                            ? 'bg-blue-600'
                            : isConnected
                            ? 'bg-black hover:bg-red-600'
                            : isBuiltIn
                            ? 'bg-emerald-600'
                            : 'bg-black hover:bg-gray-800'
                        }`}
                      >
                        {isConnecting ? (
                          <RefreshCw className="w-2.5 h-2.5 text-white animate-spin" />
                        ) : isConnected ? (
                          <Minus className="w-3 h-3 text-white stroke-[2.5]" />
                        ) : isBuiltIn ? (
                          <Check className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                        ) : (
                          <Plus className="w-3 h-3 text-white stroke-[2.5]" />
                        )}
                      </button>
                    </div>

                    {/* App Name Only */}
                    <span className="mt-2 text-xs font-semibold text-gray-800 text-center line-clamp-1 max-w-[85px] group-hover:text-blue-600 transition-colors select-none">
                      {appDisplayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* App Detail Modal */}
      {isDetailOpen && selectedApp && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsDetailOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 relative"
            onClick={(e) => e.stopPropagation()}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <button
              onClick={() => setIsDetailOpen(false)}
              className={`absolute top-4 ${lang === 'ar' ? 'left-4' : 'right-4'} text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 p-2.5 flex items-center justify-center shrink-0">
                <img
                  src={selectedApp.logo}
                  alt={selectedApp.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>{lang === 'ar' ? (selectedApp.nameAr || selectedApp.name) : selectedApp.name}</span>
                  {selectedApp.verified && (
                    <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      {lang === 'ar' ? 'موثوق' : 'Verified'}
                    </span>
                  )}
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {getCategoryLabel(selectedApp.category)}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {lang === 'ar' ? (selectedApp.descriptionAr || selectedApp.description) : selectedApp.description}
            </p>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 mb-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{lang === 'ar' ? 'بروتوكول الربط' : 'Protocol'}</span>
                <span className="font-semibold text-gray-900 font-mono">MCP / OAuth 2.0</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{lang === 'ar' ? 'حالة التوافق' : 'Compatibility'}</span>
                <span className="font-semibold text-emerald-700">Claude, Cursor, Codex, Windsurf</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {getConnectedAccount(selectedApp) && (
                <button
                  onClick={(e) => {
                    handleDisconnectApp(selectedApp, e);
                    setIsDetailOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء الربط' : 'Disconnect'}
                </button>
              )}

              <button
                onClick={() => {
                  handleConnectApp(selectedApp);
                  setIsDetailOpen(false);
                }}
                className="px-5 py-2 text-xs font-semibold bg-gray-900 hover:bg-black text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                {getConnectedAccount(selectedApp) 
                  ? (lang === 'ar' ? 'إعادة التوثيق' : 'Reconnect') 
                  : (lang === 'ar' ? 'ربط التطبيق' : 'Connect App')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom MCP Modal */}
      {isAddMcpOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsAddMcpOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 relative"
            onClick={(e) => e.stopPropagation()}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <button
              onClick={() => setIsAddMcpOpen(false)}
              className={`absolute top-4 ${lang === 'ar' ? 'left-4' : 'right-4'} text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer`}
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-gray-900 mb-1">
              {lang === 'ar' ? 'إضافة خادم MCP مخصص' : 'Add Custom MCP Server'}
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              {lang === 'ar' 
                ? 'اربط أي خادم MCP خارجي عبر رابط Endpoint المباشر.' 
                : 'Connect any external MCP server URL to expose custom tools.'}
            </p>

            <form onSubmit={handleAddCustomMcp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'ar' ? 'اسم الخادم / الأداة' : 'Server / Tool Name'}
                </label>
                <input
                  type="text"
                  required
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: خادم أتمتة المبيعات الخاص' : 'e.g. My Internal CRM MCP'}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'ar' ? 'رابط خادم MCP (SSE / Stream Endpoint)' : 'MCP Server URL (SSE / Stream Endpoint)'}
                </label>
                <input
                  type="url"
                  required
                  value={mcpUrl}
                  onChange={(e) => setMcpUrl(e.target.value)}
                  placeholder="https://mcp.my-domain.com/sse"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {lang === 'ar' ? 'التصنيف' : 'Category'}
                </label>
                <select
                  value={mcpCategory}
                  onChange={(e) => setMcpCategory(e.target.value as AppCategory)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  {APPS_CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{getCategoryLabel(c)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMcpOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#1E3A8A] hover:bg-[#1E40AF] text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ الخادم' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Search Omni-Modal */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        lang={lang}
        onSelectApp={(app) => {
          setSelectedApp(app);
          setIsDetailOpen(true);
        }}
        onNavigate={(route) => {
          if (route === 'home') onNavigateHome();
          else if (route === 'agents') window.location.pathname = '/agents';
          else if (route === 'apps') {
            setSelectedCategory('All');
            setSearchQuery('');
          }
        }}
      />
    </div>
  );
}
