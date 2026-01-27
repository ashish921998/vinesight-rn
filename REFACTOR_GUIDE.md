# Native UI Refactor Implementation Guide

**Branch:** `refactor/native-ui-strict`  
**Status:** Phases 1-6 Complete ✅ (tests/commits pending). Phase 7 in progress (Day 2).  
**Estimated Total Time:** 2-3 weeks  
**Completion:** ~55% (Phase 7 underway)

---

## Quick Start

```bash
# Switch to refactor branch
git checkout refactor/native-ui-strict

# Check current status
git log --oneline -1
# Should show: "Phase 1: Foundation - Add expo-symbols, create theme system"
```

---

## ✅ Phase 1: Foundation Setup (COMPLETE)

**Status:** ✅ Done (Committed: 2b0da94)

**What was done:**
- ✅ Created branch `refactor/native-ui-strict`
- ✅ Installed `expo-symbols` package
- ✅ Created `src/styles/theme.ts` with complete design system
- ✅ Created `src/styles/utils.ts` with helper functions
- ✅ Ported all Tailwind config to native styles

**Files created:**
- `src/styles/theme.ts`
- `src/styles/utils.ts`
- `src/styles/index.ts`

---

## 📋 Phase 2: Icon Migration (50+ files)

**Goal:** Replace all `@expo/vector-icons` (Ionicons) with `expo-symbols` (SF Symbols)

**Time Estimate:** 4-6 hours

### Icon Mapping Reference

Create this mapping file first:

```typescript
// src/utils/iconMapping.ts
export const ICON_MAPPING: Record<string, string> = {
  // Navigation
  'arrow-back': 'chevron.left',
  'arrow-forward': 'chevron.right',
  'chevron-back': 'chevron.left',
  'chevron-forward': 'chevron.right',
  'chevron-down': 'chevron.down',
  'close': 'xmark',
  'close-circle': 'xmark.circle.fill',
  
  // Actions
  'add': 'plus',
  'add-circle': 'plus.circle.fill',
  'remove-circle': 'minus.circle.fill',
  'checkmark': 'checkmark',
  'checkmark-circle': 'checkmark.circle.fill',
  'create-outline': 'pencil',
  'pencil': 'pencil',
  'trash': 'trash',
  'trash-outline': 'trash',
  'search': 'magnifyingglass',
  'search-outline': 'magnifyingglass',
  'refresh': 'arrow.clockwise',
  
  // UI Elements
  'grid': 'square.grid.2x2',
  'grid-outline': 'square.grid.2x2',
  'list-outline': 'list.bullet',
  'options': 'ellipsis',
  'ellipsis-horizontal-circle': 'ellipsis.circle',
  'menu': 'line.3.horizontal',
  
  // Farm & Agriculture
  'leaf': 'leaf.fill',
  'leaf-outline': 'leaf',
  'water': 'drop.fill',
  'water-outline': 'drop',
  'sunny': 'sun.max.fill',
  'partly-sunny': 'cloud.sun.fill',
  'rainy': 'cloud.rain.fill',
  'flash': 'bolt.fill',
  
  // Business
  'calendar': 'calendar',
  'calendar-outline': 'calendar',
  'time': 'clock.fill',
  'time-outline': 'clock',
  'location': 'location.fill',
  'location-outline': 'location',
  'cash': 'dollarsign.circle.fill',
  'cash-outline': 'dollarsign.circle',
  'receipt': 'receipt',
  'wallet-outline': 'wallet.pass',
  
  // People
  'people': 'person.2.fill',
  'people-outline': 'person.2',
  'person': 'person.fill',
  'person-outline': 'person',
  
  // Analytics
  'analytics': 'chart.bar.fill',
  'analytics-outline': 'chart.bar',
  'bar-chart-outline': 'chart.bar',
  'trending-up': 'chart.line.uptrend.xyaxis',
  'trending-down': 'chart.line.downtrend.xyaxis',
  'speedometer': 'gauge',
  
  // Info & Alerts
  'information-circle': 'info.circle.fill',
  'information-circle-outline': 'info.circle',
  'alert-circle': 'exclamationmark.circle.fill',
  'alert-circle-outline': 'exclamationmark.circle',
  'warning': 'exclamationmark.triangle.fill',
  'warning-outline': 'exclamationmark.triangle',
  'help-circle-outline': 'questionmark.circle',
  
  // Documents
  'document': 'doc.fill',
  'document-text': 'doc.text.fill',
  'document-text-outline': 'doc.text',
  
  // Tools & Science
  'flask': 'flask.fill',
  'flask-outline': 'flask',
  'beaker-outline': 'flask',
  'layers': 'square.stack.3d.up.fill',
  'layers-outline': 'square.stack.3d.up',
  'cube-outline': 'cube',
  
  // Settings
  'settings': 'gearshape.fill',
  'settings-outline': 'gearshape',
  'shield-checkmark': 'checkmark.shield.fill',
  'log-out-outline': 'rectangle.portrait.and.arrow.right',
  
  // Misc
  'notifications': 'bell.fill',
  'star-outline': 'star',
  'checkbox-outline': 'square',
  'alarm': 'alarm.fill',
  'bulb': 'lightbulb.fill',
  'bug': 'ant.fill',
  'basket': 'basket.fill',
  'cut-outline': 'scissors',
  'resize': 'arrow.up.left.and.arrow.down.right',
  'resize-outline': 'arrow.up.left.and.arrow.down.right',
  'git-branch': 'arrow.triangle.branch',
  'globe': 'globe',
  'cloud-offline': 'cloud.slash',
  'arrow-up-circle': 'arrow.up.circle.fill',
  'calculator': 'function',
  'calculator-outline': 'function',
  'compass': 'compass.fill',
  'compass-outline': 'compass',
  'save': 'square.and.arrow.down.fill',
};
```

