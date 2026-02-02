src/components/screens/lab-test-details-modal.tsx (2)
25-28: Prefer interface over type for object shapes.

Per coding guidelines, interface is preferred over type for defining object shapes in TypeScript.

Suggested change
-type Section = {
+interface Section {
title: string;
params: string[];
-};
+}
88-96: Consider locale-aware date formatting for i18n consistency.

Since this PR adds internationalization support, the date formatting using a fixed DD-MM-YYYY format may not align with user locale preferences. Consider using Intl.DateTimeFormat or a library like date-fns with locale support.

Example using Intl.DateTimeFormat
const formatDate = (dateString: string, locale?: string): string => {
if (!dateString) return '';
const date = new Date(dateString);
if (Number.isNaN(date.getTime())) return dateString;
return new Intl.DateTimeFormat(locale || 'en-IN', {
day: '2-digit',
month: '2-digit',
year: 'numeric',
}).format(date);
};
src/components/screens/lab-test-form.tsx (1)
  > 490-501: Unify parameter key normalization to avoid drift.
  > getParameterLabel already normalizes keys in use-lab-tests, while this component keeps its own normalizeParameterKey. Consider exporting a shared normalizer (or otherwise centralizing the mapping) so parsing, labels, and state keys stay consistent over time.

src/components/cards/worker-card.tsx (2)
133-136: Allow locale-specific ordering for the “rate per day” label.

Concatenating the rate with a suffix key locks the ordering; some locales may prefer prefix or different spacing. Consider a single i18n key with interpolation (or Trans for styled parts) so translators can reorder safely.

♻️ Proposed refactor using Trans for ordering + styling
-import { useTranslation } from 'react-i18next';
+import { useTranslation, Trans } from 'react-i18next';

-          <Text style={rateTextStyle} numberOfLines={1}>
-            {formattedRate}
-            <Text style={dayTextStyle}>{t('workers.ratePerDayShort')}</Text>
-          </Text>

*          <Text style={rateTextStyle} numberOfLines={1}>
*            <Trans
*              i18nKey="workers.ratePerDay"
*              values={{ rate: formattedRate }}
*              components={{ day: <Text style={dayTextStyle} /> }}
*            />
*          </Text>
  154-175: Provide a fallback for a11y labels when names are missing.

If worker.name is empty/undefined, the a11y labels can become non-descriptive. Consider a fallback name so screen readers still get meaningful labels.

♿ Suggested fallback for a11y labels
app/soil-trends.tsx (2)
55-55: Use theme tokens instead of hardcoded color values.

The background color "#f2f2f7" is equivalent to colors.surface[50] from the theme. For consistency with the coding guidelines, prefer using theme tokens.

♻️ Suggested change

-      <SafeScreen backgroundColor="#f2f2f7">

*      <SafeScreen backgroundColor={colors.surface[50]}>
  Apply this to both occurrences (lines 55 and 67).

As per coding guidelines: "Use inline styles with tokens from src/styles/theme.ts for styling"

Also applies to: 67-67

83-83: Consider replacing remaining hardcoded colors with theme tokens.

Several color values like "#597A61", "#333", and "#ef4444" are hardcoded. These could be replaced with theme tokens for better maintainability:

"#597A61" → colors.secondary[500] or define a semantic token
"#ef4444" → colors.errorRed[500]
"#333" → colors.gray[800]
Also applies to: 85-85, 126-127, 135-135, 148-148, 157-157

src/components/forms/spray-form.tsx (2)
48-50: Verify if the eslint-disable is still necessary.

The /_ eslint-disable react-hooks/refs _/ comment suggests a workaround for ref management. Consider whether this pattern could be refactored to avoid disabling the lint rule, or add a comment explaining why it's needed.

126-127: Consider extracting spray-specific accent colors to theme.

