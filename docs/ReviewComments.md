src/components/screens/farm-form.tsx (4)
316-324: Prefer interface over type for object shapes.

Per coding guidelines, use interface for defining object shapes in TypeScript.

♻️ Suggested refactor

- type CropOption = {

* interface CropOption {
  value: CropType;
  label: string;
  sublabel: string;
  renderIcon?: (args: { selected: boolean; size: number }) => React.ReactNode;
  icon?: string;
  iconColor: string;
  iconLibrary?: 'ionicons' | 'symbols';

- };

* }
  As per coding guidelines: "Prefer interface over type for defining object shapes in TypeScript"

326-372: Consider memoizing cropOptions to avoid recreation on every render.

The cropOptions array calls t() for each option and is recreated on every render. Since the array structure is static (only translations change when language changes), wrapping it in useMemo would improve performance.

♻️ Suggested refactor

- const cropOptions: CropOption[] = [

* const cropOptions: CropOption[] = useMemo(() => [
  {
  value: 'Grapes' as CropType,
  label: t('farmForm.cropOptions.grapes.label'),
  // ... rest of options
  },
  // ... other options

- ];

* ], [t]);
  374-384: Wrap helper functions in useCallback for stable references.

getSoilTextureLabel and getVarietyLabel are recreated on every render. While they're small functions, wrapping them in useCallback ensures stable references, which can help avoid unnecessary re-renders in child components if these were ever passed as props.

♻️ Suggested refactor

- const getSoilTextureLabel = (value?: string) => {

* const getSoilTextureLabel = useCallback((value?: string) => {
  if (!value) return '';
  const match = SOIL_TEXTURE_OPTIONS.find((o) => o.value === value);
  return match ? t(match.labelKey) : value;

- };

* }, [t]);

- const getVarietyLabel = (value?: string) => {

* const getVarietyLabel = useCallback((value?: string) => {
  if (!value) return '';
  if (value === 'Custom') return t('farmForm.variety.custom');
  return value;

- };

* }, [t]);
  Add useCallback to imports:

-import React, { useMemo, useState, useEffect, useRef } from 'react';
+import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
543-557: Minor inconsistency: Some unit suffixes are hardcoded while others are translated.

t('units.acres') is used for area (line 433), but other units like "m", "mm", "mm/hr", "ft", "kg/m³", etc. are hardcoded. This may be intentional if metric units are universal, but consider using translation keys for all units for consistency (especially "ft" which is locale-specific).

app/soil-profiling.tsx (1)
126-129: Incomplete i18n coverage — several hardcoded strings remain.

While key UI elements are translated, many user-facing strings are still hardcoded:

Line 127: "Fusarium: {profile.fusarium_pct}%"
Line 170: "Average Moisture"
Lines 256-257: "No Soil Profiles"
Line 266: "Add soil moisture profiles to track your farm's soil health over time."
Line 286-287: "Add First Profile"
Lines 312, 322: "Not Enough Data", "Add at least 2 profiles to see trends."
Trend labels: "Avg Moisture", "Total Profiles", "Recent Change", "from last profile", "Latest Moisture"
Consider completing the localization for consistency, especially if Marathi users will interact with this screen.

Also applies to: 169-171, 248-267, 282-288, 304-323, 340-470

src/hooks/use-fab-bottom-position.android.ts (1)
4-10: Consider using spacing tokens for consistency.

The hardcoded values (8, 12, 20) could be replaced with spacing tokens from @/styles/theme for consistency with the rest of the codebase. For example, spacing[2] = 8, spacing[3] = 12, spacing[5] = 20.

♻️ Optional refactor using spacing tokens
import { useTabBarInset } from './use-tab-bar-inset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
+import { spacing } from '@/styles/theme';

export function useFabBottomPosition(): number {
const tabBarInset = useTabBarInset();
const { bottom } = useSafeAreaInsets();
// Position relative to tab bar top: subtract paddingTop(8) + paddingBottom from total height

- const tabBarPaddingTop = 8;
- const tabBarPaddingBottom = Math.max(bottom + 12, 20);

* const tabBarPaddingTop = spacing[2];
* const tabBarPaddingBottom = Math.max(bottom + spacing[3], spacing[5]);
  return tabBarInset - tabBarPaddingBottom - tabBarPaddingTop;
  }
  src/components/forms/expense-form.tsx (1)
  76-79: Hardcoded UI strings should use i18n translation keys.