### Step-by-Step Instructions

**Step 1: Create Icon Component Wrapper**

```typescript
// src/components/ui/Symbol.tsx
import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import React from 'react';

interface SymbolProps {
  name: string;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
}

export function Symbol({ name, size = 24, color = '#000', weight = 'regular' }: SymbolProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      type="monochrome"
      fallback={
        <SymbolView name="questionmark.circle" size={size} tintColor={color} weight={weight} />
      }
    />
  );
}
```

**Step 2: Replace Icons File by File**

For each file with `@expo/vector-icons`:

```typescript
// Before:
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="leaf" size={24} color="#408059" />

// After:
import { Symbol } from '@/components/ui/Symbol';
<Symbol name="leaf.fill" size={24} color="#408059" />
```

**Step 3: Automated Search & Replace**

Create a script to help identify all icons:

```bash
# Find all Ionicons imports
grep -rn "from '@expo/vector-icons'" app/ src/ --include="*.tsx" --include="*.ts"

# Count occurrences
grep -r "Ionicons" app/ src/ --include="*.tsx" --include="*.ts" | wc -l
```

### Files to Update (in order)

#### UI Components (Priority 1)
- [ ] `src/components/ui/Input.tsx`
- [ ] `src/components/ui/Button.tsx`
- [ ] `src/components/ui/FormComponents.tsx`
- [ ] `src/components/ui/UnitPickerModal.tsx`
- [ ] `src/components/ui/UnitPickerModal 2.tsx`

#### Cards (Priority 2)
- [ ] `src/components/cards/QuickActionButton.tsx`
- [ ] `src/components/cards/StatsCard.tsx`
- [ ] `src/components/cards/WorkerCard.tsx`
- [ ] `src/components/cards/ActivityLogCard.tsx`
- [ ] `src/components/cards/FarmCard.tsx`

#### Forms (Priority 3)
- [ ] `src/components/forms/HarvestForm.tsx`
- [ ] `src/components/forms/FertigationForm.tsx`
- [ ] `src/components/forms/IrrigationForm.tsx`
- [ ] `src/components/forms/ExpenseForm.tsx`
- [ ] `src/components/forms/SprayForm.tsx`
- [ ] `src/components/forms/FormField.tsx`

#### Screens/Modals (Priority 4)
- [ ] `src/components/screens/AttendanceView.tsx`
- [ ] `src/components/screens/WaterLevelModal.tsx`
- [ ] `src/components/screens/AddEntryModal.tsx`
- [ ] `src/components/screens/AddLabTestModal.tsx`
- [ ] `src/components/screens/ParameterSelector.tsx`
- [ ] `src/components/screens/ParameterSelector 2.tsx`
- [ ] `src/components/screens/AddSoilProfileModal.tsx`
- [ ] `src/components/screens/AddTaskModal.tsx`
- [ ] `src/components/screens/AddStockModal.tsx`
- [ ] `src/components/screens/AddWorkerModal.tsx`
- [ ] `src/components/screens/AddWarehouseItemModal.tsx`
- [ ] `src/components/screens/AddActivityModal.tsx`
- [ ] `src/components/screens/EditActivityModal.tsx`