The purple accent colors (#8B5CF6, #7C3AED, #F3E8FF, #A78BFA, #F5F3FF, #DDD6FE) are used consistently for spray form styling but aren't defined in the theme. Consider adding a spray or violet color palette to src/styles/theme.ts for consistency and maintainability.

Also applies to: 132-132, 154-154, 214-214, 219-220

src/components/screens/activity-edit-form.tsx (1)
66-68: Consider extracting generateId to a shared utility.

This generateId function is similar to the one in src/components/forms/spray-form.tsx (line 17-19). Consider extracting it to a shared utility (e.g., src/utils/id.ts) to avoid duplication and ensure consistent ID generation across the codebase.

♻️ Suggested shared utility
// src/utils/id.ts
export function generateId(prefix?: string): string {
const base = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
return prefix ? `${prefix}_${base}` : base;
}
src/hooks/use-lab-tests.ts (1)
585-595: Check labTests.parameters keys for snake_case entries.

labelKey uses param.key even when it contains underscores. If your locale keys are camelCase (e.g., totalNitrogen), translations will fall back to the English label. Confirm key shape or switch to camelKey for underscore keys.

♻️ Possible adjustment

- const labelKey = param?.key ?? camelKey;

* const labelKey = param?.key
* ? param.key.includes('\_')
*      ? camelKey
*      : param.key
* : camelKey;
  src/hooks/use-soil-profiles.ts (1)
  90-97: Prefer an interface for SECTION_INFO shape.

Extracting a named interface keeps the object shape reusable and aligns with TS conventions.

♻️ Proposed refactor
+interface SectionInfo {

- labelKey: string;
- abbr: string;
- color: string;
  +}
- -export const SECTION_INFO: Record<SectionName, { labelKey: string; abbr: string; color: string }> =
  +export const SECTION_INFO: Record<SectionName, SectionInfo> =
  {
  top: { labelKey: 'soilProfileForm.sections.top', abbr: 'T', color: '#10B981' },
  bottom: { labelKey: 'soilProfileForm.sections.bottom', abbr: 'B', color: '#8B5CF6' },
  right: { labelKey: 'soilProfileForm.sections.right', abbr: 'R', color: '#F59E0B' },
  left: { labelKey: 'soilProfileForm.sections.left', abbr: 'L', color: '#3B82F6' },
  };
  As per coding guidelines: Prefer `interface` over `type` for defining object shapes in TypeScript.
  src/components/screens/farm-form.tsx (1)
  326-372: Consider memoizing cropOptions to avoid recreation on every render.

The cropOptions array calls t() for each crop label/sublabel. Since t is stable across renders (until language changes), this will recreate the array on every render unnecessarily.

♻️ Proposed refactor

- const cropOptions: CropOption[] = [

* const cropOptions: CropOption[] = useMemo(() => [
  {
  value: 'Grapes' as CropType,
  label: t('farmForm.cropOptions.grapes.label'),
  sublabel: t('farmForm.cropOptions.grapes.sublabel'),
  renderIcon: ({ selected, size }) => <CropIcon name="grapes" size={size} muted={!selected} />,
  iconColor: '#DDD6FE',
  },
  // ... other options

- ];

* ], [t]);
  src/stores/notification-store.ts (1)
  36-62: Consider extracting the storage abstraction to a shared utility.

The storage object (lines 38-62) is duplicated between notification-store.ts and onboarding-store.ts. Extracting this to a shared utility would reduce duplication and ensure consistency.

♻️ Proposed refactor - create shared storage utility
Create src/stores/storage.ts:

import \* as SecureStore from 'expo-secure-store';

const isWeb = process.env.EXPO_OS === 'web';

export const persistStorage = {
getItem: async (key: string): Promise<string | null> => {
if (isWeb) {
if (typeof localStorage === 'undefined') return null;
return localStorage.getItem(key);
}
return SecureStore.getItemAsync(key);
},
setItem: async (key: string, value: string): Promise<void> => {
if (isWeb) {
if (typeof localStorage === 'undefined') return;
localStorage.setItem(key, value);
return;
}
await SecureStore.setItemAsync(key, value);
},
removeItem: async (key: string): Promise<void> => {
if (isWeb) {
if (typeof localStorage === 'undefined') return;
localStorage.removeItem(key);
return;
}
await SecureStore.deleteItemAsync(key);
},
};
Then import in both stores:

## -const isWeb = process.env.EXPO_OS === 'web';

-const storage = {

- // ... duplicated code
  -};
  +import { persistStorage } from './storage';

// In persist config:
-storage: createJSONStorage(() => storage),
+storage: createJSONStorage(() => persistStorage),
app/reports.tsx (1)
492-496: Localize the water-usage unit suffix.
The current output renders like 1234L and the unit isn’t localized. Consider moving the unit into a translation key.

♻️ Suggested tweak

-                  {formatNumber(preview.summary.totalWaterUsage)}L

*                  {t('units.liters', {
*                    value: formatNumber(preview.summary.totalWaterUsage),
*                  })}
  src/services/report-service.ts (1)
  287-291: Consider currency-aware formatting for revenue/net profit.
  Using formatCurrency will handle signs and spacing more naturally than prefixing ₹ to a plain number.

♻️ Suggested change
-import { formatDate, formatNumber } from '@/i18n/format';
+import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
...

-              <div class="summary-value">₹${formatNumber(summary.totalRevenue)}</div>

*              <div class="summary-value">
*                ${formatCurrency(summary.totalRevenue, 'INR', { maximumFractionDigits: 0 })}
*              </div>
  ...

-              <div class="summary-value ${summary.netProfit >= 0 ? 'profit' : 'loss'}">₹${formatNumber(summary.netProfit)}</div>

*              <div class="summary-value ${summary.netProfit >= 0 ? 'profit' : 'loss'}">
*                ${formatCurrency(summary.netProfit, 'INR', { maximumFractionDigits: 0 })}
*              </div>
  app/index.tsx (1)
  95-98: Consider showing a lightweight loader while onboarding state hydrates.
  Returning null can produce a blank screen if hydration is slow; reusing AnimatedSplash (or a small spinner) would keep UX consistent.

💡 Example adjustment

- if (!hasHydrated) {
- return null;
- }

* if (!hasHydrated) {
* return <AnimatedSplash duration={2500} />;
* }
  src/components/screens/warehouse-item-form.tsx (1)
  270-277: Use formatCurrency for the preview label to avoid hard-coded symbols.
  The current label only handles INR/USD and can be wrong for other currencies; using the formatter keeps symbol/format consistent.

♻️ Suggested tweak

-              label: `${quantity} ${unit} × ${currency === 'INR' ? '₹' : '$'}${unitPrice}`,

*              label: `${quantity} ${unit} × ${formatCurrency(Number(unitPrice), currency)}`,
  src/i18n/dev-checks.ts (1)
  5-6: Prefer an interface for AnyObject to match TS style guidance.

The alias defines an object shape; using an interface keeps this aligned with the repo’s TypeScript conventions.

♻️ Proposed refactor
-type AnyObject = Record<string, unknown>;
+interface AnyObject {

- [key: string]: unknown;
  +}
  As per coding guidelines: Prefer interface over type for defining object shapes in TypeScript.
  src/components/screens/worker-form.tsx (1)
  12-12: Replace raw spacing literals with theme spacing tokens.

The inline styles use numeric literals (16/12/20) in the changed lines. To keep spacing consistent with the design system, prefer spacing[...] tokens from src/styles/theme.ts.

♻️ Proposed refactor
-import { FormModal, SectionHeader, FormInput, Toggle, InfoCard } from '@/components/ui';
+import { FormModal, SectionHeader, FormInput, Toggle, InfoCard } from '@/components/ui';
+import { spacing } from '@/styles/theme';
@@

-      <SectionHeader title={t('workers.form.sections.details')} style={{ marginBottom: 16 }} />

*      <SectionHeader
*        title={t('workers.form.sections.details')}
*        style={{ marginBottom: spacing[4] }}
*      />
  @@

-        style={{ marginBottom: 12 }}

*        style={{ marginBottom: spacing[3] }}
  @@

-        style={{ marginBottom: 12 }}

*        style={{ marginBottom: spacing[3] }}
  @@

-        style={{ marginBottom: 20 }}

*        style={{ marginBottom: spacing[5] }}
  @@

-      <SectionHeader title={t('workers.form.sections.status')} style={{ marginBottom: 16 }} />

*      <SectionHeader
*        title={t('workers.form.sections.status')}
*        style={{ marginBottom: spacing[4] }}
*      />
  @@

-        style={{ marginBottom: 16 }}

*        style={{ marginBottom: spacing[4] }}
  As per coding guidelines: Use inline styles with tokens from src/styles/theme.ts for styling; avoid using className.
  Also applies to: 127-169

src/i18n/languages.ts (1)
3-6: Introduce an interface for supported language entries.

The inline object type used in SUPPORTED_LANGUAGES defines a shape; prefer an interface to align with the repo’s TypeScript conventions.

♻️ Proposed refactor
export type SupportedLanguageCode = 'en' | 'mr';

-export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: SupportedLanguageCode; label: string }> = [
+export interface SupportedLanguage {

- code: SupportedLanguageCode;
- label: string;
  +}
- +export const SUPPORTED_LANGUAGES: ReadonlyArray<SupportedLanguage> = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  ];
  As per coding guidelines: Prefer interface over type for defining object shapes in TypeScript.
  src/i18n/locales/mr.ts (1)
  1408-1410: Prefer interface for the translation shape alias.
  This keeps the translation type aligned with the TypeScript guideline for object shapes.

