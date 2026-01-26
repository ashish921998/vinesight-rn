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
- [ ] Create `src/components/ui/Symbol.tsx` wrapper component
- [ ] Create icon mapping in guide reference

### Convert Files (check off as you go)

**UI Components:**
- [ ] Input.tsx
- [ ] Button.tsx
- [ ] FormComponents.tsx
- [ ] UnitPickerModal.tsx
- [ ] UnitPickerModal 2.tsx

**Cards (5 files):**
- [ ] QuickActionButton
- [ ] StatsCard
- [ ] WorkerCard
- [ ] ActivityLogCard
- [ ] FarmCard

**Forms (6 files):**
- [ ] HarvestForm
- [ ] FertigationForm
- [ ] IrrigationForm
- [ ] ExpenseForm
- [ ] SprayForm
- [ ] FormField

**Screens/Modals (13 files):**
- [ ] AttendanceView
- [ ] WaterLevelModal
- [ ] AddEntryModal
- [ ] AddLabTestModal
- [ ] ParameterSelector (+ v2)
- [ ] AddSoilProfileModal
- [ ] AddTaskModal
- [ ] AddStockModal
- [ ] AddWorkerModal
- [ ] AddWarehouseItemModal
- [ ] AddActivityModal
- [ ] EditActivityModal

**Pages - Tab screens:**
- [ ] _(tabs)/_layout.tsx (IMPORTANT - tab icons)
- [ ] index.tsx
- [ ] explore.tsx
- [ ] farms.tsx
- [ ] workers.tsx
- [ ] tools.tsx
- [ ] settings.tsx

**Pages - Other (27 files):**
- [ ] logs.tsx
- [ ] tasks.tsx
- [ ] warehouse.tsx
- [ ] weather.tsx
- [ ] ai-chat.tsx
- [ ] analytics.tsx
- [ ] reports.tsx
- [ ] lab-tests.tsx
- [ ] soil-profiling.tsx
- [ ] soil-trends.tsx
- [ ] petiole-trends.tsx
- [ ] onboarding.tsx
- [ ] (auth)/login.tsx
- [ ] (auth)/otp-verification.tsx
- [ ] farm/add.tsx
- [ ] farm/add_old.tsx
- [ ] farm/[id].tsx
- [ ] farm/[id]/edit.tsx
- [ ] calculator/lai.tsx
- [ ] calculator/system-discharge.tsx
- [ ] calculator/mad.tsx
- [ ] calculator/nutrients.tsx
- [ ] ErrorBoundary.tsx

### Test & Commit
- [ ] Run `npm run typecheck`
- [ ] Test app runs
- [ ] Verify no Ionicons imports remain: `grep -r "from '@expo/vector-icons'" app/ src/`
- [ ] Commit: "Phase 2: Icon migration"

---

## Phase 3: Platform.OS → process.env.EXPO_OS (17 files) - 1-2 hours

- [ ] supabase.ts
- [ ] AddLabTestModal.tsx
- [ ] AddSoilProfileModal.tsx
- [ ] AddTaskModal.tsx
- [ ] FormComponents.tsx
- [ ] ai-chat.tsx
- [ ] (auth)/login.tsx
- [ ] (tabs)/_layout.tsx
- [ ] (tabs)/settings.tsx
- [ ] calculator/lai.tsx
- [ ] calculator/system-discharge.tsx
- [ ] calculator/nutrients.tsx
- [ ] calculator/mad.tsx
- [ ] farm/[id]/edit.tsx
- [ ] farm/add_old.tsx
- [ ] reports.tsx
- [ ] AddEntryModal.tsx (line 1191)
- [ ] Commit: "Phase 3: Replace Platform.OS"

---

## Phase 4: Shadow Properties (6 files) - 30 mins

- [ ] weatherService.ts
- [ ] weather.ts (types)
- [ ] tasks.tsx
- [ ] logs.tsx
- [ ] (tabs)/_layout.tsx
- [ ] (tabs)/explore.tsx
- [ ] farm/[id].tsx
- [ ] Commit: "Phase 4: Convert shadows to boxShadow"

---

## Phase 5: SafeAreaView Replacement (17 files) - 2-3 hours