#### Pages (Priority 5)
- [ ] `app/(tabs)/_layout.tsx` - **IMPORTANT: Tab icons**
- [ ] `app/(tabs)/index.tsx`
- [ ] `app/(tabs)/explore.tsx`
- [ ] `app/(tabs)/farms.tsx`
- [ ] `app/(tabs)/workers.tsx`
- [ ] `app/(tabs)/tools.tsx`
- [ ] `app/(tabs)/settings.tsx`
- [ ] `app/logs.tsx`
- [ ] `app/tasks.tsx`
- [ ] `app/warehouse.tsx`
- [ ] `app/weather.tsx`
- [ ] `app/ai-chat.tsx`
- [ ] `app/analytics.tsx`
- [ ] `app/reports.tsx`
- [ ] `app/lab-tests.tsx`
- [ ] `app/soil-profiling.tsx`
- [ ] `app/soil-trends.tsx`
- [ ] `app/petiole-trends.tsx`
- [ ] `app/onboarding.tsx`
- [ ] `app/(auth)/login.tsx`
- [ ] `app/(auth)/otp-verification.tsx`
- [ ] `app/farm/add.tsx`
- [ ] `app/farm/add_old.tsx`
- [ ] `app/farm/[id].tsx`
- [ ] `app/farm/[id]/edit.tsx`
- [ ] `app/calculator/lai.tsx`
- [ ] `app/calculator/system-discharge.tsx`
- [ ] `app/calculator/mad.tsx`
- [ ] `app/calculator/nutrients.tsx`
- [ ] `src/components/ErrorBoundary.tsx`

### Testing After Icons Migration

```bash
# Typecheck
npm run typecheck

# Try to run
npm start

# Verify no Ionicons imports remain
grep -r "from '@expo/vector-icons'" app/ src/ --include="*.tsx"
# Should return no results
```

### Commit

```bash
git add -A
git commit -m "Phase 2: Icon migration - Replace @expo/vector-icons with expo-symbols

- Create Symbol component wrapper
- Create icon mapping for Ionicons -> SF Symbols
- Replace all Ionicons usage across 50+ files
- Update tab navigation icons
- Test and verify all icons render correctly

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 3: Platform.OS → process.env.EXPO_OS (17 files)

**Goal:** Replace all `Platform.OS` checks with `process.env.EXPO_OS`

**Time Estimate:** 1-2 hours

### Automated Find & Replace

```bash
# Find all Platform.OS usage
grep -rn "Platform\.OS" app/ src/ --include="*.tsx" --include="*.ts"

# Find all Platform imports
grep -rn "from 'react-native'" app/ src/ --include="*.tsx" | grep Platform
```

### Replace Pattern

```typescript
// Before:
import { Platform } from 'react-native';
const isIOS = Platform.OS === 'ios';

// After:
const isIOS = process.env.EXPO_OS === 'ios';
// Remove Platform import if not used elsewhere
```

### Files to Update

- [ ] `src/lib/supabase.ts`
- [ ] `src/components/screens/AddLabTestModal.tsx`
- [ ] `src/components/screens/AddSoilProfileModal.tsx`
- [ ] `src/components/screens/AddTaskModal.tsx`
- [ ] `src/components/ui/FormComponents.tsx`
- [ ] `app/ai-chat.tsx`
- [ ] `app/(auth)/login.tsx`
- [ ] `app/(tabs)/_layout.tsx`
- [ ] `app/(tabs)/settings.tsx`
- [ ] `app/calculator/lai.tsx`
- [ ] `app/calculator/system-discharge.tsx`
- [ ] `app/calculator/nutrients.tsx`
- [ ] `app/calculator/mad.tsx`
- [ ] `app/farm/[id]/edit.tsx`
- [ ] `app/farm/add_old.tsx`
- [ ] `app/reports.tsx`

### Commit

```bash
git add -A
git commit -m "Phase 3: Replace Platform.OS with process.env.EXPO_OS

- Update 17 files to use process.env.EXPO_OS instead of Platform.OS
- Remove unused Platform imports
- More consistent with Expo conventions

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 4: Shadow Properties → boxShadow (6 files)

**Goal:** Convert iOS shadow props and Android elevation to unified boxShadow

**Time Estimate:** 30 minutes

### Replace Pattern

```typescript
// Before:
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3, // Android
}

// After:
{
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
}
```

### Files to Update

- [ ] `src/services/weatherService.ts`
- [ ] `src/types/weather.ts`
- [ ] `app/tasks.tsx`
- [ ] `app/logs.tsx`
- [ ] `app/(tabs)/_layout.tsx`
- [ ] `app/(tabs)/explore.tsx`
- [ ] `app/farm/[id].tsx`

### Commit

```bash
git add -A
git commit -m "Phase 4: Convert shadow properties to boxShadow

- Replace iOS shadowColor/shadowOffset/shadowOpacity/shadowRadius
- Remove Android elevation props
- Use unified boxShadow syntax across 6 files

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 5: SafeAreaView Replacement (17 files)

**Goal:** Replace SafeAreaView with ScrollView/FlatList + contentInsetAdjustmentBehavior

**Time Estimate:** 2-3 hours

### Replace Pattern

```typescript
// Before:
import { SafeAreaView } from 'react-native';
<SafeAreaView style={{ flex: 1 }}>
  <View>...</View>
</SafeAreaView>

// After:
import { ScrollView } from 'react-native';
<ScrollView
  contentInsetAdjustmentBehavior="automatic"
  style={{ flex: 1 }}
