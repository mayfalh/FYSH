import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  ArrowRight, 
  ExternalLink, 
  Terminal, 
  Bot, 
  Cpu, 
  Layers, 
  Sparkles, 
  Check, 
  SlidersHorizontal,
  ChevronRight,
  Command
} from 'lucide-react';
import { ALL_COMPOSIO_APPS, AppItem } from '../data/appsData';
import { AGENT_LIST, TOP_AGENT_GROUPS, AgentItem } from '../data/agentsData';
import { Lang } from '../translations';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  onSelectApp?: (app: AppItem) => void;
  onSelectAgent?: (agent: AgentItem) => void;
  onNavigate?: (route: string) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  lang,
  onSelectApp,
  onSelectAgent,
  onNavigate
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'apps' | 'agents' | 'platform'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard shortcut Escape and Arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search Results aggregation
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();

    // 1. Apps matching
    const matchingApps = ALL_COMPOSIO_APPS.filter(app => {
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        (app.description && app.description.toLowerCase().includes(q)) ||
        (app.composioSlug && app.composioSlug.toLowerCase().includes(q))
      );
    }).map(app => ({
      type: 'app' as const,
      id: `app-${app.id}`,
      title: app.name,
      subtitle: app.category,
      description: app.description || '',
      logo: app.logo,
      rawItem: app
    }));

    // 2. Agents matching
    const allAgentsList: AgentItem[] = [
      ...TOP_AGENT_GROUPS.claude.items,
      ...TOP_AGENT_GROUPS.codex_chatgpt.items,
      ...TOP_AGENT_GROUPS.cursor.items,
      ...AGENT_LIST
    ];
    // Deduplicate
    const seenAgentIds = new Set<string>();
    const uniqueAgents = allAgentsList.filter(a => {
      if (seenAgentIds.has(a.id)) return false;
      seenAgentIds.add(a.id);
      return true;
    });

    const matchingAgents = uniqueAgents.filter(agent => {
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        (agent.nameAr && agent.nameAr.toLowerCase().includes(q)) ||
        agent.description.toLowerCase().includes(q) ||
        (agent.descriptionAr && agent.descriptionAr.toLowerCase().includes(q)) ||
        agent.category.toLowerCase().includes(q)
      );
    }).map(agent => ({
      type: 'agent' as const,
      id: `agent-${agent.id}`,
      title: lang === 'ar' && agent.nameAr ? agent.nameAr : agent.name,
      subtitle: agent.category,
      description: lang === 'ar' && agent.descriptionAr ? agent.descriptionAr : agent.description,
      logo: '',
      rawItem: agent
    }));

    // 3. Platform sections matching
    const platformSections = [
      {
        type: 'platform' as const,
        id: 'platform-home',
        title: lang === 'ar' ? 'الصفحة الرئيسية لمنصة فيش' : 'FYSH Platform Home',
        subtitle: lang === 'ar' ? 'نظرة عامة والخدمات السحابية' : 'Platform Overview & Cloud Engine',
        description: lang === 'ar' ? 'استكشف بيئات العمل وربط الوكلاء الذكية' : 'Explore AI agent workspaces and automation engines',
        route: 'home'
      },
      {
        type: 'platform' as const,
        id: 'platform-apps',
        title: lang === 'ar' ? 'كتالوج التطبيقات وMCP (180+ تطبيق)' : 'Apps & MCP Catalog (180+ Apps)',
        subtitle: lang === 'ar' ? 'ربط التطبيقات وخوادم MCP المخصصة' : 'Connect SaaS tools & Custom MCP Servers',
        description: lang === 'ar' ? 'تصفح كافة التطبيقات وتصنيفاتها وربط الحسابات' : 'Browse all toolkits and categories',
        route: 'apps'
      },
      {
        type: 'platform' as const,
        id: 'platform-agents',
        title: lang === 'ar' ? 'قسم ربط الوكلاء (Connect My Agent)' : 'Agent Connections (Claude, Cursor, Codex)',
        subtitle: lang === 'ar' ? 'أوامر التثبيت والـ CLI وربط MCP' : 'CLI commands, MCP URLs and installers',
        description: lang === 'ar' ? 'تثبيت أدوات التطوير للوكلاء الذكية' : 'Install developer toolkits for autonomous AI agents',
        route: 'agents'
      },
      {
        type: 'platform' as const,
        id: 'platform-api-keys',
        title: lang === 'ar' ? 'إدارة مفاتيح API (API Keys Console)' : 'API Keys Management Console',
        subtitle: lang === 'ar' ? 'مفتاح موحد لربط كل التطبيقات والوكلاء' : 'Single unified key for all toolkits and agents',
        description: lang === 'ar' ? 'إنشاء وإدارة مفاتيح API للمصادقة وتكامل الوكلاء' : 'Generate and manage project API keys for unified authentication',
        route: 'api-keys'
      },
      {
        type: 'platform' as const,
        id: 'platform-wizard',
        title: lang === 'ar' ? 'معالج الأتمتة الذكي (Automation Wizard)' : 'Automation Wizard & Workflows',
        subtitle: lang === 'ar' ? 'بناء تدفقات عمل وتكاملات تلقائية' : 'Build multi-step automated workflows',
        description: lang === 'ar' ? 'توليد سيناريوهات الأتمتة بالذكاء الاصطناعي' : 'Generate automated multi-app triggers',
        route: 'wizard'
      }
    ].filter(sec => {
      if (!q) return true;
      return (
        sec.title.toLowerCase().includes(q) ||
        sec.subtitle.toLowerCase().includes(q) ||
        sec.description.toLowerCase().includes(q)
      );
    });

    if (activeFilter === 'apps') return matchingApps;
    if (activeFilter === 'agents') return matchingAgents;
    if (activeFilter === 'platform') return platformSections;

    return [...platformSections, ...matchingAgents.slice(0, 8), ...matchingApps];
  }, [query, activeFilter, lang]);

  const handleSelect = (item: any) => {
    onClose();
    if (item.type === 'app') {
      if (onSelectApp) {
        onSelectApp(item.rawItem);
      } else if (onNavigate) {
        onNavigate('apps');
      }
    } else if (item.type === 'agent') {
      if (onSelectAgent) {
        onSelectAgent(item.rawItem);
      } else if (onNavigate) {
        onNavigate('agents');
      }
    } else if (item.type === 'platform') {
      if (onNavigate) {
        onNavigate(item.route);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-200 gap-3 bg-[#FAFAFA]">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === 'ar' 
                ? 'ابحث عن أي تطبيق، وكيل ذكي (Claude, Cursor, Devin)، أو ميزة بالمنصة...' 
                : 'Search apps (WebCrawler, Slack...), AI agents (Claude, Cursor...), or features...'
            }
            className="flex-1 bg-transparent border-none text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 px-2 py-1 rounded border border-gray-200">
            <kbd className="font-mono">ESC</kbd>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeFilter === 'all'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            {lang === 'ar' ? 'الكل' : 'All'} ({results.length})
          </button>
          <button
            onClick={() => setActiveFilter('apps')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeFilter === 'apps'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            {lang === 'ar' ? 'التطبيقات وMCP' : 'Apps & MCP'}
          </button>
          <button
            onClick={() => setActiveFilter('agents')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeFilter === 'agents'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            {lang === 'ar' ? 'الوكلاء وأدوات CLI' : 'Agents & CLI'}
          </button>
          <button
            onClick={() => setActiveFilter('platform')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeFilter === 'platform'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            {lang === 'ar' ? 'المنصة والميزات' : 'Platform & Features'}
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 divide-y divide-gray-100">
          {results.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <p className="text-sm font-medium">
                {lang === 'ar' ? 'لم يتم العثور على نتائج تطابق بحثك' : 'No matching results found'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {lang === 'ar' 
                  ? 'جرب البحث باسم تطبيق آخر أو كلمة مفتاحية عامة.' 
                  : 'Try searching for another keyword or tool name.'}
              </p>
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-gray-50 group ${
                  idx === selectedIndex ? 'bg-blue-50/50 ring-1 ring-blue-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.type === 'app' ? (
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center p-1.5 shrink-0 shadow-2xs">
                      {item.logo ? (
                        <img 
                          src={item.logo} 
                          alt={item.title} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  ) : item.type === 'agent' ? (
                    <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                      <Bot className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                        {item.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.type === 'app' ? (
                    <span className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 flex items-center gap-1">
                      {lang === 'ar' ? 'فتح وربط' : 'Connect'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  ) : item.type === 'agent' ? (
                    <span className="text-xs font-semibold text-gray-900 group-hover:text-emerald-600 flex items-center gap-1">
                      {lang === 'ar' ? 'تثبيت' : 'Install'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                      {lang === 'ar' ? 'انتقال' : 'Go'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>
            {lang === 'ar' 
              ? `إجمالي التطبيقات والوكلاء: ${ALL_COMPOSIO_APPS.length}+ أداة متصلة`
              : `Total ecosystem: ${ALL_COMPOSIO_APPS.length}+ connected tools & agents`}
          </span>
          <div className="flex items-center gap-2">
            <span>{lang === 'ar' ? 'اضغط للفتح' : 'Click to open'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
