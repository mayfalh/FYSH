import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Copy, 
  Check, 
  ExternalLink,
  Bot,
  User,
  FileText,
  X,
  ArrowDownToLine,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  Globe2,
  RefreshCw,
  Search,
  Key
} from 'lucide-react';
import { Lang, t } from '../translations';
import { TOP_AGENT_GROUPS, AGENT_LIST, AgentItem } from '../data/agentsData';
import { AgentLogo } from './AgentLogo';
import { AgentInstallModal } from './AgentInstallModal';

interface AgentsPageProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onNavigateHome: () => void;
  onNavigateToApps?: () => void;
  onNavigateToApiKeys?: () => void;
  onOpenLogin: () => void;
  isLoggedIn: boolean;
}

// Curated list of brand app icons for the "Bring your agent to where you work" section matching the screenshot
const POPULAR_APPS_ROW_1 = [
  { name: 'Gmail', slug: 'gmail', logo: 'https://logos.composio.dev/api/gmail' },
  { name: 'Slack', slug: 'slack', logo: 'https://logos.composio.dev/api/slack' },
  { name: 'Notion', slug: 'notion', logo: 'https://logos.composio.dev/api/notion' },
  { name: 'GitHub', slug: 'github', logo: 'https://logos.composio.dev/api/github' },
  { name: 'Supabase', slug: 'supabase', logo: 'https://logos.composio.dev/api/supabase' },
  { name: 'Jira', slug: 'jira', logo: 'https://logos.composio.dev/api/jira' },
  { name: 'Asana', slug: 'asana', logo: 'https://logos.composio.dev/api/asana' },
  { name: 'Google Drive', slug: 'google-drive', logo: 'https://logos.composio.dev/api/google-drive' },
  { name: 'Google Calendar', slug: 'google-calendar', logo: 'https://logos.composio.dev/api/google-calendar' },
  { name: 'Discord', slug: 'discord', logo: 'https://logos.composio.dev/api/discord' },
  { name: 'Figma', slug: 'figma', logo: 'https://logos.composio.dev/api/figma' },
  { name: 'Dropbox', slug: 'dropbox', logo: 'https://logos.composio.dev/api/dropbox' },
  { name: 'HubSpot', slug: 'hubspot', logo: 'https://logos.composio.dev/api/hubspot' },
  { name: 'Salesforce', slug: 'salesforce', logo: 'https://logos.composio.dev/api/salesforce' },
  { name: 'Shopify', slug: 'shopify', logo: 'https://logos.composio.dev/api/shopify' },
  { name: 'Intercom', slug: 'intercom', logo: 'https://logos.composio.dev/api/intercom' },
  { name: 'Linear', slug: 'linear', logo: 'https://logos.composio.dev/api/linear' },
  { name: 'Zendesk', slug: 'zendesk', logo: 'https://logos.composio.dev/api/zendesk' },
];

const POPULAR_APPS_ROW_2 = [
  { name: 'Stripe', slug: 'stripe', logo: 'https://logos.composio.dev/api/stripe' },
  { name: 'Mixpanel', slug: 'mixpanel', logo: 'https://logos.composio.dev/api/mixpanel' },
  { name: 'Monday.com', slug: 'monday', logo: 'https://logos.composio.dev/api/monday' },
  { name: 'Atlassian', slug: 'atlassian', logo: 'https://logos.composio.dev/api/atlassian' },
  { name: 'Microsoft Teams', slug: 'microsoft-teams', logo: 'https://logos.composio.dev/api/microsoft-teams' },
  { name: 'Box', slug: 'box', logo: 'https://logos.composio.dev/api/box' },
  { name: 'YouTube', slug: 'youtube', logo: 'https://logos.composio.dev/api/youtube' },
  { name: 'X / Twitter', slug: 'twitter', logo: 'https://logos.composio.dev/api/twitter' },
  { name: 'Instagram', slug: 'instagram', logo: 'https://logos.composio.dev/api/instagram' },
  { name: 'Spotify', slug: 'spotify', logo: 'https://logos.composio.dev/api/spotify' },
  { name: 'Zoom', slug: 'zoom', logo: 'https://logos.composio.dev/api/zoom' },
  { name: 'Reddit', slug: 'reddit', logo: 'https://logos.composio.dev/api/reddit' },
  { name: 'Product Hunt', slug: 'producthunt', logo: 'https://logos.composio.dev/api/producthunt' },
  { name: 'ClickUp', slug: 'clickup', logo: 'https://logos.composio.dev/api/clickup' },
  { name: 'Airtable', slug: 'airtable', logo: 'https://logos.composio.dev/api/airtable' },
  { name: 'Pipedrive', slug: 'pipedrive', logo: 'https://logos.composio.dev/api/pipedrive' },
  { name: 'DocuSign', slug: 'docusign', logo: 'https://logos.composio.dev/api/docusign' },
  { name: 'Mailchimp', slug: 'mailchimp', logo: 'https://logos.composio.dev/api/mailchimp' },
];

