/* روزنگار — language switch (فارسی / English).
   The UI is authored in Persian; in English mode every Persian phrase that appears
   in the page (text, placeholders, titles, notifications) is swapped for its English
   counterpart, digits become Latin and the layout flips to left-to-right. */
'use strict';
const EN = {
  'مدل دستیار': 'Assistant model', 'پیش‌فرض سرور': 'Server default', '⏳ در حال خواندن مدل‌ها…': '⏳ Loading models…', 'فهرست مدل‌ها خوانده نشد': 'Could not load the model list', 'مدل در دسترس است': 'models available',
  '✨ خلاصه‌ی صبحگاهی را دستیار هوشمند بنویسد (کار مهم، اولین قرار و وقت‌های آزاد)': '✨ Let the AI assistant write the morning summary (what matters, first appointment, free time)',
  'ساعت': 'Time',
  'کارها': 'Tasks', 'کارهای من': 'My tasks', 'کارهای امروز': "Today's tasks", 'رنگ‌ها': 'Colours', 'صداها': 'Sounds',
  'گروه‌بندی بر اساس تقویم خاموش شد تا هر کار را هر جا بکشید': 'Grouping by calendar is off so you can drag any task anywhere',
  'تکرار یادآوری – وقتی تیک نزده\u200cام': 'Repeat reminder – until I tick it',
  'تکرار یادآوری تا وقتی تیک نزده\u200cام': 'Repeat reminder until I tick it',
  'تکرار یادآوری': 'Repeat reminder',
  'نکته: روی آیفون همیشه می\u200cتوانید از دکمه\u200cی میکروفون کیبورد هم برای نوشتن با صدا استفاده کنید.': "Tip: on iPhone you can always use the keyboard's microphone button to type by voice.",
  'روزنگار بر اساس این اطلاعات دوره\u200cهای بعدی را پیش\u200cبینی می\u200cکند و هر بار که شروع واقعی را ثبت کنید، میانگین را خودش اصلاح می\u200cکند. این اطلاعات فقط روی همین دستگاه می\u200cماند.': 'Rooznegar predicts your next periods from this, and corrects the average each time you log a real start. This stays on this device only.',
  'با وصل کردن Google Drive، رنگ\u200cها، صداها، ترتیب کارها، گزینه\u200cهای تقویم\u200cها، عادت\u200cها و قالب\u200cها در Drive خودتان ذخیره می\u200cشوند. اگر برنامه را پاک کنید یا روی گوشی دیگری نصب کنید، با وصل شدن همه برمی\u200cگردد. اگر قبلاً پشتیبانی داشته\u200cاید، همین الان برگردانده می\u200cشود.': 'Connect Google Drive and your colours, sounds, task order, calendar options, habits and templates are kept in your own Drive. If you delete the app or install it on another phone, everything comes back once you connect. If you had a backup before, it is restored right now.',
  'مثلاً: این هفته باید گزارش ماهانه رو بنویسم (حدود ۳ ساعت)، دوشنبه دکتر برم و آخر هفته خرید خونه کنم': 'e.g. This week I need to write the monthly report (about 3 hours), see the doctor on Monday and do the house shopping at the weekend',
  'پیگیری دوره\u200cی ماهانه': 'Period tracking',
  '🩸 پیگیری دوره\u200cی ماهانه': '🩸 Period tracking',
  '🩸 تنظیمات پیگیری دوره\u200cی ماهانه': '🩸 Period tracking settings',
  'برای خانم\u200cها: روزنگار دوره\u200cهای بعدی را پیش\u200cبینی و یادآوری کند؟': 'For women: should Rooznegar predict and remind upcoming periods?',
  'بله، تنظیم کن': 'Yes, set it up',
  'نه، ممنون': 'No, thanks',
  'مرتب\u200cسازی': 'Sort',
  '🔎 پیدا کردن زمان خالی': '🔎 Find a free slot',
  '💾 ذخیره به\u200cعنوان قالب': '💾 Save as template',
  'شمارش معکوس': 'Countdown',
  'تمام روز': 'All day',
  '📎 پیوست عکس یا فایل': '📎 Attach photo or file',
  '۱ هفته قبل': '1 week before',
  '1 هفته قبل': '1 week before',
  'همان روز': 'Same day',
  'روز قبل': 'Day before',
  'تکرار یادآوری – وقتی تیک نزده\u200cام': 'Repeat reminder – until I tick it',
  'خاموش': 'Off',
  'هر ۵ دقیقه': 'Every 5 min',
  'هر 5 دقیقه': 'Every 5 min',
  'هر 10 دقیقه': 'Every 10 min',
  'هر ۱۰ دقیقه': 'Every 10 min',
  'هر 15 دقیقه': 'Every 15 min',
  'هر ۱۵ دقیقه': 'Every 15 min',
  'هر 30 دقیقه': 'Every 30 min',
  'هر ۳۰ دقیقه': 'Every 30 min',
  'هر ساعت': 'Every hour',
  'گزینه\u200cها': 'Options',
  'این تقویم تیک\u200cزدنی نیست (مثل تعطیلات و تولدها)': 'This calendar is not checkable (like holidays and birthdays)',
  'این تقویم را نشان نده': 'Hide this calendar',
  '⬆ بالاتر': '⬆ Up',
  '⬇ پایین\u200cتر': '⬇ Down',
  'بالاتر': 'Up',
  'پایین\u200cتر': 'Down',
  'نماها': 'Views',
  'گوگل': 'Google',
  'یادآوری': 'Reminders',
  'دستیار و صدا': 'Assistant & voice',
  'فارسی': 'Persian',
  'پس\u200cزمینه': 'Background',
  'یک رنگ': 'Solid colour',
  'طیف دو رنگ': 'Two-colour gradient',
  'رنگ اول': 'First colour',
  'رنگ دوم': 'Second colour',
  'جهت طیف': 'Gradient direction',
  '⬇ بالا به پایین': '⬇ Top to bottom',
  '⬅ راست به چپ': '⬅ Right to left',
  '↘ مورب': '↘ Diagonal',
  '↗ مورب': '↗ Diagonal',
  '◎ دایره\u200cای': '◎ Radial',
  '🖼 انتخاب عکس پس\u200cزمینه': '🖼 Choose background photo',
  'نمایش نام تقویم روی هر کار': 'Show calendar name on each task',
  'نمایش تاریخ دوم (میلادی کنار شمسی، یا برعکس)': 'Show second date (Gregorian next to Persian, or the reverse)',
  'صفحه\u200cی شروع': 'Start page',
  'روز (ساعتی)': 'Day (hourly)',
  'ماه': 'Month',
  'مرتب\u200cسازی پیش\u200cفرض': 'Default sort',
  'زمان': 'Time',
  'دستی': 'Manual',
  'کارهای انجام\u200cشده را در لیست\u200cها نشان نده': 'Hide done tasks in lists',
  'نمایش یا پنهان کردن هر تقویم: از منو، دکمه\u200cی ● کنار اسم تقویم. تنظیمات هر تقویم:': "Show or hide a calendar: the ● button next to its name in the menu. Each calendar's settings:",
  'صدای تیک زدن کار': 'Task done sound',
  'پاپ': 'Pop',
  'کلیک': 'Click',
  'دینگ': 'Ding',
  'موفقیت': 'Success',
  'سکه': 'Coin',
  '▶︎ پخش': '▶︎ Play',
  'خلاصه\u200cی صبحگاهی کارهای امروز': "Morning summary of today's tasks",
  'ساعت قبل': 'hours before', '۱ ساعت قبل': '1 hour before', '۲ ساعت قبل': '2 hours before',
  'سرویس پیش\u200cفرض دستیار': 'Default assistant service',
  'روش تبدیل صدا به متن': 'Speech-to-text method',
  'ضبط و تبدیل در سرور (دقیق، روی آیفون هم کار می\u200cکند)': 'Record and transcribe on the server (accurate, works on iPhone)',
  'تشخیص گفتار خود مرورگر': "Browser's own speech recognition",
  'زبان گفتار': 'Speech language',
  'بعد از گفتن، کار خودکار ساخته شود': 'Create the task automatically after speaking',
  '🎙 آزمایش میکروفون': '🎙 Test microphone',
  'پشتیبان\u200cگیری الان': 'Back up now',
  'بازیابی': 'Restore',
  '📤 ارسال': '📤 Share',
  '✎ ویرایش': '✎ Edit',
  'فعال': 'Enabled',
  'تاریخ شروع آخرین دوره': 'Last period start date',
  'طول چرخه (روز)': 'Cycle length (days)',
  'مدت دوره (روز)': 'Period length (days)',
  'یک روز قبل از شروع یادآوری کن': 'Remind me one day before',
  'امروز شروع شد': 'Started today',
  'فقط همین روز': 'This day only',
  'این روز و روزهای بعد': 'This and following days',
  'همه\u200cی تکرارها': 'All repeats',
  'عادت': 'Habit',
  'ایموجی': 'Emoji',
  'یادآوری روزانه (اختیاری)': 'Daily reminder (optional)',
  'این کار برای شما فرستاده شده است:': 'This task was sent to you:',
  'نه': 'No',
  '＋ افزودن به کارهای من': '＋ Add to my tasks',
  '✨ دستیار برنامه\u200cریزی': '✨ Planning assistant',
  'سرویس': 'Service',
  'برنامه\u200cریزی کن': 'Plan it',
  '↩︎ برگرداندن': '↩︎ Undo',
  '☁️ تنظیمات\u200cتان را نگه داریم؟': '☁️ Keep your settings?',
  'وصل کردن Drive': 'Connect Drive',
  'بعداً': 'Later',
  'نمایش/پنهان': 'Show/hide',
  'منو': 'Menu',
  'جستجو': 'Search',
  'سال قبل': 'Previous year',
  'ماه قبل': 'Previous month',
  'ماه بعد': 'Next month',
  'سال بعد': 'Next year',
  '↩︎ برگشت به امروز': '↩︎ Back to today',
  'این روز کاری نیست': 'Nothing on this day',
  '✓ تنظیمات شما از Google Drive برگردانده شد': '✓ Your settings were restored from Google Drive',
  'تکرارشونده': 'Recurring',
  'ترتیب تقویم\u200cها تغییر کرد': 'Calendar order changed',
  'رنگ نوشته\u200cها': 'Text colour',
  'پیش\u200cفرض': 'Default',
  'گزینه\u200cهای منو': 'Menu items',
  'تیک\u200cدار\u200cها در منو نمایش داده می\u200cشوند': 'Ticked items are shown in the menu',
  'خرید, فوری, پروژه\u200cالف': 'shopping, urgent, project-A',
  // v8/v10 — whole words first so «تاریخ» inside «تاریخچه» isn't half-translated
  'تاریخچه': 'History', 'مرور هفته': 'Weekly review', 'عادت‌ها': 'Habits', 'دستیار هوشمند': 'AI assistant', 'قالب‌ها': 'Templates',
  'مرتب‌سازی بر اساس': 'Sort by', '⏱ زمان': '⏱ Time', '🕘 روز': '🕘 Day', 'الفبا': 'Alphabetical', 'ترتیب تقویم‌ها': 'Calendar order', '✋ دستی': '✋ Manual',
  'همیشه اول بر اساس ترتیب تقویم‌ها': 'Always group by calendar order first', 'کارهای تکرارشونده همیشه بالای لیست': 'Recurring tasks always on top',
  'در حالت دستی کارها را با ⋮⋮ بکشید؛ ترتیب برای همیشه و برای همه‌ی روزها (حتی تکرارها) ذخیره می‌شود.': 'In manual mode drag tasks by ⋮⋮; the order is saved for good, for every day (recurring ones too).',
  'ترتیب دستی ذخیره شد': 'Manual order saved', 'کارها را با ⋮⋮ بکشید و جابه‌جا کنید': 'Drag tasks by ⋮⋮ to reorder',
  'گزینه‌های منو': 'Menu items', 'تیک‌دار‌ها در منو نمایش داده می‌شوند': 'Checked items are shown in the menu',
  'رنگ نوشته‌ها': 'Text colour', 'پیش‌فرض': 'Default',
  // navigation & headers
  'روزنگار': 'Rooznegar', 'امروز': 'Today', 'پیش‌رو': 'Upcoming', 'هفته': 'Week', 'تقویم ماهانه': 'Month', 'تقویم': 'Calendar',
  'آمار': 'Stats', 'آمار و گزارش': 'Stats & reports', 'همه کارها': 'All tasks', 'انجام‌شده': 'Done', 'این هفته': 'This week',
  'دسته‌ها': 'Categories', 'دسته جدید': 'New category', 'تنظیمات': 'Settings', 'درباره': 'About', 'حریم خصوصی': 'Privacy', 'شرایط': 'Terms',
  'گوگل متصل نیست': 'Google not connected', 'در حال اتصال…': 'Connecting…', 'در حال همگام‌سازی…': 'Syncing…', 'همگام': 'Synced',
  'خطای همگام‌سازی': 'Sync error', 'نیاز به ورود مجدد': 'Sign-in needed', 'جستجو…': 'Search…',
  'مثلاً: فردا ساعت ۵ عصر جلسه تیم هر دوشنبه #کار !': 'Add a task… (tip: #category, ! = important)',
  'جزئیات': 'Details', 'افزودن': 'Add', 'کار جدید': 'New task',
  // lists
  'عقب‌افتاده': 'Overdue', 'بدون تاریخ': 'No date', 'امروز کاری نداری': 'Nothing for today', 'دو ماه آینده خالیه': 'Next two months are free',
  'چیزی نیست': 'Nothing here', 'کاری نیست': 'Nothing planned', 'فردا': 'Tomorrow', 'افزودن کار برای این روز': 'Add a task for this day',
  'کارها را با کشیدن بین روزها جابه‌جا کنید.': 'Drag tasks between days to reschedule.', 'روزانه': 'Daily', 'هفتگی': 'Weekly', 'ماهانه': 'Monthly', 'سالانه': 'Yearly',
  // editor
  'ویرایش کار': 'Edit task', 'عنوان': 'Title', 'یادداشت': 'Notes', 'تاریخ': 'Date', 'ساعت شروع': 'Start time', 'مدت (دقیقه)': 'Duration (min)',
  'دسته': 'Category', 'بدون دسته': 'No category', 'اولویت': 'Priority', 'عادی': 'Normal', 'مهم': 'Important', 'فوری': 'Urgent',
  'رنگ اختصاصی': 'Custom color', 'برچسب‌ها (با کاما جدا کنید)': 'Tags (comma separated)', 'لینک / پیوست': 'Link / attachment',
  'زیرکارها': 'Sub-tasks', 'زیرکار جدید و Enter': 'New sub-task, then Enter', 'تکرار': 'Repeat', 'نوع': 'Type', 'بدون تکرار': 'Does not repeat',
  'هر چند': 'Every', 'تا تاریخ': 'Until', 'یادآوری‌ها': 'Reminders', 'سر وقت': 'At start time', 'افزودن یادآوری': 'Add reminder', 'بدون یادآوری': 'No reminders',
  'زنگ': 'Sound', 'پخش': 'Play', 'از دسته/پیش‌فرض': 'From category / default', 'حذف': 'Delete', 'تمرکز': 'Focus', 'انصراف': 'Cancel', 'ذخیره': 'Save',
  'ذخیره شد': 'Saved', 'حذف شود؟': 'Delete this task?', 'این کار تکراری است؛ شروع کل تکرارها جابه‌جا شود؟': 'This task repeats. Move the whole series?',
  'جابه‌جا شد': 'Moved', '(بدون عنوان)': '(no title)',
  // category dialog
  'نام': 'Name', 'رنگ': 'Color', 'زنگ پیش‌فرض این دسته': 'Default sound for this category', 'دسته حذف شود؟ (کارها باقی می‌مانند)': 'Delete this category? (tasks are kept)',
  'کار': 'Work', 'شخصی': 'Personal', 'سلامتی': 'Health',
  // settings
  'ظاهر': 'Appearance', 'تم': 'Theme', 'خودکار': 'Auto', 'تیره': 'Dark', 'روشن': 'Light', 'رنگ اصلی': 'Accent color', 'گردی گوشه‌ها': 'Corner radius',
  'تقویم نمایش': 'Calendar', 'شمسی': 'Persian (Jalali)', 'میلادی': 'Gregorian', 'شروع هفته': 'Week starts on', 'زبان': 'Language',
  'گوگل کلندر': 'Google Calendar', 'فاصله همگام‌سازی (ثانیه)': 'Sync interval (seconds)', 'اتصال به گوگل': 'Connect to Google',
  'همگام‌سازی الان': 'Sync now', 'قطع اتصال': 'Disconnect', 'اعلان و صدا': 'Notifications & sound', 'زنگ پیش‌فرض': 'Default sound', 'صدا': 'Volume',
  'لرزش': 'Vibrate', 'اجازه اعلان': 'Allow notifications', 'اعلان آزمایشی': 'Test notification',
  'آپلود زنگ دلخواه (mp3/wav، حداکثر ۷۰۰KB)': 'Upload custom sound (mp3/wav, max 700KB)', 'مدت تمرکز (دقیقه)': 'Focus length (min)', 'Snooze (دقیقه)': 'Snooze (min)',
  'نمایش تعطیلات رسمی ایران': 'Show Iranian public holidays', 'داده': 'Data', 'خروجی JSON': 'Export JSON', 'ورودی JSON': 'Import JSON', 'بستن': 'Close',
  '🔔 فعال‌سازی یادآوری در پس‌زمینه': '🔔 Enable background reminders', '🔕 خاموش کردن یادآوری پس‌زمینه': '🔕 Turn off background reminders',
  'با این گزینه یادآوری‌ها حتی وقتی برنامه بسته است روی گوشی، تبلت و Apple Watch می‌آیند.': 'Reminders arrive even when the app is closed — on phone, tablet and Apple Watch.',
  '✓ فعال است — یادآوری‌ها حتی با برنامه‌ی بسته می‌آیند (و روی Apple Watch هم نمایش داده می‌شوند).': '✓ On — reminders arrive even when the app is closed (and show on Apple Watch).',
  'در آیفون/آیپد اول برنامه را نصب کنید: در Safari دکمه‌ی Share ← Add to Home Screen، بعد برنامه را از صفحه‌ی اصلی باز کنید.': 'On iPhone/iPad, install the app first: in Safari tap Share → Add to Home Screen, then open it from the Home Screen.',
  'این مرورگر از اعلان پس‌زمینه پشتیبانی نمی‌کند.': 'This browser does not support background notifications.',
  // sounds
  'زنگوله': 'Chime', 'ناقوس': 'Bell', 'دیجیتال': 'Digital', 'ماریمبا': 'Marimba', 'نرم': 'Soft', 'هشدار': 'Alarm', 'پرنده': 'Bird', 'بی‌صدا': 'Silent', 'زنگ دلخواه (آپلودی)': 'Custom (uploaded)',
  // toasts & notifications
  'به گوگل وصل شد': 'Connected to Google', 'اعلان فعال شد': 'Notifications enabled', 'اجازه داده نشد': 'Permission denied', 'اجازه‌ی اعلان داده نشد': 'Notification permission denied',
  'اعلان آزمایشی ': 'Test notification', 'همه چیز درسته ✨': 'Everything works ✨', 'وارد شد': 'Imported', 'فایل نامعتبر': 'Invalid file',
  'اول Client ID را در تنظیمات وارد کنید': 'Enter the Client ID in Settings first', 'برای دیدن همه تقویم‌ها یک بار «اتصال به گوگل» را دوباره بزنید': 'Tap “Connect to Google” once more to see all your calendars',
  '✓ یادآوری پس‌زمینه فعال شد': '✓ Background reminders on', 'یادآوری پس‌زمینه خاموش شد': 'Background reminders off', 'یادآوری دوباره': 'Reminder again',
  'زنگ دلخواه ذخیره شد — در فهرست زنگ‌ها «زنگ دلخواه» را انتخاب کنید': 'Custom sound saved — choose “Custom” in the sound list', 'فایل بزرگ‌تر از ۷۰۰ کیلوبایت است': 'File is larger than 700 KB',
  '✓ انجام شد': '✓ Done', '⏰ بعداً': '⏰ Later', 'یادآوری دارید — برنامه را باز کنید': 'You have a reminder — open the app',
  // focus
  '⏸ توقف': '⏸ Pause', '▶ ادامه': '▶ Resume', '✕ پایان': '✕ Stop', '🍅 پایان زمان تمرکز': '🍅 Focus session done', 'یک استراحت کوتاه!': 'take a short break!',
  // stats
  'انجام‌شده در ۷ روز': 'Done in 7 days', 'روز پشت‌سرهم': 'Day streak', 'کار باز': 'Open tasks', 'دقیقه تمرکز این هفته': 'Focus minutes this week',
  '۱۴ روز اخیر': 'Last 14 days', 'بر اساس دسته': 'By category',
  'شنبه': 'Saturday', 'یکشنبه': 'Sunday', 'دوشنبه': 'Monday', 'سه‌شنبه': 'Tuesday', 'چهارشنبه': 'Wednesday', 'پنجشنبه': 'Thursday', 'جمعه': 'Friday',
  // holidays
  'نوروز': 'Nowruz', 'روز جمهوری اسلامی': 'Islamic Republic Day', 'سیزده‌بدر': 'Sizdah Bedar', 'رحلت امام خمینی': 'Death of Khomeini',
  'قیام ۱۵ خرداد': '15 Khordad uprising', 'پیروزی انقلاب': 'Revolution Day', 'ملی شدن صنعت نفت': 'Oil Nationalization Day',
};
// phrases with numbers
const EN_RULES = [
  [/([\d۰-۹]+) دقیقه قبل/g, '$1 min before'], [/([\d۰-۹]+) ساعت قبل/g, '$1 h before'], [/([\d۰-۹]+) روز قبل/g, '$1 day before'],
  [/([\d۰-۹]+) دقیقه دیگر یادآوری می‌شود/g, 'Reminding again in $1 min'], [/ساعت ([\d۰-۹:]+)/g, 'at $1'], [/ تا /g, ' – '],
  [/خطای ورود: /g, 'Sign-in error: '], [/ورود لغو شد: /g, 'Sign-in cancelled: '], [/خطا: /g, 'Error: '], [/ — /g, ' — '],
];
const EN_KEYS = Object.keys(EN).sort((a, b) => b.length - a.length);
const HAS_FA = /[؀-ۿ]/;
const isEN = () => state.settings.lang === 'en';
// a key only matches as a whole word: «نام» must never turn «برنامه» into «برNameه»
const KEY_RE = {}, FA_L = '\\u0600-\\u06FF\\u200c';
const reEsc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keyRe = k => KEY_RE[k] ||= new RegExp('(?<![' + FA_L + '])' + reEsc(k) + '(?![' + FA_L + '])', 'g');
function tr(s) {
  if (!isEN() || !s || typeof s !== 'string') return s;
  if (HAS_FA.test(s)) {
    const t = s.trim();
    if (EN[t] !== undefined) s = s.replace(t, EN[t]);
    else { for (const k of EN_KEYS) if (k.length > 2 && s.includes(k)) s = s.replace(keyRe(k), EN[k]); for (const [re, to] of EN_RULES) s = s.replace(re, to); }
  }
  return s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}