>
  <View>...</View>
</ScrollView>
```

### Files to Update

- [ ] `app/ai-chat.tsx`
- [ ] `app/warehouse.tsx`
- [ ] `app/onboarding.tsx`
- [ ] `app/analytics.tsx`
- [ ] `app/petiole-trends.tsx`
- [ ] `app/tasks.tsx`
- [ ] `app/logs.tsx`
- [ ] `app/soil-trends.tsx`
- [ ] `app/soil-profiling.tsx`
- [ ] `app/calculator/mad.tsx`
- [ ] `app/calculator/lai.tsx`
- [ ] `app/calculator/system-discharge.tsx`
- [ ] `app/calculator/nutrients.tsx`
- [ ] `app/lab-tests.tsx`
- [ ] `app/reports.tsx`
- [ ] `app/farm/add_old.tsx`
- [ ] `app/farm/add.tsx`
- [ ] `src/components/screens/AddTaskModal.tsx`

### Commit

```bash
git add -A
git commit -m "Phase 5: Replace SafeAreaView with ScrollView + contentInsetAdjustmentBehavior

- Remove SafeAreaView from 17 files
- Use ScrollView/FlatList with contentInsetAdjustmentBehavior=automatic
- Adjust padding/spacing for new layout

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 6: Minor Fixes (6 files)

**Goal:** Clean up Dimensions, StyleSheet, contentInsetAdjustmentBehavior

**Time Estimate:** 1 hour

### 6.1: Dimensions → useWindowDimensions

```typescript
// Before:
import { Dimensions } from 'react-native';
const windowWidth = Dimensions.get('window').width;

// After:
import { useWindowDimensions } from 'react-native';
const { width: windowWidth } = useWindowDimensions();
```

**File:** `src/components/screens/TrendsChart.tsx`

### 6.2: Remove StyleSheet.create

```typescript
// Before:
import { StyleSheet } from 'react-native';
const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
<View style={styles.row} />

// After:
const styles = {
  row: { flexDirection: 'row' as const },
};
<View style={styles.row} />
```

**File:** `src/components/screens/TrendsTable.tsx`

### 6.3: Fix contentInsetAdjustmentBehavior in Calculators

Change `contentInsetAdjustmentBehavior="never"` to `"automatic"` in:
- [ ] `app/calculator/lai.tsx`
- [ ] `app/calculator/system-discharge.tsx`
- [ ] `app/calculator/mad.tsx`
- [ ] `app/calculator/nutrients.tsx`

### Commit

```bash
git add -A
git commit -m "Phase 6: Minor fixes - Dimensions, StyleSheet, contentInsetAdjustmentBehavior

- Replace Dimensions.get with useWindowDimensions in TrendsChart
- Remove StyleSheet.create from TrendsTable
- Fix contentInsetAdjustmentBehavior in calculator screens

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 🔴 Phase 7: NativeWind Removal (70+ files) - MAJOR

**Goal:** Convert all className props to inline styles

**Time Estimate:** 3-5 days

**⚠️ WARNING:** This is the most time-consuming phase. Visual regressions are likely.

### Strategy

1. **Take screenshots of all screens FIRST**
2. **Work component by component** (UI primitives → cards → forms → screens → pages)
3. **Use theme constants** from `src/styles/theme.ts`
4. **Test frequently** - run app after each file/batch

### Conversion Helper Script

```bash
# Create a script to help with common conversions
cat > scripts/convert-tailwind.js << 'EOF'
// scripts/convert-tailwind.js
const tailwindToStyle = {
  // Backgrounds
  'bg-white': { backgroundColor: '#ffffff' },
  'bg-white/80': { backgroundColor: 'rgba(255, 255, 255, 0.8)' },
  'bg-primary-600': { backgroundColor: '#346a4a' },
  'bg-surface-50': { backgroundColor: '#f2f2f7' },
  
  // Padding
  'p-4': { padding: 16 },
  'px-4': { paddingHorizontal: 16 },
  'py-3': { paddingVertical: 12 },
  'pt-2': { paddingTop: 8 },
  'pb-4': { paddingBottom: 16 },
  
  // Margin
  'm-2': { margin: 8 },
  'mx-4': { marginHorizontal: 16 },
  'my-2': { marginVertical: 8 },
  'mt-4': { marginTop: 16 },
  'mb-2': { marginBottom: 8 },
  
  // Border radius
  'rounded-xl': { borderRadius: 16 },
  'rounded-2xl': { borderRadius: 20 },
  'rounded-full': { borderRadius: 9999 },
  
  // Flex
  'flex': { display: 'flex' },
  'flex-row': { flexDirection: 'row' },
  'flex-col': { flexDirection: 'column' },
  'items-center': { alignItems: 'center' },
  'justify-center': { justifyContent: 'center' },
  'justify-between': { justifyContent: 'space-between' },
  
  // Text
  'text-lg': { fontSize: 18 },
  'text-base': { fontSize: 16 },
  'text-sm': { fontSize: 14 },
  'font-semibold': { fontWeight: '600' },
  'font-bold': { fontWeight: '700' },
  'text-primary-600': { color: '#346a4a' },
  'text-surface-900': { color: '#2c2c2e' },
};

