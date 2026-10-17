/**
 * إعادة تلوين صفحة مفاتيح API من الثيم الغامق إلى هوية فيش الفاتحة.
 * يعمل مرة واحدة، ويطبع تقريرًا بعدد الاستبدالات لكل لون.
 * الاستخدام: node scripts/restyle-api-keys.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/components/ApiKeysPage.tsx');
if (!fs.existsSync(file)) {
  console.error('لم أجد src/components/ApiKeysPage.tsx — شغّل السكربت من جذر المشروع.');
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const original = src;
const report = [];

function swap(from, to, label) {
  const count = src.split(from).length - 1;
  if (count === 0) return;
  src = src.split(from).join(to);
  report.push(`${String(count).padStart(3)} × ${label || `${from} → ${to}`}`);
}

/* 1) الأزرار الأساسية: كانت بيضاء على ثيم غامق، تصبح داكنة على ثيم فاتح */
swap('bg-white hover:bg-gray-100 text-black', 'bg-gray-900 hover:bg-black text-white', 'زر أساسي (hover)');
swap('bg-white text-black', 'bg-gray-900 text-white', 'زر أساسي');
swap('hover:bg-black text-white transition-colors shadow-xs', 'hover:bg-black text-white transition-colors shadow-xs', 'زر أساسي (ثابت)');

/* 2) أسطح الصفحة */
swap('bg-[#0E1015]', 'bg-[#F7F8FA]', 'خلفية الصفحة');
swap('bg-[#14161E]', 'bg-white', 'خلفية الشريط الجانبي');
swap('bg-[#11131B]', 'bg-white', 'خلفية الشريط العلوي');
swap('bg-[#141722]', 'bg-white', 'خلفية البطاقات');
swap('bg-[#181C2A]', 'bg-[#F9FAFB]', 'رأس الجدول');
swap('bg-[#10121A]', 'bg-[#F9FAFB]', 'خلفية الرقاقة/التذييل');
swap('bg-[#0C0E14]', 'bg-[#F9FAFB]', 'خلفية غامقة');
swap('bg-[#1A1E2B]', 'bg-white', 'حقل إدخال');
swap('hover:bg-[#1A1E2D]', 'hover:bg-[#F9FAFB]', 'تحويم الصف');
swap('bg-[#1A1E2D]', 'bg-[#F9FAFB]', 'سطح فاتح');
swap('hover:bg-[#1D212F]', 'hover:bg-[#F3F4F6]', 'تحويم العنصر');
swap('bg-[#1D212F]', 'bg-[#F3F4F6]', 'سطح رمادي فاتح');
swap('hover:bg-[#282E40]', 'hover:bg-[#F3F4F6]', 'تحويم العنصر');
swap('bg-[#252B3D]', 'bg-[#F3F4F6]', 'سطح رمادي فاتح');
swap('bg-[#252B3E]', 'bg-[#F3F4F6]', 'سطح رمادي فاتح');
swap('bg-[#252C42]', 'bg-[#F3F4F6]', 'زر ثانوي');
swap('hover:bg-[#303854]', 'hover:bg-[#E5E7EB]', 'تحويم الزر الثانوي');
swap('bg-[#1E2333]', 'bg-[#F3F4F6]', 'شارة محايدة');
swap('bg-[#1F2436]', 'bg-[#F3F4F6]', 'سطح محايد');
swap('bg-[#202536]', 'bg-[#F3F4F6]', 'أيقونة الصف');
swap('bg-[#272D3F]', 'bg-[#F3F4F6]', 'سطح محايد');
swap('bg-[#2B3454]', 'bg-[#F3F4F6]', 'سطح محايد');
swap('bg-[#171C2E]', 'bg-[#F5F8FF]', 'خلفية البانر');
swap('bg-[#1A1F35]', 'bg-white', 'وسط البانر');

/* 3) الحدود */
swap('border-[#222634]', 'border-gray-200', 'حد');
swap('border-[#222738]', 'border-gray-200', 'حد');
swap('border-[#1D2232]', 'border-gray-100', 'فاصل الصفوف');
swap('border-[#262C3D]', 'border-gray-200', 'حد الحقل');
swap('border-[#262C3E]', 'border-gray-200', 'حد الرقاقة');
swap('border-[#2D344B]', 'border-gray-200', 'حد');
swap('border-[#2D3346]', 'border-gray-200', 'حد');
swap('border-[#2D354E]', 'border-gray-200', 'حد');
swap('border-[#2B3454]', 'border-gray-200', 'حد');
swap('border-[#3A4568]', 'border-gray-300', 'حد الزر الثانوي');
swap('border-[#334155]', 'border-gray-200', 'حد الشارة');
swap('border-[#785412]/50', 'border-amber-200', 'حد شارة IP');
swap('border-[#785412]', 'border-amber-200', 'حد شارة IP');
swap('bg-[#3F2F11]/40', 'bg-amber-50', 'خلفية شارة IP');
swap('bg-[#3F2025]', 'bg-rose-50', 'خلفية شارة حذف');

/* 4) النصوص */
swap('text-[#E1E4EA]', 'text-gray-900', 'نص أساسي');
swap('text-[#E2E8F0]', 'text-gray-900', 'نص أساسي');
swap('text-[#A0AEC0]', 'text-gray-500', 'نص ثانوي');
swap('text-[#8A94A6]', 'text-gray-500', 'نص ثانوي');
swap('text-[#718096]', 'text-gray-500', 'نص ثانوي');
swap('text-[#5A6478]', 'text-gray-400', 'نص باهت');
swap('text-[#94A3B8]', 'text-gray-600', 'نص ثانوي');
swap('text-[#3D4560]', 'text-gray-300', 'أيقونة باهتة');
swap('text-[#818CF8]', 'text-blue-600', 'تمييز بنفسجي');
swap('text-[#A5B4FC]', 'text-blue-700', 'تمييز بنفسجي');
swap('text-[#FBBF24]', 'text-amber-700', 'نص ذهبي');
swap('text-emerald-400', 'text-emerald-600', 'نص أخضر');
swap('placeholder-[#718096]', 'placeholder-gray-400', 'نص العنصر النائب');

/* 5) الأكسنت (البنفسجي/النيون) → أزرق الموقع */
swap('border-[#6366F1]/40', 'border-blue-200', 'حد أكسنت');
swap('border-[#6366F1]', 'border-blue-500', 'حد أكسنت');
swap('bg-[#6366F1]/20', 'bg-blue-50', 'خلفية أكسنت');
swap('bg-[#6366F1]/15', 'bg-blue-50', 'خلفية العنصر النشط');
swap('bg-[#6366F1]/10', 'bg-blue-100', 'خلفية أكسنت');
swap('bg-[#6366F1]', 'bg-blue-600', 'زر أكسنت');
swap('bg-[#4F46E5]', 'bg-blue-600', 'زر أكسنت');
swap('text-[#3730A3]', 'text-blue-700', 'نص أكسنت');

/* 6) ما تبقّى من text-white على أسطح أصبحت فاتحة */
swap('text-white', 'text-gray-900', 'نص أبيض متبقٍ');

fs.writeFileSync(file, src);
console.log(report.join('\n'));
console.log(`\nالملف: ${path.relative(process.cwd(), file)} | تغيّر: ${original === src ? 'لا شيء' : 'نعم'}`);
