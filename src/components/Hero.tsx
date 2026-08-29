import React from 'react';
import { Lang } from '../translations';
import { BoomerangVideoBg } from './BoomerangVideoBg';
import { FeatureItem } from '../types';

interface HeroProps {
  lang: Lang;
  onOpenLogin: () => void;
  onSelectFeature?: (item: FeatureItem) => void;
  onExploreApps: () => void;
}

export function Hero({ lang }: HeroProps) {
  const isArabic = lang === 'ar';

  return (
    <div id="hero" className="relative w-full bg-white overflow-hidden" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Top Hero Stage with Extended Height for Pristine Video Visibility */}
      <div className="relative min-h-[480px] sm:min-h-[560px] md:min-h-[640px] lg:min-h-[720px] w-full flex flex-col justify-end overflow-hidden">
        {/* Ambient video background */}
        <BoomerangVideoBg />

        {/* Dynamic Curved SVG Wave Transition */}
        <div className="relative z-20 w-full leading-none pointer-events-none select-none -mb-[1px]">
          <svg
            className="w-full h-14 sm:h-20 md:h-24 block text-white"
            viewBox="0 0 1440 120"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Subtle multi-layer curve */}
            <path
              d="M0,32 C320,110 440,15 720,65 C1000,115 1160,20 1440,50 L1440,120 L0,120 Z"
              fill="rgba(255, 255, 255, 0.4)"
            />
            <path
              d="M0,50 C360,125 520,30 720,80 C960,125 1120,40 1440,70 L1440,120 L0,120 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      {/* Full-width creative transition banner spanning edge-to-edge */}
      <div className="relative z-30 w-full overflow-hidden flex items-center justify-center -mt-6 sm:-mt-8 md:-mt-10 px-0 m-0">
        <div className="w-full overflow-hidden">
          <img
            src="https://res.cloudinary.com/dd3as4ova/image/upload/v1787911027/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_gour1w.png"
            alt="FYSH Unified Connection Banner"
            className="w-full h-auto object-cover select-none block pointer-events-none"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
}