const POPULAR_APPS_ROW_3 = [
  { name: 'Bitbucket', slug: 'bitbucket', logo: 'https://logos.composio.dev/api/bitbucket' },
  { name: 'GitLab', slug: 'gitlab', logo: 'https://logos.composio.dev/api/gitlab' },
  { name: 'Trello', slug: 'trello', logo: 'https://logos.composio.dev/api/trello' },
  { name: 'Snowflake', slug: 'snowflake', logo: 'https://logos.composio.dev/api/snowflake' },
  { name: 'Pinterest', slug: 'pinterest', logo: 'https://logos.composio.dev/api/pinterest' },
  { name: 'Google Keep', slug: 'google-keep', logo: 'https://logos.composio.dev/api/google-keep' },
  { name: 'WhatsApp', slug: 'whatsapp', logo: 'https://logos.composio.dev/api/whatsapp' },
  { name: 'Telegram', slug: 'telegram', logo: 'https://logos.composio.dev/api/telegram' },
  { name: 'Google Sheets', slug: 'google-sheets', logo: 'https://logos.composio.dev/api/google-sheets' },
  { name: 'Docker', slug: 'docker', logo: 'https://logos.composio.dev/api/docker' },
  { name: 'LinkedIn', slug: 'linkedin', logo: 'https://logos.composio.dev/api/linkedin' },
  { name: 'Facebook', slug: 'facebook', logo: 'https://logos.composio.dev/api/facebook' },
  { name: 'Webflow', slug: 'webflow', logo: 'https://logos.composio.dev/api/webflow' },
  { name: 'Twitch', slug: 'twitch', logo: 'https://logos.composio.dev/api/twitch' },
  { name: 'Medium', slug: 'medium', logo: 'https://logos.composio.dev/api/medium' },
  { name: 'Google Cloud', slug: 'google-cloud', logo: 'https://logos.composio.dev/api/google-cloud' },
  { name: 'AWS', slug: 'aws', logo: 'https://logos.composio.dev/api/aws' },
  { name: 'Notion Calendar', slug: 'notion-calendar', logo: 'https://logos.composio.dev/api/notion' },
];

