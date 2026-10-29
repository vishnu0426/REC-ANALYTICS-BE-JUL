// i18n helpers for the multilingual form builder.
//
// Storage model (inside form_content):
//   languages:        ['en', 'hi', 'ar']          selected languages
//   default_language: 'en'                         the source language
//   field.label / field.description / field.placeholder
//                     -> text in the DEFAULT language (source of truth)
//   field.translations = {
//     hi: { label, description, placeholder },
//     ar: { ... },
//   }   -> per-language overrides; missing entries fall back to the default
//
// Rendering never needs to know any of this: pre-localize the fields array
// with localizeFields() before handing it to FormRenderer.

import { apolloClient } from '../config.js';
import { TRANSLATE_TEXTS } from '../components/admin/form-builder-components/graphql/queries.js';
import { getLanguage, isRTL } from '../components/admin/form-builder-components/constants/languages.js';

export { isRTL };

// Repair UTF-8 text that was mis-decoded as latin-1/cp1252 ('à®•...'). Returns
// the repaired text, or '' when it can't be repaired (caller falls back).
const MOJIBAKE = /[ÂÃà][\u0080-¿ŒœŠšŸŽžƒˆ˜–-›€™®¯°±²³´µ¶·¸¹º»¼½¾¿]/;
export const fixMojibake = (text) => {
    if (typeof text !== 'string' || !MOJIBAKE.test(text)) return text;
    try {
        const cp1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
        const bytes = Uint8Array.from(Array.from(text), (ch) => {
            const c = ch.codePointAt(0);
            if (c <= 0xff) return c;
            if (cp1252[c] != null) return cp1252[c];
            throw new Error('not mojibake');
        });
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return '';
    }
};

// Resolve one piece of field text for `lang`, falling back to default language.
export const fieldText = (field, key, lang, defaultLang) => {
    if (!lang || lang === defaultLang) return field[key];
    const t = field.translations?.[lang]?.[key];
    return t != null && t !== '' ? t : field[key];
};

// Return a localized copy of the fields array (label, description, placeholder,
// plus option labels when translated). Safe to pass straight to FormRenderer /
// getMissingRequiredFields. Originals are never mutated.
export const localizeFields = (fields, lang, defaultLang) => {
    if (!lang || !fields) return fields;
    return fields.map((f) => {
        const t = f.translations?.[lang];
        if (!t) return f;
        const out = { ...f };
        if (t.label != null && t.label !== '') out.label = t.label;
        if (t.description != null && t.description !== '') out.description = t.description;
        if (t.placeholder != null && t.placeholder !== '') out.placeholder = t.placeholder;
        if (Array.isArray(t.option_labels) && Array.isArray(f.options)) {
            out.options = f.options.map((o, i) =>
                typeof o === 'object' && fixMojibake(t.option_labels[i])
                    ? { ...o, label: fixMojibake(t.option_labels[i]) }
                    : o
            );
        }
        return out;
    });
};

// Ask the backend to translate texts into `target` (Google Translate →
// MyMemory fallback, no API key). Returns the translated array, or null if
// the service is unreachable so callers can keep manual edits untouched.
export const translateTexts = async (texts, target, source = 'en') => {
    const clean = texts.map((t) => (t == null ? '' : String(t)));
    if (!clean.some((t) => t.trim()) || !target || target === source) return clean;
    try {
        const { data } = await apolloClient.query({
            query: TRANSLATE_TEXTS,
            variables: { texts: clean, target, source },
            fetchPolicy: 'no-cache',
        });
        const out = data?.translateTexts;
        if (!Array.isArray(out)) return null;
        // null entries = failed translations: keep the source text visible
        return out.map((t, i) => (t == null || t === '' ? clean[i] : t));
    } catch {
        return null;
    }
};

// True when the field has no translation yet for `lang` (auto-translate hook).
export const needsTranslation = (field, lang, defaultLang) => {
    if (!lang || lang === defaultLang) return false;
    const t = field.translations?.[lang];
    return !t || t.label == null || t.label === '';
};

// ---- Per-field texts -------------------------------------------------------
// A field's translatable texts are: label, description, placeholder, plus the
// labels of its options (dropdown/radio/checkbox/segmented) when present.
const fieldTexts = (field) => {
    const base = [field.label || '', field.description || '', field.placeholder || ''];
    if (Array.isArray(field.options)) {
        field.options.forEach((o) => base.push(typeof o === 'object' ? o.label || '' : ''));
    }
    return base;
};

// Apply a texts array returned from translateTexts() back onto the field.
const applyFieldTexts = (field, res) => {
    const [label, description, placeholder, ...optionLabels] = res;
    const out = {
        ...field,
        translations: {
            ...field.translations,
            [field.__targetLang]: {
                label: label || field.label || '',
                description: description || '',
                placeholder: placeholder || '',
            },
        },
    };
    if (optionLabels.length && Array.isArray(field.options)) {
        // unrepairable garbage -> '' so renderer falls back to the source label
        out.translations[field.__targetLang].option_labels = optionLabels.map(fixMojibake);
    }
    delete out.__targetLang;
    return out;
};

// Build the texts array + apply the result for one field/language.
// Returns updated field object (or the original when nothing to do/failed).
// `force` retranslates even an existing translation (manual "translate again").
export const translateFieldTo = async (field, lang, defaultLang, { force = false } = {}) => {
    if (!lang || lang === defaultLang) return field;
    if (!force && !needsTranslation(field, lang, defaultLang)) return field;
    const res = await translateTexts(fieldTexts(field), lang, defaultLang);
    if (!res) return field;
    return applyFieldTexts({ ...field, __targetLang: lang }, res);
};

/**
 * Auto-translate every field into every non-default language, filling only
 * MISSING translations (existing text — manual edits included — is never
 * overwritten unless `force` is set). One batched request per language.
 *
 * Returns { fields, translatedCount, failed } so callers can toast the result.
 */
export const autoTranslateFields = async (fields, languages, defaultLang, { force = false } = {}) => {
    const list = [...(fields || [])];
    const langs = (languages || []).filter((l) => l !== defaultLang);
    let translatedCount = 0;
    let failed = false;

    for (const lang of langs) {
        // Which fields need translating, and what text layout each has
        const plan = [];
        list.forEach((f, i) => {
            const missing = force ? (f.label || '').trim() : needsTranslation(f, lang, defaultLang);
            if (missing && (f.label || '').trim()) plan.push(i);
        });
        if (!plan.length) continue;

        const texts = [];
        plan.forEach((i) => texts.push(...fieldTexts(list[i])));

        const res = await translateTexts(texts, lang, defaultLang);
        if (!res) { failed = true; continue; }

        let offset = 0;
        plan.forEach((fi) => {
            const f = list[fi];
            const size = fieldTexts(f).length;
            const slice = res.slice(offset, offset + size);
            offset += size;
            if (!slice[0]) return;
            list[fi] = applyFieldTexts({ ...f, __targetLang: lang }, slice);
            translatedCount += 1;
        });
    }

    return { fields: list, translatedCount, failed };
};
