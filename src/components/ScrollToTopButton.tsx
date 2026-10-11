import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Lang } from '../translations';

interface ScrollToTopButtonProps {
  lang: Lang;
  heroId?: string;
  threshold?: number;
}

export function ScrollToTopButton({ lang, heroId = 'hero', threshold = 450 }: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isArabic = lang === 'ar';

  useEffect(() => {
    let ticking = false;

    const checkScrollPosition = () => {
      const heroElement = document.getElementById(heroId);
      if (heroElement) {
        // Appears after the user has scrolled down past the hero section
        const heroBottom = heroElement.getBoundingClientRect().bottom;
        setIsVisible(heroBottom <= 80);
      } else {
        // Fallback for long subpages without a hero element
        setIsVisible(window.scrollY > threshold);
      }

      // Calculate scroll percentage for subtle progress ring
      const totalScrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScrollable > 0) {
        const progress = Math.min(Math.max(window.scrollY / totalScrollable, 0), 1);
        setScrollProgress(progress);
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(checkScrollPosition);
        ticking = true;
      }
    };

    // Initial check
    checkScrollPosition();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [heroId, threshold]);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const label = isArabic ? 'العودة إلى الأعلى' : 'Scroll to top';
  const circleRadius = 22;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - scrollProgress * circumference;

  return (
    <div
      className={`fixed bottom-6 end-6 sm:bottom-8 sm:end-8 z-40 flex items-center transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 scale-90 translate-y-4 pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label={label}
        title={label}
        className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-[#191919] text-white shadow-xl shadow-black/25 hover:bg-[#8B0000] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#8B0000] focus-visible:ring-offset-2 transition-all duration-200 cursor-pointer active:scale-95"
      >
        {/* Subtle circular scroll progress track */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r={circleRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="2"
          />
          {/* Active progress stroke */}
          <circle
            cx="24"
            cy="24"
            r={circleRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.7)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-150 ease-out"
          />
        </svg>

        {/* Up Arrow Icon */}
        <ArrowUp className="w-5 h-5 relative z-10 transition-transform duration-200 group-hover:-translate-y-0.5" />

        {/* Floating Tooltip Label on Hover */}
        <span
          className="absolute end-14 px-2.5 py-1 text-xs font-medium text-white bg-[#191919] border border-white/10 rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 select-none hidden sm:block"
          aria-hidden="true"
        >
          {label}
        </span>
      </button>
    </div>
  );
}