console.log('Tailwind to Style converter ready');
console.log('Use theme constants from src/styles/theme.ts');
EOF
```

### File-by-File Checklist

#### UI Components
- [ ] `src/components/ui/Button.tsx`
- [ ] `src/components/ui/Input.tsx`
- [ ] `src/components/ui/FormComponents.tsx`
- [ ] `src/components/ui/OTPInput.tsx`
- [ ] `src/components/ui/UnitPickerModal.tsx`
- [ ] `src/components/ui/UnitPickerModal 2.tsx`
- [ ] `src/components/ui/CropIcon.tsx`

#### Cards
- [ ] `src/components/cards/QuickActionButton.tsx`
- [ ] `src/components/cards/StatsCard.tsx`
- [ ] `src/components/cards/WorkerCard.tsx`
- [ ] `src/components/cards/ActivityLogCard.tsx`
- [ ] `src/components/cards/FarmCard.tsx`

#### Forms
- [ ] `src/components/forms/HarvestForm.tsx`
- [ ] `src/components/forms/FertigationForm.tsx`
- [ ] `src/components/forms/IrrigationForm.tsx`
- [ ] `src/components/forms/ExpenseForm.tsx`
- [ ] `src/components/forms/SprayForm.tsx`
- [ ] `src/components/forms/FormField.tsx`

#### Screens/Modals (15+ files)
- [ ] `src/components/screens/AttendanceView.tsx`
- [ ] `src/components/screens/WaterLevelModal.tsx`
- [ ] `src/components/screens/AddEntryModal.tsx`
- [ ] `src/components/screens/AddLabTestModal.tsx`
- [ ] `src/components/screens/TrendsChart.tsx`
- [ ] `src/components/screens/ParameterSelector.tsx`
- [ ] `src/components/screens/ParameterSelector 2.tsx`
- [ ] `src/components/screens/AddStockModal.tsx`
- [ ] `src/components/screens/AddWorkerModal.tsx`
- [ ] `src/components/screens/AddSoilProfileModal.tsx`
- [ ] `src/components/screens/EditActivityModal.tsx`
- [ ] `src/components/screens/AddActivityModal.tsx`
- [ ] `src/components/screens/AddTaskModal.tsx`
- [ ] `src/components/screens/TrendsTable.tsx`
- [ ] `src/components/screens/AddWarehouseItemModal.tsx`

#### Pages (35+ files)
- [ ] `app/(tabs)/index.tsx`
- [ ] `app/(tabs)/explore.tsx`
- [ ] `app/(tabs)/farms.tsx`
- [ ] `app/(tabs)/workers.tsx`
- [ ] `app/(tabs)/tools.tsx`
- [ ] `app/(tabs)/settings.tsx`
- [ ] `app/index.tsx`
- [ ] `app/logs.tsx`
- [ ] `app/tasks.tsx`
- [ ] `app/warehouse.tsx`
- [ ] `app/weather.tsx`
- [ ] `app/ai-chat.tsx`
- [ ] `app/analytics.tsx`
- [ ] `app/reports.tsx`
- [ ] `app/lab-tests.tsx`
- [ ] `app/soil-profiling.tsx`
- [ ] `app/soil-trends.tsx`
- [ ] `app/petiole-trends.tsx`
- [ ] `app/onboarding.tsx`
- [ ] `app/(auth)/login.tsx`
- [ ] `app/(auth)/otp-verification.tsx`
- [ ] `app/farm/add.tsx`
- [ ] `app/farm/[id].tsx`
- [ ] `app/farm/[id]/edit.tsx`
- [ ] `app/calculator/lai.tsx`
- [ ] `app/calculator/system-discharge.tsx`
- [ ] `app/calculator/mad.tsx`
- [ ] `app/calculator/nutrients.tsx`
- [ ] `src/components/ErrorBoundary.tsx`
- [ ] `src/components/AnimatedSplash.tsx`

### After All Files Converted

**Remove NativeWind dependencies:**

```bash
# Uninstall packages
npm uninstall nativewind tailwindcss

# Remove files
rm tailwind.config.js
rm src/global.css

# Update metro.config.js (remove NativeWind plugin)
# Update babel.config.js (remove nativewind preset)
# Update app/_layout.tsx (remove global.css import)
```

### Commit

```bash
git add -A
git commit -m "Phase 7: Remove NativeWind - Convert all className to inline styles