Given this PR adds comprehensive i18n support, the following hardcoded strings in the expense form should be translated:

"Expense" / "Log farm expense" (lines 76-79)
"Category" (line 97)
"Amount" (line 139)
"Remarks" (line 165)
"Optional - describe the expense" (line 192)
"Ready to add" / "Select category and enter amount" (line 255)
Also applies to: 97-97, 139-139, 165-165, 192-192, 255-255

src/hooks/use-fab-bottom-position.ts (1)
6-7: Consider explicit web platform handling if FAB positioning differs.

Web is explicitly supported in this project (see npm run web), but the current code defaults non-Android platforms—including web—to the iOS implementation. While this mirrors the consistent pattern used elsewhere in the hooks (use-fab-bottom-inset.ts, use-tab-bar-inset.ts), if web requires distinct FAB positioning logic, add explicit web handling:

export const useFabBottomPosition =
Platform.OS === 'android'
? useFabBottomPositionAndroid
: Platform.OS === 'web'
? useFabBottomPositionWeb
: useFabBottomPositionIOS;
If iOS positioning works acceptably on web, the current implementation is acceptable.

src/components/screens/water-level-sheet.tsx (1)
122-135: Consider extracting the 30% threshold as a configurable constant.

The low-water alert threshold is hardcoded at 30%. For maintainability, consider extracting this to a named constant or making it configurable per farm.

+const LOW_WATER_THRESHOLD_PERCENT = 30;

