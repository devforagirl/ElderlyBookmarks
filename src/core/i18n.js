import { LOCALES } from './locales_data.js';

let currentLang = 'en';

/**
 * Sets the current application language
 * @param {string} lang - The language code (e.g., 'en', 'zh_CN', 'auto')
 */
export function setLanguage(lang) {
    currentLang = lang;
}

/**
 * Translates a key into the current language
 * @param {string} key - The translation key
 * @param {Array} [placeholders=[]] - Values to replace placeholders (e.g., $TITLE$)
 * @returns {string} The translated text
 */
export function t(key, placeholders = []) {
    let lang = currentLang;

    // If auto, detect browser language
    if (lang === 'auto') {
        const uiLang = chrome.i18n.getUILanguage(); // e.g. "en-US", "zh-CN"
        // Try exact match first
        if (LOCALES[uiLang]) {
            lang = uiLang;
        } else {
            // Try prefix match (e.g. "en-GB" -> "en")
            const prefix = uiLang.split('-')[0];
            if (LOCALES[prefix]) {
                lang = prefix;
            } else {
                // Fallback to zh_CN for "zh" if not zh_TW
                if (prefix === 'zh') lang = 'zh_CN';
                else lang = 'en'; // Ultimate fallback
            }
        }
        // Ensure the mapped lang actually exists in our LOCALES
        if (!LOCALES[lang]) lang = 'en';
    }

    const dict = LOCALES[lang] || LOCALES['en'];
    let message = dict[key] || key;

    // Handle specific replacements (e.g., $TITLE$)
    if (key === 'msgDeleteConfirm' && placeholders.length > 0) {
        return message.replace('$TITLE$', placeholders[0]);
    }

    return message;
}

/**
 * Returns the current language
 * @returns {string}
 */
export function getCurrentLanguage() {
    return currentLang;
}