♻️ Optional refactor
-export type MrTranslations = typeof mr;
+export interface MrTranslations extends typeof mr {}
As per coding guidelines: Prefer interface over type for defining object shapes in TypeScript.

app/weather.tsx (1)
1174-1178: Using toLocaleTimeString instead of formatTime.

The "last updated" timestamp uses toLocaleTimeString() directly instead of the centralized formatTime helper imported elsewhere in the codebase. This may cause inconsistent formatting across locales.

♻️ Proposed fix to use formatTime
+import { formatDate, formatTime } from '@/i18n/format';
...
<Text style={{ fontSize: fontSize.xs, color: colors.surface[400] }}>
{t('weather.lastUpdated', {

-                time: new Date(weather.lastUpdated).toLocaleTimeString(),

*                time: formatTime(new Date(weather.lastUpdated)),
                 })}
               </Text>
  app/lab-tests.tsx (1)
  27-35: Local formatDate function duplicates centralized utility.

This file defines its own formatDate function that produces DD-MM-YYYY format, while the codebase has a centralized formatDate in src/i18n/format.ts that handles locale-aware formatting. Consider using the centralized version with appropriate options for consistency.

♻️ Proposed refactor to use centralized formatDate
+import { formatDate } from '@/i18n/format';
...
-const formatDate = (dateString: string): string => {

- if (!dateString) return '';
- const date = new Date(dateString);
- if (Number.isNaN(date.getTime())) return dateString;
- const day = String(date.getDate()).padStart(2, '0');
- const month = String(date.getMonth() + 1).padStart(2, '0');
- const year = date.getFullYear();
- return `${day}-${month}-${year}`;
  -};
  ...
  // Usage in renderTestCard:
  -{formatDate(test.date)}
  +{formatDate(test.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
  app/onboarding.tsx (1)
  49-52: Redundant language setting in handleNext.

The language is already set immediately when the user taps a language option (lines 200-201 and 226-227). This block in handleNext duplicates those calls when the user proceeds to the next step.

Consider removing this block since the language is set on selection, or remove the immediate setting on press if you prefer to only apply the change when the user confirms.

🔧 Option: Remove redundant calls from handleNext

- if (currentStep === 'language') {
-      setLanguage(selectedLanguage);
-      setAppLanguage(selectedLanguage);
- }
app/analytics.tsx (1)
357-365: Performance category names are not translated.

The key from performanceMetrics.categories is displayed directly with textTransform: 'capitalize'. These category names (e.g., "irrigation", "efficiency") should use translation keys for full i18n support.

🌐 Suggested approach
<Text
style={{
                           fontSize: fontSize.xs,
                           color: colors.surface[500],
                           textTransform: 'capitalize',
                         }} >

-                        {key}

*                        {t(`analytics.categories.${key}`)}
                         </Text>
  Add corresponding translation keys for each category.

src/i18n/format.ts (2)
9-13: Redundant numberingSystem specification.

The Latin numbering system is specified both in the locale string (-u-nu-latn suffix from getLocaleWithLatinDigits()) and in the options object (numberingSystem: 'latn'). The locale extension should be sufficient.

♻️ Remove redundant option
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
return new Intl.NumberFormat(getLocaleWithLatinDigits(), {

- numberingSystem: 'latn',
  ...options,
  }).format(value);
  }
  Apply similarly to formatCurrency and formatDate.

29-38: Consider validating date input.

new Date(date) with an invalid string returns an Invalid Date object, which when formatted produces "Invalid Date" string. Consider adding validation or a fallback.

🛡️ Proposed defensive handling
export function formatDate(
date: Date | string | number,
options?: Intl.DateTimeFormatOptions,
): string {
const d = date instanceof Date ? date : new Date(date);

- if (Number.isNaN(d.getTime())) {
- return ''; // or a fallback like 'Invalid date'
- }
  return new Intl.DateTimeFormat(getLocaleWithLatinDigits(), {
  numberingSystem: 'latn',
  ...options,
  }).format(d);
  }
  src/stores/language-store.ts (1)
  20-44: Consider using AsyncStorage instead of SecureStore for language preference.

Language preference is not sensitive data. SecureStore adds encryption overhead and has size limitations that aren't necessary here. Consider using @react-native-async-storage/async-storage for better performance, which is the standard choice for non-sensitive persisted data.

That said, if consistency with other stores in the codebase is preferred, the current implementation is functionally correct.

src/services/notifications.ts (1)
85-87: Consider using i18n interpolation for farmName.

The current string concatenation breaks the translation pattern. Use interpolation for better localization support (e.g., different languages may place the farm name differently).

💡 Suggested improvement

- const baseBody = i18n.t('notifications.lowWater.body');
- const body = farmName ? `${farmName}: ${baseBody}` : baseBody;

* const body = farmName
* ? i18n.t('notifications.lowWater.bodyWithFarm', { farmName })
* : i18n.t('notifications.lowWater.body');
  This requires adding a new translation key like:

"bodyWithFarm": "{{farmName}}: Your crops need water"
src/components/screens/location-picker.tsx (1)
195-206: Default coordinates may not be appropriate for target users.

The fallback coordinates (37.7749, -122.4194) are San Francisco, CA. Given the app uses INR currency and targets Indian farmers, consider using coordinates in India as the default (e.g., central India: ~20.5937, 78.9629).

src/components/cards/activity-log-card.tsx (1)
41-46: Consider using the proper TFunction type for better type safety.

The current inline type (key: string, options?: Record<string, unknown>) => string works but loses some type checking benefits.

💡 Suggested improvement
+import type { TFunction } from 'i18next';

function getDescriptionFromData(
type: LogTypeId,

- t: (key: string, options?: Record<string, unknown>) => string,

* t: TFunction,
  data?: RecordData,
  currency?: string,
  ): string {

src/hooks/use-lab-tests.ts (1)
601-605: ⚠️ Potential issue | 🟡 Minor

Normalize aliases before unit lookup.

With the new alias normalization (e.g., organic_carbon), getParameterUnit can return empty units for unnormalized keys. Normalizing here keeps units consistent.

🛠️ Suggested fix
-export function getParameterUnit(key: string, isSoil: boolean): string {

- const params = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
- const param = params.find((p) => p.key === key);
- return param?.unit || '';
  -}
  +export function getParameterUnit(key: string, isSoil: boolean): string {

* const testType = isSoil ? 'soil' : 'petiole';
* const normalizedKey = normalizeParameterKey(key, testType);
* const params = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
* const param = params.find((p) => p.key === normalizedKey);
* return param?.unit || '';
  +}
  app/(tabs)/explore.tsx (1)
  1191-1200: ⚠️ Potential issue | 🟡 Minor

Search placeholder strings are not localized.

The searchPlaceholder useMemo returns hardcoded English strings, inconsistent with the rest of the i18n integration in this file.

🌐 Proposed fix to localize search placeholders
const searchPlaceholder = useMemo(() => {
switch (selectedTab) {
case 'farms':

-        return 'Search farms...';

*        return t('farms.search.placeholder');
       case 'warehouse':

-        return 'Search inventory...';

*        return t('warehouse.search.placeholder');
       default:

-        return 'Search...';

*        return t('common.search');
  }

- }, [selectedTab]);

* }, [selectedTab, t]);
  app/add-lab-test.tsx (1)
  10-51: ⚠️ Potential issue | 🟡 Minor

