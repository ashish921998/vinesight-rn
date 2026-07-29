/**
 * Guards the `reports.*` translation namespace.
 *
 * Two invariants, both of which were broken before the reports redesign:
 *
 * 1. Key parity across all 3 locales. `src/i18n/dev-checks.ts` only compares
 *    en↔mr and only as a `console.error` in __DEV__, so `hi` drifted unnoticed
 *    (`reports.filters.title` was English-only, surviving on an inline t()
 *    fallback). A test is the only thing that actually fails CI.
 *
 * 2. No hardcoded glossary terms in `mr`. `devCheckMrGlossaryUsage` already
 *    logs these, but as one of ~40 console errors it was logged-and-ignored.
 *    Asserting it for this namespace keeps the redesign's cleanup from rotting.
 *
 * Scoped to `reports.*` deliberately: the other namespaces still carry
 * pre-existing violations, so a global assertion would land red on day one.
 */

import { GLOSSARY_MR } from '@/i18n/glossary.mr';
import { en } from '@/i18n/locales/en';
import { hi } from '@/i18n/locales/hi';
import { mr } from '@/i18n/locales/mr';

type AnyObject = Record<string, unknown>;

/** Dotted leaf paths, so nested objects are compared structurally not by identity. */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as AnyObject).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function flattenStrings(value: unknown, prefix = ''): { path: string; value: string }[] {
  if (typeof value === 'string') return [{ path: prefix, value }];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as AnyObject).flatMap(([key, child]) =>
    flattenStrings(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('reports.* i18n', () => {
  it('has identical keys in en, hi and mr', () => {
    const enKeys = flattenKeys(en.reports).sort();
    expect(flattenKeys(hi.reports).sort()).toEqual(enKeys);
    expect(flattenKeys(mr.reports).sort()).toEqual(enKeys);
  });

  it('has no empty strings in any locale', () => {
    for (const [name, bundle] of [
      ['en', en.reports],
      ['hi', hi.reports],
      ['mr', mr.reports],
    ] as const) {
      const blank = flattenStrings(bundle).filter((entry) => entry.value.trim().length === 0);
      expect({ locale: name, blank }).toEqual({ locale: name, blank: [] });
    }
  });

  it('never hardcodes a glossary term in mr — use $t(glossary.*) nesting', () => {
    const terms = Object.entries(GLOSSARY_MR).filter(([, term]) => term.trim().length > 0);

    const offenders = flattenStrings(mr.reports).flatMap(({ path, value }) =>
      terms
        // Standalone tokens only, matching devCheckMrGlossaryUsage: a Devanagari
        // boundary means the term is inflected (e.g. फवारणीची) and is not a
        // glossary reference.
        .filter(([, term]) =>
          new RegExp(`(^|[^\\u0900-\\u097F])${term}([^\\u0900-\\u097F]|$)`).test(value),
        )
        .map(([key]) => `reports.${path} hardcodes glossary.${key}`),
    );

    expect(offenders).toEqual([]);
  });
});
