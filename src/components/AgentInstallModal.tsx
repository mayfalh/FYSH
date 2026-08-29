import React, { useState } from 'react';
import { X, Copy, Check, Terminal, FileCode, BookOpen, Sparkles } from 'lucide-react';
import { AgentItem } from '../data/agentsData';
import { AgentLogo } from './AgentLogo';
import { Lang } from '../translations';

interface AgentInstallModalProps {
  agent: AgentItem | null;
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
}

export function AgentInstallModal({ agent, isOpen, onClose, lang }: AgentInstallModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'command' | 'config' | 'guide'>('command');

  if (!isOpen || !agent) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const formattedMcpConfig = agent.mcpConfig
    ? JSON.stringify(agent.mcpConfig, null, 2)
    : JSON.stringify(
        {
          mcpServers: {
            fysh: {
              command: 'npx',
              args: ['-y', '@composio/mcp@latest']
            }
          }
        },
        null,
        2
      );

  const fallbackCommand = agent.command || `composio add ${agent.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-xl w-full overflow-hidden relative">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
          <div className="flex items-center gap-3.5">
            <AgentLogo id={agent.id} name={agent.name} className="w-9 h-9" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {agent.name}
                </h3>
                {agent.badge && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {agent.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {lang === 'ar' ? agent.descriptionAr : agent.description}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 px-6 bg-white">
          <button
            onClick={() => setActiveTab('command')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'command'
                ? 'border-[#8B0000] text-[#8B0000]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'أمر التثبيت' : 'Install Command'}</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'config'
                ? 'border-[#8B0000] text-[#8B0000]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إعدادات MCP' : 'MCP Config (JSON)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-[#8B0000] text-[#8B0000]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'دليل الخطوات' : 'Step-by-Step Guide'}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'command' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{lang === 'ar' ? 'شغّل الأمر التالي في سطر الأوامر (Terminal):' : 'Run this command in your terminal / shell:'}</span>
                {copiedType === 'command' ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {lang === 'ar' ? 'تم النسخ!' : 'Copied!'}
                  </span>
                ) : null}
              </div>

              <div className="relative group bg-[#F8FAFC] text-gray-900 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-gray-200">
                <code>{fallbackCommand}</code>
                <button
                  onClick={() => handleCopy(fallbackCommand, 'command')}
                  className="absolute top-3 end-3 p-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors shadow-2xs cursor-pointer"
                  title="Copy command"
                >
                  {copiedType === 'command' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                {lang === 'ar'
                  ? 'يتيح هذا الأمر ربط الوكيل بحساب فيش الخاص بك واستدعاء الأدوات المصرح بها تلقائياً.'
                  : 'This registers FYSH tools into your agent runtime environment with automatic token resolution.'}
              </p>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{lang === 'ar' ? 'إعدادات تكوين MCP JSON:' : 'MCP configuration JSON block:'}</span>
                {copiedType === 'config' ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {lang === 'ar' ? 'تم النسخ!' : 'Copied!'}
                  </span>
                ) : null}
              </div>

              <div className="relative group bg-[#F8FAFC] text-indigo-950 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-gray-200">
                <pre className="text-indigo-900">{formattedMcpConfig}</pre>
                <button
                  onClick={() => handleCopy(formattedMcpConfig, 'config')}
                  className="absolute top-3 end-3 p-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors shadow-2xs cursor-pointer"
                  title="Copy MCP JSON"
                >
                  {copiedType === 'config' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? 'متوافق مع Claude Desktop و Cursor و Roo Code و Windsurf و Zed وأي عميل يدعم MCP.'
                    : 'Fully compatible with Claude Desktop, Cursor, Roo Code, Windsurf, Zed, and any MCP client.'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {lang === 'ar' ? 'تعليمات الإعداد والتشغيل:' : 'Setup Instructions:'}
              </h4>
              <ol className="space-y-2.5">
                {(lang === 'ar' ? agent.steps.ar : agent.steps.en).map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="w-5 h-5 rounded-full bg-[#8B0000] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{lang === 'ar' ? 'جاهز للتكامل الفوري' : 'Ready for instant integration'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
            <button
              onClick={() => handleCopy(fallbackCommand, 'command')}
              className="px-3.5 py-1.5 bg-[#8B0000] hover:bg-[#660000] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copiedType === 'command' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{lang === 'ar' ? 'نسخ الأمر السريع' : 'Copy Quick Command'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
