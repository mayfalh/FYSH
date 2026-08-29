import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Shield, 
  Search, 
  Terminal, 
  ExternalLink, 
  HelpCircle, 
  ChevronRight, 
  Globe, 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Cpu, 
  Users, 
  Radio, 
  FileText, 
  Settings, 
  LifeBuoy, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Code, 
  Eye, 
  EyeOff,
  RefreshCw,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { Lang, t } from '../translations';
import { ApiKeyItem } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

interface ApiKeysPageProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onNavigateHome: () => void;
  onNavigateToApps: () => void;
  onNavigateToAgents: () => void;
  onOpenLogin: () => void;
  isLoggedIn: boolean;
}

export function ApiKeysPage({
  lang,
  setLang,
  onNavigateHome,
  onNavigateToApps,
  onNavigateToAgents,
  onOpenLogin,
  isLoggedIn,
}: ApiKeysPageProps) {
  const currentT = t[lang];
  const isArabic = lang === 'ar';

  // Active Workspace
  const [activeWorkspace, setActiveWorkspace] = useState('mayalfalh_workspace');
  const [activeProject, setActiveProject] = useState('mayalfalh_workspace_first_project');

  // Keys list
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Key Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyAccess, setNewKeyAccess] = useState<'Full access' | 'Read only'>('Full access');
  const [newKeyIp, setNewKeyIp] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Revealed New Key Modal
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ name: string; token: string; maskedToken: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'claude' | 'python' | 'curl' | 'nodejs'>('claude');

  // Delete Confirmation
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Key Testing & Verification
  const [selectedKeyForTest, setSelectedKeyForTest] = useState<string>('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Copy indicator for table tokens
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Real-time Firestore sync & fallback to backend
  useEffect(() => {
    let unsubscribeFirestore = () => {};

    const loadKeys = async () => {
      setLoading(true);
      const user = auth.currentUser;
      const effectiveUserId = user?.uid || 'mayalfalh_workspace';
      const effectiveEmail = user?.email || 'mayalfalh@gmail.com';

      // 1. Try fetching from backend endpoint first to seed default workspace keys
      try {
        const response = await fetch(`/api/fish/keys?fishUserId=${effectiveUserId}&userEmail=${encodeURIComponent(effectiveEmail)}`);
        const data = await response.json();
        if (data?.keys && Array.isArray(data.keys)) {
          setApiKeys(data.keys);
          if (data.keys.length > 0 && !selectedKeyForTest) {
            setSelectedKeyForTest(data.keys[0].token);
          }
        }
      } catch (err) {
        console.warn("Backend keys fetch note:", err);
      }

      // 2. Setup real-time listener if user is logged in
      if (user?.uid) {
        try {
          const q = query(collection(db, 'apiKeys'), where('userId', '==', user.uid));
          unsubscribeFirestore = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              const firestoreKeys: ApiKeyItem[] = snapshot.docs.map(docSnap => {
                const d = docSnap.data();
                return {
                  id: docSnap.id,
                  name: d.name || 'FYSH Key',
                  token: d.token || '',
                  maskedToken: d.maskedToken || (d.token ? `ak_**${d.token.slice(-4)}` : 'ak_****'),
                  access: d.access || 'Full access',
                  ipAllowlist: d.ipAllowlist || 'No restriction',
                  userId: d.userId,
                  userEmail: d.userEmail,
                  createdAt: d.createdAt || 'Just now',
                  status: d.status || 'ACTIVE',
                };
              });
              setApiKeys(firestoreKeys);
            }
          }, (err) => {
            console.warn("Firestore apiKeys listener:", err);
          });
        } catch (e) {
          console.warn("Firestore query setup error:", e);
        }
      }

      setLoading(false);
    };

    loadKeys();

    return () => {
      unsubscribeFirestore();
    };
  }, [isLoggedIn]);

  // Handle create API key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    const user = auth.currentUser;
    const effectiveUserId = user?.uid || 'mayalfalh_workspace';
    const effectiveEmail = user?.email || 'mayalfalh@gmail.com';

    try {
      // 1. Call backend to generate secure cryptographical token
      const res = await fetch('/api/fish/keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fishUserId: effectiveUserId,
          name: newKeyName.trim(),
          access: newKeyAccess,
          ipAllowlist: newKeyIp.trim() || 'No restriction',
          userEmail: effectiveEmail
        })
      });
      const data = await res.json();

      if (data?.key) {
        const createdKey: ApiKeyItem = data.key;

        // 2. Also save to Firestore if authenticated for permanent cloud persistence
        if (user?.uid) {
          try {
            await setDoc(doc(db, 'apiKeys', createdKey.id), {
              ...createdKey,
              userId: user.uid,
              userEmail: user.email || '',
              createdAt: new Date().toISOString()
            });
          } catch (fErr) {
            console.warn("Firestore save key notice:", fErr);
          }
        }

        // Update local list
        setApiKeys(prev => [createdKey, ...prev.filter(k => k.id !== createdKey.id)]);
        setNewlyCreatedKey({
          name: createdKey.name,
          token: data.token,
          maskedToken: createdKey.maskedToken
        });
        setSelectedKeyForTest(data.token);
        setIsCreateModalOpen(false);
        setNewKeyName('');
        setNewKeyIp('');
      }
    } catch (err: any) {
      console.error("Failed to create key:", err);
      alert(isArabic ? 'حدث خطأ أثناء إنشاء المفتاح. يرجى المحاولة مرة أخرى.' : 'Failed to create API key. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete API key
  const handleDeleteKey = async () => {
    if (!keyToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Call backend delete
      await fetch(`/api/fish/keys/${keyToDelete.id}`, { method: 'DELETE' });

      // 2. Delete from Firestore if exists
      if (auth.currentUser?.uid) {
        try {
          await deleteDoc(doc(db, 'apiKeys', keyToDelete.id));
        } catch (fErr) {
          console.warn("Firestore delete key notice:", fErr);
        }
      }

      setApiKeys(prev => prev.filter(k => k.id !== keyToDelete.id));
      if (selectedKeyForTest === keyToDelete.token) {
        setSelectedKeyForTest('');
        setTestResult(null);
      }
      setKeyToDelete(null);
    } catch (err) {
      console.error("Failed to delete key:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy full token or masked token
  const handleCopy = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  // Live Test Key
  const handleTestKey = async () => {
    if (!selectedKeyForTest) return;
    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/fish/keys/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': selectedKeyForTest
        },
        body: JSON.stringify({ apiKey: selectedKeyForTest })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ valid: false, error: err?.message || 'Verification failed' });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Filtered keys
  const filteredKeys = apiKeys.filter(k => 
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.maskedToken.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0E1015] text-[#E1E4EA] font-sans antialiased flex flex-col md:flex-row">
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR (Composio Platform Console exact dark styling)               */}
      {/* ========================================================================= */}
      <aside className="w-full md:w-64 bg-[#14161E] border-b md:border-b-0 md:border-r border-[#222634] flex flex-col shrink-0 select-none">
        {/* Workspace Switcher Header */}
        <div className="p-3.5 border-b border-[#222634] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#8B0000] to-[#E53E3E] flex items-center justify-center text-white font-bold text-sm shadow-md">
              ف
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#A0AEC0] flex items-center gap-1">
                <span className="text-[#E53E3E] font-bold">PLATFORM</span> Switch
              </div>
              <div className="text-xs font-bold text-white truncate max-w-[130px]">
                {activeWorkspace}
              </div>
            </div>
          </div>
          <button 
            onClick={onNavigateHome}
            title={isArabic ? 'العودة للموقع الرئيسي' : 'Return to Website'}
            className="text-[11px] text-[#A0AEC0] hover:text-white px-2 py-1 rounded bg-[#1D212F] hover:bg-[#282E40] border border-[#2D3346] transition-colors"
          >
            {isArabic ? 'الموقع' : 'Site'}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {/* Quick Search */}
          <div className="px-2 mb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#718096]" />
              <input
                type="text"
                placeholder={isArabic ? 'بحث في المنصة...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A1E2B] border border-[#262C3D] rounded-md py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-[#718096] focus:outline-hidden focus:border-[#E53E3E] transition-colors"
              />
            </div>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-[#718096] px-3 py-1">
            {isArabic ? 'لوحة التحكم' : 'Core'}
          </div>

          <button
            onClick={onNavigateToApps}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#A0AEC0] hover:text-white hover:bg-[#1D212F] transition-colors text-left"
          >
            <Layers className="w-4 h-4 text-[#718096]" />
            <span>{isArabic ? 'التطبيقات والأدوات (Toolkits)' : 'Toolkits'}</span>
          </button>

          <button
            onClick={onNavigateToAgents}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#A0AEC0] hover:text-white hover:bg-[#1D212F] transition-colors text-left"
          >
            <Cpu className="w-4 h-4 text-[#718096]" />
            <span>{isArabic ? 'الوكلاء (Agents & MCP)' : 'Agents'}</span>
          </button>

          {/* ACTIVE: API Keys */}
          <div className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold text-white bg-[#6366F1]/15 text-[#818CF8] border-r-2 md:border-r-0 md:border-l-2 border-[#6366F1]">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#818CF8]" />
              <span>{isArabic ? 'مفاتيح API (API Keys)' : 'API Keys'}</span>
            </div>
            <span className="text-[10px] bg-[#6366F1]/20 text-[#A5B4FC] px-1.5 py-0.5 rounded font-mono">
              {apiKeys.length}
            </span>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-[#718096] px-3 pt-3 pb-1">
            {isArabic ? 'الربط والبيانات' : 'Management'}
          </div>

          <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#718096] hover:text-[#A0AEC0] hover:bg-[#1D212F] transition-colors cursor-pointer">
            <Radio className="w-4 h-4 text-[#718096]" />
            <span>{isArabic ? 'الجلسات الحية (Sessions)' : 'Sessions'}</span>
          </div>

          <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#718096] hover:text-[#A0AEC0] hover:bg-[#1D212F] transition-colors cursor-pointer">
            <Shield className="w-4 h-4 text-[#718096]" />
            <span>{isArabic ? 'إعدادات المصادقة (Auth Configs)' : 'Auth Configs'}</span>
          </div>

          <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#718096] hover:text-[#A0AEC0] hover:bg-[#1D212F] transition-colors cursor-pointer">
            <FileText className="w-4 h-4 text-[#718096]" />
            <span>{isArabic ? 'سجلات الاستدعاء (Logs)' : 'Logs'}</span>
          </div>
        </div>

        {/* Sidebar Footer: User Profile & Quick Settings */}
        <div className="p-3 border-t border-[#222634] bg-[#10121A] space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1.5 text-[11px] text-[#A0AEC0] hover:text-white px-2 py-1 rounded bg-[#1A1E2B] border border-[#262C3D]"
            >
              <Globe className="w-3 h-3" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button 
              onClick={onOpenLogin}
              className="text-[11px] text-[#A0AEC0] hover:text-white px-2 py-1 rounded bg-[#1A1E2B] border border-[#262C3D]"
            >
              {isLoggedIn ? (isArabic ? 'حسابي' : 'Profile') : (isArabic ? 'دخول' : 'Sign in')}
            </button>
          </div>

          {/* User Info Card */}
          <div className="flex items-center gap-2 pt-1">
            <div className="w-7 h-7 rounded-full bg-linear-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold ring-1 ring-white/20">
              M
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">may alfah</div>
              <div className="text-[10px] text-[#718096] truncate">mayalfalh_workspace</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" title="Connected" />
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA: API Keys Management Table & Creation Flow             */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Breadcrumb Bar */}
        <header className="h-14 border-b border-[#222634] px-6 sm:px-8 flex items-center justify-between bg-[#11131B]">
          <div className="flex items-center gap-2 text-xs text-[#718096]">
            <span>{activeWorkspace}</span>
            <span>/</span>
            <span>{activeProject}</span>
            <span>/</span>
            <span className="text-white font-medium">api-keys</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 text-xs text-[#A0AEC0] hover:text-white transition-colors"
            >
              <ArrowLeft className={`w-3.5 h-3.5 ${isArabic ? 'rotate-180' : ''}`} />
              <span>{isArabic ? 'الرئيسية' : 'Home'}</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black font-semibold text-xs rounded-md hover:bg-gray-100 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إنشاء مفتاح جديد' : 'Create API Key'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header Title Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <span>API Keys</span>
                <span className="text-xs font-normal text-[#A0AEC0] bg-[#1E2333] border border-[#2D344B] px-2.5 py-0.5 rounded-full">
                  {apiKeys.length} {isArabic ? 'مفاتيح نشطة' : 'active keys'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#8A94A6] mt-1">
                {isArabic 
                  ? 'إدارة مفاتيح API للمصادقة مع هذا المشروع وربط كافة تطبيقاتك مع الوكلاء بنقرة واحدة.' 
                  : 'Manage API keys for authenticating with this project.'}
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-black font-semibold text-xs rounded-lg transition-all shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isArabic ? 'إنشاء مفتاح API' : 'Create API Key'}</span>
            </button>
          </div>

          {/* ARABIC NON-TECHNICAL VALUE BANNER: Explaining the 1-Key Magic */}
          <div className="bg-linear-to-r from-[#171C2E] via-[#1A1F35] to-[#171C2E] border border-[#2B3454] rounded-xl p-4 sm:p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#6366F1]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/40 flex items-center justify-center text-[#818CF8] shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{isArabic ? '💡 كيف يعمل مفتاح فيش الموحد؟' : '💡 How does the unified FYSH API Key work?'}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-normal">
                      {isArabic ? 'بدون تعقيد تقني' : 'No-code ready'}
                    </span>
                  </h2>
                  <p className="text-xs text-[#A0AEC0] mt-1 leading-relaxed max-w-3xl">
                    {isArabic 
                      ? 'بدلاً من إنشاء حساب ومفتاح API لكل تطبيق على حدة (Gmail, Notion, Slack, Drive...)، تقوم بربط تطبيقاتك لمرة واحدة فقط في قسم "التطبيقات"، ثم تستخرج مفتاح فيش هذا وتضعه في وكيلك (Claude, Cursor, ChatGPT) ليتحكم بكل تطبيقاتك تلقائياً دون الحاجة لتسجيل أي مفاتيح أخرى!'
                      : 'Instead of managing separate API keys for every single service (Gmail, Notion, Slack, Drive...), connect your apps once in the Toolkits tab, then use this single FYSH API Key in Claude, Cursor, or your AI agents to seamlessly orchestrate everything!'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onNavigateToApps}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#252C42] hover:bg-[#303854] border border-[#3A4568] rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'ربط التطبيقات' : 'Connect Toolkits'}</span>
                </button>
                <button
                  onClick={onNavigateToAgents}
                  className="px-3 py-1.5 text-xs font-medium text-[#A5B4FC] bg-[#6366F1]/20 hover:bg-[#6366F1]/30 border border-[#6366F1]/40 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تثبيت الوكيل' : 'Setup Agent'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MAIN TABLE (Matching screenshot columns: Name, Token, Access, IP, Created) */}
          {/* ========================================================================= */}
          <div className="bg-[#141722] border border-[#222738] rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#E1E4EA]">
                <thead className="bg-[#181C2A] text-[#8A94A6] uppercase text-[11px] font-semibold border-b border-[#222738]">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-medium">Name</th>
                    <th scope="col" className="px-5 py-3.5 font-medium">Token</th>
                    <th scope="col" className="px-5 py-3.5 font-medium">Access</th>
                    <th scope="col" className="px-5 py-3.5 font-medium">IP Allowlist</th>
                    <th scope="col" className="px-5 py-3.5 font-medium">Created At</th>
                    <th scope="col" className="px-5 py-3.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D2232]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#718096]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#6366F1]" />
                        <span>{isArabic ? 'جاري تحميل المفاتيح...' : 'Loading API keys...'}</span>
                      </td>
                    </tr>
                  ) : filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-[#718096]">
                        <Key className="w-8 h-8 mx-auto mb-2 text-[#3D4560]" />
                        <p className="text-sm font-medium text-white">{isArabic ? 'لا توجد مفاتيح تطابق البحث' : 'No API keys found'}</p>
                        <p className="text-xs text-[#718096] mt-1">{isArabic ? 'أنشئ مفتاحك الأول لبدء ربط تطبيقاتك مع الوكلاء.' : 'Create your first API key to start connecting agents.'}</p>
                        <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="mt-4 px-3.5 py-1.5 bg-white text-black font-semibold text-xs rounded-md hover:bg-gray-100 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'إنشاء مفتاح' : 'Create Key'}</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map((item) => (
                      <tr 
                        key={item.id}
                        className="hover:bg-[#1A1E2D] transition-colors group"
                      >
                        {/* Name */}
                        <td className="px-5 py-4 font-medium text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-[#202536] border border-[#2D344B] flex items-center justify-center text-[#818CF8] shrink-0">
                            <Key className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-white">{item.name}</span>
                            {item.status === 'ACTIVE' && (
                              <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active" />
                            )}
                          </div>
                        </td>

                        {/* Token (Masked like ak_**YP6X) */}
                        <td className="px-5 py-4">
                          <div className="inline-flex items-center gap-2 bg-[#10121A] border border-[#262C3E] px-2.5 py-1 rounded-md font-mono text-[11px] text-[#A5B4FC]">
                            <span>{item.maskedToken}</span>
                            <button
                              onClick={() => handleCopy(item.token || item.maskedToken, item.id)}
                              title={isArabic ? 'نسخ التوكن' : 'Copy token'}
                              className="text-[#718096] hover:text-white transition-colors cursor-pointer"
                            >
                              {copiedKeyId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Access */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1E293B] text-[#94A3B8] border border-[#334155]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>{item.access || 'Full access'}</span>
                          </span>
                        </td>

                        {/* IP Allowlist */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#3F2F11]/40 text-[#FBBF24] border border-[#785412]/50">
                            <Shield className="w-3 h-3 text-[#FBBF24]" />
                            <span>{item.ipAllowlist || 'No restriction'}</span>
                          </span>
                        </td>

                        {/* Created At */}
                        <td className="px-5 py-4 text-[#8A94A6] font-mono text-[11px]">
                          {item.createdAt}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedKeyForTest(item.token);
                                handleTestKey();
                              }}
                              title={isArabic ? 'اختبار صلاحية المفتاح' : 'Test API key'}
                              className="p-1.5 rounded text-[#718096] hover:text-white hover:bg-[#252B3D] transition-colors"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            <button
                              onClick={() => setKeyToDelete(item)}
                              title={isArabic ? 'حذف المفتاح' : 'Delete API key'}
                              className="p-1.5 rounded text-[#718096] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* QUICK INTERACTIVE TESTER & PLAYGROUND                                     */}
          {/* ========================================================================= */}
          <div className="bg-[#141722] border border-[#222738] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>{isArabic ? 'اختبار المفتاح السريع (Live Key Tester)' : 'Live Key Verification'}</span>
                </h3>
                <p className="text-xs text-[#8A94A6] mt-0.5">
                  {isArabic 
                    ? 'تحقق مباشرة من أن مفتاحك يعمل ويتصل بجميع أدواتك وتطبيقاتك بنجاح.' 
                    : 'Verify your unified key and test live connectivity across all connected toolkits.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedKeyForTest}
                  onChange={(e) => setSelectedKeyForTest(e.target.value)}
                  className="bg-[#1A1E2D] border border-[#2D344B] text-xs text-white rounded-md px-3 py-1.5 focus:outline-hidden focus:border-[#6366F1]"
                >
                  <option value="">{isArabic ? '-- اختر مفتاحاً --' : '-- Select API Key --'}</option>
                  {apiKeys.map(k => (
                    <option key={k.id} value={k.token}>
                      {k.name} ({k.maskedToken})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleTestKey}
                  disabled={!selectedKeyForTest || isTestingKey}
                  className="px-3.5 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isTestingKey ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  <span>{isArabic ? 'اختبار الآن' : 'Test Key'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg border text-xs font-mono transition-all ${
                testResult.valid 
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' 
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold flex items-center gap-1.5">
                    {testResult.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    {testResult.valid ? (isArabic ? '✅ المفتاح فعال ومتصل بالكامل!' : '✅ API Key is Valid & Active!') : (isArabic ? '❌ تعذر التحقق من المفتاح' : '❌ Verification Failed')}
                  </span>
                  <span className="text-[10px] text-[#8A94A6]">status: {testResult.valid ? '200 OK' : '401 Unauthorized'}</span>
                </div>
                {testResult.valid ? (
                  <div className="space-y-1 text-[#A0AEC0]">
                    <div>Workspace: <span className="text-white">{testResult.userId}</span></div>
                    <div>Access Level: <span className="text-emerald-400">{testResult.access}</span></div>
                    <div>Active Connected Apps: <span className="text-white font-bold">{testResult.connectedAccountsCount || 0} applications</span></div>
                    <div>MCP Endpoint: <span className="text-[#818CF8] underline">{testResult.mcpEndpoint}</span></div>
                  </div>
                ) : (
                  <div className="text-rose-300">{testResult.error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE API KEY DIALOG                                            */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#141722] border border-[#272D3F] rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-[#222738] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-[#818CF8]">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isArabic ? 'إنشاء مفتاح API جديد' : 'Create new API Key'}
                  </h3>
                  <p className="text-[11px] text-[#718096]">
                    {isArabic ? 'للمصادقة مع هذا المشروع واستخدامه في وكلائك' : 'For authenticating with this project'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#718096] hover:text-white text-xs px-2 py-1 rounded hover:bg-[#1F2436]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  {isArabic ? 'اسم المفتاح (Key Name) *' : 'Key Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isArabic ? 'مثال: وكيلي الذكي، Claude Desktop، متجر العمل...' : 'e.g. Claude Agent, My Assistant, Production Key'}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-[#1A1E2D] border border-[#2D344B] rounded-lg px-3 py-2 text-xs text-white placeholder-[#5A6478] focus:outline-hidden focus:border-[#6366F1]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  {isArabic ? 'مستوى الصلاحية (Access Level)' : 'Access Level'}
                </label>
                <select
                  value={newKeyAccess}
                  onChange={(e: any) => setNewKeyAccess(e.target.value)}
                  className="w-full bg-[#1A1E2D] border border-[#2D344B] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-[#6366F1]"
                >
                  <option value="Full access">{isArabic ? 'صلاحية كاملة (Full access - موصى به)' : 'Full access (Recommended)'}</option>
                  <option value="Read only">{isArabic ? 'قراءة فقط (Read only)' : 'Read only'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  {isArabic ? 'تقييد عناوين IP (اختياري)' : 'IP Allowlist (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isArabic ? 'اتركه فارغاً للسماح من أي مكان (No restriction)' : 'Leave empty for No restriction'}
                  value={newKeyIp}
                  onChange={(e) => setNewKeyIp(e.target.value)}
                  className="w-full bg-[#1A1E2D] border border-[#2D344B] rounded-lg px-3 py-2 text-xs text-white placeholder-[#5A6478] focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#181C2A] border border-[#252B3E] text-[11px] text-[#8A94A6] space-y-1">
                <div className="font-semibold text-white flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isArabic ? 'الأمان والحماية' : 'Security Notice'}</span>
                </div>
                <p>
                  {isArabic 
                    ? 'سيتم توليد مفتاح سري عالي التشفير. سيتم عرضه لمرة واحدة فقط لنسخه.' 
                    : 'A high-security key will be generated and shown once for copying.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#A0AEC0] hover:text-white bg-[#1A1E2D] hover:bg-[#252B3D] rounded-md transition-colors"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newKeyName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isArabic ? 'تأكيد وإنشاء' : 'Generate Key'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REVEAL GENERATED KEY (One-time secure copy modal)                 */}
      {/* ========================================================================= */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#141722] border border-[#3730A3] rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-left">
            <div className="flex items-center gap-3 border-b border-[#222738] pb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isArabic ? 'تم إنشاء مفتاح API بنجاح! 🎉' : 'API Key Created Successfully! 🎉'}
                </h3>
                <p className="text-xs text-[#8A94A6]">
                  {isArabic ? `المفتاح: ${newlyCreatedKey.name}` : `Key name: ${newlyCreatedKey.name}`}
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                {isArabic 
                  ? 'يرجى حفظ هذا المفتاح في مكان آمن الآن. لن تتمكن من رؤية التوكن كاملاً مرة أخرى بعد إغلاق هذه النافذة.' 
                  : 'Please save this key securely right now. You will not be able to view the full token again after closing.'}
              </p>
            </div>

            {/* Token Reveal Box */}
            <div>
              <label className="block text-[11px] font-semibold text-[#A0AEC0] uppercase tracking-wider mb-1.5">
                {isArabic ? 'مفتاح فيش الموحد (FYSH API Key)' : 'FYSH Unified API Key'}
              </label>
              <div className="flex items-center gap-2 bg-[#0C0E14] border border-[#2D354E] rounded-lg p-2.5 font-mono text-xs text-emerald-300">
                <span className="truncate flex-1 select-all">{newlyCreatedKey.token}</span>
                <button
                  onClick={() => handleCopy(newlyCreatedKey.token)}
                  className="px-3 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ المفتاح' : 'Copy Key')}</span>
                </button>
              </div>
            </div>

            {/* Quick Setup Code Snippets */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">
                {isArabic ? 'طريقة الاستخدام الفوري في الوكلاء:' : 'Instant Integration Snippets:'}
              </div>
              <div className="flex border-b border-[#252B3E] gap-2 text-xs">
                <button
                  onClick={() => setActiveSnippetTab('claude')}
                  className={`pb-1.5 px-2 font-medium transition-colors ${activeSnippetTab === 'claude' ? 'text-[#818CF8] border-b-2 border-[#6366F1]' : 'text-[#718096] hover:text-white'}`}
                >
                  Claude Desktop (MCP)
                </button>
                <button
                  onClick={() => setActiveSnippetTab('python')}
                  className={`pb-1.5 px-2 font-medium transition-colors ${activeSnippetTab === 'python' ? 'text-[#818CF8] border-b-2 border-[#6366F1]' : 'text-[#718096] hover:text-white'}`}
                >
                  Python
                </button>
                <button
                  onClick={() => setActiveSnippetTab('curl')}
                  className={`pb-1.5 px-2 font-medium transition-colors ${activeSnippetTab === 'curl' ? 'text-[#818CF8] border-b-2 border-[#6366F1]' : 'text-[#718096] hover:text-white'}`}
                >
                  cURL
                </button>
              </div>

              <div className="bg-[#0C0E14] border border-[#222738] rounded-lg p-3 text-[11px] font-mono text-[#E2E8F0] overflow-x-auto relative">
                {activeSnippetTab === 'claude' && (
                  <pre>{`// In claude_desktop_config.json
{
  "mcpServers": {
    "fysh": {
      "command": "npx",
      "args": ["-y", "@composio/mcp@latest", "--api-key", "${newlyCreatedKey.token}"]
    }
  }
}`}</pre>
                )}
                {activeSnippetTab === 'python' && (
                  <pre>{`from composio import Composio

# Universal FYSH Key connected to all your toolkits
composio = Composio(api_key="${newlyCreatedKey.token}")
session = composio.create_session()`}</pre>
                )}
                {activeSnippetTab === 'curl' && (
                  <pre>{`curl -X POST "${window.location.origin}/api/fish/v1/execute" \\
  -H "x-api-key: ${newlyCreatedKey.token}" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Check my recent unread emails in Gmail"}'`}</pre>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="px-5 py-2 bg-white hover:bg-gray-100 text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                {isArabic ? 'فهمت، تم حفظ المفتاح' : 'I have saved my key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION                                              */}
      {/* ========================================================================= */}
      {keyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141722] border border-[#3F2025] rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isArabic ? 'حذف مفتاح API' : 'Delete API Key'}
                </h3>
                <p className="text-xs text-[#8A94A6]">
                  {isArabic ? `هل أنت متأكد من حذف ${keyToDelete.name}؟` : `Are you sure you want to delete ${keyToDelete.name}?`}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#A0AEC0] leading-relaxed">
              {isArabic 
                ? 'أي تطبيق أو وكيل ذكي يستخدم هذا المفتاح سيفقد الوصول فوراً ولن يتمكن من الاتصال بتطبيقاتك.' 
                : 'Any agent or integration using this key will immediately lose access.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setKeyToDelete(null)}
                className="px-3 py-1.5 text-xs text-[#A0AEC0] hover:text-white bg-[#1A1E2D] rounded-md transition-colors"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteKey}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isArabic ? 'تأكيد الحذف' : 'Delete Key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