- Convert 70+ files from Tailwind className to inline styles
- Use theme constants from src/styles/theme.ts
- Remove nativewind and tailwindcss dependencies
- Remove tailwind.config.js and src/global.css
- Update metro and babel configs

BREAKING CHANGE: Complete styling system migration

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 🔴 Phase 8: Modal Architecture (15+ files) - MAJOR

**Goal:** Convert custom Modal components to route-based modal presentations

**Time Estimate:** 3-4 days

**⚠️ WARNING:** This changes the entire navigation flow and data passing patterns.

### Strategy

For each modal, create a new route file and update navigation logic.

### Example Migration

#### Before: Custom Modal

```typescript
// Parent component
const [showModal, setShowModal] = useState(false);
<AddWorkerModal visible={showModal} onClose={() => setShowModal(false)} />

// src/components/screens/AddWorkerModal.tsx
export function AddWorkerModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide">
      {/* Modal content */}
    </Modal>
  );
}
```

#### After: Route-based Modal

```typescript
// Parent component
import { router } from 'expo-router';
<Button onPress={() => router.push('/add-worker')} />

// app/add-worker.tsx
import { Stack } from 'expo-router';

export default function AddWorkerScreen() {
  const router = useRouter();
  
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Add Worker',
        }}
      />
      <View>{/* Modal content */}</View>
    </>
  );
}
```

### Modals to Migrate

- [ ] `AddActivityModal` → `app/add-activity.tsx`
- [ ] `AddEntryModal` → `app/add-entry.tsx`
- [ ] `AddLabTestModal` → `app/add-lab-test.tsx`
- [ ] `AddSoilProfileModal` → `app/add-soil-profile.tsx`
- [ ] `AddStockModal` → `app/add-stock.tsx`
- [ ] `AddTaskModal` → `app/add-task.tsx`
- [ ] `AddWarehouseItemModal` → `app/add-warehouse-item.tsx`
- [ ] `AddWorkerModal` → `app/add-worker.tsx`
- [ ] `EditActivityModal` → `app/edit-activity/[id].tsx`
- [ ] `WaterLevelModal` → `app/water-level.tsx`
- [ ] `UnitPickerModal` → Consider keeping as overlay or convert to sheet
- [ ] `UnitPickerModal 2` → Remove duplicate

### State Management Updates

For modals that need to pass data:

1. **Option A: Route params** (for simple data)
```typescript
router.push({
  pathname: '/edit-activity/[id]',
  params: { id: activity.id, type: activity.type }
});
```

2. **Option B: Zustand store** (for complex data/callbacks)
```typescript
// src/stores/modalStore.ts
interface ModalStore {
  editActivityData: Activity | null;
  setEditActivityData: (data: Activity | null) => void;
}
```

### Commit

```bash
git add -A
git commit -m "Phase 8: Modal architecture - Convert to route-based modals

- Create new route files for all modals in app/ directory
- Update navigation from Modal component to router.push
- Update data passing via route params and stores
- Delete old Modal component files
- Configure Stack.Screen presentation options

BREAKING CHANGE: Complete modal system refactor

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 9: AsyncStorage & WebView Alternatives (4 files)

**Goal:** Remove forbidden AsyncStorage and WebView usage

**Time Estimate:** 2-3 hours (or more if backend changes needed)

### 9.1: Supabase Web Storage

**File:** `src/lib/supabase.ts`

```typescript
// Before:
import AsyncStorage from '@react-native-async-storage/async-storage';

// After:
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';

// Use SecureStore for native, FileSystem for web
```

### 9.2: Lab Test PDF Parsing

**File:** `src/components/screens/AddLabTestModal.tsx`

**Options:**
1. **Server-side parsing** (Recommended)
   - Upload PDF to Supabase Storage
   - Parse on backend with proper PDF library
   - Return structured data

2. **Remove WebView, use native PDF viewer**
   - Use `expo-document-picker` only
   - Manual data entry (no auto-parsing)

3. **Third-party PDF parsing service**
   - Use OCR service API
   - Parse PDF server-side

### 9.3: Onboarding Store

**File:** `src/stores/onboardingStore.ts`

```typescript
// Before:
import AsyncStorage from '@react-native-async-storage/async-storage';

// After:
import * as SecureStore from 'expo-secure-store';
// OR: Keep in-memory only (reset on app restart)
```

### Commit

```bash
git add -A
git commit -m "Phase 9: Remove AsyncStorage and WebView

- Replace AsyncStorage with SecureStore in supabase.ts
- Remove WebView PDF parsing from AddLabTestModal
- Update onboarding storage strategy
- Implement server-side PDF parsing alternative

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 10: Tabs Migration (1 file)

**Goal:** Replace Tabs with NativeTabs (unstable API)

**Time Estimate:** 1-2 hours

**⚠️ WARNING:** This uses an unstable Expo API. Test thoroughly.

**File:** `app/(tabs)/_layout.tsx`

