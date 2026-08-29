import React, { useRef } from 'react';

const VIDEO_URL = "https://res.cloudinary.com/dd3as4ova/video/upload/v1788026067/%D9%85%D9%86%D8%B5%D8%A9_%D8%AA%D9%83%D8%A7%D9%85%D9%84_%D8%A7%D9%84%D8%AA%D8%B7%D8%A8%D9%8A%D9%82%D8%A7%D8%AA_%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%82%D8%A8%D9%84%D9%8A%D8%A9_202608211216_gveotm.mp4";

export function BoomerangVideoBg() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Background looping video */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover object-center"
      />

      {/* Subtle light overlay to ensure pristine contrast */}
      <div className="absolute inset-0 bg-white/10 backdrop-brightness-[1.02]" />
    </div>
  );
}

