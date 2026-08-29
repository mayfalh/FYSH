import React, { useState } from 'react';
import { 
  Bot, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowRight, 
  FileText, 
  X,
  Sparkles,
  Download
} from 'lucide-react';
import { Lang } from '../translations';
import { AgentLogo } from './AgentLogo';
import { AgentInstallModal } from './AgentInstallModal';
import { TOP_AGENT_GROUPS, AGENT_LIST, AgentItem } from '../data/agentsData';

interface AgentDashboardSectionProps {
  lang: Lang;
  onNavigateToAgents?: () => void;
  onExploreApps?: () => void;
}

// 32 curated real apps with direct high-resolution logos for the bottom banner
const BANNER_APPS = [
  { id: 'gmail', name: 'Gmail', logo: 'https://logos.composio.dev/api/gmail' },
  { id: 'slack', name: 'Slack', logo: 'https://logos.composio.dev/api/slack' },
  { id: 'notion', name: 'Notion', logo: 'https://logos.composio.dev/api/notion' },
  { id: 'github', name: 'GitHub', logo: 'https://logos.composio.dev/api/github' },
  { id: 'linear', name: 'Linear', logo: 'https://logos.composio.dev/api/linear' },
  { id: 'asana', name: 'Asana', logo: 'https://logos.composio.dev/api/asana' },
  { id: 'googledrive', name: 'Google Drive', logo: 'https://logos.composio.dev/api/googledrive' },
  { id: 'googlecalendar', name: 'Google Calendar', logo: 'https://logos.composio.dev/api/googlecalendar' },
  { id: 'discord', name: 'Discord', logo: 'https://logos.composio.dev/api/discord' },
  { id: 'figma', name: 'Figma', logo: 'https://logos.composio.dev/api/figma' },
  { id: 'dropbox', name: 'Dropbox', logo: 'https://logos.composio.dev/api/dropbox' },
  { id: 'hubspot', name: 'HubSpot', logo: 'https://logos.composio.dev/api/hubspot' },
  { id: 'salesforce', name: 'Salesforce', logo: 'https://logos.composio.dev/api/salesforce' },
  { id: 'shopify', name: 'Shopify', logo: 'https://logos.composio.dev/api/shopify' },
  { id: 'teams', name: 'Microsoft Teams', logo: 'https://logos.composio.dev/api/teams' },
  { id: 'trello', name: 'Trello', logo: 'https://logos.composio.dev/api/trello' },
  { id: 'zapier', name: 'Zapier', logo: 'https://logos.composio.dev/api/zapier' },
  { id: 'clickup', name: 'ClickUp', logo: 'https://logos.composio.dev/api/clickup' },
  { id: 'intercom', name: 'Intercom', logo: 'https://logos.composio.dev/api/intercom' },
  { id: 'postman', name: 'Postman', logo: 'https://logos.composio.dev/api/postman' },
  { id: 'monday', name: 'Monday.com', logo: 'https://logos.composio.dev/api/monday' },
  { id: 'jira', name: 'Jira', logo: 'https://logos.composio.dev/api/jira' },
  { id: 'zoom', name: 'Zoom', logo: 'https://logos.composio.dev/api/zoom' },
  { id: 'airtable', name: 'Airtable', logo: 'https://logos.composio.dev/api/airtable' },
  { id: 'googledocs', name: 'Google Docs', logo: 'https://logos.composio.dev/api/googledocs' },
  { id: 'youtube', name: 'YouTube', logo: 'https://logos.composio.dev/api/youtube' },
  { id: 'twitter', name: 'X / Twitter', logo: 'https://logos.composio.dev/api/twitter' },
  { id: 'instagram', name: 'Instagram', logo: 'https://logos.composio.dev/api/instagram' },
  { id: 'spotify', name: 'Spotify', logo: 'https://logos.composio.dev/api/spotify' },
  { id: 'reddit', name: 'Reddit', logo: 'https://logos.composio.dev/api/reddit' },
  { id: 'producthunt', name: 'Product Hunt', logo: 'https://logos.composio.dev/api/producthunt' },
  { id: 'stripe', name: 'Stripe', logo: 'https://logos.composio.dev/api/stripe' },
];