Add a localized placeholder for missing farmId instead of the literal fallback.

The literal 'missing' string on line 17 is interpolated into the translated error message on line 50. Marathi users will see: "अवैध फार्म आयडी: missing" (mixing the localized text with English).

The suggested t('common.missing') key does not exist in the translations. Either add missing to the common namespace in both src/i18n/locales/en.ts and src/i18n/locales/mr.ts, or use an existing key like common.unknownDate:

♻️ Option 1: Add new key

- const farmIdLabel = params.farmId ?? 'missing';

* const farmIdLabel = params.farmId ?? t('common.missing');
  Then add to src/i18n/locales/en.ts under common:

missing: 'Missing',
And to src/i18n/locales/mr.ts under common:

missing: 'अनुपलब्ध',
src/components/screens/trends-table.tsx (1)
  29-90: ⚠️ Potential issue | 🟡 Minor

Localize the remaining empty-state strings using dedicated table keys.

These are still hardcoded, causing English text to display for Marathi users. Rather than reusing the chart-specific trends.empty._ keys (which reference "view chart"), create separate trends.table.empty._ keys to keep table and chart empty states distinct:

🌐 Suggested mapping

-          No Data Available

*          {t('trends.table.empty.noDataTitle')}
  ...

-          Add lab tests to view trends

