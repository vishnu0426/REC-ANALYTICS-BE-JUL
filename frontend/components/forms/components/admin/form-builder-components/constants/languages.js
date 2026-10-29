// Language catalog for the multilingual form builder.
// Every language is listed by its endonym (the name speakers use for their
// own language), plus an English name for searchability.
// `rtl: true` marks right-to-left scripts (drives dir="rtl" when filling).

export const LANGUAGES = [
    { code: 'en', native: 'English', english: 'English', rtl: false },
    { code: 'es', native: 'Español', english: 'Spanish', rtl: false },
    { code: 'fr', native: 'Français', english: 'French', rtl: false },
    { code: 'de', native: 'Deutsch', english: 'German', rtl: false },
    { code: 'it', native: 'Italiano', english: 'Italian', rtl: false },
    { code: 'pt', native: 'Português', english: 'Portuguese', rtl: false },
    { code: 'nl', native: 'Nederlands', english: 'Dutch', rtl: false },
    { code: 'ru', native: 'Русский', english: 'Russian', rtl: false },
    { code: 'uk', native: 'Українська', english: 'Ukrainian', rtl: false },
    { code: 'be', native: 'Беларуская', english: 'Belarusian', rtl: false },
    { code: 'pl', native: 'Polski', english: 'Polish', rtl: false },
    { code: 'cs', native: 'Čeština', english: 'Czech', rtl: false },
    { code: 'sk', native: 'Slovenčina', english: 'Slovak', rtl: false },
    { code: 'hu', native: 'Magyar', english: 'Hungarian', rtl: false },
    { code: 'ro', native: 'Română', english: 'Romanian', rtl: false },
    { code: 'bg', native: 'Български', english: 'Bulgarian', rtl: false },
    { code: 'sr', native: 'Српски', english: 'Serbian', rtl: false },
    { code: 'hr', native: 'Hrvatski', english: 'Croatian', rtl: false },
    { code: 'bs', native: 'Bosanski', english: 'Bosnian', rtl: false },
    { code: 'sl', native: 'Slovenščina', english: 'Slovenian', rtl: false },
    { code: 'mk', native: 'Македонски', english: 'Macedonian', rtl: false },
    { code: 'el', native: 'Ελληνικά', english: 'Greek', rtl: false },
    { code: 'sq', native: 'Shqip', english: 'Albanian', rtl: false },
    { code: 'et', native: 'Eesti', english: 'Estonian', rtl: false },
    { code: 'lv', native: 'Latviešu', english: 'Latvian', rtl: false },
    { code: 'lt', native: 'Lietuvių', english: 'Lithuanian', rtl: false },
    { code: 'da', native: 'Dansk', english: 'Danish', rtl: false },
    { code: 'sv', native: 'Svenska', english: 'Swedish', rtl: false },
    { code: 'no', native: 'Norsk', english: 'Norwegian', rtl: false },
    { code: 'fi', native: 'Suomi', english: 'Finnish', rtl: false },
    { code: 'is', native: 'Íslenska', english: 'Icelandic', rtl: false },
    { code: 'ga', native: 'Gaeilge', english: 'Irish', rtl: false },
    { code: 'cy', native: 'Cymraeg', english: 'Welsh', rtl: false },
    { code: 'ca', native: 'Català', english: 'Catalan', rtl: false },
    { code: 'gl', native: 'Galego', english: 'Galician', rtl: false },
    { code: 'eu', native: 'Euskara', english: 'Basque', rtl: false },
    { code: 'lb', native: 'Lëtzebuergesch', english: 'Luxembourgish', rtl: false },
    { code: 'mt', native: 'Malti', english: 'Maltese', rtl: false },
    { code: 'fy', native: 'Frysk', english: 'Frisian', rtl: false },
    { code: 'tr', native: 'Türkçe', english: 'Turkish', rtl: false },
    { code: 'az', native: 'Azərbaycanca', english: 'Azerbaijani', rtl: false },
    { code: 'kk', native: 'Қазақ тілі', english: 'Kazakh', rtl: false },
    { code: 'uz', native: "O'zbekcha", english: 'Uzbek', rtl: false },
    { code: 'mn', native: 'Монгол хэл', english: 'Mongolian', rtl: false },
    { code: 'ka', native: 'ქართული', english: 'Georgian', rtl: false },
    { code: 'hy', native: 'Հայերեն', english: 'Armenian', rtl: false },
    { code: 'zh-CN', native: '简体中文', english: 'Chinese (Simplified)', rtl: false },
    { code: 'zh-TW', native: '繁體中文', english: 'Chinese (Traditional)', rtl: false },
    { code: 'ja', native: '日本語', english: 'Japanese', rtl: false },
    { code: 'ko', native: '한국어', english: 'Korean', rtl: false },
    { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese', rtl: false },
    { code: 'th', native: 'ไทย', english: 'Thai', rtl: false },
    { code: 'lo', native: 'ລາວ', english: 'Lao', rtl: false },
    { code: 'km', native: 'ខ្មែរ', english: 'Khmer', rtl: false },
    { code: 'my', native: 'မြန်မာဘာသာ', english: 'Burmese', rtl: false },
    { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', rtl: false },
    { code: 'ms', native: 'Bahasa Melayu', english: 'Malay', rtl: false },
    { code: 'tl', native: 'Tagalog', english: 'Tagalog', rtl: false },
    { code: 'fil', native: 'Filipino', english: 'Filipino', rtl: false },
    { code: 'jv', native: 'Jawa', english: 'Javanese', rtl: false },
    { code: 'su', native: 'Basa Sunda', english: 'Sundanese', rtl: false },
    { code: 'hi', native: 'हिन्दी', english: 'Hindi', rtl: false },
    { code: 'bn', native: 'বাংলা', english: 'Bengali', rtl: false },
    { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi', rtl: false },
    { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', rtl: false },
    { code: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia', rtl: false },
    { code: 'ta', native: 'தமிழ்', english: 'Tamil', rtl: false },
    { code: 'te', native: 'తెలుగు', english: 'Telugu', rtl: false },
    { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', rtl: false },
    { code: 'ml', native: 'മലയാളം', english: 'Malayalam', rtl: false },
    { code: 'ne', native: 'नेपाली', english: 'Nepali', rtl: false },
    { code: 'si', native: 'සිංහල', english: 'Sinhala', rtl: false },
    { code: 'ur', native: 'اردو', english: 'Urdu', rtl: true },
    { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true },
    { code: 'fa', native: 'فارسی', english: 'Persian', rtl: true },
    { code: 'he', native: 'עברית', english: 'Hebrew', rtl: true },
    { code: 'ps', native: 'پښتو', english: 'Pashto', rtl: true },
    { code: 'sd', native: 'سنڌي', english: 'Sindhi', rtl: true },
    { code: 'ku', native: 'کوردی', english: 'Kurdish', rtl: true },
    { code: 'yi', native: 'ייִדיש', english: 'Yiddish', rtl: true },
    { code: 'dv', native: 'ދިވެހި', english: 'Dhivehi', rtl: true },
    { code: 'ug', native: 'ئۇيغۇرچە', english: 'Uyghur', rtl: true },
    { code: 'sw', native: 'Kiswahili', english: 'Swahili', rtl: false },
    { code: 'am', native: 'አማርኛ', english: 'Amharic', rtl: false },
    { code: 'ha', native: 'Hausa', english: 'Hausa', rtl: false },
    { code: 'yo', native: 'Yorùbá', english: 'Yoruba', rtl: false },
    { code: 'ig', native: 'Igbo', english: 'Igbo', rtl: false },
    { code: 'zu', native: 'isiZulu', english: 'Zulu', rtl: false },
    { code: 'xh', native: 'isiXhosa', english: 'Xhosa', rtl: false },
    { code: 'af', native: 'Afrikaans', english: 'Afrikaans', rtl: false },
    { code: 'so', native: 'Soomaali', english: 'Somali', rtl: false },
    { code: 'ht', native: 'Kreyòl ayisyen', english: 'Haitian Creole', rtl: false },
];

export const DEFAULT_LANGUAGE = 'en';

export const getLanguage = (code) => {
    const found = LANGUAGES.find((l) => l.code === code);
    if (found) return found;
    // Unknown/extra code: still render something sensible in its own code
    if (code) return { code, native: code, english: code, rtl: false };
    return LANGUAGES.find((l) => l.code === 'en');
};

// Options for antd Selects: shown in the language's own script, English in
// parentheses so mixed-script lists stay scannable ("हिन्दी (Hindi)").
export const languageOptions = (codes) =>
    (codes || LANGUAGES.map((l) => l.code)).map((code) => {
        const l = getLanguage(code);
        return { value: l.code, label: `${l.native} (${l.english})`, rtl: l.rtl };
    });

export const isRTL = (code) => !!getLanguage(code).rtl;
