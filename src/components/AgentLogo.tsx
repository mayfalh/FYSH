import React from 'react';

interface AgentLogoProps {
  id: string;
  name: string;
  logo?: string;
  className?: string;
}

// Pixel-perfect official icons for the exact agents in the Composio ecosystem
export function AgentLogo({ id, name, className = "w-6 h-6" }: AgentLogoProps) {
  const cleanId = id.toLowerCase().replace(/[-_]/g, '');

  // 1. Claude + Claude Cowork (Anthropic Starburst Orange)
  if (cleanId.includes('claudecowork') || cleanId === 'claude') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          {/* Anthropic Sunburst rays */}
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3.5" fill="#D97706" />
        </svg>
      </div>
    );
  }

  // 2. Claude Code (Anthropic CLI Pixel Crab/Bug)
  if (cleanId.includes('claudecode')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <rect x="5" y="7" width="14" height="10" rx="2" fill="#EA580C" />
          <circle cx="9" cy="11" r="1.5" fill="#FFFFFF" />
          <circle cx="15" cy="11" r="1.5" fill="#FFFFFF" />
          <path d="M7 4L5 7M17 4l2 3M4 12H2M22 12h-2M5 17l-2 3M19 17l2 3M9 17v3M15 17v3" stroke="#EA580C" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 3. Codex (OpenAI Codex Blue Sphere)
  if (cleanId === 'codex') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <circle cx="12" cy="12" r="9" fill="url(#codexGrad)" />
          <path d="M12 3a9 9 0 0 1 0 18M3 12a9 9 0 0 1 18 0M7 7l10 10M7 17L17 7" stroke="#FFFFFF" strokeWidth="0.75" strokeOpacity="0.6" />
          <defs>
            <radialGradient id="codexGrad" cx="30%" cy="30%" r="70%">
              <stop stopColor="#60A5FA" />
              <stop offset="60%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 4. ChatGPT / OpenAI Agent Builder (OpenAI Swirl Logo)
  if (cleanId === 'chatgpt' || cleanId.includes('openai')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path
            d="M21.5 10.2a5.4 5.4 0 0 0-.46-4.4 5.5 5.5 0 0 0-5.74-2.68A5.4 5.4 0 0 0 11 1.5a5.5 5.5 0 0 0-5.26 3.82 5.4 5.4 0 0 0-3.9 2.84 5.5 5.5 0 0 0 .66 6.28 5.4 5.4 0 0 0 .46 4.4 5.5 5.5 0 0 0 5.74 2.68A5.4 5.4 0 0 0 13 22.5a5.5 5.5 0 0 0 5.26-3.82 5.4 5.4 0 0 0 3.9-2.84 5.5 5.5 0 0 0-.66-6.28z"
            stroke="#18181B"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M12 7.5v9M7.5 9.5l9 5M16.5 9.5l-9 5"
            stroke="#18181B"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 5. Cursor (Isometric 3D Cube)
  if (cleanId.includes('cursor')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M12 2L3.5 6.8v10.4L12 22l8.5-4.8V6.8L12 2z" fill="#27272A" stroke="#18181B" strokeWidth="1.2" />
          <path d="M12 2v20M3.5 6.8l8.5 5.2 8.5-5.2" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 6. Hermes (Black and White Winged Helmet / Bust)
  if (cleanId === 'hermes') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <circle cx="12" cy="12" r="10" fill="#18181B" />
          {/* Winged Hermes helmet outline */}
          <path d="M8 15c0-3 2-6 5-6s4 2 4 5M9 15h7M7 11c-2-1-3-3-2-5 2 1 3 3 2 5zM17 11c2-1 3-3 2-5-2 1-3 3-2 5z" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="16.5" r="1.5" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 7. OpenClaw (Red Lobster / Crab Claw)
  if (cleanId === 'openclaw') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <circle cx="12" cy="12" r="9.5" fill="#EF4444" />
          <path d="M8 10c0-2.5 1.8-4 4-4s4 1.5 4 4c0 3-2 5-4 5s-4-2-4-5z" fill="#DC2626" />
          <circle cx="9.5" cy="10" r="1.2" fill="#FFFFFF" />
          <circle cx="14.5" cy="10" r="1.2" fill="#FFFFFF" />
          <path d="M7 6C5 5 4 7 5 9M17 6c2-1 3 1 2 3M7 16l-2 2M17 16l2 2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 8. Notion (Black 'N' in rounded square)
  if (cleanId === 'notion' || cleanId.includes('notion')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <div className="w-full h-full rounded-md bg-white border border-gray-300 flex items-center justify-center shadow-2xs">
          <span className="font-serif font-black text-xs text-black select-none">N</span>
        </div>
      </div>
    );
  }

  // 9. Warp (Black rounded square with prompt icon)
  if (cleanId === 'warp') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <div className="w-full h-full rounded-md bg-black flex items-center justify-center shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
            <path d="M6 8l4 4-4 4M12 16h6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  }

  // 10. Grok (xAI circle with diagonal slash)
  if (cleanId === 'grok') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <circle cx="12" cy="12" r="9" stroke="#18181B" strokeWidth="1.8" />
          <path d="M8 16L16 8M13.5 16l2.5-2.5" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 11. Gemini CLI (Google Gemini Multicolored 4-point sparkle)
  if (cleanId.includes('gemini')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" fill="url(#geminiGradientDirect)" />
          <defs>
            <linearGradient id="geminiGradientDirect" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E40AF" />
              <stop offset="35%" stopColor="#3B82F6" />
              <stop offset="70%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 12. VS Code (Visual Studio Code Blue Ribbon)
  if (cleanId.includes('vscode')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="#007ACC" className="w-full h-full">
          <path d="M17.5 2.5L7 11 2 7.5 0 9l4 3-4 3 2 1.5 5-3.5 10.5 8.5 6.5-3V5.5l-6.5-3zm0 4.2l3 2.3-3 2.3V6.7zm0 8.3l3 2.3-3 2.3V15z" />
        </svg>
      </div>
    );
  }

  // 13. Devin Desktop (Cognition Devin Constellation 3 Black Circles)
  if (cleanId.includes('devin')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <circle cx="12" cy="6" r="3.2" fill="#18181B" />
          <circle cx="6" cy="17" r="3.2" fill="#18181B" />
          <circle cx="18" cy="17" r="3.2" fill="#18181B" />
          <path d="M12 6L6 17M12 6l6 11M6 17h12" stroke="#18181B" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 14. Cline (Purple Robot/Droid Face)
  if (cleanId === 'cline') {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <div className="w-full h-full rounded-md bg-[#6D28D9] flex items-center justify-center shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
            <rect x="4" y="6" width="16" height="13" rx="3" fill="#8B5CF6" />
            <circle cx="9" cy="12" r="1.5" fill="#FFFFFF" />
            <circle cx="15" cy="12" r="1.5" fill="#FFFFFF" />
            <path d="M12 2v4M9 2h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  // 15. Antigravity (Google Antigravity Ribbon 'A' / Wave Loop)
  if (cleanId.includes('antigravity')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path
            d="M5 19L12 5l7 14M7.5 14.5h9"
            stroke="url(#antigravityRainbow)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="antigravityRainbow" x1="5" y1="19" x2="19" y2="5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" />
              <stop offset="35%" stopColor="#10B981" />
              <stop offset="70%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 16. n8n (Coral / Red connected nodes)
  if (cleanId.includes('n8n')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <circle cx="6" cy="12" r="3" fill="#EA3556" />
          <circle cx="18" cy="7" r="3" fill="#EA3556" />
          <circle cx="18" cy="17" r="3" fill="#EA3556" />
          <path d="M6 12h6l6-5M12 12l6 5" stroke="#EA3556" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 17. MCP URL (Connector / Plugs / Cable coil)
  if (cleanId.includes('mcp')) {
    return (
      <div className={`${className} flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M7 16l-3 3M17 6l3-3M6 11l7-7 4 4-7 7-4-4zM13 18l4-4" stroke="#18181B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 8.5l7 7" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Fallback
  return (
    <div className={`${className} rounded-md bg-gray-100 border border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-700`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
