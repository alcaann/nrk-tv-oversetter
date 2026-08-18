/**
 * Target languages for translation.
 *
 * There is no API for asking the browser which languages it supports, so we keep a
 * superset of candidates here and probe each one with Translator.availability() at
 * runtime, discarding anything that reports 'unavailable'. That matters because the
 * supported set differs sharply between browsers - Chrome documents around 44
 * languages, Edge 148 claims 145+ - and it changes as those browsers are updated.
 * Probing means the dropdown follows the browser instead of this file.
 *
 * Note that availability() cannot tell us whether a model is already downloaded:
 * Chrome deliberately reports every pair as 'downloadable' until the calling origin
 * creates a translator for it, as an anti-fingerprinting measure. Only 'unavailable'
 * is a truthful signal, which is exactly the one we need here.
 */

export interface LanguageOption {
  code: string;
  name: string;
  native?: string;
}

export const CANDIDATE_LANGUAGES: LanguageOption[] = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'ca', name: 'Catalan', native: 'Català' },
  { code: 'ceb', name: 'Cebuano' },
  { code: 'co', name: 'Corsican' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'cy', name: 'Welsh', native: 'Cymraeg' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'et', name: 'Estonian', native: 'Eesti' },
  { code: 'eu', name: 'Basque', native: 'Euskara' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'fy', name: 'Frisian' },
  { code: 'ga', name: 'Irish', native: 'Gaeilge' },
  { code: 'gd', name: 'Scots Gaelic' },
  { code: 'gl', name: 'Galician', native: 'Galego' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ha', name: 'Hausa' },
  { code: 'haw', name: 'Hawaiian' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'hmn', name: 'Hmong' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'hy', name: 'Armenian', native: 'Հայերեն' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ig', name: 'Igbo' },
  { code: 'is', name: 'Icelandic', native: 'Íslenska' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'jv', name: 'Javanese' },
  { code: 'ka', name: 'Georgian', native: 'ქართული' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'km', name: 'Khmer', native: 'ខ្មែរ' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ku', name: 'Kurdish' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'la', name: 'Latin' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'lo', name: 'Lao', native: 'ລາວ' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuvių' },
  { code: 'lv', name: 'Latvian', native: 'Latviešu' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'mi', name: 'Maori' },
  { code: 'mk', name: 'Macedonian', native: 'Македонски' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'mt', name: 'Maltese', native: 'Malti' },
  { code: 'my', name: 'Burmese' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'no', name: 'Norwegian', native: 'Norsk' },
  { code: 'ny', name: 'Chichewa' },
  { code: 'or', name: 'Odia' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'ps', name: 'Pashto' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'si', name: 'Sinhala', native: 'සිංහල' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', native: 'Slovenščina' },
  { code: 'sm', name: 'Samoan' },
  { code: 'sn', name: 'Shona' },
  { code: 'so', name: 'Somali' },
  { code: 'sq', name: 'Albanian', native: 'Shqip' },
  { code: 'sr', name: 'Serbian', native: 'Српски' },
  { code: 'st', name: 'Sesotho' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'tg', name: 'Tajik' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'tl', name: 'Filipino' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'tt', name: 'Tatar' },
  { code: 'ug', name: 'Uyghur' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'zu', name: 'Zulu' }
];

/**
 * Chrome's documented set, used only when probing is impossible (no Translator
 * object in this context and no cached result yet). Conservative on purpose:
 * better to offer too few than to offer languages that silently fail.
 */
const FALLBACK_CODES = [
  'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi',
  'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'mr', 'nl', 'no', 'pl', 'pt',
  'ro', 'ru', 'sk', 'sl', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh', 'zh-Hant'
];

const CACHE_KEY = 'supportedLanguagesCache';

interface LanguageCache {
  /** Re-probe when the browser updates, since the supported set can change */
  userAgent: string;
  sourceLanguage: string;
  codes: string[];
}

const byCode = new Map(CANDIDATE_LANGUAGES.map((l) => [l.code, l]));

export function getLanguageName(code: string): string {
  const match = byCode.get(code);
  return match ? match.name : code;
}

export function getLanguageLabel(lang: LanguageOption): string {
  return lang.native ? `${lang.name} (${lang.native})` : lang.name;
}

function toOptions(codes: string[]): LanguageOption[] {
  return codes
    .map((c) => byCode.get(c))
    .filter((l): l is LanguageOption => l !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readCache(sourceLang: string): Promise<string[] | null> {
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const cache: LanguageCache | undefined = stored[CACHE_KEY];
    if (
      cache &&
      cache.userAgent === navigator.userAgent &&
      cache.sourceLanguage === sourceLang &&
      Array.isArray(cache.codes) &&
      cache.codes.length > 0
    ) {
      return cache.codes;
    }
  } catch {
    // Cache is an optimisation; failing to read it is not an error
  }
  return null;
}

async function writeCache(sourceLang: string, codes: string[]): Promise<void> {
  try {
    const cache: LanguageCache = {
      userAgent: navigator.userAgent,
      sourceLanguage: sourceLang,
      codes
    };
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  } catch {
    // Not fatal - we just re-probe next time
  }
}

/**
 * Ask the browser which of our candidates it can translate the source language into.
 * Returns an empty array when the Translator API is not reachable from this context.
 */
export async function probeSupportedLanguages(sourceLang: string): Promise<string[]> {
  const api = (globalThis as any).Translator;
  if (!api || typeof api.availability !== 'function') {
    return [];
  }

  const supported: string[] = [];
  const BATCH = 12;

  for (let i = 0; i < CANDIDATE_LANGUAGES.length; i += BATCH) {
    const batch = CANDIDATE_LANGUAGES.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (lang) => {
        if (lang.code === sourceLang) {
          return null;
        }
        try {
          const availability = await api.availability({
            sourceLanguage: sourceLang,
            targetLanguage: lang.code
          });
          // 'unavailable' is the only truthful negative; everything else means usable
          return availability && availability !== 'unavailable' ? lang.code : null;
        } catch {
          return null;
        }
      })
    );
    for (const code of results) {
      if (code) {
        supported.push(code);
      }
    }
  }

  return supported;
}

/**
 * The languages to offer in the UI, cached per browser version.
 */
export async function getSupportedLanguages(sourceLang: string): Promise<LanguageOption[]> {
  const cached = await readCache(sourceLang);
  if (cached) {
    return toOptions(cached);
  }

  const probed = await probeSupportedLanguages(sourceLang);
  if (probed.length > 0) {
    await writeCache(sourceLang, probed);
    return toOptions(probed);
  }

  return toOptions(FALLBACK_CODES.filter((c) => c !== sourceLang));
}

/**
 * Fill a <select> with language options, preserving the current selection when the
 * language is still supported.
 */
export function populateLanguageSelect(
  select: HTMLSelectElement,
  languages: LanguageOption[],
  selectedCode: string
): void {
  select.innerHTML = '';
  for (const lang of languages) {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = getLanguageLabel(lang);
    select.appendChild(option);
  }

  if (languages.some((l) => l.code === selectedCode)) {
    select.value = selectedCode;
  } else if (languages.length > 0) {
    select.value = languages[0].code;
  }
}
