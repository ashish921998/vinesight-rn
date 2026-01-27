# Native UI Refactor - Quick Checklist

**Branch:** `refactor/native-ui-strict`  
**Guide:** See `REFACTOR_GUIDE.md` for detailed instructions

---

## ✅ Phase 1: Foundation (COMPLETE)
- [x] Create branch
- [x] Install expo-symbols
- [x] Create theme system
- [x] Commit

---

## Phase 2: Icon Migration (50+ files) - 4-6 hours

### Setup
- [x] Create `src/components/ui/Symbol.tsx` wrapper component
- [x] Create icon mapping in guide reference

### Convert Files (check off as you go)

**UI Components:**
- [x] Input.tsx
- [x] Button.tsx
- [x] FormComponents.tsx
- [x] UnitPickerModal.tsx
- [x] UnitPickerModal 2.tsx

**Cards (5 files):**
- [x] QuickActionButton
- [x] StatsCard
- [x] WorkerCard
- [x] ActivityLogCard
- [x] FarmCard

**Forms (6 files):**
- [x] HarvestForm
- [x] FertigationForm
- [x] IrrigationForm
- [x] ExpenseForm
- [x] SprayForm
- [x] FormField

**Screens/Modals (13 files):**
- [x] AttendanceView
- [x] WaterLevelModal
- [x] AddEntryModal
- [x] AddLabTestModal
- [x] ParameterSelector (+ v2)
- [x] AddSoilProfileModal
- [x] AddTaskModal
- [x] AddStockModal
- [x] AddWorkerModal
- [x] AddWarehouseItemModal
- [x] AddActivityModal
- [x] EditActivityModal

**Pages - Tab screens:**
- [x] _(tabs)/_layout.tsx (IMPORTANT - tab icons)
- [x] index.tsx
- [x] explore.tsx
- [x] farms.tsx
- [x] workers.tsx
- [x] tools.tsx
- [x] settings.tsx

**Pages - Other (27 files):**
- [x] logs.tsx
- [x] tasks.tsx
- [x] warehouse.tsx
- [x] weather.tsx
- [x] ai-chat.tsx
- [x] analytics.tsx
- [x] reports.tsx
- [x] lab-tests.tsx
- [x] soil-profiling.tsx
- [x] soil-trends.tsx
- [x] petiole-trends.tsx
- [x] onboarding.tsx
- [x] (auth)/login.tsx
- [x] (auth)/otp-verification.tsx
- [x] farm/add.tsx
- [x] farm/add_old.tsx
- [x] farm/[id].tsx
- [x] farm/[id]/edit.tsx
- [x] calculator/lai.tsx
- [x] calculator/system-discharge.tsx
- [x] calculator/mad.tsx
- [x] calculator/nutrients.tsx
- [x] ErrorBoundary.tsx

### Test & Commit
- [x] Run `npm run typecheck`
- [ ] Test app runs
- [x] Verify no Ionicons imports remain outside Symbol fallback: `grep -r "from '@expo/vector-icons'" app/ src/`
- [ ] Commit: "Phase 2: Icon migration"
> Status: typecheck done; app run + Ionicons verify pending.

---

## Phase 3: Platform.OS → process.env.EXPO_OS (17 files) - 1-2 hours

- [x] supabase.ts
- [x] AddLabTestModal.tsx
- [x] AddSoilProfileModal.tsx
- [x] AddTaskModal.tsx
- [x] FormComponents.tsx
- [x] ai-chat.tsx
- [x] (auth)/login.tsx
- [x] (tabs)/_layout.tsx
- [x] (tabs)/settings.tsx
- [x] calculator/lai.tsx
- [x] calculator/system-discharge.tsx
- [x] calculator/nutrients.tsx
- [x] calculator/mad.tsx
- [x] farm/[id]/edit.tsx
- [x] farm/add_old.tsx
- [x] reports.tsx
- [x] AddEntryModal.tsx (line 1191)
- [ ] Commit: "Phase 3: Replace Platform.OS"
> Status: commit pending.

---

## Phase 4: Shadow Properties (6 files) - 30 mins

- [x] weatherService.ts
- [x] weather.ts (types)
- [x] tasks.tsx
- [x] logs.tsx
- [x] (tabs)/_layout.tsx
- [x] (tabs)/explore.tsx
- [x] farm/[id].tsx
- [ ] Commit: "Phase 4: Convert shadows to boxShadow"
> Status: commit pending.

---

## Phase 5: SafeAreaView Replacement (17 files) - 2-3 hours

- [x] ai-chat.tsx
- [x] warehouse.tsx
- [x] onboarding.tsx
- [x] analytics.tsx
- [x] petiole-trends.tsx
- [x] tasks.tsx
- [x] logs.tsx
- [x] soil-trends.tsx
- [x] soil-profiling.tsx
- [x] calculator/mad.tsx
- [x] calculator/lai.tsx
- [x] calculator/system-discharge.tsx
- [x] calculator/nutrients.tsx
- [x] lab-tests.tsx
- [x] reports.tsx
- [x] farm/add_old.tsx
- [x] farm/add.tsx
- [x] AddTaskModal.tsx
- [ ] Commit: "Phase 5: Replace SafeAreaView"
> Status: commit pending.

---

## Phase 6: Minor Fixes (6 files) - 1 hour

