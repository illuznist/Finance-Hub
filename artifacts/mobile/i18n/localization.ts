export type AppLanguage = "en" | "ar";
export type DisplayCalendar = "gregorian" | "hijri";

export interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export type CalendarDateOptions = Pick<
  Intl.DateTimeFormatOptions,
  "weekday" | "day" | "month" | "year" | "hour" | "minute"
>;

export interface DisplayPreferences {
  language: AppLanguage;
  calendar: DisplayCalendar;
}

let activePreferences: DisplayPreferences = { language: "en", calendar: "gregorian" };

export function setActiveDisplayPreferences(preferences: DisplayPreferences): void {
  activePreferences = { ...preferences };
}

const ARABIC_TRANSLATIONS: Record<string, string> = {
  "APPEARANCE": "المظهر",
  "PROFILE": "الملف الشخصي",
  "CURRENCY & BUDGET": "العملة والميزانية",
  "SECURITY": "الأمان",
  "DATA & PRIVACY": "البيانات والخصوصية",
  "ACCOUNT": "الحساب",
  "SUPPORT": "الدعم",
  "ABOUT": "حول التطبيق",
  "Settings": "الإعدادات",
  "Appearance": "المظهر",
  "Theme": "السمة",
  "System": "النظام",
  "Light": "فاتح",
  "Dark": "داكن",
  "Profile": "الملف الشخصي",
  "Tap to edit name": "اضغط لتعديل الاسم",
  "Currency & Budget": "العملة والميزانية",
  "Display Currency": "عملة العرض",
  "Saudi Riyal": "ريال سعودي",
  "US Dollar": "دولار أمريكي",
  "UAE Dirham": "درهم إماراتي",
  "Euro": "يورو",
  "British Pound": "جنيه إسترليني",
  "Indian Rupee": "روبية هندية",
  "Monthly Budget": "الميزانية الشهرية",
  "Notifications": "الإشعارات",
  "Enable Reminders": "تفعيل التذكيرات",
  "Remind me": "ذكّرني",
  "Security": "الأمان",
  "Face ID": "بصمة الوجه",
  "Fingerprint": "بصمة الإصبع",
  "Biometric unlock is on": "فتح القفل بالبصمة مفعّل",
  "Use biometrics to unlock app": "استخدم البصمة لفتح التطبيق",
  "Immediately": "فورًا",
  "1 min": "دقيقة واحدة",
  "5 min": "٥ دقائق",
  "10 min": "١٠ دقائق",
  "30 min": "٣٠ دقيقة",
  "Never": "أبدًا",
  "PIN Lock": "قفل PIN",
  "PIN set — locks on restart and after inactivity": "تم إعداد PIN — يُقفل عند إعادة التشغيل وبعد عدم النشاط",
  "Protect your data with a PIN": "احمِ بياناتك باستخدام PIN",
  "Auto-lock": "القفل التلقائي",
  "Change PIN": "تغيير PIN",
  "Data & Privacy": "البيانات والخصوصية",
  "Backup & Restore": "النسخ الاحتياطي والاستعادة",
  "Encrypted local file, no cloud upload": "ملف محلي مشفّر، دون رفع إلى السحابة",
  "Account": "الحساب",
  "Signed in as": "تم تسجيل الدخول باسم",
  "Sign Out": "تسجيل الخروج",
  "Support": "الدعم",
  "Help & Support": "المساعدة والدعم",
  "Privacy Policy": "سياسة الخصوصية",
  "Terms & Conditions": "الشروط والأحكام",
  "About": "حول التطبيق",
  "EMI reminders": "تذكيرات الأقساط",
  "Expense reminders": "تذكيرات المصروفات",
  "Budget alerts": "تنبيهات الميزانية",
  "Balloon reminders": "تذكيرات الدفعة النهائية",
  "Loan reminders": "تذكيرات القروض",
  "Local reminders require device permission. Web previews do not send notifications. Category thresholds are configured in Budget.": "تتطلب التذكيرات المحلية إذن الجهاز. لا ترسل معاينة الويب إشعارات. تُضبط حدود الفئات من الميزانية.",
  "Totals include only records in this currency. Different currencies are never combined without conversion.": "تشمل الإجماليات السجلات بهذه العملة فقط. لا تُجمع العملات المختلفة دون تحويل.",
  "Verify to change PIN": "تحقق لتغيير PIN",
  "Verify to disable PIN": "تحقق لتعطيل PIN",
  "Verify your account password before changing app lock settings.": "تحقق من كلمة مرور الحساب قبل تغيير إعدادات قفل التطبيق.",
  "Account password": "كلمة مرور الحساب",
  "Checking…": "جارٍ التحقق…",
  "Saving…": "جارٍ الحفظ…",
  "Could not change language": "تعذّر تغيير اللغة",
  "Could not save preference": "تعذّر حفظ التفضيل",
  "Version": "الإصدار",
  "Expo Go": "معاينة Expo Go",
  "Language": "اللغة",
  "English": "English",
  "Arabic (Saudi Arabia)": "العربية (السعودية)",
  "Display calendar": "تقويم العرض",
  "Gregorian": "ميلادي",
  "Hijri": "هجري",
  "Date entry always uses the Gregorian calendar.": "إدخال التواريخ يستخدم التقويم الميلادي دائمًا.",
  "Changing language reloads the app to apply right-to-left layout.": "سيُعاد تحميل التطبيق لتطبيق اتجاه الكتابة من اليمين إلى اليسار.",
  "Gregorian date": "التاريخ ميلادي",
  "Home": "الرئيسية",
  "Wallets": "المحافظ",
  "Expenses": "المصروفات",
  "EMIs": "الأقساط",
  "Loans": "القروض",
  "Total Balance": "إجمالي الرصيد",
  "TOTAL BALANCE": "إجمالي الرصيد",
  "Received this month": "المبالغ المستلمة هذا الشهر",
  "Paid this month": "المدفوع هذا الشهر",
  "Remaining this month": "المتبقي هذا الشهر",
  "Over budget this month": "تجاوزت الميزانية هذا الشهر",
  "Set a monthly budget": "حدّد ميزانية شهرية",
  "of": "من",
  "budget": "الميزانية",
  "Budget details": "تفاصيل الميزانية",
  "Spent": "تم إنفاق",
  "Coming up": "القادم",
  "View all": "عرض الكل",
  "No upcoming commitments. Recurring expenses, EMIs and loan schedules appear here.": "لا توجد التزامات قادمة. ستظهر هنا المصروفات المتكررة والأقساط وجداول القروض.",
  "Savings": "المدخرات",
  "rate this month": "نسبة هذا الشهر",
  "Goal progress": "تقدم الهدف",
  "of goal": "من الهدف",
  "Saved this month": "المدخرات هذا الشهر",
  "In savings accounts": "في حسابات التوفير",
  "Active EMIs": "الأقساط النشطة",
  "Good Morning": "صباح الخير",
  "Good Afternoon": "مساء الخير",
  "Good Evening": "مساء الخير",
  "Only": "المتبقي",
  "left this month": "لهذا الشهر",
  "Over by": "زيادة قدرها",
  "review your spending": "راجع مصروفاتك",
  "You've used": "استخدمت",
  "of your monthly budget": "من ميزانيتك الشهرية",
  "expenses reset and ready to track": "مصروفات أُعيد ضبطها وجاهزة للمتابعة",
  "expense reset and ready to track": "مصروف أُعيد ضبطه وجاهز للمتابعة",
  "is here": "بدأ",
  "Overdue": "متأخر",
  "Due today": "مستحق اليوم",
  "Heads up": "تنبيه",
  "Low budget": "الميزانية منخفضة",
  "Budget exceeded": "تم تجاوز الميزانية",
  "Dismiss budget alert": "إخفاء تنبيه الميزانية",
  "Open transactions": "فتح المعاملات",
  "Open analytics": "فتح التحليلات",
  "Open settings": "فتح الإعدادات",
  "Set your PIN": "إعداد PIN",
  "Confirm your PIN": "تأكيد PIN",
  "Enter a 4-digit PIN": "أدخل PIN من 4 أرقام",
  "Enter the PIN again to confirm": "أدخل PIN مرة أخرى للتأكيد",
  "PINs don't match — try again": "رمزا PIN غير متطابقين — حاول مرة أخرى",
  "Cancel": "إلغاء",
  "Unlock FinanceApp": "فتح FinanceApp",
  "Enter your 4-digit app PIN": "أدخل PIN التطبيق المكوّن من 4 أرقام",
  "Use PIN or password": "استخدم PIN أو كلمة المرور",
  "Use Face ID": "استخدم بصمة الوجه",
  "Use fingerprint": "استخدم بصمة الإصبع",
  "Forgot PIN? Use account password": "نسيت PIN؟ استخدم كلمة مرور الحساب",
  "Sign In": "تسجيل الدخول",
  "Create Account": "إنشاء حساب",
  "Welcome back": "مرحبًا بعودتك",
  "Create account": "إنشاء حساب",
  "Sign in to access your financial data": "سجّل الدخول للوصول إلى بياناتك المالية",
  "Your records stay on this device": "تبقى سجلاتك على هذا الجهاز",
  "Full name": "الاسم الكامل",
  "Email address": "البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Confirm password": "تأكيد كلمة المرور",
  "No cloud sync. Backups export only when you choose.": "لا توجد مزامنة سحابية. لا تُصدّر النسخ الاحتياطية إلا باختيارك.",
  "Sign in to access the finance records stored on this device.": "سجّل الدخول للوصول إلى السجلات المالية المحفوظة على هذا الجهاز.",
  "Continue": "متابعة",
  "Retry safely": "إعادة المحاولة بأمان",
  "NOTIFICATIONS": "الإشعارات",
  "Same day": "في اليوم نفسه",
  "1 day before": "قبل يوم",
  "3 days before": "قبل 3 أيام",
  "7 days before": "قبل 7 أيام",
  "Try again in": "أعد المحاولة بعد",
  "Incorrect PIN. Try again or use account-password recovery.": "PIN غير صحيح. حاول مرة أخرى أو استخدم استعادة كلمة مرور الحساب.",
  "Too many attempts. Wait before trying again.": "محاولات كثيرة. انتظر قبل المحاولة مجددًا.",
  "PIN could not be verified. Use account-password recovery.": "تعذّر التحقق من PIN. استخدم استعادة كلمة مرور الحساب.",
  "Secure PIN storage could not be upgraded. The app remains locked; retry or use account-password recovery.": "تعذّر تحديث التخزين الآمن لـ PIN. سيبقى التطبيق مقفلًا؛ أعد المحاولة أو استخدم استعادة كلمة مرور الحساب.",
  "Screen privacy protection is unavailable on this device; app locking remains enabled.": "حماية خصوصية الشاشة غير متاحة على هذا الجهاز؛ سيبقى قفل التطبيق مفعّلًا.",
  "That account password was not correct.": "كلمة مرور الحساب غير صحيحة.",
  "Password recovery could not complete. Try again.": "تعذّرت استعادة كلمة المرور. حاول مرة أخرى.",
  "Reset app lock": "إعادة ضبط قفل التطبيق",
  "Verify your account password to remove the unavailable PIN. Your finance records will stay unchanged.": "تحقق من كلمة مرور الحساب لإزالة PIN غير المتاح. ستبقى سجلاتك المالية دون تغيير.",
  "Account security data is unavailable": "بيانات أمان الحساب غير متاحة",
  "Your saved records have not been changed. Retry safely; do not clear app storage.": "لم تتغير سجلاتك المحفوظة. أعد المحاولة بأمان ولا تمسح بيانات التطبيق.",
  "Biometric authentication failed. Use your password instead.": "تعذّر التحقق بالبصمة. استخدم كلمة المرور بدلًا من ذلك.",
  "Please enter your name.": "أدخل اسمك.",
  "Please enter a valid email.": "أدخل بريدًا إلكترونيًا صالحًا.",
  "Password must be at least 6 characters.": "يجب ألا تقل كلمة المرور عن 6 أحرف.",
  "Passwords do not match.": "كلمتا المرور غير متطابقتين.",
  "Failed to create account. Please try again.": "تعذّر إنشاء الحساب. حاول مرة أخرى.",
  "Please enter your email.": "أدخل بريدك الإلكتروني.",
  "Please enter your password.": "أدخل كلمة المرور.",
  "Incorrect email or password.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "Sign in with": "تسجيل الدخول باستخدام",
  "Your finances,": "أموالك",
  "beautifully organized": "مرتبة بوضوح",
  "A premium personal finance tracker built for clarity and control.": "متتبع مالي شخصي مصمم لمنحك الوضوح والتحكم.",
  "Expense tracking": "تتبع المصروفات",
  "Log recurring bills and monthly expenses with due-date reminders.": "سجّل الفواتير المتكررة والمصروفات الشهرية مع تذكيرات الاستحقاق.",
  "EMI management": "إدارة الأقساط",
  "Track installment plans with a live progress ring and payoff timeline.": "تابع خطط الأقساط ومؤشر التقدم وجدول السداد.",
  "Smart analytics": "تحليلات ذكية",
  "Visual breakdowns of where your money goes, every month.": "عرض مرئي لوجهة أموالك كل شهر.",
  "Personalize": "تخصيص",
  "your experience": "تجربتك",
  "We'll set up the app to match your preferences.": "سنضبط التطبيق وفق تفضيلاتك.",
  "Your name": "اسمك",
  "Enter your name": "أدخل اسمك",
  "Default currency": "العملة الافتراضية",
  "Set your": "حدّد",
  "monthly budget": "ميزانيتك الشهرية",
  "Define how much you plan to spend each month. You can always adjust this later in Settings.": "حدّد المبلغ الذي تخطط لإنفاقه شهريًا. يمكنك تعديله لاحقًا من الإعدادات.",
  "Monthly budget": "الميزانية الشهرية",
  "Back": "رجوع",
  "Get Started": "ابدأ",
  "Analytics": "التحليلات",
  "Transactions": "المعاملات",
  "Budget": "الميزانية",
  "Forecast": "التوقعات",
  "Recurring": "المتكرر",
  "Selected period": "الفترة المحددة",
  "Date": "التاريخ",
  "Could not save security settings": "تعذّر حفظ إعدادات الأمان",
  "PIN could not be saved. Your current app lock was not changed.": "تعذّر حفظ PIN. لم يتغير قفل التطبيق الحالي.",
  "PIN could not be saved. Try again.": "تعذّر حفظ PIN. حاول مرة أخرى.",
  "Payment reminder": "تذكير بالدفع",
  "due": "مستحق",
  "used": "مستخدم",
  "spent of": "تم إنفاق من",
  "No change from previous period": "لا تغيير مقارنة بالفترة السابقة",
  "Past month": "الشهر الماضي",
  "Next month": "الشهر القادم",
  "Current month": "الشهر الحالي",
  "tap for current": "اضغط للانتقال إلى الشهر الحالي",
  "REMAINING": "المتبقي",
  "Needs attention": "يحتاج إلى الانتباه",
  "Categories": "الفئات",
  "Used": "المستخدم",
  "Daily average": "المتوسط اليومي",
  "Projected": "المتوقع",
  "Exceeded": "تم التجاوز",
  "Near limit": "قريب من الحد",
  "Approaching": "يقترب من الحد",
  "No limit": "بلا حد",
  "On track": "ضمن المسار",
  "Disable PIN": "تعطيل PIN",
  "Are you sure you want to disable PIN lock?": "هل تريد تعطيل قفل PIN؟",
  "Disable": "تعطيل",
  "You will need to sign in again to access your data.": "ستحتاج إلى تسجيل الدخول مجددًا للوصول إلى بياناتك.",
  "All": "الكل",
  "Balloon": "دفعة ختامية",
  "Next 7 days": "الأيام السبعة القادمة",
  "Next 30 days": "الثلاثون يومًا القادمة",
  "This month": "هذا الشهر",
  "Custom": "مخصص",
  "Paid": "مدفوع",
  "Skipped": "تم التجاوز",
  "Upcoming": "القادم",
  "Scheduled": "مجدول",
  "Enter dates as YYYY-MM-DD.": "أدخل التواريخ بالصيغة YYYY-MM-DD.",
  "Start date must be on or before end date.": "يجب أن يكون تاريخ البدء في يوم تاريخ الانتهاء أو قبله.",
  "No account": "لا يوجد حساب",
  "Removed account": "حساب محذوف",
  "Recurring expense": "مصروف متكرر",
  "EMI": "قسط",
  "Balloon payment": "دفعة ختامية",
  "Loan repayment": "سداد قرض",
  "Scheduled commitments, not transactions": "التزامات مجدولة وليست معاملات",
  "Include overdue": "تضمين المتأخرات",
  "Schedules unavailable": "الجداول غير متاحة",
  "Upcoming payments could not be calculated right now.": "تعذّر حساب الدفعات القادمة الآن.",
  "Nothing scheduled": "لا توجد عناصر مجدولة",
  "No commitments in this range. Recurring expenses, EMIs, balloon payments and loan schedules appear here.": "لا توجد التزامات في هذه الفترة. ستظهر هنا المصروفات المتكررة والأقساط والدفعات الختامية وجداول القروض.",
  "Nothing else in this range.": "لا توجد عناصر أخرى في هذه الفترة.",
  "Create encrypted backup": "إنشاء نسخة احتياطية مشفّرة",
  "Backups are encrypted on this device with AES-256-GCM and exported only to a location you choose. Finance records are not uploaded. Keep a copy outside this app; uninstalling the app or losing the device can otherwise erase local records. The backup password cannot be recovered if lost.": "تُشفّر النسخ الاحتياطية على هذا الجهاز باستخدام AES-256-GCM، ولا تُصدّر إلا إلى موقع تختاره. لا تُرفع السجلات المالية. احتفظ بنسخة خارج التطبيق؛ فقد يؤدي حذف التطبيق أو فقدان الجهاز إلى محو السجلات المحلية. لا يمكن استعادة كلمة مرور النسخة الاحتياطية عند فقدانها.",
  "Includes your accounts, ledger, income, expenses, EMIs, loans, budgets, recurring items, savings and snapshots. Theme is included; language and calendar stay on this device. Device PIN and account credentials are excluded.": "تشمل حساباتك وسجل المعاملات والدخل والمصروفات والأقساط والقروض والميزانيات والعناصر المتكررة والمدخرات واللقطات. تُضمّن السمة، بينما تبقى اللغة والتقويم على هذا الجهاز. لا يُضمّن PIN الجهاز أو بيانات الحساب.",
  "Browser storage is not hardware-backed. Use a trusted device profile and keep exported backups protected.": "تخزين المتصفح غير محمي بعتاد الجهاز. استخدم ملف جهاز موثوقًا واحفظ النسخ الاحتياطية المصدّرة في مكان آمن.",
  "Confirm backup password": "تأكيد كلمة مرور النسخة الاحتياطية",
  "Create and export backup": "إنشاء النسخة الاحتياطية وتصديرها",
  "Last backup created": "تاريخ آخر نسخة احتياطية",
  "Not yet": "لم تُنشأ بعد",
  "Restore from backup": "استعادة من نسخة احتياطية",
  "The file and password are checked and the contents are validated before any saved records change.": "يُتحقق من الملف وكلمة المرور وتُراجع محتوياته قبل تغيير أي سجلات محفوظة.",
  "Choose backup file": "اختيار ملف النسخة الاحتياطية",
  "Backup preview": "معاينة النسخة الاحتياطية",
  "Created": "تاريخ الإنشاء",
  "app": "التطبيق",
  "format": "التنسيق",
  "Replace local records": "استبدال السجلات المحلية",
  "Store the exported file somewhere you control and keep its password separately. Uninstalling the app or losing this device does not transfer its local records.": "احفظ الملف المُصدّر في مكان تتحكم به، واحتفظ بكلمة مروره منفصلة. حذف التطبيق أو فقدان هذا الجهاز لا ينقل سجلاته المحلية.",
  "Replace this device’s records?": "هل تريد استبدال سجلات هذا الجهاز؟",
  "The current finance data and appearance setting will be saved in a protected recovery copy first. Your device PIN and account lock will stay as they are. Do not clear app storage during restore.": "سيُحفظ الوضع المالي الحالي وإعداد المظهر أولًا في نسخة استرداد محمية. سيبقى PIN الجهاز وقفل الحساب كما هما. لا تمسح بيانات التطبيق أثناء الاستعادة.",
  "Selected": "تم الاختيار",
  "characters": "أحرف",
  "Accounts": "الحسابات",
  "Ledger entries": "قيود السجل",
  "Income records": "سجلات الدخل",
  "EMI schedules": "جداول الأقساط",
  "EMI payments": "دفعات الأقساط",
  "Loan payments": "دفعات القروض",
  "Budget plans": "خطط الميزانية",
  "Budget periods": "فترات الميزانية",
  "Recurring rules": "قواعد التكرار",
  "Scheduled items": "عناصر مجدولة",
  "Savings goals": "أهداف الادخار",
  "Net-worth snapshots": "لقطات صافي الثروة",
  "The previous backup date could not be read. Existing backups are not affected.": "تعذّر قراءة تاريخ النسخة الاحتياطية السابقة. لم تتأثر النسخ الحالية.",
  "The two backup passwords do not match.": "كلمتا مرور النسخة الاحتياطية غير متطابقتين.",
  "The backup could not be created.": "تعذّر إنشاء النسخة الاحتياطية.",
  "The selected backup could not be read.": "تعذّرت قراءة النسخة الاحتياطية المحددة.",
  "Enter the password used to encrypt this backup.": "أدخل كلمة المرور المستخدمة لتشفير هذه النسخة الاحتياطية.",
  "Choose an encrypted backup file first.": "اختر ملف نسخة احتياطية مشفّرًا أولًا.",
  "Backup verified. Review the records before replacing this device's data.": "تم التحقق من النسخة الاحتياطية. راجع السجلات قبل استبدال بيانات هذا الجهاز.",
  "The backup could not be opened.": "تعذّر فتح النسخة الاحتياطية.",
  "Backup restored. Your current PIN, biometrics, and account lock remained on this device.": "تمت استعادة النسخة الاحتياطية. بقي PIN الحالي وبصمة الجهاز وقفل الحساب على هذا الجهاز.",
  "Restore could not be completed.": "تعذّر إكمال الاستعادة.",
  "Replace records": "استبدال السجلات",
  "Restoring…": "جارٍ الاستعادة…",
  "characters.": "أحرف.",
  "CONTACT": "التواصل",
  "FREQUENTLY ASKED": "الأسئلة الشائعة",
  "We are here to help": "نحن هنا للمساعدة",
  "Browse the FAQ below or reach out and we will get back to you as soon as possible.": "اطّلع على الأسئلة الشائعة أدناه أو تواصل معنا وسنرد عليك في أقرب وقت.",
  "Email Support": "مراسلة الدعم",
  "Report a Bug": "الإبلاغ عن مشكلة",
  "Help us improve by reporting issues": "ساعدنا على التحسين بالإبلاغ عن المشكلات",
  "Average response time: 1–2 business days": "متوسط وقت الرد: يوم إلى يومي عمل",
  "Is my data safe and private?": "هل بياناتي آمنة وخاصة؟",
  "Finance records stay in this app's local store and are not uploaded to a FinanceApp server. The finance database is not encrypted at rest by the app. Native credentials and PIN verifiers use device secure storage; browser builds use local storage.": "تبقى السجلات المالية في التخزين المحلي للتطبيق ولا تُرفع إلى خادم FinanceApp. لا يشفّر التطبيق قاعدة البيانات وهي مخزنة. تستخدم بيانات الاعتماد ورموز PIN في الأجهزة الأصلية التخزين الآمن للجهاز؛ أما إصدار المتصفح فيستخدم التخزين المحلي.",
  "I forgot my PIN — what do I do?": "نسيت PIN، ماذا أفعل؟",
  "Tap “Forgot PIN?” on the lock screen and verify your account password to reset the app lock. This does not delete finance records. You can enable biometrics as an optional alternative in Settings.": "اضغط على «نسيت PIN؟» في شاشة القفل وتحقق من كلمة مرور حسابك لإعادة ضبط قفل التطبيق. لن يؤدي ذلك إلى حذف السجلات المالية. يمكنك تفعيل البصمة كخيار إضافي من الإعدادات.",
  "How do I enable Face ID or Fingerprint?": "كيف أفعّل بصمة الوجه أو الإصبع؟",
  "Go to Settings, then Security. Toggle on the Face ID or Fingerprint option. Your device must have biometrics set up in system settings.": "انتقل إلى الإعدادات ثم الأمان، وفعّل خيار بصمة الوجه أو الإصبع. يجب إعداد البصمة في إعدادات نظام الجهاز.",
  "Which currencies are supported?": "ما العملات المدعومة؟",
  "FinanceApp supports SAR, USD, EUR, GBP, AED, INR, and more. Change your display currency any time in Settings under Currency & Budget.": "يدعم FinanceApp عملات SAR وUSD وEUR وGBP وAED وINR وغيرها. يمكنك تغيير عملة العرض من قسم العملة والميزانية في الإعدادات.",
  "How does the monthly reset work?": "كيف تعمل إعادة الضبط الشهرية؟",
  "At the start of each month, all recurring expenses are automatically marked as unpaid so you can track the new month. Your history remains intact.": "في بداية كل شهر، تُعلّم المصروفات المتكررة تلقائيًا بأنها غير مدفوعة لمتابعة الشهر الجديد. يبقى السجل السابق محفوظًا.",
  "Can I export or backup my data?": "هل يمكنني تصدير بياناتي أو نسخها احتياطيًا؟",
  "Open Settings → Backup & Restore to create a password-protected encrypted file or restore one. The app does not upload backups. Keep the password separately; it cannot be recovered if lost.": "افتح الإعدادات ← النسخ الاحتياطي والاستعادة لإنشاء ملف مشفّر محمي بكلمة مرور أو استعادة ملف. لا يرفع التطبيق النسخ الاحتياطية. احتفظ بكلمة المرور منفصلة، إذ لا يمكن استعادتها عند فقدانها.",
  "How do EMIs work?": "كيف تعمل الأقساط؟",
  "Add any loan or installment plan with the total amount, number of installments, and start date. The app tracks how many are paid and shows the remaining balance.": "أضف قرضًا أو خطة تقسيط مع المبلغ الإجمالي وعدد الأقساط وتاريخ البدء. يتابع التطبيق الأقساط المدفوعة ويعرض الرصيد المتبقي.",
  "Choose a backup password with at least 12 characters.": "اختر كلمة مرور للنسخة الاحتياطية لا تقل عن 12 حرفًا.",
  "The finance records could not be prepared for backup.": "تعذّر تجهيز السجلات المالية للنسخ الاحتياطي.",
  "This backup is too large to export safely.": "حجم النسخة الاحتياطية أكبر من الحد الآمن للتصدير.",
  "This backup file is too large to open safely.": "حجم ملف النسخة الاحتياطية أكبر من الحد الآمن للفتح.",
  "This file is not a readable Finance Hub backup.": "هذا الملف ليس نسخة احتياطية قابلة للقراءة من Finance Hub.",
  "This is not a Finance Hub encrypted backup.": "هذه ليست نسخة احتياطية مشفّرة من Finance Hub.",
  "This backup format version is not supported by this app.": "إصدار تنسيق النسخة الاحتياطية غير مدعوم في هذا التطبيق.",
  "This backup uses an unsupported encryption format.": "تستخدم هذه النسخة الاحتياطية تنسيق تشفير غير مدعوم.",
  "This backup's key settings are invalid or unsupported.": "إعدادات المفتاح في هذه النسخة الاحتياطية غير صالحة أو غير مدعومة.",
  "This backup file is incomplete or damaged.": "ملف النسخة الاحتياطية غير مكتمل أو تالف.",
  "The backup could not be opened. Check the password and select an intact backup.": "تعذّر فتح النسخة الاحتياطية. تحقق من كلمة المرور واختر ملفًا سليمًا.",
  "The backup record summary does not match its contents.": "ملخص السجلات لا يطابق محتوى النسخة الاحتياطية.",
  "The backup contains an unsupported appearance preference.": "تحتوي النسخة الاحتياطية على تفضيل مظهر غير مدعوم.",
  "The backup contents are invalid or incomplete.": "محتوى النسخة الاحتياطية غير صالح أو غير مكتمل.",
  "The backup preview information is invalid.": "معلومات معاينة النسخة الاحتياطية غير صالحة.",
  "The backup preview counts are invalid.": "أعداد معاينة النسخة الاحتياطية غير صالحة.",
  "The backup data is invalid.": "بيانات النسخة الاحتياطية غير صالحة.",
  "The backup file is incomplete.": "ملف النسخة الاحتياطية غير مكتمل.",
  "Secure random data is unavailable on this device.": "البيانات العشوائية الآمنة غير متاحة على هذا الجهاز.",
  "File sharing is unavailable on this device.": "مشاركة الملفات غير متاحة على هذا الجهاز.",
  "No backup file was selected.": "لم يتم اختيار ملف نسخة احتياطية.",
  "This file is larger than the 64 MB backup limit.": "حجم الملف يتجاوز حد النسخة الاحتياطية البالغ 64 ميغابايت.",
  "The selected file could not be read.": "تعذّرت قراءة الملف المحدد.",
  "Last updated": "آخر تحديث",
  "November 2026": "نوفمبر 2026",
  "FinanceApp — Built with privacy by design": "FinanceApp — صُمم مع مراعاة الخصوصية",
  "Legal content is shown in English until an Arabic translation is reviewed.": "يُعرض المحتوى القانوني بالإنجليزية إلى حين مراجعة ترجمته العربية.",
  "Data Storage": "تخزين البيانات",
  "Data We Do Not Collect": "البيانات التي لا نجمعها",
  "Authentication": "المصادقة",
  "Third-Party Services": "خدمات الجهات الخارجية",
  "Data Deletion": "حذف البيانات",
  "Acceptance of Terms": "قبول الشروط",
  "Description of Service": "وصف الخدمة",
  "No Financial Advice": "لا تُقدّم نصائح مالية",
  "Data Responsibility": "مسؤولية البيانات",
  "Accuracy of Information": "دقة المعلومات",
  "Intellectual Property": "الملكية الفكرية",
  "Limitation of Liability": "حدود المسؤولية",
  "Governing Law": "القانون الحاكم",
  "Schedules. Nothing is paid until you confirm.": "جداول مجدولة، ولا يتم الدفع حتى تؤكده.",
  "Pay or skip due items from Upcoming.": "ادفع العناصر المستحقة أو تخطّها من صفحة القادم.",
  "Unassigned": "غير معيّن",
  "Next": "التالي",
  "Paused": "متوقف مؤقتًا",
  "Active": "نشط",
  "No active schedules.": "لا توجد جداول نشطة.",
  "History": "السجل",
  "Status": "الحالة",
  "Next due": "الاستحقاق القادم",
  "Started": "تاريخ البدء",
  "Ends": "ينتهي",
  "No end date": "بلا تاريخ انتهاء",
  "Reminder": "تذكير",
  "Auto-create pending": "إنشاء عنصر مستحق تلقائيًا",
  "On": "مفعّل",
  "Off": "متوقف",
  "Edit": "تعديل",
  "Pause": "إيقاف مؤقت",
  "Resume": "استئناف",
  "Archive": "أرشفة",
  "Archive schedule?": "هل تريد أرشفة الجدول؟",
  "No new occurrences will be created. Paid history and transactions are kept.": "لن تُنشأ عناصر جديدة. سيبقى سجل الدفعات والمعاملات محفوظًا.",
  "Status could not be changed.": "تعذّر تغيير الحالة.",
  "This schedule could not be archived.": "تعذّرت أرشفة هذا الجدول.",
  "Pending": "معلّق",
  "No occurrences yet.": "لا توجد عناصر مستحقة بعد.",
  "Open in Transactions": "فتح في المعاملات",
  "Edit recurring": "تعديل المصروف المتكرر",
  "New recurring expense": "مصروف متكرر جديد",
  "Save changes": "حفظ التغييرات",
  "Add schedule": "إضافة جدول",
  "Name": "الاسم",
  "Amount": "المبلغ",
  "Category": "الفئة",
  "Frequency": "التكرار",
  "Daily": "يومي",
  "Weekly": "أسبوعي",
  "Monthly": "شهري",
  "Every 2 months": "كل شهرين",
  "Quarterly": "ربع سنوي",
  "Every 6 months": "كل ستة أشهر",
  "Annually": "سنوي",
  "Days": "أيام",
  "Weeks": "أسابيع",
  "Months": "أشهر",
  "Add a name.": "أدخل اسمًا.",
  "Enter a positive amount with up to two decimals.": "أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى.",
  "Use YYYY-MM-DD.": "استخدم الصيغة YYYY-MM-DD.",
  "End date must be a valid date on or after the start.": "يجب أن يكون تاريخ الانتهاء صالحًا وفي يوم تاريخ البدء أو بعده.",
  "Use a whole number from 1 to 365.": "أدخل عددًا صحيحًا من 1 إلى 365.",
  "This schedule could not be saved. Check the details and try again.": "تعذّر حفظ هذا الجدول. تحقق من التفاصيل وحاول مرة أخرى.",
  "Rent, internet, gym": "الإيجار والإنترنت والنادي",
  "Monthly dates on the 29th–31st fall back to the last day of shorter months.": "تُضبط المواعيد الشهرية بين 29 و31 على آخر يوم في الأشهر الأقصر.",
  "The first payment is due on this date.": "تستحق الدفعة الأولى في هذا التاريخ.",
  "Calculated, not editable. After saving, the next due date is the first scheduled date after today, based on the start date and frequency. Change the start date to move the schedule.": "يُحسب ولا يمكن تعديله. بعد الحفظ، يكون تاريخ الاستحقاق التالي أول موعد مجدول بعد اليوم وفق تاريخ البدء والتكرار. غيّر تاريخ البدء لنقل الجدول.",
  "End date (optional)": "تاريخ الانتهاء (اختياري)",
  "Paused schedules stop creating occurrences.": "تتوقف الجداول الموقوفة مؤقتًا عن إنشاء العناصر.",
  "Creates a pending occurrence when due. It never pays or changes a balance.": "ينشئ عنصرًا معلّقًا عند الاستحقاق، ولا يدفع أو يغيّر الرصيد.",
  "Notes (optional)": "ملاحظات (اختياري)",
  "Apply changes to": "تطبيق التغييرات على",
  "Paid history is never rewritten.": "لا يُعاد كتابة سجل الدفعات.",
  "Future only": "المستقبل فقط",
  "Pending occurrences": "العناصر المعلّقة",
  "Every": "كل",
  "day": "يوم",
  "days": "أيام",
  "week": "أسبوع",
  "weeks": "أسابيع",
  "month": "شهر",
  "months": "أشهر",
  "Skip this occurrence and pause the schedule. No payment is recorded.": "تخطّ هذا الاستحقاق وأوقف الجدول مؤقتًا. لن يتم تسجيل دفعة.",
  "Skip this occurrence and move to the next due date. No payment is recorded.": "تخطّ هذا الاستحقاق وانتقل إلى الموعد التالي. لن يتم تسجيل دفعة.",
  "Skip and pause?": "هل تريد التخطي والإيقاف مؤقتًا؟",
  "Skip this one?": "هل تريد تخطي هذا الاستحقاق؟",
  "Skip and pause": "تخطٍ وإيقاف مؤقت",
  "Skip": "تخطي",
  "This payment is confirmed and recorded in Transactions.": "تم تأكيد هذه الدفعة وتسجيلها في المعاملات.",
  "This occurrence was skipped. No payment was recorded.": "تم تخطي هذا الاستحقاق ولم تُسجل أي دفعة.",
  "Confirming creates one transaction and updates the selected account balance.": "يؤدي التأكيد إلى إنشاء معاملة واحدة وتحديث رصيد الحساب المحدد.",
  "Recording...": "جارٍ التسجيل...",
  "Confirm payment": "تأكيد الدفع",
  "Edit schedule": "تعديل الجدول",
  "Recorded without changing an account balance.": "تم التسجيل دون تغيير رصيد أي حساب.",
  "Your records are protected": "سجلاتك محمية",
  "Do not clear app storage. The original data is retained if migration cannot finish. If a save failed, keep this app open and retry.": "لا تمسح بيانات التطبيق. تُحفظ البيانات الأصلية إذا تعذّر إكمال الترحيل. إذا فشل الحفظ، أبقِ التطبيق مفتوحًا وأعد المحاولة.",
  "Payment date": "تاريخ الدفع",
  "Confirm": "تأكيد",
  "Your records have not been changed. Retry safely; do not clear app storage.": "لم تتغير سجلاتك. أعد المحاولة بأمان ولا تمسح بيانات التطبيق.",
  "Security settings could not be saved. Keep the app open and retry safely.": "تعذّر حفظ إعدادات الأمان. أبقِ التطبيق مفتوحًا وأعد المحاولة بأمان.",
  "Security settings could not be saved. Retry safely before leaving this screen.": "تعذّر حفظ إعدادات الأمان. أعد المحاولة بأمان قبل مغادرة هذه الشاشة.",
  "Finance storage is unavailable. Retry before changing security settings.": "التخزين المالي غير متاح. أعد المحاولة قبل تغيير إعدادات الأمان.",
  "Saved data could not be loaded. No records have been reset.": "تعذّر تحميل البيانات المحفوظة. لم تتم إعادة ضبط أي سجل.",
  "Finance storage is unavailable. Retry before making changes.": "التخزين المالي غير متاح. أعد المحاولة قبل إجراء تغييرات.",
  "Saved data could not be retried safely.": "تعذّرت إعادة محاولة تحميل البيانات المحفوظة بأمان.",
  "Changes could not be saved: storage unavailable. Keep the app open and retry.": "تعذّر حفظ التغييرات لأن التخزين غير متاح. أبقِ التطبيق مفتوحًا وأعد المحاولة.",
  "The selected backup does not contain a finance document.": "لا تحتوي النسخة الاحتياطية المحددة على مستند مالي.",
  "The selected backup contains an unreadable finance document.": "تحتوي النسخة الاحتياطية المحددة على مستند مالي غير قابل للقراءة.",
  "A restored account balance could not be verified.": "تعذّر التحقق من رصيد حساب مستعاد.",
  "Finance storage is unavailable. Retry before restoring a backup.": "التخزين المالي غير متاح. أعد المحاولة قبل استعادة نسخة احتياطية.",
  "A restore was interrupted. The protected recovery copy is still present. Do not clear app storage; tap Retry safely.": "انقطعت الاستعادة. ما زالت نسخة الاسترداد المحمية موجودة. لا تمسح بيانات التطبيق؛ اضغط على إعادة المحاولة بأمان.",
  "Restore did not finish. Keep the app open and use Retry safely to recover the previous records.": "لم تكتمل الاستعادة. أبقِ التطبيق مفتوحًا واستخدم إعادة المحاولة بأمان لاستعادة السجلات السابقة.",
  "Restore could not start safely. Your current records are unchanged; tap Retry safely before continuing.": "تعذّر بدء الاستعادة بأمان. لم تتغير سجلاتك الحالية؛ اضغط على إعادة المحاولة بأمان قبل المتابعة.",
  "Restore did not finish; previous records were retained.": "لم تكتمل الاستعادة؛ تم الاحتفاظ بالسجلات السابقة.",
};

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function translate(key: string, language: AppLanguage): string {
  return language === "ar" ? ARABIC_TRANSLATIONS[key] ?? key : key;
}

