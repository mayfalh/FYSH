import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Settings, 
  Users, 
  Key, 
  CreditCard, 
  ChevronDown, 
  Copy, 
  RotateCw, 
  Eye, 
  EyeOff, 
  Terminal, 
  Plug, 
  Check, 
  ExternalLink, 
  Shield, 
  LogOut, 
  User, 
  Camera, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Code,
  Laptop,
  Layers,
  Trash2,
  Activity,
  AlertCircle,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';
import { Lang } from '../translations';
import { User as FirebaseUser } from 'firebase/auth';
import { ALL_COMPOSIO_APPS, AppItem } from '../data/appsData';
import { 
  ConnectedAccountItem, 
  fetchUserConnectedAccounts, 
  disconnectUserAccount, 
  initiateComposioConnect,
  getOrCreateStableFishUserId,
  CONNECTED_ACCOUNTS_EVENT
} from '../lib/composioClient';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  firebaseUser: FirebaseUser | null;
  displayName: string;
  setDisplayName: (name: string) => void;
  userBio: string;
  setUserBio: (bio: string) => void;
  profileImage: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  onLogout: () => void;
}

type SettingsTab = 'sessions' | 'integrations' | 'general' | 'members' | 'billing';

export function UserSettingsModal({
  isOpen,
  onClose,
  lang,
  firebaseUser,
  displayName,
  setDisplayName,
  userBio,
  setUserBio,
  profileImage,
  onImageChange,
  onSaveProfile,
  isSaving,
  saveSuccess,
  onLogout
}: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('integrations');
  const [searchQuery, setSearchQuery] = useState('');
  
  // API Key state
  const [apiKey, setApiKey] = useState('ck_S8I924fa930bf443c984920SDOG');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [keyCreatedDate, setKeyCreatedDate] = useState('Aug 23, 2026');

  // Connected Apps State
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountItem[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [connectingAppId, setConnectingAppId] = useState<string | null>(null);
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [testSuccessId, setTestSuccessId] = useState<string | null>(null);
  const [connectedAppSearch, setConnectedAppSearch] = useState('');
  const [connectedCategory, setConnectedCategory] = useState('All');
  const [showCatalogBrowser, setShowCatalogBrowser] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal helpers for CLI and MCP setup
  const [isCliModalOpen, setIsCliModalOpen] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);

  // Members mockup state
  const [members, setMembers] = useState([
    { id: 1, name: displayName || (lang === 'ar' ? 'مستخدم فيش' : 'may alfalf'), email: firebaseUser?.email || 'mayalfalh@gmail.com', role: 'Owner', status: 'Active' },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  const loadConnectedAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const uid = getOrCreateStableFishUserId(firebaseUser?.uid);
      const accs = await fetchUserConnectedAccounts(uid);
      setConnectedAccounts(accs);
    } catch (err) {
      console.warn("Failed loading connected accounts", err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConnectedAccounts();
    }
  }, [isOpen, firebaseUser]);

  useEffect(() => {
    const handleUpdate = () => {
      loadConnectedAccounts();
    };
    window.addEventListener(CONNECTED_ACCOUNTS_EVENT, handleUpdate);
    return () => window.removeEventListener(CONNECTED_ACCOUNTS_EVENT, handleUpdate);
  }, [firebaseUser]);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleRegenerateKey = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomStr = '';
      for (let i = 0; i < 22; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setApiKey(`ck_S8I${randomStr}SDOG`);
      setKeyCreatedDate(lang === 'ar' ? 'اليوم، ٢٨ أغسطس ٢٠٢٦' : 'Today, Aug 28, 2026');
      setIsRegenerating(false);
      setIsCopied(false);
    }, 600);
  };

  const handleCopyCliCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 2000);
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setMembers(prev => [
      ...prev,
      { id: Date.now(), name: inviteEmail.split('@')[0], email: inviteEmail, role: 'Member', status: 'Pending' }
    ]);
    setInviteEmail('');
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
  };

  const handleDisconnect = async (acc: ConnectedAccountItem) => {
    setDeletingAccountId(acc.id);
    const uid = getOrCreateStableFishUserId(firebaseUser?.uid);
    const ok = await disconnectUserAccount(acc.id, uid, acc.toolkitSlug);
    setDeletingAccountId(null);
    if (ok) {
      setConnectedAccounts(prev => prev.filter(item => item.id !== acc.id));
      setFeedbackMsg({
        type: 'success',
        text: lang === 'ar' ? `تم إلغاء ربط وحذف ${acc.appName || acc.toolkitSlug} بنجاح` : `Disconnected ${acc.appName || acc.toolkitSlug}`
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } else {
      setFeedbackMsg({
        type: 'error',
        text: lang === 'ar' ? 'فشل إلغاء الربط. يرجى المحاولة مرة أخرى.' : 'Failed to disconnect app.'
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleTestConnection = async (acc: ConnectedAccountItem) => {
    setTestingAccountId(acc.id);
    try {
      const uid = getOrCreateStableFishUserId(firebaseUser?.uid);
      await fetch('/api/composio/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fishUserId: uid,
          toolkitSlug: acc.toolkitSlug,
          connectedAccountId: acc.id
        })
      });
      setTestSuccessId(acc.id);
      setTimeout(() => setTestSuccessId(null), 3000);
    } catch (e) {
      console.warn("Test error", e);
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleConnectAppFromModal = async (app: AppItem) => {
    setConnectingAppId(app.id);
    setFeedbackMsg(null);
    const uid = getOrCreateStableFishUserId(firebaseUser?.uid);
    
    const result = await initiateComposioConnect(app, uid);
    if (!result.success || !result.redirectUrl) {
      setConnectingAppId(null);
      setFeedbackMsg({
        type: 'error',
        text: result.error || (lang === 'ar' ? 'فشل بدء الاتصال مع التطبيق' : 'Failed to start connection')
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      return;
    }

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const authWindow = window.open(
      result.redirectUrl,
      `Connect_${app.name}`,
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
    );

    if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
      window.location.href = result.redirectUrl;
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;
    const pollInterval = setInterval(async () => {
      attempts++;
      if (authWindow.closed || attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setConnectingAppId(null);
        await loadConnectedAccounts();
        setFeedbackMsg({
          type: 'success',
          text: lang === 'ar' ? `تم ربط وتفعيل ${app.name} بنجاح!` : `${app.name} connected successfully!`
        });
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    }, 1500);
  };

  const maskedKey = isKeyVisible 
    ? apiKey 
    : `${apiKey.slice(0, 6)}•••••••••••••${apiKey.slice(-4)}`;

  const userInitial = (displayName || firebaseUser?.email || 'M').charAt(0).toUpperCase();
  const workspaceSlug = firebaseUser?.email ? firebaseUser.email.split('@')[0] + '_workspace' : 'mayalfalh_workspace';

  // Popular starter integrations for quick 1-click connect
  const popularStarterApps: AppItem[] = [
    { id: 'gmail', name: 'Gmail', category: 'Communication', logo: 'https://logos.composio.dev/api/gmail', composioSlug: 'gmail', description: 'Read, send, and draft emails automatically.' },
    { id: 'googlecalendar', name: 'Google Calendar', category: 'Productivity & Workspace', logo: 'https://logos.composio.dev/api/googlecalendar', composioSlug: 'googlecalendar', description: 'Schedule and manage calendar events.' },
    { id: 'slack', name: 'Slack', category: 'Communication', logo: 'https://logos.composio.dev/api/slack', composioSlug: 'slack', description: 'Send channel messages and manage workspace alerts.' },
    { id: 'github', name: 'GitHub', category: 'Developer & DevOps', logo: 'https://logos.composio.dev/api/github', composioSlug: 'github', description: 'Manage repos, issues, pull requests, and commits.' },
    { id: 'notion', name: 'Notion', category: 'Productivity & Workspace', logo: 'https://logos.composio.dev/api/notion', composioSlug: 'notion', description: 'Read and update workspaces, databases, and pages.' },
    { id: 'linear', name: 'Linear', category: 'Developer & DevOps', logo: 'https://logos.composio.dev/api/linear', composioSlug: 'linear', description: 'Issue tracking and project management workflows.' },
    { id: 'discord', name: 'Discord', category: 'Communication', logo: 'https://logos.composio.dev/api/discord', composioSlug: 'discord', description: 'Interact with Discord servers, channels, and roles.' },
    { id: 'airtable', name: 'Airtable', category: 'Productivity & Workspace', logo: 'https://logos.composio.dev/api/airtable', composioSlug: 'airtable', description: 'Relational database and spreadsheet automation.' },
  ];

  // Categories available for connected accounts
  const connectedCategoriesList = ['All', 'Communication', 'AI, Search & LLMs', 'Developer & DevOps', 'Productivity & Workspace', 'CRM, Sales & Marketing', 'Design & Media', 'Finance & Accounting', 'Data & Analytics', 'Social & Entertainment', 'Operations & Other'];

  const connectedCategoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { All: connectedAccounts.length };
    connectedCategoriesList.forEach(cat => {
      if (cat !== 'All') {
        if (cat === 'Communication') {
          counts[cat] = connectedAccounts.filter(
            acc => acc.category === 'Communication' || acc.category === 'Email & Communication'
          ).length;
        } else {
          counts[cat] = connectedAccounts.filter(acc => acc.category === cat).length;
        }
      }
    });
    return counts;
  }, [connectedAccounts]);

  const filteredConnectedAccounts = connectedAccounts.filter(acc => {
    const q = connectedAppSearch.toLowerCase().trim();
    const matchesSearch = !q || (
      (acc.appName && acc.appName.toLowerCase().includes(q)) ||
      (acc.toolkitSlug && acc.toolkitSlug.toLowerCase().includes(q)) ||
      (acc.category && acc.category.toLowerCase().includes(q))
    );

    let matchesCategory = false;
    if (connectedCategory === 'All') {
      matchesCategory = true;
    } else if (connectedCategory === 'Communication') {
      matchesCategory = acc.category === 'Communication' || acc.category === 'Email & Communication';
    } else {
      matchesCategory = acc.category === connectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  const filteredCatalogApps = ALL_COMPOSIO_APPS.filter(app => {
    const matchesCategory = catalogCategory === 'All' || app.category === catalogCategory;
    const matchesSearch = !catalogSearch.trim() || 
      app.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
      (app.description && app.description.toLowerCase().includes(catalogSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 animate-fadeIn">
      <div 
        className="relative w-full max-w-6xl h-[92vh] max-h-[860px] bg-[#FFFFFF] rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col md:flex-row"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 lg:w-72 bg-[#FAF9F9] border-b md:border-b-0 md:border-e border-gray-200 flex flex-col flex-shrink-0">
          {/* Top Bar / Back button */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-black transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-200/60 cursor-pointer"
            >
              <span className={lang === 'ar' ? 'rotate-180' : ''}>←</span>
              <span>{lang === 'ar' ? 'الرجوع' : 'Back'}</span>
            </button>
            <div className="md:hidden">
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-black rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search in Settings */}
          <div className="p-3">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 text-gray-400 absolute top-1/2 -translate-y-1/2 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={lang === 'ar' ? 'البحث في الإعدادات...' : 'Search'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full text-xs bg-white border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-1 focus:ring-[#8B0000] focus:border-[#8B0000] transition-all ${
                  lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                }`}
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
            {/* Dedicated Connected Apps Tab */}
            <button
              onClick={() => setActiveTab('integrations')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'integrations'
                  ? 'bg-white text-[#8B0000] shadow-2xs border border-gray-200/80 font-bold'
                  : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Layers className={`w-4 h-4 flex-shrink-0 ${activeTab === 'integrations' ? 'text-[#8B0000]' : 'text-gray-400'}`} />
                <span className="truncate">{lang === 'ar' ? 'التطبيقات المتصلة' : 'Connected Apps'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                connectedAccounts.length > 0 
                  ? 'bg-[#8B0000]/10 text-[#8B0000]' 
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {connectedAccounts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sessions')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'sessions'
                  ? 'bg-white text-[#8B0000] shadow-2xs border border-gray-200/80 font-semibold'
                  : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'
              }`}
            >
              <Key className={`w-4 h-4 ${activeTab === 'sessions' ? 'text-[#8B0000]' : 'text-gray-400'}`} />
              <span>{lang === 'ar' ? 'الجلسات ومفتاح API' : 'Sessions & API Key'}</span>
            </button>

            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-white text-[#191919] shadow-2xs border border-gray-200/80 font-semibold'
                  : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === 'general' ? 'text-[#8B0000]' : 'text-gray-400'}`} />
              <span>{lang === 'ar' ? 'عام' : 'General'}</span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-white text-[#191919] shadow-2xs border border-gray-200/80 font-semibold'
                  : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'members' ? 'text-[#8B0000]' : 'text-gray-400'}`} />
              <span>{lang === 'ar' ? 'الأعضاء' : 'Members'}</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-white text-[#191919] shadow-2xs border border-gray-200/80 font-semibold'
                  : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'
              }`}
            >
              <CreditCard className={`w-4 h-4 ${activeTab === 'billing' ? 'text-[#8B0000]' : 'text-gray-400'}`} />
              <span>{lang === 'ar' ? 'الفواتير والاشتراكات' : 'Billing'}</span>
            </button>
          </nav>

          {/* Bottom User Workspace Info */}
          <div className="p-3 border-t border-gray-200 bg-[#FAF9F9]">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-200/90 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {displayName || (lang === 'ar' ? 'مستخدم فيش' : 'may alfalf')}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {workspaceSlug}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onLogout}
                  title={lang === 'ar' ? 'تسجيل الخروج' : 'Log out'}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto">
          {/* Top header with close icon on desktop */}
          <div className="hidden md:flex justify-end p-4 pb-0">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-black rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 sm:p-8 md:p-10 max-w-4xl">
            {/* Dynamic Feedback Banner */}
            {feedbackMsg && (
              <div className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between gap-3 shadow-xs border ${
                feedbackMsg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {feedbackMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <span className="font-medium">{feedbackMsg.text}</span>
                </div>
                <button onClick={() => setFeedbackMsg(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* TAB: Connected Apps (التطبيقات المتصلة) */}
            {activeTab === 'integrations' && (
              <div className="space-y-8 animate-fade-in">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-serif text-[#191919] font-normal tracking-tight flex items-center gap-3">
                      <span>{lang === 'ar' ? 'التطبيقات المتصلة والحسابات المربوطة' : 'Connected Applications'}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-sans bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        {connectedAccounts.length} {lang === 'ar' ? 'نشط' : 'Active'}
                      </span>
                    </h1>
                    <p className="mt-1.5 text-xs sm:text-sm text-gray-500 leading-relaxed max-w-2xl">
                      {lang === 'ar' 
                        ? 'إدارة والتحكم في جميع الأدوات والخدمات المرتبطة بحسابك عبر منصة فيش، مع إمكانية فحص الاتصال أو حذفه وإلغاء الربط فورياً.' 
                        : 'View and manage all connected accounts and toolkits linked to your FYSH profile. Test status or revoke access at any time.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={loadConnectedAccounts}
                      disabled={isLoadingAccounts}
                      title={lang === 'ar' ? 'تحديث القائمة' : 'Refresh'}
                      className="p-2 text-gray-500 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingAccounts ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setShowCatalogBrowser(!showCatalogBrowser)}
                      className="px-4 py-2 bg-[#8B0000] text-white text-xs font-semibold rounded-xl hover:bg-[#660000] transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'ربط تطبيق جديد' : 'Connect New App'}</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar & Category Filters for Connected Apps */}
                {connectedAccounts.length > 0 && (
                  <div className="space-y-3">
                    <div className="relative max-w-md">
                      <Search className={`w-3.5 h-3.5 text-gray-400 absolute top-1/2 -translate-y-1/2 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                      <input
                        type="text"
                        placeholder={lang === 'ar' ? 'البحث بين تطبيقاتك المتصلة...' : 'Filter connected apps...'}
                        value={connectedAppSearch}
                        onChange={(e) => setConnectedAppSearch(e.target.value)}
                        className={`w-full text-xs bg-[#FAF9F9] border border-gray-200 rounded-xl py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#8B0000] transition-all ${
                          lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                        }`}
                      />
                    </div>

                    {/* Category Filter Pills for Connected Accounts */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
                      {connectedCategoriesList.map((cat) => {
                        const count = connectedCategoryCounts[cat] || 0;
                        if (cat !== 'All' && count === 0) return null; // Only show active categories

                        const isSelected = connectedCategory === cat;
                        const labelAr: Record<string, string> = {
                          'All': 'الكل',
                          'Communication': 'التواصل',
                          'AI, Search & LLMs': 'الذكاء الاصطناعي',
                          'Developer & DevOps': 'المطورين',
                          'Productivity & Workspace': 'الإنتاجية',
                          'CRM, Sales & Marketing': 'إدارة العملاء والتسويق',
                          'Design & Media': 'التصميم والوسائط',
                          'Finance & Accounting': 'المالية',
                          'Data & Analytics': 'البيانات والتحليلات',
                          'Social & Entertainment': 'التواصل والترفيه',
                          'Operations & Other': 'العمليات'
                        };

                        const displayLabel = lang === 'ar' ? (labelAr[cat] || cat) : cat;

                        return (
                          <button
                            key={cat}
                            onClick={() => setConnectedCategory(cat)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-gray-900 text-white shadow-2xs'
                                : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 hover:text-gray-900 border border-gray-200/60'
                            }`}
                          >
                            <span>{displayLabel}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Connected Accounts List */}
                {isLoadingAccounts && connectedAccounts.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-[#8B0000] rounded-full animate-spin mb-3"></div>
                    <p className="text-xs text-gray-500">{lang === 'ar' ? 'جاري جلب التطبيقات المتصلة...' : 'Loading connected accounts...'}</p>
                  </div>
                ) : connectedAccounts.length > 0 ? (
                  <div className="space-y-3">
                    {filteredConnectedAccounts.map((acc) => {
                      const isDeleting = deletingAccountId === acc.id;
                      const isTesting = testingAccountId === acc.id;
                      const isTestSuccess = testSuccessId === acc.id;

                      return (
                        <div
                          key={acc.id}
                          className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 hover:border-gray-300 hover:shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 p-2 flex items-center justify-center flex-shrink-0 shadow-2xs">
                              <img
                                src={acc.logo || `https://logos.composio.dev/api/${acc.toolkitSlug}`}
                                alt={acc.appName || acc.toolkitSlug}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://res.cloudinary.com/dd3as4ova/image/upload/v1787885428/logo1_edjwuq.png';
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-gray-900 truncate">
                                  {acc.appName || acc.toolkitSlug}
                                </h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  {lang === 'ar' ? 'متصل ونشط' : 'Active & Synced'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                                <span>{acc.category || 'Productivity & Workspace'}</span>
                                <span>•</span>
                                <span className="font-mono text-[10px]">OAuth 2.0 / MCP</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                            {/* Test Connection Button */}
                            <button
                              type="button"
                              onClick={() => handleTestConnection(acc)}
                              disabled={isTesting || isDeleting}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isTesting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-500" />
                              ) : isTestSuccess ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Activity className="w-3.5 h-3.5 text-gray-500" />
                              )}
                              <span>
                                {isTesting 
                                  ? (lang === 'ar' ? 'فحص...' : 'Checking...') 
                                  : isTestSuccess 
                                  ? (lang === 'ar' ? 'سليم ومتصل' : 'Healthy') 
                                  : (lang === 'ar' ? 'فحص الاتصال' : 'Test')}
                              </span>
                            </button>

                            {/* Revoke / Disconnect Button */}
                            <button
                              type="button"
                              onClick={() => handleDisconnect(acc)}
                              disabled={isDeleting || isTesting}
                              title={lang === 'ar' ? 'إلغاء الربط وحذف الحساب' : 'Disconnect & remove'}
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-800 border border-red-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              )}
                              <span>{isDeleting ? (lang === 'ar' ? 'جاري الإلغاء...' : 'Revoking...') : (lang === 'ar' ? 'إلغاء الربط' : 'Disconnect')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state with helpful starter gallery */
                  <div className="border border-gray-200/90 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-[#FAF9F9]/50">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-[#8B0000] mb-4">
                      <Layers className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">
                      {lang === 'ar' ? 'لم تقم بربط أي تطبيقات حتى الآن' : 'No connected apps yet'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1.5 max-w-md leading-relaxed">
                      {lang === 'ar'
                        ? 'اربط حساباتك (مثل Gmail أو Slack أو GitHub أو Notion) لتمكين الوكلاء الذكيين وتوليد سياق MCP مباشر في أدواتك.'
                        : 'Connect your accounts (like Gmail, Slack, GitHub, or Notion) to enable AI agents and MCP workflows across your workspace.'}
                    </p>
                    <button
                      onClick={() => setShowCatalogBrowser(true)}
                      className="mt-5 px-5 py-2.5 bg-[#8B0000] text-white text-xs font-semibold rounded-xl hover:bg-[#660000] transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'استعراض وربط التطبيقات' : 'Browse & Connect Apps'}</span>
                    </button>
                  </div>
                )}

                {/* Popular Apps Quick-Connect Drawer / Browser */}
                <div className="mt-8 pt-8 border-t border-gray-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">
                        {lang === 'ar' ? 'تطبيقات مقترحة للربط السريع' : 'Recommended Quick Connect'}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {lang === 'ar' ? 'أشهر الأدوات جاهزة للمصادقة الفورية بضغطة زر:' : 'Top tools ready for 1-click OAuth connection:'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {popularStarterApps.map((app) => {
                      const isConnected = connectedAccounts.some(acc => {
                        const accSlug = (acc.toolkitSlug || '').toLowerCase();
                        const appSlug = (app.composioSlug || app.id).toLowerCase();
                        return accSlug.includes(appSlug) || appSlug.includes(accSlug);
                      });
                      const isConnecting = connectingAppId === app.id;

                      return (
                        <div
                          key={app.id}
                          className="p-3.5 rounded-xl border border-gray-200/90 bg-white hover:border-gray-300 hover:shadow-2xs transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 p-1.5 flex items-center justify-center flex-shrink-0">
                              <img
                                src={app.logo}
                                alt={app.name}
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-gray-900 truncate">{app.name}</h4>
                              <p className="text-[10.5px] text-gray-500 truncate">{app.description}</p>
                            </div>
                          </div>

                          {isConnected ? (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 flex-shrink-0">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{lang === 'ar' ? 'مربوط' : 'Linked'}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConnectAppFromModal(app)}
                              disabled={isConnecting}
                              className="px-3 py-1.5 bg-[#8B0000] text-white hover:bg-[#660000] text-xs font-medium rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              {isConnecting ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              <span>{isConnecting ? (lang === 'ar' ? 'جاري...' : 'Linking...') : (lang === 'ar' ? 'ربط' : 'Connect')}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expandable Catalog Browser */}
                {showCatalogBrowser && (
                  <div className="mt-8 p-5 bg-[#FAF9F9] rounded-2xl border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">
                        {lang === 'ar' ? 'دليل كافة التطبيقات المدعومة (+300 تطبيق)' : 'Complete Integrations Directory (300+ Apps)'}
                      </h3>
                      <button
                        onClick={() => setShowCatalogBrowser(false)}
                        className="text-xs text-gray-500 hover:text-black font-semibold cursor-pointer"
                      >
                        {lang === 'ar' ? 'إخفاء' : 'Collapse'}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className={`w-3.5 h-3.5 text-gray-400 absolute top-1/2 -translate-y-1/2 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                      <input
                        type="text"
                        placeholder={lang === 'ar' ? 'ابحث عن أي تطبيق (مثل Jira, Zoom, Supabase, Stripe)...' : 'Search any app...'}
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className={`w-full text-xs bg-white border border-gray-200 rounded-xl py-2 focus:outline-none focus:ring-1 focus:ring-[#8B0000] ${
                          lang === 'ar' ? 'pr-8 pl-3' : 'pl-8 pr-3'
                        }`}
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {filteredCatalogApps.slice(0, 30).map((app) => {
                        const isConnected = connectedAccounts.some(acc => {
                          const accSlug = (acc.toolkitSlug || '').toLowerCase();
                          const appSlug = (app.composioSlug || app.id).toLowerCase();
                          return accSlug.includes(appSlug) || appSlug.includes(accSlug);
                        });
                        const isConnecting = connectingAppId === app.id;

                        return (
                          <div
                            key={app.id}
                            className="p-2.5 rounded-xl bg-white border border-gray-200 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={app.logo} alt={app.name} className="w-5 h-5 object-contain flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-gray-900 truncate block">{app.name}</span>
                                <span className="text-[10px] text-gray-400 truncate block">{app.category}</span>
                              </div>
                            </div>
                            {isConnected ? (
                              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                {lang === 'ar' ? 'متصل' : 'Active'}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleConnectAppFromModal(app)}
                                disabled={isConnecting}
                                className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-[#8B0000] hover:text-white rounded-lg transition-colors font-medium cursor-pointer"
                              >
                                {isConnecting ? '...' : (lang === 'ar' ? 'ربط' : 'Connect')}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: Sessions & API Key */}
            {activeTab === 'sessions' && (
              <div className="space-y-10 animate-fade-in">
                {/* Section Title */}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-serif text-[#191919] font-normal tracking-tight">
                    {lang === 'ar' ? 'الجلسات ومفتاح البرمجة (Sessions & API Key)' : 'Sessions & API Key'}
                  </h1>
                  <p className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed max-w-3xl">
                    {lang === 'ar' ? (
                      <>
                        يمكن لعملاء MCP المصادقة بطريقتين: باستخدام مفتاح API يتم إرساله في ترويسة{' '}
                        <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-xs border border-gray-200">x-consumer-api-key</code>
                        ، أو عبر بروتوكول OAuth المعتمد.
                      </>
                    ) : (
                      <>
                        MCP clients can authenticate two ways: with an API key sent in the{' '}
                        <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-xs border border-gray-200">x-consumer-api-key</code>{' '}
                        header, or with OAuth.
                      </>
                    )}
                  </p>
                </div>

                {/* 1. API Key Card */}
                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#191919]">
                      {lang === 'ar' ? 'مفتاح API' : 'API Key'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lang === 'ar' ? (
                        <>
                          أرسل هذا المفتاح في ترويسة{' '}
                          <code className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded font-mono text-[11px]">x-consumer-api-key</code>{' '}
                          لمصادقة عملاء MCP مع حسابك على فيش.
                        </>
                      ) : (
                        <>
                          Send this key in the{' '}
                          <code className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded font-mono text-[11px]">x-consumer-api-key</code>{' '}
                          header to authenticate MCP clients with your account.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                        {lang === 'ar' ? 'مفتاحك البرمجي الخاص' : 'Your API Key'}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-medium text-gray-800 tracking-wide select-all">
                        <span>{maskedKey}</span>
                        <button
                          type="button"
                          onClick={() => setIsKeyVisible(!isKeyVisible)}
                          title={isKeyVisible ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors cursor-pointer"
                        >
                          {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {lang === 'ar' ? `تاريخ الإنشاء: ${keyCreatedDate}` : `Created on ${keyCreatedDate}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
                      <a
                        href="/api-keys"
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0E1015] hover:bg-[#1E2333] border border-[#2D344B] rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title={lang === 'ar' ? 'فتح لوحة إدارة مفاتيح API المتقدمة' : 'Open Full API Keys Console'}
                      >
                        <Key className="w-3.5 h-3.5 text-[#818CF8]" />
                        <span>{lang === 'ar' ? 'إدارة المفاتيح المتقدمة ↗' : 'Advanced Keys Console ↗'}</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">{lang === 'ar' ? 'تم النسخ!' : 'Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'نسخ المفتاح' : 'Copy'}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        disabled={isRegenerating}
                        className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-[#8B0000]' : ''}`} />
                        <span>{isRegenerating ? (lang === 'ar' ? 'جاري التوليد...' : 'Regenerating...') : (lang === 'ar' ? 'إعادة توليد' : 'Regenerate')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. CLI Sessions */}
                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#191919]">
                      {lang === 'ar' ? 'جلسات CLI (CLI Sessions)' : 'CLI Sessions'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lang === 'ar' ? 'إدارة جلسات سطر الأوامر النشطة لحسابك على فيش.' : 'Manage active CLI sessions for your account.'}
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-[#FAF9F9]/50">
                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-gray-600 mb-3">
                      <Terminal className="w-6 h-6 text-gray-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {lang === 'ar' ? 'لا توجد جلسات CLI نشطة' : 'No active CLI sessions'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                      {lang === 'ar' ? (
                        <>
                          ستظهر جلسات سطر الأوامر هنا عند الاتصال عبر أداة CLI.{' '}
                          <button
                            onClick={() => setIsCliModalOpen(true)}
                            className="text-[#8B0000] font-semibold hover:underline cursor-pointer"
                          >
                            إعداد سطر الأوامر (CLI)
                          </button>
                        </>
                      ) : (
                        <>
                          CLI sessions will appear here when you connect via the CLI.{' '}
                          <button
                            onClick={() => setIsCliModalOpen(true)}
                            className="text-[#8B0000] font-semibold hover:underline cursor-pointer"
                          >
                            Set up the CLI
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* 3. MCP Session Management */}
                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#191919]">
                      {lang === 'ar' ? 'إدارة جلسات MCP (MCP Session Management)' : 'MCP Session Management'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lang === 'ar' ? 'عرض وإلغاء صلاحيات الوصول لعملاء MCP المصادق عليهم عبر OAuth.' : 'View and revoke access for OAuth-authenticated MCP clients.'}
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-[#FAF9F9]/50">
                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-gray-600 mb-3">
                      <Plug className="w-6 h-6 text-gray-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {lang === 'ar' ? 'لا يوجد عملاء MCP مصرّح لهم' : 'No authorized MCP clients'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm">
                      {lang === 'ar' ? (
                        <>
                          سيظهر عملاء بروتوكول MCP هنا عند ربط عميل عبر OAuth.{' '}
                          <button
                            onClick={() => setIsMcpModalOpen(true)}
                            className="text-[#8B0000] font-semibold hover:underline cursor-pointer"
                          >
                            ربط عميل MCP
                          </button>
                        </>
                      ) : (
                        <>
                          MCP clients will appear here when you connect one with OAuth.{' '}
                          <button
                            onClick={() => setIsMcpModalOpen(true)}
                            className="text-[#8B0000] font-semibold hover:underline cursor-pointer"
                          >
                            Connect a client
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: General Profile Settings */}
            {activeTab === 'general' && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h1 className="text-2xl font-serif text-[#191919]">
                    {lang === 'ar' ? 'الإعدادات العامة للملف الشخصي' : 'General Profile Settings'}
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    {lang === 'ar' ? 'إدارة بياناتك الشخصية وحسابك في منصة فيش.' : 'Manage your personal details and account preferences on FYSH.'}
                  </p>
                </div>

                {/* Connected Apps Quick Status Card inside General Tab */}
                <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-[#8B0000] border border-red-100 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">
                        {lang === 'ar' ? 'التطبيقات والحسابات المتصلة' : 'Connected Applications'}
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        {lang === 'ar' 
                          ? `لديك ${connectedAccounts.length} تطبيق متصل حالياً بحسابك.`
                          : `You have ${connectedAccounts.length} active connected app(s).`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('integrations')}
                    className="px-3.5 py-1.5 bg-white text-gray-800 hover:text-[#8B0000] text-xs font-semibold rounded-xl border border-gray-300 hover:border-gray-400 shadow-2xs transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                  >
                    <span>{lang === 'ar' ? 'إدارة التطبيقات المتصلة' : 'Manage Connected Apps'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={onSaveProfile} className="space-y-6 max-w-xl">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center shadow-xs">
                        {profileImage ? (
                          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-9 h-9 text-gray-400" />
                        )}
                      </div>
                      <label className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="w-4 h-4 mb-0.5" />
                        <span className="text-[9px] font-medium">{lang === 'ar' ? 'تغيير' : 'Upload'}</span>
                        <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
                      </label>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{displayName || 'User'}</h4>
                      <p className="text-xs text-gray-500">{firebaseUser?.email || 'guest@fysh.ai'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {lang === 'ar' ? 'الاسم الظاهر' : 'Display Name'}
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#8B0000] focus:border-[#8B0000]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      disabled
                      value={firebaseUser?.email || 'guest@fysh.ai'}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      {lang === 'ar' ? 'نبذة تعريفية' : 'Bio'}
                    </label>
                    <textarea
                      rows={3}
                      value={userBio}
                      onChange={(e) => setUserBio(e.target.value)}
                      placeholder={lang === 'ar' ? 'نبذة عن استخدامك لمنصة فيش...' : 'Tell us about your team or integrations...'}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#8B0000] focus:border-[#8B0000] resize-none"
                    />
                  </div>

                  {saveSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تم حفظ التغييرات بنجاح.' : 'Changes saved successfully.'}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 bg-[#8B0000] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#660000] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: Members */}
            {activeTab === 'members' && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-serif text-[#191919]">
                      {lang === 'ar' ? 'أعضاء الفريق' : 'Team Members'}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                      {lang === 'ar' ? 'إدارة الأعضاء والصلاحيات داخل مساحة عمل فيش الخاصة بك.' : 'Manage who has access to this FYSH workspace and their roles.'}
                    </p>
                  </div>
                </div>

                {/* Invite Form */}
                <form onSubmit={handleInviteMember} className="flex gap-2 max-w-md">
                  <input
                    type="email"
                    placeholder={lang === 'ar' ? 'أدخل بريد العضو للدعوة...' : 'colleague@company.com'}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#8B0000]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#8B0000] text-white text-xs font-semibold rounded-xl hover:bg-[#660000] transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'دعوة' : 'Invite'}</span>
                  </button>
                </form>

                {inviteSent && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تم إرسال رابط الدعوة بنجاح!' : 'Invitation link sent successfully!'}</span>
                  </div>
                )}

                {/* Members List */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF9F9] border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className={`p-3.5 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'العضو' : 'Member'}</th>
                        <th className={`p-3.5 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                        <th className={`p-3.5 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3.5">
                            <div className="font-semibold text-gray-900">{m.name}</div>
                            <div className="text-gray-400 text-[11px]">{m.email}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                              {m.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              m.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Billing */}
            {activeTab === 'billing' && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h1 className="text-2xl font-serif text-[#191919]">
                    {lang === 'ar' ? 'الاشتراكات والفواتير' : 'Billing & Quotas'}
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    {lang === 'ar' ? 'تفاصيل باقتك الحالية واستهلاك طلبات الـ API والتكاملات.' : 'Review your current plan, MCP tool calls, and API quotas.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Current Plan Card */}
                  <div className="border border-gray-200 rounded-2xl p-6 bg-gradient-to-b from-white to-[#FAF9F9] shadow-2xs">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-bold text-[#8B0000] uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-md border border-red-100">
                        {lang === 'ar' ? 'الخطة الحالية' : 'Current Plan'}
                      </span>
                      <Sparkles className="w-5 h-5 text-[#8B0000]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">FYSH Developer Pro</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {lang === 'ar' ? 'وصول غير محدود لأكثر من 5,000 تطبيق وربط MCP فوري.' : 'Unlimited access to 5,000+ apps and instant MCP connections.'}
                    </p>
                    <div className="mt-6 pt-4 border-t border-gray-200 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900">$0</span>
                      <span className="text-xs text-gray-500">{lang === 'ar' ? '/ تجريبي مجاني' : '/ Developer Beta'}</span>
                    </div>
                  </div>

                  {/* Usage Card */}
                  <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-2xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        {lang === 'ar' ? 'استهلاك الـ API هذا الشهر' : 'API Usage This Month'}
                      </h4>
                      <div className="text-2xl font-bold text-gray-900">1,482 / 50,000</div>
                      <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
                        <div className="bg-[#8B0000] h-full rounded-full" style={{ width: '3%' }} />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-4">
                      {lang === 'ar' ? 'يتم تجديد الحصة في الأول من كل شهر.' : 'Quota renews on the 1st of every month.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CLI Setup Modal Helper */}
      {isCliModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#8B0000]" />
                <h3 className="font-bold text-base text-gray-900">{lang === 'ar' ? 'تهيئة سطر الأوامر FYSH CLI' : 'Set up FYSH CLI'}</h3>
              </div>
              <button onClick={() => setIsCliModalOpen(false)} className="text-gray-400 hover:text-black cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              {lang === 'ar' ? 'ثبّت أداة فيش لسطر الأوامر وقم بربط جلستك المحلية مباشرة:' : 'Install the FYSH command line tool and authenticate your local terminal:'}
            </p>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-xs flex items-center justify-between mb-4">
              <code>npm install -g @fysh/cli && fysh login</code>
              <button
                onClick={() => handleCopyCliCommand('npm install -g @fysh/cli && fysh login')}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
                title="Copy"
              >
                {cliCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={() => setIsCliModalOpen(false)}
              className="w-full py-2 bg-[#8B0000] text-white text-xs font-semibold rounded-lg hover:bg-[#660000] cursor-pointer"
            >
              {lang === 'ar' ? 'فهمت ذلك' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* MCP Client Connect Modal Helper */}
      {isMcpModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Plug className="w-5 h-5 text-[#8B0000]" />
                <h3 className="font-bold text-base text-gray-900">{lang === 'ar' ? 'ربط عميل MCP' : 'Connect an MCP Client'}</h3>
              </div>
              <button onClick={() => setIsMcpModalOpen(false)} className="text-gray-400 hover:text-black cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              {lang === 'ar' ? 'يدعم فيش بروتوكول Model Context Protocol (MCP) لربط Claude Desktop و Cursor و Windsurf وكافة الوكلاء:' : 'FYSH natively supports Model Context Protocol (MCP) for Claude Desktop, Cursor, Windsurf, and custom AI Agents:'}
            </p>
            <div className="space-y-2 mb-5">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex items-center justify-between">
                <span className="font-medium text-gray-800">Claude Desktop</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Ready</span>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex items-center justify-between">
                <span className="font-medium text-gray-800">Cursor / Windsurf</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Ready</span>
              </div>
            </div>
            <button
              onClick={() => setIsMcpModalOpen(false)}
              className="w-full py-2 bg-[#8B0000] text-white text-xs font-semibold rounded-lg hover:bg-[#660000] cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