export function AgentsPage({ 
  lang, 
  setLang, 
  onNavigateHome, 
  onNavigateToApps,
  onNavigateToApiKeys,
  onOpenLogin, 
  isLoggedIn 
}: AgentsPageProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedCliTab, setSelectedCliTab] = useState<'unix' | 'windows'>('unix');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleOpenInstall = (agent: AgentItem) => {
    setSelectedAgent(agent);
    setIsInstallModalOpen(true);
  };

  const cliInstallCommand = 'curl -fsSL https://composio.dev/install';
  const mcpUniversalUrl = 'https://connect.composio.dev/mcp';
  const directDashboardUrl = 'https://dashboard.composio.dev/mayalfalh_workspace/~/connect';

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#191919] selection:bg-gray-200" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Fixed Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-8 md:px-12 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 hover:text-[#8B0000] transition-colors group cursor-pointer"
            title={lang === 'ar' ? 'الرجوع إلى الصفحة الرئيسية' : 'Return to Home'}
          >
            {lang === 'ar' ? (
              <ArrowRight className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            ) : (
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            )}
            <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />

          <a
            href="/"
            onClick={(e) => { e.preventDefault(); onNavigateHome(); }}
            className="flex items-center"
          >
            <img
              src="https://res.cloudinary.com/dd3as4ova/image/upload/v1787885428/logo1_edjwuq.png"
              alt="FYSH Logo"
              className="h-8 sm:h-9 w-auto object-contain transition-all duration-200"
            />
          </a>
        </div>

        {/* Center: Indicator & Quick Switch */}
        <div className="hidden md:flex items-center gap-3 text-xs font-semibold text-gray-700 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200">
          <div className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-[#2563eb]" />
            <span>{lang === 'ar' ? 'منصة ربط الوكلاء الذكية - فيش' : 'FYSH Agent Gateway'}</span>
          </div>
          <span className="h-3 w-px bg-gray-300" />
          <span className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-md font-mono border border-blue-200">MCP Protocol</span>
        </div>

        {/* Right Actions */}
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
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-2.5 py-1.5 rounded-md text-[#191919] hover:bg-gray-100 transition-colors text-xs font-bold"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>

          <button
            onClick={onOpenLogin}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#8B0000] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#660000] transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>{isLoggedIn ? (lang === 'ar' ? 'حسابي' : 'My Account') : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}</span>
          </button>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        
        {/* Page Title: Exact match from screenshot with FYSH branding */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#111111] font-sans leading-tight">
            {lang === 'ar' 
              ? 'أنجز المزيد مع فيش، في كل مكان تعمل فيه.' 
              : 'Do more with FYSH, everywhere you work.'}
          </h1>

          {/* Connect my agent Royal Blue Button */}
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setIsQuickConnectOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-sm shadow-sm hover:shadow transition-all cursor-pointer active:scale-98"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{lang === 'ar' ? 'ربط وكيلي الذكي' : 'Connect my agent'}</span>
            </button>
          </div>
        </div>

        {/* Top 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          {/* Left Column: Claude, Codex + ChatGPT, Cursor */}
          <div className="space-y-6">
            
            {/* 1. Claude Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
              <h2 className="text-base font-bold text-[#111] mb-4">
                Claude
              </h2>
              <div className="space-y-3.5">
                {TOP_AGENT_GROUPS.claude.items.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <AgentLogo id={item.id} name={item.name} className="w-6 h-6" />
                      <span className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenInstall(item)}
                      className="px-3 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>Install</span>
                      <span className="text-gray-400">↗</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Codex + ChatGPT Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
              <h2 className="text-base font-bold text-[#111] mb-4">
                Codex + ChatGPT
              </h2>
              <div className="space-y-3.5">
                {TOP_AGENT_GROUPS.codex_chatgpt.items.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <AgentLogo id={item.id} name={item.name} className="w-6 h-6" />
                      <span className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenInstall(item)}
                      className="px-3 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>Install</span>
                      <span className="text-gray-400">↗</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Cursor Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
              <h2 className="text-base font-bold text-[#111] mb-4">
                Cursor
              </h2>
              <div className="space-y-3.5">
                {TOP_AGENT_GROUPS.cursor.items.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <AgentLogo id={item.id} name={item.name} className="w-6 h-6" />
                      <span className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenInstall(item)}
                      className="px-3 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>Install</span>
                      <span className="text-gray-400">↗</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Use FYSH via CLI & MCP */}
          <div className="space-y-6 flex flex-col justify-between">
            
            {/* Card 1: Use FYSH via CLI */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs flex-1 flex flex-col justify-between">
              <div>
                {/* Header with Title and Top-Right Icons */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-[#111]">
                    Use FYSH via CLI
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {/* Gorilla / Agent Icon */}
                    <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center text-[10px] text-white">
                      🦍
                    </div>
                    {/* Anthropic Pixel Icon */}
                    <div className="w-5 h-5 flex items-center justify-center">
                      <AgentLogo id="claude_code" name="Claude Code" className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Subheader bar with OS tab and review script link */}
                <div className="flex items-center justify-between text-xs text-gray-600 pb-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedCliTab('unix')}
                      className={`pb-1 -mb-2.5 font-semibold transition-colors cursor-pointer ${
                        selectedCliTab === 'unix'
                          ? 'border-b-2 border-gray-900 text-gray-900'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <span>Linux & macOS</span>
                    </button>
                    <button
                      onClick={() => setSelectedCliTab('windows')}
                      className={`pb-1 -mb-2.5 font-medium transition-colors cursor-pointer ${
                        selectedCliTab === 'windows'
                          ? 'border-b-2 border-gray-900 text-gray-900 font-semibold'
                          : 'text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      <span>Windows</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsScriptModalOpen(true)}
                    className="text-gray-500 hover:text-gray-900 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Review install script</span>
                    <span className="text-gray-400">↗</span>
                  </button>
                </div>

                {/* Shell install command box */}
                <div className="mt-4 bg-[#EEF2FF]/60 p-3 rounded-lg border border-indigo-100 flex items-center justify-between group">
                  <code className="text-xs font-mono text-indigo-900 font-medium truncate select-all">
                    $ {selectedCliTab === 'unix' ? cliInstallCommand : 'iwr -useb https://composio.dev/install.ps1 | iex'}
                  </code>
                  <button
                    onClick={() => handleCopy(selectedCliTab === 'unix' ? cliInstallCommand : 'iwr -useb https://composio.dev/install.ps1 | iex', 'cli_cmd')}
                    className="p-1 text-indigo-600 hover:text-indigo-900 rounded transition-colors shrink-0 cursor-pointer"
                    title="Copy installation command"
                  >
                    {copiedKey === 'cli_cmd' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Terminal Window Preview */}
                <div className="mt-4 bg-[#F4F4F6] rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
                  {/* Window Dots Header */}
                  <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                  </div>

                  {/* Terminal Content */}
                  <div className="p-3.5 font-mono text-[11px] text-gray-700 space-y-2 overflow-x-auto leading-relaxed">
                    <div>
                      <span className="text-gray-400 select-none">$ </span>
                      <span className="text-gray-800 font-medium">composio search</span>
                      <span className="text-gray-600"> "can you report a bug on composiohq/composio"</span>
                    </div>

                    <div className="text-gray-500 font-medium text-[10px]">
                      Found GITHUB_CREATE_ISSUE
                    </div>

                    <div>
                      <span className="text-gray-400 select-none">$ </span>
                      <span className="text-gray-800 font-medium">composio execute GITHUB_CREATE_ISSUE \</span>
                      <div className="pl-3 text-gray-600">
                        -d '{"{"}"owner":"composiohq","repo":"composio","title":"report"{"}"}'
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500 text-[10px] pt-1">
                      <span className="text-gray-400 font-bold">*</span>
                      <span>Composing...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: MCP */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-[#111]">
                  MCP
                </h2>
                {/* Protocol Icons on top right */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-bold">⌘</span>
                  <span className="text-xs text-gray-700 font-bold">⌥</span>
                  <span className="text-xs text-indigo-600 font-bold">◈</span>
                  <span className="text-xs text-red-500 font-bold">☍</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider block">
                  URL
                </span>
                
                <div className="bg-[#EEF2FF]/60 p-3 rounded-lg border border-indigo-100 flex items-center justify-between group">
                  <code className="text-xs font-mono text-indigo-900 font-medium truncate select-all">
                    {mcpUniversalUrl}
                  </code>
                  <button
                    onClick={() => handleCopy(mcpUniversalUrl, 'mcp_url')}
                    className="p-1 text-indigo-600 hover:text-indigo-900 rounded transition-colors shrink-0 cursor-pointer"
                    title="Copy MCP URL"
                  >
                    {copiedKey === 'mcp_url' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Card 3: Bring your agent to where you work (Exact Match from the Screenshot!) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs mb-6">
          {/* Header Row: Title on Left, Button on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {lang === 'ar' ? 'اجعل وكيلك الذكي يعمل في كل مكان معك.' : 'Bring your agent to where you work.'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {lang === 'ar' ? 'أكثر من 1000+ تطبيق متاح لوكيل الذكاء الاصطناعي الخاص بك.' : '1000+ apps available for your AI agent.'}
              </p>
            </div>

            {onNavigateToApps && (
              <button
                onClick={onNavigateToApps}
                className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 text-xs sm:text-sm font-semibold rounded-lg border border-gray-300 hover:border-gray-400 shadow-2xs transition-all cursor-pointer group shrink-0"
              >
                <span>{lang === 'ar' ? 'ربط تطبيقاتك' : 'Connect Your Apps'}</span>
                <span className="group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform">→</span>
              </button>
            )}
          </div>

          {/* 3 Dense Rows of Real Official Brand Logos */}
          <div className="pt-6 space-y-4">
            {/* Row 1 */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              {POPULAR_APPS_ROW_1.map((app) => (
                <div 
                  key={app.slug} 
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-300 p-1.5 flex items-center justify-center shrink-0 transition-all hover:scale-110 shadow-2xs group relative cursor-pointer"
                  title={app.name}
                  onClick={onNavigateToApps}
                >
                  <img 
                    src={app.logo} 
                    alt={app.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Row 2 */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              {POPULAR_APPS_ROW_2.map((app) => (
                <div 
                  key={app.slug} 
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-300 p-1.5 flex items-center justify-center shrink-0 transition-all hover:scale-110 shadow-2xs group relative cursor-pointer"
                  title={app.name}
                  onClick={onNavigateToApps}
                >
                  <img 
                    src={app.logo} 
                    alt={app.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Row 3 */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              {POPULAR_APPS_ROW_3.map((app) => (
                <div 
                  key={app.slug} 
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-300 p-1.5 flex items-center justify-center shrink-0 transition-all hover:scale-110 shadow-2xs group relative cursor-pointer"
                  title={app.name}
                  onClick={onNavigateToApps}
                >
                  <img 
                    src={app.logo} 
                    alt={app.name} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Extended List of Supported Agents */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs divide-y divide-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {lang === 'ar' ? 'جميع الوكلاء والبيئات المدعومة' : 'All Supported Agents & Frameworks'}
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              {AGENT_LIST.length} frameworks
            </span>
          </div>

          {AGENT_LIST.map((agent) => (
            <div 
              key={agent.id}
              className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AgentLogo id={agent.id} name={agent.name} className="w-6 h-6" />
                <div>
                  <span className="text-sm font-semibold text-gray-900 block">
                    {agent.name}
                  </span>
                  <span className="text-xs text-gray-500 hidden sm:block">
                    {lang === 'ar' ? agent.descriptionAr : agent.description}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleOpenInstall(agent)}
                className="px-3.5 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Install</span>
                <span className="text-gray-400">↗</span>
              </button>
            </div>
          ))}
        </div>

      </main>

      {/* Quick Connect My Agent Modal */}
      {isQuickConnectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full p-6 relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <ArrowDownToLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {lang === 'ar' ? 'ربط وكيلك الذكي بـ FYSH' : 'Connect Your Agent with FYSH'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {lang === 'ar' ? 'اختر بيئة التشغيل أو المنصة لبدء الاستدعاء الفوري' : 'Select your agent environment to get started'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickConnectOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Claude Desktop */}
                <div 
                  onClick={() => {
                    setIsQuickConnectOpen(false);
                    const claudeAgent = TOP_AGENT_GROUPS.claude.items[0];
                    if (claudeAgent) handleOpenInstall(claudeAgent);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <AgentLogo id="claude_cowork" name="Claude" className="w-6 h-6" />
                    <span className="text-sm font-bold text-gray-900">Claude Desktop</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {lang === 'ar' ? 'تكامل MCP رسمي لبرنامج كلود المكتبي' : 'Official MCP config for Claude Desktop'}
                  </p>
                </div>

                {/* Option 2: Cursor */}
                <div 
                  onClick={() => {
                    setIsQuickConnectOpen(false);
                    const cursorAgent = TOP_AGENT_GROUPS.cursor.items[0];
                    if (cursorAgent) handleOpenInstall(cursorAgent);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <AgentLogo id="cursor_ide" name="Cursor" className="w-6 h-6" />
                    <span className="text-sm font-bold text-gray-900">Cursor IDE</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {lang === 'ar' ? 'ربط محرر Cursor بالأدوات والواجهات' : 'Connect Cursor editor with live tools'}
                  </p>
                </div>

                {/* Option 3: Terminal / CLI */}
                <div 
                  onClick={() => {
                    setIsQuickConnectOpen(false);
                    setIsScriptModalOpen(true);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Terminal className="w-6 h-6 text-gray-800" />
                    <span className="text-sm font-bold text-gray-900">Terminal CLI</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {lang === 'ar' ? 'تثبيت أداة سطر الأوامر عبر curl' : 'Install Composio CLI globally via curl'}
                  </p>
                </div>

                {/* Option 4: Universal MCP */}
                <div 
                  onClick={() => {
                    handleCopy(mcpUniversalUrl, 'quick_mcp');
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-bold text-gray-900">Universal MCP</span>
                    </div>
                    {copiedKey === 'quick_mcp' ? (
                      <span className="text-[10px] text-emerald-600 font-bold">{lang === 'ar' ? 'تم النسخ!' : 'Copied!'}</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate font-mono">
                    {mcpUniversalUrl}
                  </p>
                </div>
              </div>

              {/* Direct Workspace Link */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900">
                    {lang === 'ar' ? 'لوحة تحكم مساحة العمل المباشرة' : 'Direct Composio Workspace Dashboard'}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    https://dashboard.composio.dev/mayalfalh_workspace/~/connect
                  </p>
                </div>
                <a
                  href={directDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-lg hover:bg-[#1D4ED8] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>{lang === 'ar' ? 'فتح' : 'Open'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsQuickConnectOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Review Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" dir="ltr">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">CLI Install Script Preview</h3>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-xs text-gray-800 overflow-x-auto max-h-96">
              <pre>{`#!/usr/bin/env bash
# FYSH + Composio Official CLI Installer
set -e

echo "Downloading CLI tool..."
curl -fsSL https://github.com/ComposioHQ/composio/releases/latest/download/composio-linux-amd64 -o /usr/local/bin/composio
chmod +x /usr/local/bin/composio

echo "CLI installed successfully!"
echo "Run 'composio init' to authenticate with FYSH workspace."`}</pre>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleCopy(cliInstallCommand, 'script_copy');
                  setIsScriptModalOpen(false);
                }}
                className="px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                Copy Install Command
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Detail / Install Modal */}
      <AgentInstallModal 
        agent={selectedAgent} 
        isOpen={isInstallModalOpen} 
        onClose={() => setIsInstallModalOpen(false)} 
        lang={lang} 
      />
    </div>
  );
}
