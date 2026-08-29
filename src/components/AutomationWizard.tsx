import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Zap, Play, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { getOrCreateStableFishUserId } from '../lib/fishUser';

interface AutomationWizardProps {
  lang: 'ar' | 'en';
}

interface TriggerEvent {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface TriggerApp {
  id: string;
  nameAr: string;
  nameEn: string;
  logo: string;
  events: TriggerEvent[];
}

interface ActionItem {
  appId: string;
  appNameAr: string;
  appNameEn: string;
  appLogo: string;
  actionAr: string;
  actionEn: string;
}

const TRIGGER_APPS: TriggerApp[] = [
  {
    id: 'gmail',
    nameAr: 'جيميل (Gmail)',
    nameEn: 'Gmail',
    logo: 'https://www.gstatic.com/images/branding/product/1x/gmail_48dp.png',
    events: [
      { id: 'new_email', nameAr: 'عند استلام بريد إلكتروني جديد', nameEn: 'When a new email is received' },
      { id: 'email_labeled', nameAr: 'عند تصنيف بريد إلكتروني', nameEn: 'When an email is labeled' },
      { id: 'starred_email', nameAr: 'عند تمييز رسالة بنجمة', nameEn: 'When an email is starred' }
    ]
  },
  {
    id: 'slack',
    nameAr: 'سلاك (Slack)',
    nameEn: 'Slack',
    logo: 'https://a.slack-edge.com/80588/marketing/img/meta/icon-32.png',
    events: [
      { id: 'new_message', nameAr: 'عند استلام رسالة جديدة في قناة', nameEn: 'When a new message is posted in a channel' },
      { id: 'new_mention', nameAr: 'عند الإشارة إليك في رسالة', nameEn: 'When you are mentioned in a message' },
      { id: 'new_reaction', nameAr: 'عند إضافة تفاعل emoji جديد', nameEn: 'When a new reaction is added' }
    ]
  },
  {
    id: 'google_calendar',
    nameAr: 'تقويم جوجل (Google Calendar)',
    nameEn: 'Google Calendar',
    logo: 'https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png',
    events: [
      { id: 'event_starting', nameAr: 'قبل بدء موعد أو اجتماع', nameEn: 'Before an event starts' },
      { id: 'new_event', nameAr: 'عند إنشاء موعد جديد', nameEn: 'When a new event is created' }
    ]
  },
  {
    id: 'stripe',
    nameAr: 'سترايب (Stripe)',
    nameEn: 'Stripe',
    logo: 'https://images.ctfassets.net/fzn2nurlz69s/3dn342gnvK4gxhTfV5lX48/c5d8009c916896207f2efbb94f61b0c0/Stripe_icon_-_square.svg',
    events: [
      { id: 'new_payment', nameAr: 'عند إتمام عملية دفع ناجحة', nameEn: 'When a successful payment is made' },
      { id: 'new_subscription', nameAr: 'عند اشتراك عميل جديد', nameEn: 'When a new subscription starts' }
    ]
  },
  {
    id: 'github',
    nameAr: 'جيت هب (GitHub)',
    nameEn: 'GitHub',
    logo: 'https://github.githubassets.com/favicons/favicon.svg',
    events: [
      { id: 'new_pr', nameAr: 'عند فتح طلب سحب جديد (Pull Request)', nameEn: 'When a new PR is opened' },
      { id: 'new_issue', nameAr: 'عند إنشاء مشكلة جديدة (Issue)', nameEn: 'When a new issue is created' }
    ]
  }
];

const ACTION_APPS: ActionItem[] = [
  {
    appId: 'telegram',
    appNameAr: 'تيليجرام (Telegram)',
    appNameEn: 'Telegram',
    appLogo: 'https://telegram.org/img/t_logo.png',
    actionAr: 'إرسال رسالة تنبيه إلى قناة أو مجموعة',
    actionEn: 'Send notification message to chat or group'
  },
  {
    appId: 'slack',
    appNameAr: 'سلاك (Slack)',
    appNameEn: 'Slack',
    appLogo: 'https://a.slack-edge.com/80588/marketing/img/meta/icon-32.png',
    actionAr: 'نشر رسالة في قناة محددة',
    actionEn: 'Post message in a specific channel'
  },
  {
    appId: 'google_sheets',
    appNameAr: 'جوجل شيتس (Google Sheets)',
    appNameEn: 'Google Sheets',
    appLogo: 'https://www.gstatic.com/images/branding/product/1x/sheets_48dp.png',
    actionAr: 'إضافة صف بيانات جديد في جدول',
    actionEn: 'Add new row to spreadsheet'
  },
  {
    appId: 'gmail',
    appNameAr: 'جيميل (Gmail)',
    appNameEn: 'Gmail',
    appLogo: 'https://www.gstatic.com/images/branding/product/1x/gmail_48dp.png',
    actionAr: 'إرسال بريد إلكتروني آلي',
    actionEn: 'Send automated email'
  },
  {
    appId: 'trello',
    appNameAr: 'تريلو (Trello)',
    appNameEn: 'Trello',
    appLogo: 'https://d2k1ftgv8pobqg.cloudfront.net/meta/p/res/images/icon-trello/favicon-16.png',
    actionAr: 'إنشاء بطاقة مهمة جديدة في اللوحة',
    actionEn: 'Create a new task card on board'
  },
  {
    appId: 'notion',
    appNameAr: 'نوشن (Notion)',
    appNameEn: 'Notion',
    appLogo: 'https://www.notion.so/images/logo-ios.png',
    actionAr: 'إنشاء صفحة أو سجل جديد في قاعدة البيانات',
    actionEn: 'Create a new database page or record'
  }
];

export function AutomationWizard({ lang }: AutomationWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedTriggerApp, setSelectedTriggerApp] = useState<TriggerApp | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TriggerEvent | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testSuccess, setTestSuccess] = useState<boolean>(false);

  const isAr = lang === 'ar';

  const handleReset = () => {
    setStep(1);
    setSelectedTriggerApp(null);
    setSelectedEvent(null);
    setSelectedAction(null);
    setIsCompleted(false);
    setTestSuccess(false);
  };

  const handleRunTest = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestSuccess(true);
    }, 1200);
  };

  const handleCreateAutomation = async () => {
    if (!selectedTriggerApp || !selectedEvent || !selectedAction) return;
    const stableUserId = await getOrCreateStableFishUserId();
    const automationData = {
      id: 'auto_' + Date.now(),
      userId: stableUserId,
      triggerApp: selectedTriggerApp.id,
      triggerEvent: selectedEvent.id,
      actionApp: selectedAction.appId,
      actionType: selectedAction.actionEn,
      createdAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'automations'), automationData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'automations');
    }
    setIsCompleted(true);
  };

  return (
    <div className="w-full bg-[#FAF9F9] border border-gray-200/90 rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm my-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B0000]/10 text-[#8B0000] text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAr ? 'مساعد الأتمتة الذكي' : 'Smart Automation Assistant'}</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-serif text-[#191919] tracking-tight">
          {isAr ? 'بناء أتمتة مخصصة في 3 خطوات بسيطة' : 'Build Custom Automation in 3 Simple Steps'}
        </h3>
        <p className="text-sm text-[#191919]/70 mt-2">
          {isAr
            ? 'اربط تطبيقاتك المفضلة ونفذ المهام تلقائياً بدون الحاجة لأي خبرة برمجية.'
            : 'Connect your favorite apps and automate workflows instantly without coding.'}
        </p>
      </div>

      {/* Stepper Progress Indicator */}
      <div className="flex items-center justify-center max-w-md mx-auto mb-10">
        {[1, 2, 3].map((s) => {
          const isActive = step === s;
          const isDone = step > s || isCompleted;
          return (
            <div key={s} className="flex items-center">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isActive
                    ? 'bg-[#191919] text-white ring-4 ring-[#191919]/10 shadow-md'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 sm:w-20 h-1 mx-2 transition-all ${
                    step > s || isCompleted ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Wizard Step Content */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto">
        {/* STEP 1: Select Trigger App */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wider">
                {isAr ? 'الخطوة الأولى' : 'Step 1'}
              </span>
              <h4 className="text-lg sm:text-xl font-serif text-[#191919] mt-1">
                {isAr ? 'اختر التطبيق الذي يبدأ الحدث (المشغل)' : 'Select the Trigger Application'}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {isAr ? 'ما هو التطبيق الذي سيقوم بإرسال الإشارة الأولى؟' : 'Which app will start the workflow?'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {TRIGGER_APPS.map((app) => {
                const isSelected = selectedTriggerApp?.id === app.id;
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedTriggerApp(app)}
                    className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#8B0000] bg-[#8B0000]/5 ring-2 ring-[#8B0000]/20'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white p-2.5 shadow-2xs border border-gray-100 flex items-center justify-center shrink-0">
                      <img src={app.logo} alt="" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-semibold text-[#191919] truncate">
                        {isAr ? app.nameAr : app.nameEn}
                      </h5>
                      <span className="text-xs text-gray-500">
                        {isAr ? `${app.events.length} أحداث متاحة` : `${app.events.length} trigger events`}
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[#8B0000] shrink-0" />}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                disabled={!selectedTriggerApp}
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-[#191919] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{isAr ? 'التالي' : 'Next'}</span>
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Select Trigger Event */}
        {step === 2 && selectedTriggerApp && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wider">
                  {isAr ? 'الخطوة الثانية' : 'Step 2'}
                </span>
                <h4 className="text-lg sm:text-xl font-serif text-[#191919] mt-1">
                  {isAr ? `اختر الحدث في ${selectedTriggerApp.nameAr}` : `Select event in ${selectedTriggerApp.nameEn}`}
                </h4>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {isAr ? 'متى بالضبط تريد تشغيل هذه الأتمتة؟' : 'When exactly should this trigger fire?'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-100 p-2 flex items-center justify-center shrink-0">
                <img src={selectedTriggerApp.logo} alt="" className="w-6 h-6 object-contain" />
              </div>
            </div>

            <div className="space-y-3">
              {selectedTriggerApp.events.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#8B0000] bg-[#8B0000]/5 ring-2 ring-[#8B0000]/20'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${isSelected ? 'bg-[#8B0000]' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium text-[#191919]">
                        {isAr ? evt.nameAr : evt.nameEn}
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[#8B0000]" />}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>{isAr ? 'السابق' : 'Back'}</span>
              </button>
              <button
                disabled={!selectedEvent}
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-[#191919] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{isAr ? 'التالي' : 'Next'}</span>
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Select Action App and Action */}
        {step === 3 && (
          <div>
            <div className="mb-6">
              <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wider">
                {isAr ? 'الخطوة الثالثة' : 'Step 3'}
              </span>
              <h4 className="text-lg sm:text-xl font-serif text-[#191919] mt-1">
                {isAr ? 'اختر التطبيق المستهدف والإجراء المطلوب' : 'Select Target App and Action'}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {isAr ? 'ما الذي تريد حدوثه تلقائياً عند وقوع الحدث؟' : 'What should happen automatically?'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
              {ACTION_APPS.map((act) => {
                const isSelected = selectedAction?.appId === act.appId;
                return (
                  <div
                    key={act.appId}
                    onClick={() => setSelectedAction(act)}
                    className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#8B0000] bg-[#8B0000]/5 ring-2 ring-[#8B0000]/20'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white p-2.5 shadow-2xs border border-gray-100 flex items-center justify-center shrink-0">
                      <img src={act.appLogo} alt="" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-semibold text-[#191919] truncate">
                        {isAr ? act.appNameAr : act.appNameEn}
                      </h5>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {isAr ? act.actionAr : act.actionEn}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[#8B0000] shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Summary preview */}
            {selectedTriggerApp && selectedEvent && selectedAction && (
              <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl mb-6 text-xs sm:text-sm">
                <div className="font-semibold text-[#191919] mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#8B0000]" />
                  <span>{isAr ? 'ملخص تدفق الأتمتة:' : 'Automation Workflow Summary:'}</span>
                </div>
                <div className="text-gray-600 space-y-1">
                  <div>• {isAr ? 'المشغل:' : 'Trigger:'} <strong className="text-[#191919]">{isAr ? selectedTriggerApp.nameAr : selectedTriggerApp.nameEn}</strong> ({isAr ? selectedEvent.nameAr : selectedEvent.nameEn})</div>
                  <div>• {isAr ? 'الإجراء:' : 'Action:'} <strong className="text-[#191919]">{isAr ? selectedAction.appNameAr : selectedAction.appNameEn}</strong> ({isAr ? selectedAction.actionAr : selectedAction.actionEn})</div>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>{isAr ? 'السابق' : 'Back'}</span>
              </button>

              <button
                disabled={!selectedAction}
                onClick={handleCreateAutomation}
                className="px-6 py-2.5 bg-[#8B0000] text-white text-sm font-medium rounded-xl hover:bg-[#660000] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? 'إنشاء وتفعيل الأتمتة' : 'Create & Activate Automation'}</span>
              </button>
            </div>
          </div>
        )}

        {/* COMPLETION / SUCCESS VIEW */}
        {isCompleted && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h4 className="text-xl sm:text-2xl font-serif text-[#191919]">
              {isAr ? 'تم إنشاء وتفعيل الأتمتة بنجاح!' : 'Automation Created & Activated Successfully!'}
            </h4>
            <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto leading-relaxed">
              {isAr
                ? 'تعمل أتمتتك الآن في الخلفية. يمكنك اختبار الاتصال أو تعديل الإعدادات في أي وقت.'
                : 'Your automation is now live in the background. You can test it or edit settings anytime.'}
            </p>

            {/* Test Simulation Box */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl max-w-md mx-auto text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-[#8B0000]" />
                  {isAr ? 'اختبار سير العمل التجريبي' : 'Test Workflow Execution'}
                </span>
                {testSuccess && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {isAr ? 'تم بنجاح (200 OK)' : 'Success (200 OK)'}
                  </span>
                )}
              </div>
              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className="w-full py-2.5 bg-[#191919] hover:bg-[#333] text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري محاكاة الحدث وإرسال الاختبار...' : 'Simulating event and sending test...'}</span>
                  </>
                ) : testSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? 'إعادة تشغيل الاختبار التجريبي' : 'Run Test Again'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تشغيل اختبار تجريبي الآن' : 'Run Test Now'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-[#191919] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors cursor-pointer"
              >
                {isAr ? 'إنشاء أتمتة جديدة أخرى' : 'Create Another Automation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