function trNode(root) {
  if (!isEN()) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const v = n.nodeValue; if (!v.trim()) continue;
    const p = n.parentElement; if (p && (p.closest('script,style,textarea') || p.isContentEditable)) continue;
    if (p && p.closest('.task .t, .ev, .uc, .sub span, input')) continue; // never translate user content (task titles)
    let t = v.trim() === '→' ? '←' : v.trim() === '←' ? '→' : null; // arrows flip with direction
    const out = t ? v.replace(v.trim(), t) : tr(v);
    if (out !== v) n.nodeValue = out;
  }
  const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
  for (const el of els) for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); if (v && HAS_FA.test(v)) el.setAttribute(a, tr(v)); }
}
function applyLang() {
  const en = isEN();
  document.documentElement.lang = en ? 'en' : 'fa';
  document.documentElement.dir = en ? 'ltr' : 'rtl';
  document.title = en ? 'Rooznegar' : 'روزنگار';
  if (en) trNode(document.body);
}
// translate everything the app renders, as it renders it
new MutationObserver(ms => {
  if (!isEN()) return;
  for (const m of ms) {
    if (m.type === 'characterData') { const v = m.target.nodeValue, o = tr(v); if (o !== v) m.target.nodeValue = o; }
    for (const n of m.addedNodes) n.nodeType === 1 ? trNode(n) : n.nodeType === 3 && trNode(n.parentElement || document.body);
  }
}).observe(document.body, { childList: true, subtree: true, characterData: true });
// notifications, confirms and prompts
const _notifyI = notify; notify = o => _notifyI({ ...o, title: tr(o.title), body: tr(o.body) });
const _confirm = window.confirm.bind(window); window.confirm = m => _confirm(tr(m));
// language picker in Settings
(() => {
  const f = $('#setForm'), sel = f.lang;
  $('#openSettings').addEventListener('click', () => { sel.value = state.settings.lang || 'fa'; });
  sel.addEventListener('change', () => {
    state.settings.lang = sel.value; save();
    location.reload(); // simplest way to rebuild every label in the new language
  });
})();
applyLang();