export function translateAppText(key: string): string {
  return translate(key, activePreferences.language);
}

export function localeFor(language: AppLanguage): string {
  return language === "ar" ? "ar-SA-u-nu-arab" : "en-US";
}

export function formatNumber(
  value: number,
  language: AppLanguage,
  options: NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatCurrency(
  amount: number,
  currency: string,
  language: AppLanguage,
  options: NumberFormatOptions = {},
): string {
  return `${currency} ${formatNumber(amount, language, options)}`;
}

export function formatAppNumber(value: number, options: NumberFormatOptions = {}): string {
  return formatNumber(value, activePreferences.language, options);
}

export function formatAppCurrency(
  amount: number,
  currency: string,
  options: NumberFormatOptions = {},
): string {
  return formatCurrency(amount, currency, activePreferences.language, options);
}

export function formatAppDate(
  value: Date | string,
  options: CalendarDateOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return formatDisplayDate(value, activePreferences.language, activePreferences.calendar, options);
}

function toLocalDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  return new Date(value);
}

export function formatDisplayDate(
  value: Date | string,
  language: AppLanguage,
  calendar: DisplayCalendar,
  options: CalendarDateOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  const date = toLocalDate(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(localeFor(language), {
    ...options,
    calendar: calendar === "hijri" ? "islamic-umalqura" : "gregory",
    numberingSystem: language === "ar" ? "arab" : "latn",
  }).format(date);
}

/** Normalize only a temporary localized input string; never changes stored data. */
export function normalizeLocalizedNumberInput(value: string): string {
  return value
    .replace(/[٠-٩۰-۹]/g, digit => ARABIC_DIGITS[digit] ?? digit)
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
}

export function parseLocalizedNumberInput(value: string): number | null {
  const normalized = normalizeLocalizedNumberInput(value);
  if (!normalized || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "ar";
}

export function isDisplayCalendar(value: unknown): value is DisplayCalendar {
  return value === "gregorian" || value === "hijri";
}

export function parseDisplayPreferences(raw: string | null): DisplayPreferences {
  if (raw) {
    try {
      const value = JSON.parse(raw) as { language?: unknown; calendar?: unknown };
      return {
        language: isAppLanguage(value.language) ? value.language : "en",
        calendar: isDisplayCalendar(value.calendar) ? value.calendar : "gregorian",
      };
    } catch {
      // Malformed preferences do not affect finance data and use safe defaults.
    }
  }
  return { language: "en", calendar: "gregorian" };
}

export function serializeDisplayPreferences(preferences: DisplayPreferences): string {
  return JSON.stringify(preferences);
}

export function isRightToLeftLanguage(language: AppLanguage): boolean {
  return language === "ar";
}
