import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Sections } from './components/Sections';
import { SignalLoginModal } from './components/SignalLoginModal';
import { DetailModal } from './components/DetailModal';
import { AppsPage } from './components/AppsPage';
import { AgentsPage } from './components/AgentsPage';
import { ApiKeysPage } from './components/ApiKeysPage';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { FeatureItem } from './types';
import { Lang } from './translations';

export default function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureItem | null>(null);
  
  // Standalone page routing: 'home' | 'apps' | 'agents' | 'api-keys'
  const [currentRoute, setCurrentRoute] = useState<'home' | 'apps' | 'agents' | 'api-keys'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/apps')) return 'apps';
      if (window.location.pathname.startsWith('/agents') || window.location.pathname.startsWith('/connect-agent')) return 'agents';
      if (window.location.pathname.startsWith('/api-keys') || window.location.pathname.startsWith('/keys') || window.location.pathname.startsWith('/console')) return 'api-keys';
    }
    return 'home';
  });

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  // Global shortcut for Cmd+K / Ctrl+K
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

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/apps')) {
        setCurrentRoute('apps');
      } else if (window.location.pathname.startsWith('/agents') || window.location.pathname.startsWith('/connect-agent')) {
        setCurrentRoute('agents');
      } else if (window.location.pathname.startsWith('/api-keys') || window.location.pathname.startsWith('/keys') || window.location.pathname.startsWith('/console')) {
        setCurrentRoute('api-keys');
      } else {
        setCurrentRoute('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (sectionId: string) => {
    if (sectionId === 'apps') {
      setCurrentRoute('apps');
      window.history.pushState(null, '', '/apps');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (sectionId === 'agents') {
      setCurrentRoute('agents');
      window.history.pushState(null, '', '/agents');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (sectionId === 'api-keys' || sectionId === 'keys') {
      setCurrentRoute('api-keys');
      window.history.pushState(null, '', '/api-keys');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentRoute === 'apps' || currentRoute === 'agents' || currentRoute === 'api-keys') {
      setCurrentRoute('home');
      window.history.pushState(null, '', '/');
      setTimeout(() => {
        if (sectionId === 'hero') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
      return;
    }

    if (sectionId === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExploreApps = () => {
    setCurrentRoute('apps');
    window.history.pushState(null, '', '/apps');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToAgents = () => {
    setCurrentRoute('agents');
    window.history.pushState(null, '', '/agents');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToApiKeys = () => {
    setCurrentRoute('api-keys');
    window.history.pushState(null, '', '/api-keys');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    setCurrentRoute('home');
    window.history.pushState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render standalone API Keys developer console if on /api-keys route
  if (currentRoute === 'api-keys') {
    return (
      <>
        <ApiKeysPage
          lang={lang}
          setLang={setLang}
          onNavigateHome={handleNavigateHome}
          onNavigateToApps={handleExploreApps}
          onNavigateToAgents={handleNavigateToAgents}
          onOpenLogin={() => setIsLoginOpen(true)}
          isLoggedIn={isLoggedIn}
        />
        <SignalLoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          lang={lang}
          isLoggedIn={isLoggedIn}
          setIsLoggedIn={setIsLoggedIn}
        />
        <GlobalSearchModal
          isOpen={isGlobalSearchOpen}
          onClose={() => setIsGlobalSearchOpen(false)}
          lang={lang}
          onNavigate={(route) => {
            if (route === 'home') handleNavigateHome();
            if (route === 'agents') handleNavigateToAgents();
            if (route === 'apps') handleExploreApps();
            if (route === 'api-keys') handleNavigateToApiKeys();
          }}
        />
      </>
    );
  }

  // Render standalone Apps page if on /apps route
  if (currentRoute === 'apps') {
    return (
      <>
        <AppsPage
          lang={lang}
          setLang={setLang}
          onNavigateHome={handleNavigateHome}
          onNavigateToAgents={handleNavigateToAgents}
          onNavigateToApiKeys={handleNavigateToApiKeys}
          onOpenLogin={() => setIsLoginOpen(true)}
          isLoggedIn={isLoggedIn}
        />
        <SignalLoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          lang={lang}
          isLoggedIn={isLoggedIn}
          setIsLoggedIn={setIsLoggedIn}
        />
        <GlobalSearchModal
          isOpen={isGlobalSearchOpen}
          onClose={() => setIsGlobalSearchOpen(false)}
          lang={lang}
          onNavigate={(route) => {
            if (route === 'home') handleNavigateHome();
            if (route === 'agents') handleNavigateToAgents();
            if (route === 'apps') handleExploreApps();
            if (route === 'api-keys') handleNavigateToApiKeys();
          }}
        />
      </>
    );
  }

  // Render standalone Agents page if on /agents route
  if (currentRoute === 'agents') {
    return (
      <>
        <AgentsPage
          lang={lang}
          setLang={setLang}
          onNavigateHome={handleNavigateHome}
          onNavigateToApps={handleExploreApps}
          onNavigateToApiKeys={handleNavigateToApiKeys}
          onOpenLogin={() => setIsLoginOpen(true)}
          isLoggedIn={isLoggedIn}
        />
        <SignalLoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          lang={lang}
          isLoggedIn={isLoggedIn}
          setIsLoggedIn={setIsLoggedIn}
        />
        <GlobalSearchModal
          isOpen={isGlobalSearchOpen}
          onClose={() => setIsGlobalSearchOpen(false)}
          lang={lang}
          onNavigate={(route) => {
            if (route === 'home') handleNavigateHome();
            if (route === 'agents') handleNavigateToAgents();
            if (route === 'apps') handleExploreApps();
            if (route === 'api-keys') handleNavigateToApiKeys();
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden selection:bg-[#191919] selection:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Fixed Navbar */}
      <Navbar
        lang={lang}
        setLang={setLang}
        onOpenLogin={() => setIsLoginOpen(true)}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsGlobalSearchOpen(true)}
        isLoggedIn={isLoggedIn}
      />

      {/* Hero section with Boomerang video background & curved plug connector */}
      <Hero
        lang={lang}
        onOpenLogin={() => setIsLoginOpen(true)}
        onSelectFeature={(item) => setSelectedFeature(item)}
        onExploreApps={handleExploreApps}
      />

      {/* Additional Marketing Sections */}
      <Sections
        lang={lang}
        onOpenLogin={() => setIsLoginOpen(true)}
        onExploreApps={handleExploreApps}
        onNavigateToAgents={handleNavigateToAgents}
      />

      {/* Modals */}
      <SignalLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        lang={lang}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
      />

      <DetailModal
        item={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onNavigateToAgents={handleNavigateToAgents}
        onNavigateToApps={handleExploreApps}
        lang={lang}
      />

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        lang={lang}
        onNavigate={(route) => {
          if (route === 'home') handleNavigateHome();
          if (route === 'agents') handleNavigateToAgents();
          if (route === 'apps') handleExploreApps();
        }}
      />
    </div>
  );
}