*          {t('trends.table.empty.noDataBody')}
  ...

-          No Parameter Data

*          {t('trends.table.empty.noParamsTitle')}
  ...

-          Unable to load parameter trends

*          {t('trends.table.empty.noParamsBody')}
  Then add to src/i18n/locales/en.ts:

trends.table.empty: {
noDataTitle: 'No Data Available',
noDataBody: 'Add lab tests to view trends',
noParamsTitle: 'No Parameter Data',
noParamsBody: 'Unable to load parameter trends',
}
And the corresponding Marathi translations to src/i18n/locales/mr.ts.

src/components/screens/entry-form.tsx (4)
482-488: ⚠️ Potential issue | 🟡 Minor

Hardcoded English strings in partial success alert.

The "Partial Success" alert message at lines 483-486 is not translated. This should use i18n keys for consistency with the rest of the file.

🌐 Proposed fix to translate the partial success alert
if (failedCount > 0) {
Alert.alert(

-          'Partial Success',
-          `${failedCount} log${failedCount > 1 ? 's' : ''} failed to save. Please review and try again.`,

*          t('entryForm.partialSuccess.title'),
*          t('entryForm.partialSuccess.body', { count: failedCount }),
           );
           return;
         }
  1559-1585: ⚠️ Potential issue | 🟡 Minor