- [x] TrendsChart.tsx - Dimensions → useWindowDimensions
- [x] TrendsTable.tsx - Remove StyleSheet.create
- [x] calculator/lai.tsx - contentInsetAdjustmentBehavior
- [x] calculator/system-discharge.tsx - contentInsetAdjustmentBehavior
- [x] calculator/mad.tsx - contentInsetAdjustmentBehavior
- [x] calculator/nutrients.tsx - contentInsetAdjustmentBehavior
- [ ] Commit: "Phase 6: Minor fixes"
> Status: commit pending.

---

## 🛑 CHECKPOINT: Re-evaluate

**At this point you've completed phases 2-6 (the "easy wins").**

Test the app thoroughly:
- [ ] All screens load
- [ ] All icons display correctly
- [ ] No visual regressions
- [ ] App feels native
> Status: checkpoint tests not run yet.

**Decision time:**
- Continue with phases 7-12 (NativeWind removal, modal refactor, file renaming)? 
- OR: Stop here and keep current architecture?

---

## 🔴 Phase 7: NativeWind Removal (70+ files) - 3-5 DAYS

**⚠️ MAJOR CHANGE - Take screenshots of all screens first!**

### Day 1: UI Components & Cards
- [ ] Take screenshots of all screens
- [x] Convert UI components (7 files)
- [x] Convert Cards (5 files)
- [ ] Test and commit

### Day 2: Forms & Small Screens
- [x] Convert Forms (6 files)
- [x] Convert small screens (10 files)
- [ ] Test and commit

### Day 3-4: Large Screens & Pages
- [x] Convert remaining screens (15+ files) — completed (warehouse, ai-chat, farm/[id], tools tab, explore tab, reports, analytics, weather, logs, tasks, lab-tests, soil-profiling, petiole-trends, soil-trends, onboarding, farm add, farm edit, calculator screens, app index, AnimatedSplash, ErrorBoundary)
- [x] Remove legacy route: `app/farm/add_old.tsx`
- [x] Convert tab pages (7 files) — completed (_layout, index, farms, workers, tools, explore, settings)
- [ ] Test and commit

### Day 5: Other Pages & Cleanup
- [x] Convert remaining pages (27 files)
- [x] Remove NativeWind dependencies
- [x] Remove config files
- [x] Update metro/babel configs
- [ ] Final test and commit

---

## 🔴 Phase 8: Modal Architecture (15+ files) - 3-4 DAYS

**⚠️ MAJOR CHANGE - Changes entire navigation flow**

- [x] Plan data flow strategy (params + store)
- [x] Create route files for all modals
- [x] Update all modal invocations
- [ ] Test each modal route
- [ ] Delete old modal components (AddActivityModal removed; keep others as screen content)
- [x] Commit: "Phase 8: Modal architecture"

---

## Phase 9: AsyncStorage & WebView (4 files) - 2-3 hours

- [x] supabase.ts - Replace AsyncStorage
- [x] AddLabTestModal.tsx - Remove WebView
- [x] onboardingStore.ts - Replace AsyncStorage
- [x] Implement PDF parsing alternative (image-only parsing)
- [ ] Commit: "Phase 9: Remove AsyncStorage/WebView"

---

## Phase 10: Tabs Migration (1 file) - 1-2 hours

- [x] Update (tabs)/_layout.tsx to use NativeTabs
- [ ] Test thoroughly
- [x] Commit: "Phase 10: Migrate to NativeTabs"

---

## Phase 11: TouchableOpacity → Pressable (50+ files) - 3-4 hours

- [ ] Find all TouchableOpacity: `grep -rn "TouchableOpacity" app/ src/`
- [x] Convert batch by batch
- [ ] Test press interactions
- [x] Commit: "Phase 11: Replace TouchableOpacity"

---

## 🔴 Phase 12: File Renaming (50+ files) - 2-3 DAYS

**⚠️ HIGH RISK - Use git mv to preserve history**

- [ ] Create complete rename mapping
- [ ] Run rename script
- [ ] Fix all imports
- [ ] Update barrel exports
- [ ] Run typecheck
- [ ] Commit: "Phase 12: Rename files to kebab-case"

---

## Phase 13: Testing & Verification - 3-5 DAYS

### Static Analysis
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format` completes

### Build Tests
- [ ] Dev server starts
- [ ] iOS build works
- [ ] Android build works
- [ ] Web build works

### Functionality Tests
- [ ] All screens accessible
- [ ] All forms work
- [ ] All CRUD operations work
- [ ] No JavaScript errors
- [ ] No visual regressions

### Final Commit
- [ ] Commit: "Phase 13: Testing complete"
- [ ] Tag: `git tag v2.0.0-native-ui`

---

## 🎯 Merge to Main

- [ ] All tests pass
- [ ] Code review (if team)
- [ ] Merge to main
- [ ] Deploy

---

## 📊 Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| 1. Foundation | 1h | - | ✅ Complete |
| 2. Icons | 4-6h | - | |
| 3. Platform.OS | 1-2h | - | |
| 4. Shadows | 30m | - | |
| 5. SafeAreaView | 2-3h | - | |
| 6. Minor Fixes | 1h | - | |
| **Subtotal (Easy)** | **~12h** | - | |
| 7. NativeWind | 3-5d | - | |
| 8. Modals | 3-4d | - | |
| 9. Storage/WebView | 2-3h | - | |
| 10. Tabs | 1-2h | - | |
| 11. TouchableOpacity | 3-4h | - | |
| 12. File Naming | 2-3d | - | |
| 13. Testing | 3-5d | - | |
| **Total** | **2-3 weeks** | - | |

---

**Pro Tip:** Work in focused 2-4 hour blocks. Commit frequently. Test often.
