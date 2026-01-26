# Phase 7: NativeWind Removal - Status Report

## ✅ Completed (Checkpoint 2)

### Files Converted (9 total):
1. **src/components/ui/Button.tsx** - Full theme integration
2. **src/components/ui/Input.tsx** - Legacy containerClassName support added
3. **src/components/ui/OTPInput.tsx** - Dynamic styling with proper types
4. **src/components/ui/FormComponents.tsx** - 10 components converted
5. **src/components/ui/UnitPickerModal.tsx** - Complete conversion
6. **src/components/cards/QuickActionButton.tsx** - Pressable state handling
7. **src/components/cards/StatsCard.tsx** - Theme integration
8. **src/components/cards/ActivityLogCard.tsx** - Full conversion
9. **app/(auth)/login.tsx** - Auth screen converted

### Stats:
- **Lines changed**: ~1,400+ insertions, ~400 deletions
- **Progress**: 9/50 files with className (18%)
- **Remaining**: 41 files with ~1,850 className usages

## 📋 Remaining Work - Priority Order

### High Priority (User-Facing Screens)
1. **app/(auth)/otp-verification.tsx** (162 lines, 17 className usages)
2. **src/components/cards/WorkerCard.tsx** (80 lines, 13 usages)
3. **src/components/cards/FarmCard.tsx** (127 lines, 22 usages)
4. **app/(tabs)/index.tsx** - Dashboard (28 usages)
5. **app/(tabs)/farms.tsx** (34 usages)
6. **app/(tabs)/workers.tsx** (32 usages)
7. **app/(tabs)/explore.tsx** (130 usages) - LARGE
8. **app/(tabs)/settings.tsx** (72 usages)

### Medium Priority (Feature Screens)
9. **app/logs.tsx** (102 usages) - LARGE
10. **app/tasks.tsx** (39 usages)
11. **app/warehouse.tsx** (54 usages)
12. **app/weather.tsx** (125 usages) - LARGE
13. **app/analytics.tsx** (88 usages) - LARGE
14. **app/ai-chat.tsx** (29 usages)
15. **app/reports.tsx** (69 usages)
16. **app/onboarding.tsx** (57 usages)

### Low Priority (Forms & Modals)
17-22. **Forms** (6 files, 133 total usages)
    - HarvestForm.tsx (28)
    - FertigationForm.tsx (27)
    - ExpenseForm.tsx (24)
    - SprayForm.tsx (20)
    - FormField.tsx (19)
    - IrrigationForm.tsx (15)

23-32. **Screens/Modals** (10 files, 390 total usages)
    - AttendanceView.tsx (147) - LARGEST
    - WaterLevelModal.tsx (63)
    - AddTaskModal.tsx (53)
    - AddSoilProfileModal.tsx (37)
    - TrendsChart.tsx (35)
    - AddLabTestModal.tsx (29)
    - TrendsTable.tsx (8)
    - AddStockModal.tsx (6)
    - ParameterSelector.tsx (6)
    - ParameterSelector 2.tsx (6)

33-40. **Calculators & Farm Routes** (8 files)
    - calculator/system-discharge.tsx (64)
    - calculator/mad.tsx (47)
    - calculator/nutrients.tsx (32)
    - calculator/lai.tsx (32)
    - farm/[id].tsx (84)
    - farm/add.tsx (24)
    - farm/add_old.tsx (48)
    - farm/[id]/edit.tsx (48)

41-43. **Misc**
    - lab-tests.tsx (36)
    - soil-profiling.tsx (66)
    - soil-trends.tsx, petiole-trends.tsx (19 each)

## 🔧 Conversion Pattern

For each file:
```typescript
// 1. Add imports
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { type ViewStyle, type TextStyle } from 'react-native';

// 2. Create style objects
const containerStyle: ViewStyle = {
  flex: 1,
  backgroundColor: colors.surface[100],
  // ... convert className to properties
};

// 3. Replace className with style
// Before: <View className="flex-1 bg-white px-4">
// After: <View style={containerStyle}>

// 4. Handle Pressable active states
// Before: <Pressable className="active:opacity-70">
// After: <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
```

## 🚀 Quick Reference - Common Conversions

```javascript
// Flex
'flex-1' → { flex: 1 }
'flex-row' → { flexDirection: 'row' }
'items-center' → { alignItems: 'center' }
'justify-between' → { justifyContent: 'space-between' }

// Spacing
'p-4' → { padding: spacing[4] } // 16px
'px-6' → { paddingHorizontal: spacing[6] } // 24px
'py-3' → { paddingVertical: spacing[3] } // 12px
'mt-4' → { marginTop: spacing[4] } // 16px
'mb-2' → { marginBottom: spacing[2] } // 8px

// Border
'rounded-xl' → { borderRadius: borderRadius.xl } // 16px
'rounded-2xl' → { borderRadius: borderRadius['2xl'] } // 20px
'rounded-full' → { borderRadius: borderRadius.full } // 9999px

// Colors (use theme)
'bg-white' → { backgroundColor: colors.surface[100] }
'bg-primary-600' → { backgroundColor: colors.primary[600] }
'text-surface-900' → { color: colors.surface[900] }

// Text
'text-lg' → { fontSize: fontSize.lg } // 18px
'font-semibold' → { fontWeight: fontWeight.semibold } // '600'
'text-center' → { textAlign: 'center' }
```

## 📊 Analysis Tool

Run the analysis script to see detailed className usage:
```bash
node scripts/convert-nativewind.js
```

## ⚠️ Known Issues

1. **Legacy Props**: Input component supports `containerClassName` for backward compatibility
2. **Type Errors**: Some pre-existing TypeScript errors in forms (29 errors, not related to our changes)
3. **Symbol Icons**: Some icon names need SF Symbol equivalents

## 🎯 Next Session Goals

1. Convert remaining auth screen (otp-verification.tsx)
2. Convert remaining cards (WorkerCard, FarmCard)
3. Convert dashboard and main tabs (index, farms, workers)
4. Test converted screens visually
5. Create Checkpoint 3 commit

Estimated time for remaining work: 4-6 hours total
- High priority screens: 2-3 hours
- Forms & modals: 2-3 hours
- Final cleanup & testing: 1 hour