- [ ] ai-chat.tsx
- [ ] warehouse.tsx
- [ ] onboarding.tsx
- [ ] analytics.tsx
- [ ] petiole-trends.tsx
- [ ] tasks.tsx
- [ ] logs.tsx
- [ ] soil-trends.tsx
- [ ] soil-profiling.tsx
- [ ] calculator/mad.tsx
- [ ] calculator/lai.tsx
- [ ] calculator/system-discharge.tsx
- [ ] calculator/nutrients.tsx
- [ ] lab-tests.tsx
- [ ] reports.tsx
- [ ] farm/add_old.tsx
- [ ] farm/add.tsx
- [ ] AddTaskModal.tsx
- [ ] Commit: "Phase 5: Replace SafeAreaView"

---

## Phase 6: Minor Fixes (6 files) - 1 hour

- [ ] TrendsChart.tsx - Dimensions → useWindowDimensions
- [ ] TrendsTable.tsx - Remove StyleSheet.create
- [ ] calculator/lai.tsx - contentInsetAdjustmentBehavior
- [ ] calculator/system-discharge.tsx - contentInsetAdjustmentBehavior
- [ ] calculator/mad.tsx - contentInsetAdjustmentBehavior
- [ ] calculator/nutrients.tsx - contentInsetAdjustmentBehavior
- [ ] Commit: "Phase 6: Minor fixes"

---

## 🛑 CHECKPOINT: Re-evaluate

**At this point you've completed phases 2-6 (the "easy wins").**

Test the app thoroughly:
- [ ] All screens load
- [ ] All icons display correctly
- [ ] No visual regressions
- [ ] App feels native

**Decision time:**
- Continue with phases 7-12 (NativeWind removal, modal refactor, file renaming)? 
- OR: Stop here and keep current architecture?

---

## 🔴 Phase 7: NativeWind Removal (70+ files) - 3-5 DAYS

**⚠️ MAJOR CHANGE - Take screenshots of all screens first!**

### Day 1: UI Components & Cards
- [ ] Take screenshots of all screens
- [ ] Convert UI components (7 files)
- [ ] Convert Cards (5 files)
- [ ] Test and commit

### Day 2: Forms & Small Screens
- [ ] Convert Forms (6 files)
- [ ] Convert small screens (10 files)
- [ ] Test and commit

### Day 3-4: Large Screens & Pages
- [ ] Convert remaining screens (15+ files)
- [ ] Convert tab pages (7 files)
- [ ] Test and commit

### Day 5: Other Pages & Cleanup
- [ ] Convert remaining pages (27 files)
- [ ] Remove NativeWind dependencies
- [ ] Remove config files
- [ ] Update metro/babel configs
- [ ] Final test and commit

---

## 🔴 Phase 8: Modal Architecture (15+ files) - 3-4 DAYS

**⚠️ MAJOR CHANGE - Changes entire navigation flow**

- [ ] Plan data flow strategy (params vs stores)
- [ ] Create route files for all modals
- [ ] Update all modal invocations
- [ ] Test each modal route
- [ ] Delete old modal components
- [ ] Commit: "Phase 8: Modal architecture"

---

## Phase 9: AsyncStorage & WebView (4 files) - 2-3 hours

- [ ] supabase.ts - Replace AsyncStorage
- [ ] AddLabTestModal.tsx - Remove WebView
- [ ] onboardingStore.ts - Replace AsyncStorage
- [ ] Implement PDF parsing alternative
- [ ] Commit: "Phase 9: Remove AsyncStorage/WebView"

---

## Phase 10: Tabs Migration (1 file) - 1-2 hours

- [ ] Update (tabs)/_layout.tsx to use NativeTabs
- [ ] Test thoroughly
- [ ] Commit: "Phase 10: Migrate to NativeTabs"

---

## Phase 11: TouchableOpacity → Pressable (50+ files) - 3-4 hours

- [ ] Find all TouchableOpacity: `grep -rn "TouchableOpacity" app/ src/`
- [ ] Convert batch by batch
- [ ] Test press interactions
- [ ] Commit: "Phase 11: Replace TouchableOpacity"

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