- // If user enabled low-water alerts, notify immediately when the new level is critical.
  if (lowWaterAlertsEnabled && farm.total_tank_capacity && farm.total_tank_capacity > 0) {
  const pct = (calculatedWaterLevel / farm.total_tank_capacity) \* 100;

* if (pct < 30) {

- if (pct < LOW_WATER_THRESHOLD_PERCENT) {
  src/hooks/use-dashboard-stats.ts (1)
  178-183: Query cache may show stale currency format when preference changes.

The preferredCurrency is derived from useProfile but is not included in the queryKey. If a user changes their currency preference, the cached activities will still show the old currency format until the cache expires or is manually invalidated.

Consider adding the currency to the query key if immediate updates are desired:

return useQuery({

- queryKey: queryKeys.dashboard.recentActivities(limit),

* queryKey: [...queryKeys.dashboard.recentActivities(limit), preferredCurrency],
  Alternatively, this may be acceptable if stale data for 30 seconds is tolerable.

src/services/report-service.ts (1)
287-287: Inconsistent currency handling: hardcoded ₹ symbol vs. user's preferred currency.

The PDF generation uses hardcoded ₹ (Indian Rupee) symbols, but the dashboard hooks now use the user's preferred_currency. This creates inconsistency:

Line 287: ₹${formatNumber(summary.totalRevenue)}
Line 291: ₹${formatNumber(summary.netProfit)}
Line 341: ${r.price ? '₹' + r.price : '-'}
Line 359: ₹${r.cost}
Consider using formatCurrency with the user's preferred currency for consistency, or document that reports are always generated in INR.

Also applies to: 291-291, 341-341, 359-359

src/components/screens/trends-chart.tsx (1)
202-229: Replace hardcoded hex colors with theme tokens.

The selected-point banner and change-indicator colors still use literal hex values. Please swap to colors.\* tokens so the palette stays centralized.
As per coding guidelines: Use inline styles with tokens from src/styles/theme.ts for styling; avoid using className.

Also applies to: 344-355

src/components/screens/attendance-subcomponents/calendar-attendance-tab.tsx (1)
60-61: Consider localizing the remaining calendar UI strings.

Month names, day labels, “Worker/All Workers”, “Today”, legend labels, and the worker sheet title/subtitle are still hardcoded. Moving these into translation keys (or using the locale formatter for the month header) would align with the rest of the i18n rollout.

Also applies to: 110-452

app/index.tsx (1)
95-98: Avoid a blank screen while onboarding store hydrates.

Returning null can flash an empty screen; consider showing a lightweight fallback (e.g., the existing splash) until hydration completes.

Suggested tweak

- if (!hasHydrated) {
- return null;
- }

* if (!hasHydrated) {
* return <AnimatedSplash duration={2500} />;
* }
  src/constants/calculator-models.ts (1)
  32-46: Consider migrating other constants to labelKey for consistency.

LOG_TYPES was updated to use labelKey for i18n, but similar constants (WATER_GROWTH_STAGES, GRAPE_GROWTH_STAGES, IRRIGATION_METHODS, SOIL_TYPES, REFILL_SPANS) still use hardcoded label strings. Consider migrating these for full i18n support, or document why they remain untranslated.

Also applies to: 125-189, 203-207, 223-245, 259-263

src/hooks/use-soil-profiles.ts (1)
133-148: getMoistureStatus returns hardcoded English labels.

This function returns hardcoded strings like 'Very Dry', 'Optimal', etc., while other parts of the file use i18n. Consider returning labelKey values or using i18n.t() for consistency.

♻️ Suggested refactor for i18n consistency
export function getMoistureStatus(moisture: number): {

- label: string;

* labelKey: string;
  color: string;
  } {
  if (moisture < 20) {

- return { label: 'Very Dry', color: '#EF4444' };

* return { labelKey: 'soilProfile.moistureStatus.veryDry', color: '#EF4444' };
  } else if (moisture < 40) {

- return { label: 'Dry', color: '#F59E0B' };

* return { labelKey: 'soilProfile.moistureStatus.dry', color: '#F59E0B' };
  } else if (moisture < 60) {

- return { label: 'Optimal', color: '#10B981' };

* return { labelKey: 'soilProfile.moistureStatus.optimal', color: '#10B981' };
  } else if (moisture < 80) {

- return { label: 'Moist', color: '#3B82F6' };

* return { labelKey: 'soilProfile.moistureStatus.moist', color: '#3B82F6' };
  } else {

- return { label: 'Wet', color: '#6366F1' };

* return { labelKey: 'soilProfile.moistureStatus.wet', color: '#6366F1' };
  }
  }
  app/(tabs)/\_layout.tsx (1)
  86-93: Stale scaleMap entries for removed compass icon.

The scaleMap still contains entries for 'compass' and 'compass.fill', but the Explore tab now uses 'house' icon. These entries are now dead code.

♻️ Remove stale scaleMap entries
const scaleMap: Record<string, number> = {

-        compass: 1.1,
-        'compass.fill': 1.1,

*        house: 1.1,
*        'house.fill': 1.1,
           'wrench.and.screwdriver': 0.9,
           'wrench.and.screwdriver.fill': 0.9,
         };
  app/weather.tsx (3)
  26-30: Consider localizing soil type labels.

The SOIL_TYPES labels are hardcoded in English. For full i18n support, these should use translation keys.

const SOIL_TYPES: { value: SoilType; labelKey: string }[] = [
{ value: 'sandy', labelKey: 'weather.soilTypes.sandy' },
{ value: 'medium', labelKey: 'weather.soilTypes.medium' },
{ value: 'clay', labelKey: 'weather.soilTypes.clay' },
];
Then render with t(type.labelKey) where used.

14-23: Consider localizing growth stage labels.

Similar to soil types, GROWTH_STAGES values are displayed directly as English text. For consistent i18n, these could be mapped to translation keys.

1174-1176: Consider using formatDate for time formatting.

The toLocaleTimeString() call doesn't use the centralized formatting utility. For consistency with other date/time formatting in the app:

- time: new Date(weather.lastUpdated).toLocaleTimeString(),

* time: formatDate(weather.lastUpdated, { hour: 'numeric', minute: 'numeric' }),
  app/onboarding.tsx (1)
  151-203: Use theme color tokens instead of hard-coded hex values in the new step.

The new language step introduces hard-coded colors (e.g., icon color), which diverges from the theme-token guideline.

🎨 Example using theme tokens

-        <SymbolIcon name="globe" size={48} color="#1a5d1a" />

*        <SymbolIcon name="globe" size={48} color={colors.primary[700]} />
  As per coding guidelines: Use inline styles with tokens from src/styles/theme.ts for styling; avoid using className.

app/\_layout.tsx (2)
30-30: Prefer an interface for DefaultPropsCarrier.
This is an object shape and fits the interface convention used elsewhere.

♻️ Suggested refactor
-type DefaultPropsCarrier = { defaultProps?: { style?: StyleProp<TextStyle> } };
+interface DefaultPropsCarrier {

- defaultProps?: { style?: StyleProp<TextStyle> };
  +}
  As per coding guidelines: Prefer interface over type for defining object shapes in TypeScript.

34-94: Remove the duplicated Android text patch block.
The second block is unreachable after the first sets androidTextPatched, so keeping one copy avoids confusion.

♻️ Suggested cleanup
-if (Platform.OS === 'android' && !androidTextPatched) {

- androidTextPatched = true;
-
- const TextWithDefaults = Text as unknown as DefaultPropsCarrier;
- const TextInputWithDefaults = TextInput as unknown as DefaultPropsCarrier;
-
- TextWithDefaults.defaultProps = {
- ...(TextWithDefaults.defaultProps ?? {}),
- style: [
-      {
-        includeFontPadding: true,
-        paddingBottom: androidTextPadding.bottom,
-        paddingRight: androidTextPadding.right,
-      },
-      TextWithDefaults.defaultProps?.style,
- ],
- };
-
- TextInputWithDefaults.defaultProps = {
- ...(TextInputWithDefaults.defaultProps ?? {}),
- style: [
-      {
-        includeFontPadding: true,
-        paddingBottom: androidTextPadding.bottom,
-        paddingRight: androidTextPadding.right,
-      },
-      TextInputWithDefaults.defaultProps?.style,
- ],
- };
  -}
  app/(tabs)/workers.tsx (1)
  18-22: Consider an interface for the tab metadata shape.
  This keeps object-shape typing consistent with the preferred style.

♻️ Suggested refactor
type WorkersTab = 'workers' | 'attendance' | 'analytics';

-const TAB_DATA: { id: WorkersTab; labelKey: string }[] = [
+interface WorkersTabMeta {

- id: WorkersTab;
- labelKey: string;
  +}
- +const TAB_DATA: WorkersTabMeta[] = [
  { id: 'workers', labelKey: 'workers.tabs.workers' },
  { id: 'attendance', labelKey: 'workers.tabs.attendance' },
  { id: 'analytics', labelKey: 'workers.tabs.analytics' },
  ];
  As per coding guidelines: Prefer interface over type for defining object shapes in TypeScript.

src/components/screens/location-picker.tsx (1)
27-42: Error boundary lacks reset mechanism.

The MapErrorBoundary catches errors and renders the fallback, but it never resets hasError back to false. If the map fails once (e.g., due to a transient issue), the fallback will persist even on subsequent opens until the component is fully unmounted and remounted.

Consider adding a reset mechanism via a key prop or a method to clear the error state:

♻️ Proposed fix to add error reset capability
class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
state: MapErrorBoundaryState = { hasError: false };

static getDerivedStateFromError(): MapErrorBoundaryState {
return { hasError: true };
}

componentDidCatch(error: Error) {
this.props.onError(error);
}

- componentDidUpdate(prevProps: MapErrorBoundaryProps) {
- // Reset error state when children change (e.g., on re-open)
- if (this.state.hasError && prevProps.children !== this.props.children) {
-      this.setState({ hasError: false });
- }
- }
- render() {
  if (this.state.hasError) return this.props.fallback;
  return this.props.children;
  }
  }
  app/farm/[id].tsx (1)
  75-75: Inconsistent platform detection methods.

Line 75 uses Platform.OS === 'android', but line 255 and line 484 still use process.env.EXPO_OS === 'android'. Consider using Platform.OS consistently throughout for clarity.

♻️ Proposed fix for consistency

- const isAndroid = process.env.EXPO_OS === 'android';

* const isAndroid = Platform.OS === 'android';
  And at line 484:

- spacing[16] + (process.env.EXPO_OS === 'android' ? 16 : 0),

* spacing[16] + (isAndroid ? 16 : 0),
  src/components/screens/lab-test-form.tsx (1)
  154-161: Inconsistent platform detection.

This uses process.env.EXPO_OS === 'android' while other files in this PR use Platform.OS. Consider using Platform.OS for consistency with the rest of the codebase.

♻️ Proposed fix
+import { Platform } from 'react-native';

const handleDateChange = (\_: DateTimePickerEvent, selectedDate?: Date) => {

- if (process.env.EXPO_OS === 'android') {

* if (Platform.OS === 'android') {
  setShowDatePicker(false);
  }
  app/analytics.tsx (1)
  363-365: Dynamic translation key may fail silently.

The dynamic key t(\analytics.categories.${key}`)depends on thekeyvalues fromperformanceMetrics.categories` matching translation keys exactly. If a new category is added without a corresponding translation, it will display the raw key.

Consider adding a fallback or using the original key as the default value:

♻️ Proposed fix with fallback

-                        {t(`analytics.categories.${key}`)}

*                        {t(`analytics.categories.${key}`, { defaultValue: key })}
  app/(tabs)/farms.tsx (1)
  255-255: Platform detection inconsistency.

Lines 255 and 484 use process.env.EXPO_OS while other parts of the PR use Platform.OS. Consider using Platform.OS consistently, especially since Platform is not currently imported in this file.

♻️ Proposed fix
+import { Platform } from 'react-native';

- const isAndroid = process.env.EXPO_OS === 'android';

* const isAndroid = Platform.OS === 'android';

  // ...

  const listBottomPadding = Math.max(

- spacing[16] + (process.env.EXPO_OS === 'android' ? 16 : 0),

* spacing[16] + (isAndroid ? 16 : 0),
  (showFab ? fabBottom + 56 : 0) + spacing[8],
  );
  Also applies to: 483-486

src/components/screens/lab-test-details-modal.tsx (1)
88-96: Consider using the i18n formatDate utility for consistency with the rest of the app.

The local formatDate function replicates what the i18n utility from @/i18n/format provides. Since this app is India-specific (locales: en-IN, mr-IN, hi-IN), you can produce the same DD-MM-YYYY format using formatDate(date, { year: 'numeric', month: '2-digit', day: '2-digit' }). This approach ensures consistency across the codebase, where most components already use the i18n helper with custom options. The same pattern appears elsewhere (e.g., app/lab-tests.tsx), so consolidating on the i18n utility would also reduce duplication.

app/(tabs)/index.tsx (1)
79-79: Greeting may become stale if the app remains open.

The greetingKey is memoized with an empty dependency array, so it will only compute once when the component mounts. If a user keeps the app open across time boundaries (e.g., from morning to afternoon), the greeting won't update.

Consider adding a time-based dependency or removing memoization since getGreetingKey() is a lightweight computation:

♻️ Proposed fix

- const greetingKey = useMemo(() => getGreetingKey(), []);

* const greetingKey = getGreetingKey();
  app/(tabs)/settings.tsx (1)
  1023-1030: Async toggle errors may go unhandled.

The onToggle callback can return a Promise, but the void keyword discards it without error handling. If any async handler throws (e.g., permission request fails unexpectedly), it becomes an unhandled promise rejection.

🛡️ Proposed fix with error boundary
<Switch
value={enabled}

-        onValueChange={(value) => {
-          void onToggle(value);
-        }}

*        onValueChange={(value) => {
*          Promise.resolve(onToggle(value)).catch((error) => {
*            if (__DEV__) {
*              console.error('Toggle error:', error);
*            }
*          });
*        }}
           trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
           thumbColor={enabled ? '#22C55E' : '#F3F4F6'}
         />
  app/(tabs)/explore.tsx (1)
  56-57: Consider using useRef for Animated.Value instances.

useMemo works here but useRef is more semantically appropriate for mutable values that persist across renders without triggering re-renders. This is a minor stylistic preference.

♻️ Proposed refactor

- const scrollY = useMemo(() => new Animated.Value(0), []);
- const tabSwitchAnim = useMemo(() => new Animated.Value(1), []);

* const scrollY = useRef(new Animated.Value(0)).current;
* const tabSwitchAnim = useRef(new Animated.Value(1)).current;
