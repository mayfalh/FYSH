import React, { useEffect, useRef, useState } from 'react';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { X, User, LogOut, Check, Camera, AlertCircle } from 'lucide-react';
import { Lang, t } from '../translations';
import { UserSettingsModal } from './UserSettingsModal';

interface SignalLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
}

export function SignalLoginModal({ isOpen, onClose, lang, isLoggedIn, setIsLoggedIn }: SignalLoginModalProps) {
  const currentT = t[lang];
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // User Profile State (for when logged in)
  const [displayName, setDisplayName] = useState('');
  const [userBio, setUserBio] = useState('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsLoggedIn(true);
        setDisplayName(user.displayName || user.email?.split('@')[0] || (lang === 'ar' ? 'مستخدم فيش' : 'FYSH User'));
        if (user.photoURL) {
          setProfileImage(user.photoURL);
        }
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.displayName) setDisplayName(data.displayName);
            if (data.bio) setUserBio(data.bio);
            if (data.profileImage) setProfileImage(data.profileImage);
          } else {
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email || 'guest@fysh.ai',
              displayName: user.displayName || (lang === 'ar' ? 'مستخدم فيش' : 'FYSH User'),
              bio: '',
              profileImage: user.photoURL || '',
              createdAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (error: any) {
          console.warn("User profile sync note:", error?.message || error);
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
        }
      } else {
        setIsLoggedIn(false);
      }
    });
    return () => unsubscribe();
  }, [lang, setIsLoggedIn]);

  // Responsive layout engine for Signal Login
  useEffect(() => {
    if (!isOpen || isLoggedIn) return;

    const REF_W = 1464, REF_H = 949, PHOTO_W = 836, PANE_W = 628, CARD_W = 613, CARD_H = 922;
    const CONTENT_H = 697;
    const PANE_RATIO = PANE_W / REF_W;
    const HERO_W = 681, HERO_H = 219;
    const RAMP_HI = 1280, RAMP_LO = 1000, PHOTO_MIN = 0.42;
    const RAMP_LO2 = 820, PHOTO_MIN2 = 0.36;

    const handleLayout = () => {
      if (!stageRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const aspect = vw / vh;

      const photoEl = photoRef.current;
      const paneEl = paneRef.current;
      const cardEl = cardRef.current;
      const cardInEl = cardInRef.current;
      const heroEl = heroRef.current;

      if (!photoEl || !paneEl || !cardEl || !cardInEl || !heroEl) return;

      // Clear inline hygiene
      photoEl.style.cssText = '';
      paneEl.style.cssText = '';
      cardEl.style.cssText = '';
      cardInEl.style.cssText = '';
      heroEl.style.cssText = '';
      document.body.classList.remove('tabport', 'stacked');

      const isPhone = vw < 700;
      const isPortrait = !isPhone && aspect < 51 / 50;

      if (isPhone) {
        document.body.classList.add('stacked');
        return;
      }

      if (isPortrait) {
        document.body.classList.add('tabport');
        return;
      }

      // Mode A: Land (Landscape >= 700px)
      let photoRatio = 1 - PANE_RATIO;
      if (vw < RAMP_HI && vw >= RAMP_LO) {
        const t = (vw - RAMP_LO) / (RAMP_HI - RAMP_LO);
        photoRatio = PHOTO_MIN + t * ((1 - PANE_RATIO) - PHOTO_MIN);
      } else if (vw < RAMP_LO && vw >= RAMP_LO2) {
        const t = (vw - RAMP_LO2) / (RAMP_LO - RAMP_LO2);
        photoRatio = PHOTO_MIN2 + t * (PHOTO_MIN - PHOTO_MIN2);
      } else if (vw < RAMP_LO2) {
        photoRatio = PHOTO_MIN2;
      }

      const photoW = vw * photoRatio;
      const paneW = vw - photoW;

      photoEl.style.width = `${photoRatio * 100}%`;
      paneEl.style.left = `${photoRatio * 100}%`;

      // placeCard
      const cs = Math.min(paneW / PANE_W, vh / CONTENT_H);
      const gapL = 1 * cs;
      const mT = 14 * cs;
      const mB = 13 * cs;
      const mR = 14 * cs;
      const cw = Math.max(CARD_W * cs, paneW - gapL - mR);
      const ch = vh - mT - mB;

      cardEl.style.left = `${gapL}px`;
      cardEl.style.top = `${mT}px`;
      cardEl.style.width = `${cw}px`;
      cardEl.style.height = `${ch}px`;
      cardEl.style.borderRadius = `${26 * cs}px`;
      cardEl.style.borderWidth = `${Math.max(1, cs)}px`;

      cardInEl.style.transform = `translate(${((cw - CARD_W * cs) / 2)}px, 0) scale(${cs})`;

      // seatHero
      const bandH = vh;
      const imgScale = Math.max(photoW / 1177, bandH / 1336);
      const s = Math.min(imgScale / (836 / 1177), photoW * 0.92 / HERO_W);
      heroEl.style.transform = `scale(${s})`;
      heroEl.style.transformOrigin = 'left bottom';
      heroEl.style.bottom = '0px';
      heroEl.style.left = '0px';
      heroEl.style.width = `${HERO_W}px`;
      heroEl.style.height = `${HERO_H}px`;
    };

    handleLayout();
    window.addEventListener('resize', handleLayout);
    window.addEventListener('orientationchange', handleLayout);

    return () => {
      window.removeEventListener('resize', handleLayout);
      window.removeEventListener('orientationchange', handleLayout);
      window.removeEventListener('orientationchange', handleLayout);
      document.body.classList.remove('tabport', 'stacked');
    };
  }, [isOpen, isLoggedIn]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setFirebaseUser(user);
        setIsLoggedIn(true);
        setDisplayName(user.displayName || user.email?.split('@')[0] || (lang === 'ar' ? 'مستخدم فيش' : 'FYSH User'));
        if (user.photoURL) {
          setProfileImage(user.photoURL);
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        // User voluntarily closed popup
      } else if (error?.code === 'auth/api-key-not-valid') {
        setErrorMsg(
          lang === 'ar'
            ? 'مفتاح Firebase API غير صالح أو لم يتم تفعيل Identity Toolkit API في مشروع Firebase/Google Cloud. يرجى مراجعة إعدادات Firebase Authentication.'
            : 'Firebase API key is invalid or Identity Toolkit is not enabled. Please enable Authentication in Firebase Console.'
        );
      } else if (error?.code === 'auth/unauthorized-domain') {
        setErrorMsg(
          lang === 'ar'
            ? 'نطاق التطبيق غير مضاف في قائمة النطاقات المصرّح بها (Authorized Domains) في Firebase Authentication.'
            : 'This domain is not in the Firebase Authorized Domains list in Firebase Console.'
        );
      } else if (error?.code === 'auth/configuration-not-found') {
        setErrorMsg(
          lang === 'ar'
            ? 'خدمة Firebase Authentication لم يتم تفعيلها في مشروع Firebase بعد. يرجى الدخول إلى Firebase Console > Build > Authentication والضغط على "Get Started" وتفعيل موفر Google.'
            : 'Firebase Authentication is not enabled yet in your Firebase Project. Please go to Firebase Console > Build > Authentication, click "Get Started", and enable Google sign-in.'
        );
      } else if (error?.code === 'auth/operation-not-allowed') {
        setErrorMsg(
          lang === 'ar'
            ? 'موفر تسجيل الدخول عبر Google غير مفعّل في لوحة تحكم Firebase (Authentication > Sign-in method).'
            : 'Google Sign-In is not enabled in Firebase Console (Authentication > Sign-in method).'
        );
      } else {
        setErrorMsg(error?.message || (lang === 'ar' ? 'فشل تسجيل الدخول عبر قوقل' : 'Google authentication failed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
    } catch (error) {
      console.error(error);
      setIsLoggedIn(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userDocRef, {
        displayName,
        bio: userBio,
        profileImage,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
      setErrorMsg(lang === 'ar' ? 'فشل حفظ الملف الشخصي' : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoggedIn) {
    return (
      <UserSettingsModal
        isOpen={isOpen}
        onClose={onClose}
        lang={lang}
        firebaseUser={firebaseUser}
        displayName={displayName}
        setDisplayName={setDisplayName}
        userBio={userBio}
        setUserBio={setUserBio}
        profileImage={profileImage}
        onImageChange={handleImageChange}
        onSaveProfile={handleSaveProfile}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      {/* Signal Masterpiece Login Screen */}
      <div className="relative w-full h-full sm:w-[1464px] sm:h-[949px] sm:max-w-[95vw] sm:max-h-[95vh] rounded-3xl overflow-hidden shadow-2xl bg-[#fefefe] border border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-50 text-gray-500 hover:text-black bg-white/80 backdrop-blur-md p-2 rounded-full shadow-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div ref={stageRef} className="absolute inset-0 overflow-hidden bg-[#fefefe]">
            {/* Photo / Video Column */}
            <section ref={photoRef} className="absolute left-0 top-0 h-full w-[57.1038%] overflow-hidden bg-[#111]">
              <video className="absolute inset-0 w-full h-full object-cover object-[100%_50%] block" autoPlay muted loop playsInline preload="auto">
                <source src="https://res.cloudinary.com/dd3as4ova/video/upload/v1787375509/Applications_emerging_from_FYSH___202608211518_r3xeec.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 scrim-overlay hidden"></div>
              
              <div ref={heroRef} className="absolute left-0 bottom-0 w-[681px] h-[219px] origin-left-bottom pointer-events-none p-8 flex flex-col justify-end">
                <div className="inline-flex items-center h-[37px] px-4 rounded-full bg-[#2f2a27]/95 backdrop-blur-md shadow-lg text-white whitespace-nowrap w-max pointer-events-auto mb-4">
                  <svg className="w-[17px] h-[16.27px] fill-current mr-2.5" viewBox="0 0 582 557">
                    <path fillRule="evenodd" d="M449.0 0.0 435.0 0.0 415.0 10.0 200.0 249.0 187.0 276.0 189.0 299.0 212.0 326.0 232.0 332.0 289.0 334.0 289.0 516.0 301.0 543.0 324.0 556.0 346.0 556.0 374.0 536.0 573.0 311.0 582.0 288.0 579.0 264.0 559.0 240.0 539.0 233.0 478.0 230.0 478.0 32.0 470.0 13.0ZM442.0 38.0 446.0 250.0 466.0 267.0 540.0 270.0 547.0 285.0 341.0 520.0 332.0 522.0 324.0 514.0 321.0 314.0 307.0 300.0 295.0 297.0 233.0 297.0 224.0 291.0 221.0 282.0ZM1.0 67.0 4.0 81.0 17.0 90.0 216.0 90.0 223.0 87.0 232.0 74.0 228.0 57.0 215.0 49.0 18.0 49.0 5.0 57.0ZM0.0 285.0 4.0 300.0 17.0 308.0 105.0 308.0 118.0 299.0 121.0 291.0 119.0 278.0 111.0 270.0 103.0 267.0 17.0 267.0 4.0 275.0ZM1.0 495.0 4.0 511.0 10.0 517.0 23.0 520.0 179.0 520.0 191.0 516.0 200.0 500.0 196.0 488.0 182.0 479.0 18.0 479.0 9.0 483.0Z" />
                  </svg>
                  <span className="text-[13.6px] font-normal">{lang === 'ar' ? 'مصمم للفرق سريعة التطور' : 'Built for fast-moving teams'}</span>
                </div>
                <div className="flex flex-col font-['Eloquia',sans-serif] leading-none tracking-tight text-black font-[578]">
                  <span id="hl1" className="text-[69.14px] tracking-[-1.936px] whitespace-nowrap">
                    {lang === 'ar' ? 'اكتشف إشاراتك وحوّلها' : 'Find Signal to Action'}
                  </span>
                  <span id="hl2" className="text-[68.95px] tracking-[-1.931px] whitespace-nowrap mt-1">
                    {lang === 'ar' ? 'إلى قرارات فورية' : 'Instantly'}
                  </span>
                </div>
              </div>
            </section>

            {/* Pane / Card Column */}
            <section ref={paneRef} className="absolute left-[57.1038%] right-0 top-0 bottom-0 bg-[#fefefe]">
              <div ref={cardRef} className="absolute left-[1px] top-[14px] w-[613px] h-[922px] rounded-[26px] overflow-hidden bg-[#fefefe]/90 backdrop-blur-[28px] border border-black/[0.036] shadow-[1px_10px_14px_rgba(10,14,20,0.14),0_1px_3px_rgba(10,14,20,0.05)]">
                <div ref={cardInRef} className="absolute inset-0 origin-top-left p-12">
                  {/* H1 */}
                  <h1 id="h1" className="absolute left-[62px] top-[90px] w-[488px] text-[42.55px] font-[584] tracking-[-2.553px] text-[#2c3343] font-['Eloquia',sans-serif]">
                    {lang === 'ar' ? 'مرحباً بك في فيش' : 'Welcome to FYSH'}
                  </h1>
                  {/* Sub */}
                  <p id="sub" className="absolute left-[62px] top-[155px] w-[488px] text-[18px] leading-relaxed tracking-[-0.245px] text-[#797979]">
                    {lang === 'ar' ? 'سجّل الدخول بحساب Google للوصول إلى أدوات الربط والوكلاء الذكيين.' : 'Sign in with your Google account to manage toolkits, workflows, and AI agents.'}
                  </p>
                  
                  {/* Google OAuth Single Sign-In Button */}
                  <div className="absolute left-[62px] top-[250px] w-[489px] space-y-4">
                    <button
                      id="gBtn"
                      type="button"
                      disabled={isLoading}
                      onClick={handleGoogleLogin}
                      className="w-full h-[64px] border-[1.5px] border-[#c8c8ca] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center gap-4 cursor-pointer hover:bg-gray-50 hover:shadow-[0_4px_14px_rgba(0,0,0,0.10)] active:scale-[0.99] transition-all disabled:opacity-60"
                    >
                      <svg className="w-[22px] h-[22px] shrink-0" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.61l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.44-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-10.41l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      <span className="text-[17px] font-medium tracking-[-0.2px] text-[#232424]">
                        {isLoading ? (lang === 'ar' ? 'جاري الاتصال بـ Google...' : 'Connecting with Google...') : (lang === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google')}
                      </span>
                    </button>

                    {errorMsg ? (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl shadow-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">{lang === 'ar' ? 'تنبيه إعدادات الحساب' : 'Configuration Notice'}</p>
                          <p className="leading-relaxed text-amber-800">{errorMsg}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100 text-xs text-gray-500 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                        <span>
                          {lang === 'ar' 
                            ? 'تسجيل دخول آمن وفوري وموثوق عبر بروتوكول Google OAuth 2.0.' 
                            : 'Instant, secure single sign-on powered by Google OAuth 2.0.'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer */}
                  <p id="bottom" className="absolute left-[62px] top-[480px] w-[489px] text-center text-[13.5px] tracking-[-0.196px] text-[#666]">
                    {lang === 'ar' ? 'بالاستمرار، أنت توافق على شروط الخدمة وسياسة الخصوصية لمنصة فيش.' : 'By continuing, you agree to FYSH Terms of Service and Privacy Policy.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
  );
}