```typescript
// Before:
import { Tabs } from 'expo-router';

// After:
import { Tabs } from 'expo-router/unstable-native-tabs';
```

**Note:** May require additional configuration changes depending on Expo SDK version.

### Commit

```bash
git add -A
git commit -m "Phase 10: Migrate to NativeTabs

- Replace Tabs with expo-router/unstable-native-tabs
- Update tab configuration for native tabs
- Test thoroughly on iOS and Android

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 11: TouchableOpacity → Pressable (50+ files)

**Goal:** Standardize on Pressable throughout

**Time Estimate:** 3-4 hours

### Replace Pattern

```typescript
// Before:
import { TouchableOpacity } from 'react-native';
<TouchableOpacity onPress={handlePress} style={styles.button}>
  <Text>Press me</Text>
</TouchableOpacity>

// After:
import { Pressable } from 'react-native';
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7 }
  ]}
>
  <Text>Press me</Text>
</Pressable>
```

### Automated Search

```bash
# Find all TouchableOpacity usage
grep -rn "TouchableOpacity" app/ src/ --include="*.tsx"

# Count
grep -r "TouchableOpacity" app/ src/ --include="*.tsx" | wc -l
```

### Commit

```bash
git add -A
git commit -m "Phase 11: Replace TouchableOpacity with Pressable

- Convert all TouchableOpacity to Pressable across 50+ files
- Update pressed state styling
- Ensure accessibility props are maintained

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 🔴 Phase 12: File Renaming (50+ files) - MAJOR

**Goal:** Rename all files to kebab-case

**Time Estimate:** 2-3 days

**⚠️ WARNING:** High risk of breaking imports. Use TypeScript to catch errors.

### Rename Mapping

Create this first:

```bash
# Generate rename mapping
cat > RENAME_MAP.txt << 'EOF'
# Components
src/components/ui/Button.tsx → src/components/ui/button.tsx
src/components/ui/Input.tsx → src/components/ui/input.tsx
src/components/ui/FormComponents.tsx → src/components/ui/form-components.tsx
src/components/ui/OTPInput.tsx → src/components/ui/otp-input.tsx
src/components/ui/UnitPickerModal.tsx → src/components/ui/unit-picker-modal.tsx
src/components/ui/CropIcon.tsx → src/components/ui/crop-icon.tsx

# Fix files with spaces
src/components/ui/UnitPickerModal 2.tsx → src/components/ui/unit-picker-modal-v2.tsx
src/components/screens/ParameterSelector 2.tsx → src/components/screens/parameter-selector-v2.tsx

# Cards
src/components/cards/QuickActionButton.tsx → src/components/cards/quick-action-button.tsx
src/components/cards/StatsCard.tsx → src/components/cards/stats-card.tsx
src/components/cards/WorkerCard.tsx → src/components/cards/worker-card.tsx
src/components/cards/ActivityLogCard.tsx → src/components/cards/activity-log-card.tsx
src/components/cards/FarmCard.tsx → src/components/cards/farm-card.tsx

# ... add all other files
EOF
```

### Rename Script

```bash
#!/bin/bash
# scripts/rename-files.sh

# Read rename map and execute
while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue
  
  # Parse old and new paths
  old_path=$(echo "$line" | awk '{print $1}')
  new_path=$(echo "$line" | awk '{print $3}')
  
  # Rename with git mv (preserves history)
  if [ -f "$old_path" ]; then
    echo "Renaming: $old_path → $new_path"
    git mv "$old_path" "$new_path"
  else
    echo "File not found: $old_path"
  fi
done < RENAME_MAP.txt
```

### Update Imports

After renaming, fix all imports:

```bash
# Run TypeScript to find broken imports
npm run typecheck

# Fix imports manually or with script
# Update barrel exports (index.ts files)
```

### Commit