export function AgentDashboardSection({ lang, onNavigateToAgents, onExploreApps }: AgentDashboardSectionProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  return (
    <div className="w-full my-10 sm:my-14" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Title & Primary Action Button */}
      <div className="text-center mb-10 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#111111] font-sans leading-tight">
          {lang === 'ar' ? 'أنجز المزيد مع فيش، في كل مكان تعمل فيه.' : 'Do more with Composio, everywhere you work.'}
        </h2>

        <div className="mt-5 flex justify-center">
          <button
            onClick={onNavigateToAgents}
            className="px-6 py-2.5 sm:px-7 sm:py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 cursor-pointer group"
          >
            <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            <span>{lang === 'ar' ? 'ربط وكيلك الذكي' : 'Connect my agent'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid matching exactly the provided design */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* Left Column: Claude, Codex + ChatGPT, Cursor */}
        <div className="space-y-6">
          
          {/* 1. Claude Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-2xs hover:border-gray-300 transition-all">
            <h3 className="text-base font-bold text-[#111] mb-4">
              Claude
            </h3>
            <div className="space-y-4">
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
                    className="px-3.5 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Install</span>
                    <span className="text-gray-400">↗</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Codex + ChatGPT Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-2xs hover:border-gray-300 transition-all">
            <h3 className="text-base font-bold text-[#111] mb-4">
              Codex + ChatGPT
            </h3>
            <div className="space-y-4">
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
                    className="px-3.5 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Install</span>
                    <span className="text-gray-400">↗</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Cursor Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-2xs hover:border-gray-300 transition-all">
            <h3 className="text-base font-bold text-[#111] mb-4">
              Cursor
            </h3>
            <div className="space-y-4">
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
                    className="px-3.5 py-1 text-xs font-medium text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Install</span>
                    <span className="text-gray-400">↗</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Use Composio via CLI & MCP */}
        <div className="space-y-6 flex flex-col justify-between">
          
          {/* 1. Use Composio via CLI */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-2xs flex-1 flex flex-col justify-between hover:border-gray-300 transition-all">
            <div>
              {/* Header with Title and Corner Agent Icons */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-[#111]">
                  Use Composio via CLI
                </h3>
                {/* Real Mini Agent Logos in Top Right */}
                <div className="flex items-center gap-1.5">
                  <AgentLogo id="hermes" name="Hermes" className="w-5 h-5" />
                  <AgentLogo id="openclaw" name="OpenClaw" className="w-5 h-5" />
                </div>
              </div>

              {/* Subheader bar with OS tab and review script link */}
              <div className="flex items-center justify-between text-xs text-gray-600 pb-2.5 border-b border-gray-100">
                <div className="flex items-center gap-1 border-b-2 border-gray-900 pb-1 -mb-2.5 font-semibold text-gray-900">
                  <span>Linux & macOS</span>
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
              <div className="mt-4 bg-[#EEF2FF]/60 p-3.5 rounded-lg border border-indigo-100 flex items-center justify-between group">
                <code className="text-xs font-mono text-indigo-900 font-medium truncate select-all">
                  $ {cliInstallCommand}
                </code>
                <button
                  onClick={() => handleCopy(cliInstallCommand, 'cli_cmd')}
                  className="p-1 text-indigo-600 hover:text-indigo-900 rounded transition-colors shrink-0 cursor-pointer"
                  title="Copy installation command"
                >
                  {copiedKey === 'cli_cmd' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
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

          {/* 2. MCP Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-2xs hover:border-gray-300 transition-all">
            {/* Header with Title and Corner Agent Icons */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#111]">
                MCP
              </h3>
              {/* Real Mini Agent Logos in Top Right */}
              <div className="flex items-center gap-2">
                <AgentLogo id="vscode" name="VS Code" className="w-4 h-4" />
                <AgentLogo id="devin_desktop" name="Devin" className="w-4 h-4" />
                <AgentLogo id="notion" name="Notion" className="w-4 h-4" />
                <AgentLogo id="n8n" name="n8n" className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider block">
                URL
              </span>
              
              <div className="bg-[#EEF2FF]/60 p-3.5 rounded-lg border border-indigo-100 flex items-center justify-between group">
                <code className="text-xs font-mono text-indigo-900 font-medium truncate select-all">
                  {mcpUniversalUrl}
                </code>
                <button
                  onClick={() => handleCopy(mcpUniversalUrl, 'mcp_url')}
                  className="p-1 text-indigo-600 hover:text-indigo-900 rounded transition-colors shrink-0 cursor-pointer"
                  title="Copy MCP URL"
                >
                  {copiedKey === 'mcp_url' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Wide Banner: Bring your agent to where you work. */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-2xs hover:border-gray-300 transition-all">
        {/* Banner Top Row: Title, Subtitle, and Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#111] tracking-tight">
              {lang === 'ar' ? 'اجلب وكيلك الذكي إلى حيث تعمل.' : 'Bring your agent to where you work.'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {lang === 'ar' ? '+1000 تطبيق متاح لوكيلك الذكي للربط الفوري.' : '1000+ apps available for your AI agent.'}
            </p>
          </div>

          {onExploreApps && (
            <button
              onClick={onExploreApps}
              className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-gray-50 text-gray-900 text-xs sm:text-sm font-semibold border border-gray-300 hover:border-gray-400 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer group"
            >
              <span>{lang === 'ar' ? 'ربط تطبيقاتك' : 'Connect Your Apps'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Real Crisp App Logos Grid (2 Clean Rows) */}
        <div className="pt-6 grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-3 sm:gap-4 items-center justify-items-center">
          {BANNER_APPS.map((app) => (
            <div
              key={`banner-app-${app.id}`}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white p-1.5 flex items-center justify-center transition-transform hover:scale-115 hover:shadow-2xs select-none cursor-pointer"
              title={app.name}
              onClick={onExploreApps}
            >
              <img
                src={app.logo}
                alt={app.name}
                className="w-full h-full object-contain pointer-events-none drop-shadow-2xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Script Review Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" dir="ltr">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">Composio CLI Install Script Preview</h3>
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
# Official Composio CLI Installer
set -e

echo "Downloading Composio CLI..."
curl -fsSL https://github.com/ComposioHQ/composio/releases/latest/download/composio-linux-amd64 -o /usr/local/bin/composio
chmod +x /usr/local/bin/composio

echo "Composio CLI installed successfully!"
echo "Run 'composio init' to get started."`}</pre>
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
                className="px-4 py-2 bg-[#8B0000] text-white text-xs font-semibold rounded-lg hover:bg-[#660000] transition-colors cursor-pointer"
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
