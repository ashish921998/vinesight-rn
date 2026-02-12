import type { EnTranslations } from './locales/en';
import type { MrTranslations } from './locales/mr';
import { GLOSSARY_MR } from './glossary.mr';

type AnyObject = Record<string, unknown>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function flattenKeys(obj: AnyObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as AnyObject, next));
    } else {
      keys.push(next);
    }
  }
  return keys;
}

function collectStrings(
  obj: AnyObject,
  path: string[] = [],
): Array<{ path: string; value: string }> {
  const out: Array<{ path: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const nextPath = [...path, k];
    if (typeof v === 'string') {
      out.push({ path: nextPath.join('.'), value: v });
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...collectStrings(v as AnyObject, nextPath));
    }
  }
  return out;
}

export function devCheckKeyParity(en: EnTranslations, mr: MrTranslations): void {
  const enKeys = new Set(flattenKeys(en as unknown as AnyObject));
  const mrKeys = new Set(flattenKeys(mr as unknown as AnyObject));

  const missingInMr: string[] = [];
  for (const key of enKeys) {
    if (!mrKeys.has(key)) missingInMr.push(key);
  }

  if (missingInMr.length > 0 && __DEV__) {
    console.error('[i18n] Marathi is missing translation keys:', missingInMr);
  }
}

export function devCheckMrGlossaryUsage(mr: MrTranslations): void {
  const glossaryValues = Object.values(GLOSSARY_MR).filter((v) => v.trim().length > 0);

  const strings = collectStrings(mr as unknown as AnyObject).filter(
    (s) => !s.path.startsWith('glossary.'),
  );

  for (const { path, value } of strings) {
    for (const term of glossaryValues) {
      const termRegex = new RegExp(
        // Match only standalone tokens, not substrings inside other words (e.g. "शेती", "कामगिरी").
        // We use the Devanagari Unicode block range to avoid requiring Unicode property escapes in JS engines.
        `(^|[^\\u0900-\\u097F])${escapeRegExp(term)}([^\\u0900-\\u097F]|$)`,
      );

      if (termRegex.test(value) && __DEV__) {
        console.error(
          `[i18n] Do not hardcode glossary term "${term}" in mr resource at "${path}". Use $t(glossary.*) nesting instead. Value: ${JSON.stringify(
            value,
          )}`,
        );
      }
    }
  }
}
