import React from 'react';
import { LogoMark } from './Logo';
import { Lang, t } from '../translations';
import { Globe, User, Search } from 'lucide-react';

interface NavbarProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onOpenLogin: () => void;
  onNavigate: (sectionId: string) => void;
  onOpenSearch?: () => void;
  isLoggedIn: boolean;
}

export function Navbar({ lang, setLang, onOpenLogin, onNavigate, onOpenSearch, isLoggedIn }: NavbarProps) {
  const currentT = t[lang];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    onNavigate(sectionId);
  };

  const toggleLanguage = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 md:px-14 py-3 sm:py-5 md:py-6 flex items-center justify-between bg-transparent border-0">
      {/* Brand logo: Official FYSH logo without background */}
      <div className="flex items-center">
        <a
          href="#hero"
          onClick={(e) => handleNavClick(e, 'hero')}
          className="flex items-center group transition-transform duration-200 hover:scale-105"
        >
          <img
            src="https://res.cloudinary.com/dd3as4ova/image/upload/v1787885428/logo1_edjwuq.png"
            alt="FYSH Logo"
            className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto object-contain drop-shadow-sm transition-all duration-200"
          />
        </a>
      </div>

      {/* Center: Navigation Links (evenly spaced) */}
      <nav className="hidden md:flex items-center justify-around flex-1 max-w-xl mx-auto px-6">
        <a
          href="#hero"
          onClick={(e) => handleNavClick(e, 'hero')}
          className="text-sm text-[#191919] hover:text-[#8B0000] transition-colors duration-200 font-medium"
        >
          {currentT.nav.home}
        </a>
        <a
          href="/apps"
          onClick={(e) => handleNavClick(e, 'apps')}
          className="text-sm text-[#191919]/80 hover:text-[#8B0000] transition-colors duration-200 font-medium"
        >
          {currentT.nav.apps}
        </a>
        <a
          href="/agents"
          onClick={(e) => handleNavClick(e, 'agents')}
          className="text-sm text-[#191919]/80 hover:text-[#8B0000] transition-colors duration-200 font-medium flex items-center gap-1"
        >
          <span>{currentT.nav.agents}</span>
        </a>
        <a
          href="/api-keys"
          onClick={(e) => handleNavClick(e, 'api-keys')}
          className="text-sm text-[#191919]/80 hover:text-[#8B0000] transition-colors duration-200 font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/5 hover:bg-black/10"
        >
          <span>{currentT.nav.apiKeys || (lang === 'ar' ? 'مفاتيح API' : 'API Keys')}</span>
          <span className="text-[10px] bg-[#8B0000] text-white px-1.5 py-0.2 rounded font-mono font-normal">Key</span>
        </a>
        <a
          href="#solutions"
          onClick={(e) => handleNavClick(e, 'solutions')}
          className="text-sm text-[#191919]/80 hover:text-[#8B0000] transition-colors duration-200 font-medium"
        >
          {currentT.nav.howItWorks}
        </a>
      </nav>

      {/* Left: Global Search + Language switch + Login CTA */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            title={lang === 'ar' ? 'البحث الشامل (⌘K)' : 'Omni Search (⌘K)'}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-300/80 hover:border-gray-400 hover:bg-white shadow-2xs transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline font-medium">{lang === 'ar' ? 'بحث...' : 'Search...'}</span>
            <kbd className="hidden sm:inline text-[10px] bg-gray-100 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
        )}

        <button
          onClick={toggleLanguage}
          title={lang === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
          className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-[#191919] hover:text-[#8B0000] hover:bg-black/5 transition-all text-xs font-bold tracking-wider"
        >
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>

        <button
          onClick={onOpenLogin}
          className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#8B0000] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#660000] transition-colors duration-200 shadow-sm flex items-center gap-1.5 sm:gap-2"
        >
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{isLoggedIn ? currentT.nav.workspace : currentT.nav.login}</span>
        </button>
      </div>
    </header>
  );
}