Hardcoded strings in Due Date picker modal.

The "Select Due Date" title (line 1560) and "Done" button text (line 1584) are not translated, unlike the similar date picker at lines 1686/1708 which uses t('entryForm.selectDate') and t('entryForm.done').

🌐 Proposed fix to translate the due date picker
<Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>

-                    Select Due Date

*                    {t('entryForm.selectDueDate')}
                   </Text>
                   <Text selectable style={{ fontWeight: '600', color: '#ffffff' }}>

-                    Done

*                    {t('entryForm.done')}
                     </Text>
  1351-1402: ⚠️ Potential issue | 🟡 Minor

Hardcoded form labels in task content.

Several form labels remain hardcoded in English: "Title \*" (line 1356), "Enter task title" (line 1361), "Description" (line 1381), "Add details about this task" (line 1386), "Type" (line 1411), "Priority" (line 1446), "Due Date" (line 1488), and "Select due date" (line 1517). These should use translation keys for consistency.

1063-1082: ⚠️ Potential issue | 🟡 Minor

\*Hardcoded "Farm " and "Select farm" labels.

The farm selector labels at lines 1063 and 1082 are hardcoded in English. Apply translation keys similar to other form fields.

🌐 Proposed fix
<Text
selectable
style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }} >

-            Farm *

*            {t('entryForm.farmLabel')}
           </Text>
               <Text selectable style={{ fontSize: 16, color: '#2c2c2e', marginLeft: 8 }}>

-                {activeFarm?.name || 'Select farm'}

*                {activeFarm?.name || t('entryForm.selectFarm')}
                 </Text>
  app/weather.tsx (3)
  336-340: ⚠️ Potential issue | 🟡 Minor

Hardcoded location warning message.

The warning message about missing GPS coordinates (lines 337-338) is not translated. This user-facing text should use i18n keys.

🌐 Proposed fix
<Text
style={{
                 color: '#92400E',
                 fontSize: fontSize.sm,
                 marginLeft: spacing[3],
                 flex: 1,
               }} >

-              This farm doesn&apos;t have location coordinates. Weather data is showing default
-              location (Nashik). Add GPS coordinates to get farm-specific weather.

*              {t('weather.warnings.noCoordinates')}
               </Text>
  354-357: ⚠️ Potential issue | 🟡 Minor