```bash
git add -A
git commit -m "Phase 12: Rename all files to kebab-case

- Rename 50+ files to kebab-case convention
- Fix files with spaces in names
- Update all imports across codebase
- Update barrel exports (index.ts files)
- Verify with TypeScript

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📋 Phase 13: Testing & Verification

**Goal:** Comprehensive testing and bug fixing

**Time Estimate:** 3-5 days

### Testing Checklist

#### 13.1: Static Analysis
- [ ] `npm run typecheck` - No TypeScript errors
- [ ] `npm run lint` - No ESLint errors
- [ ] `npm run format` - Code formatted

#### 13.2: Build Tests
- [ ] `npm start` - Dev server starts
- [ ] `npx expo start --ios` - iOS build works
- [ ] `npx expo start --android` - Android build works
- [ ] `npm run web` - Web build works

#### 13.3: Screen Testing (iOS)
- [ ] Splash screen
- [ ] Login / OTP verification
- [ ] Onboarding
- [ ] Dashboard (index)
- [ ] Explore tab (farms, workers, warehouse)
- [ ] Tools tab (calculators, AI chat)
- [ ] Settings tab
- [ ] Farm detail screen
- [ ] Farm add/edit screens
- [ ] All modals (now routes)
- [ ] Weather screen
- [ ] Analytics screen
- [ ] Reports screen
- [ ] Lab tests screen
- [ ] Soil profiling screens
- [ ] Tasks screen
- [ ] Logs screen

#### 13.4: Screen Testing (Android)
- [ ] Repeat all iOS tests on Android

#### 13.5: Functionality Testing
- [ ] User authentication flow
- [ ] Farm CRUD operations
- [ ] Worker management
- [ ] Activity logging
- [ ] Task management
- [ ] Warehouse management
- [ ] Reports generation
- [ ] Lab test data entry
- [ ] Calculator tools
- [ ] Weather integration
- [ ] AI chat functionality

#### 13.6: Visual Regression Testing
- [ ] Compare screenshots before/after
- [ ] Check spacing, colors, fonts
- [ ] Verify glass effects still work
- [ ] Check dark mode (if applicable)
- [ ] Verify responsive layouts

#### 13.7: Performance Testing
- [ ] App launch time
- [ ] Navigation performance
- [ ] List scrolling performance
- [ ] Memory usage
- [ ] Bundle size comparison

### Bug Tracking

Create a `BUGS.md` file to track issues:

```markdown
# Refactor Bugs

## Critical
- [ ] Issue 1

## High Priority
- [ ] Issue 2

## Medium Priority
- [ ] Issue 3

## Low Priority / Polish
- [ ] Issue 4
```

### Final Commit

```bash
git add -A
git commit -m "Phase 13: Testing and verification complete

- Fix all TypeScript errors
- Fix all ESLint issues
- Test all screens on iOS and Android
- Fix visual regressions
- Verify all functionality works
- Performance optimization

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 🎯 Final Steps

### Merge to Main

```bash
# Make sure all tests pass
npm run typecheck
npm run lint
npm test

# Merge
git checkout main
git merge refactor/native-ui-strict

# Push
git push origin main
```

### Clean Up

```bash
# Delete refactor branch (optional)
git branch -d refactor/native-ui-strict
git push origin --delete refactor/native-ui-strict

# Archive old code (optional)
git tag -a "pre-native-ui-refactor" HEAD~1 -m "Code before native UI refactor"
```

---

## 📊 Progress Tracking

| Phase | Status | Time Spent | Notes |
|-------|--------|------------|-------|
| 1. Foundation | ✅ Complete | - | Theme system created |
| 2. Icon Migration | ⬜ Pending | - | 50+ files |
| 3. Platform.OS | ⬜ Pending | - | 17 files |
| 4. Shadows | ⬜ Pending | - | 6 files |
| 5. SafeAreaView | ⬜ Pending | - | 17 files |
| 6. Minor Fixes | ⬜ Pending | - | 6 files |
| 7. NativeWind | ⬜ Pending | - | 70+ files - MAJOR |
| 8. Modal Architecture | ⬜ Pending | - | 15+ files - MAJOR |
| 9. AsyncStorage/WebView | ⬜ Pending | - | 4 files |
| 10. Tabs Migration | ⬜ Pending | - | 1 file |
| 11. TouchableOpacity | ⬜ Pending | - | 50+ files |
| 12. File Renaming | ⬜ Pending | - | 50+ files - MAJOR |
| 13. Testing | ⬜ Pending | - | Comprehensive |

**Total Estimated Time:** 2-3 weeks  
**Current Progress:** ~8%

---

## 💡 Tips

1. **Work in small batches** - Commit after each phase or sub-phase
2. **Test frequently** - Run the app after significant changes
3. **Use TypeScript** - Let it catch broken imports and type errors
4. **Take screenshots** - Before starting Phase 7, screenshot all screens
5. **Use branches** - Consider sub-branches for major phases (7, 8, 12)
6. **Document issues** - Keep BUGS.md updated
7. **Ask for help** - This is a massive refactor; pair programming helps
8. **Consider alternatives** - You can always decide to skip the major phases

---

## 🆘 Rollback Instructions

If anything goes wrong:

```bash
# See commit history
git log --oneline

# Rollback to specific commit
git reset --hard <commit-hash>

# Or rollback one phase
git reset --hard HEAD~1

# Force push if needed (be careful!)
git push origin refactor/native-ui-strict --force
```

---

## 📝 Notes

- This guide assumes you're working on the `refactor/native-ui-strict` branch
- Each phase is designed to be independently committable
- Phases 7, 8, and 12 are the most time-consuming and risky
- Consider doing phases 2-6 first, then re-evaluate if 7-12 are worth it
- This refactor will essentially rewrite 80% of the UI codebase

**Good luck! 🚀**