Hardcoded picker labels "GROWTH STAGE" and "SOIL TYPE".

The section labels at lines 356 and 430 are hardcoded uppercase English strings. These should use translation keys with appropriate text transformation.

Also applies to: 429-431

510-546: ⚠️ Potential issue | 🟡 Minor

Hardcoded weather condition strings.

Several weather-related strings remain hardcoded: "Current Location" (line 511), "Feels like" (line 546). These should be translated for consistency with other weather labels.

app/warehouse.tsx (2)
257-260: ⚠️ Potential issue | 🟡 Minor

Hardcoded "{count} items" text.

The low stock items count badge at line 259 uses hardcoded English text. This should use a translation key with interpolation.

🌐 Proposed fix
<Text
style={{
                       color: COLORS.lowStock,
                       fontSize: fontSize.xs,
                       fontWeight: fontWeight.medium,
                     }} >

-                    {lowStockItems.length} items

*                    {t('warehouse.labels.itemCount', { count: lowStockItems.length })}
                     </Text>
  550-581: ⚠️ Potential issue | 🟡 Minor

Hardcoded inventory item detail labels.

The labels "Quantity" (line 552), "Unit Price" (line 566), and "Total Value" (line 580) are hardcoded in English. These should use translation keys for consistency with the rest of the file.

🌐 Proposed fix
<Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>

-                      Quantity

*                      {t('warehouse.labels.quantity')}
                       </Text>
  ...
  <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>

-                      Unit Price

*                      {t('warehouse.labels.unitPrice')}
                       </Text>
  ...
  <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>

-                      Total Value

*                      {t('warehouse.labels.totalValue')}
                       </Text>
  app/analytics.tsx (1)
  180-182: ⚠️ Potential issue | 🟡 Minor

Hard-coded strings should use translation keys.

"Irrigation Hours" and "Spray Applications" (line 214-216) are still hard-coded while similar labels like "Total Harvest" (line 249) and "Harvest Value" (line 288) use translation keys. This creates inconsistent i18n coverage.

🌐 Proposed fix for consistent i18n
<Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>

-                Irrigation Hours

*                {t('analytics.labels.irrigationHours')}
               </Text>
               <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>

-                Spray Applications

*                {t('analytics.labels.sprayApplications')}
                 </Text>
  Add corresponding keys to locale files.

src/components/screens/attendance-subcomponents/mark-attendance-tab.tsx (6)
36-84: ⚠️ Potential issue | 🟡 Minor

Hardcoded English strings in getStatusDisplay should be translated.

The fullLabel values ('Full Day', 'Half Day', 'Absent', 'Not Set') and single-letter label values are hardcoded in English. For consistent i18n support, these should use translation keys.

💡 Suggested approach
Pass the t function as a parameter or move this function inside the component:

-const getStatusDisplay = (

- status: AttendanceStatus,
  -): {
  +const getStatusDisplay = (

* status: AttendanceStatus,
* t: (key: string) => string,
  +): {
  // ...
  } => {
  switch (status) {
  case 'full_day':
  return {

-        label: 'F',

*        label: t('attendance.status.fullDayShort'),
         // ...

-        fullLabel: 'Full Day',

*        fullLabel: t('attendance.status.fullDay'),
         };
       // ... similar for other cases
  }
  };
  419-521: ⚠️ Potential issue | 🟡 Minor

Multiple UI strings remain untranslated.

The following strings should use translation keys for complete i18n support:

"Filters" (line 419)
"Worker" (line 455)
"Farms" (line 508)
"selected" / "All Farms" (lines 520-521)
560-591: ⚠️ Potential issue | 🟡 Minor

Additional hardcoded strings need translation.

"This Week" (line 560)
"Unsaved Changes" / "Up to Date" (line 591)
754-838: ⚠️ Potential issue | 🟡 Minor

Quick action button labels are hardcoded.

"All Full", "All Half", and "All Off" should use translation keys.

910-944: ⚠️ Potential issue | 🟡 Minor

Save/Next button labels are hardcoded.

"Saving...", "Save & Next", "Save & Finish", "Next Worker", and "Done" should use translation keys.

965-968: ⚠️ Potential issue | 🟡 Minor

Sheet titles and subtitles are hardcoded.

"Select Worker" and "Choose a worker to mark attendance" should use translation keys.
