import { useWorkersTourStore } from '@/features/guided-tour/workers-tour-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const INITIAL_STATE = {
  _hydrated: false,
  hasSeenTour: false,
  isActive: false,
  currentStep: 'tabs_overview' as const,
  hasSeenAddWorkerTour: false,
  isAddWorkerTourActive: false,
  addWorkerTourStep: 'name_field' as const,
  hasSeenSettlementTour: false,
  isSettlementTourActive: false,
  settlementTourStep: 'worker_picker' as const,
};

beforeEach(() => {
  useWorkersTourStore.setState(INITIAL_STATE);
});

// ============================================================
// Overview tour
// ============================================================

describe('Overview tour', () => {
  it('starts inactive by default', () => {
    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.currentStep).toBe('tabs_overview');
    expect(state.hasSeenTour).toBe(false);
  });

  it('startTour activates and resets step to tabs_overview', () => {
    useWorkersTourStore.getState().startTour();
    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.currentStep).toBe('tabs_overview');
  });

  it('advanceStep moves through all steps in order', () => {
    useWorkersTourStore.getState().startTour();

    useWorkersTourStore.getState().advanceStep();
    expect(useWorkersTourStore.getState().currentStep).toBe('add_worker');

    useWorkersTourStore.getState().advanceStep();
    expect(useWorkersTourStore.getState().currentStep).toBe('attendance_tab');

    useWorkersTourStore.getState().advanceStep();
    expect(useWorkersTourStore.getState().currentStep).toBe('mark_day');
  });

  it('advanceStep on last step completes the tour', () => {
    useWorkersTourStore.setState({ isActive: true, currentStep: 'mark_day' });

    useWorkersTourStore.getState().advanceStep();
    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.hasSeenTour).toBe(true);
    expect(state.currentStep).toBe('tabs_overview');
  });

  it('skipTour deactivates and marks as seen', () => {
    useWorkersTourStore.setState({ isActive: true, currentStep: 'add_worker' });

    useWorkersTourStore.getState().skipTour();
    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.hasSeenTour).toBe(true);
    expect(state.currentStep).toBe('tabs_overview');
  });

  it('completeTour deactivates and marks as seen', () => {
    useWorkersTourStore.setState({ isActive: true, currentStep: 'attendance_tab' });

    useWorkersTourStore.getState().completeTour();
    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.hasSeenTour).toBe(true);
    expect(state.currentStep).toBe('tabs_overview');
  });

  it('resetTour clears hasSeenTour and deactivates', () => {
    useWorkersTourStore.setState({ hasSeenTour: true, isActive: false });

    useWorkersTourStore.getState().resetTour();
    const state = useWorkersTourStore.getState();
    expect(state.hasSeenTour).toBe(false);
    expect(state.isActive).toBe(false);
    expect(state.currentStep).toBe('tabs_overview');
  });

  it('full walkthrough: start → advance all → auto-complete', () => {
    useWorkersTourStore.getState().startTour();
    expect(useWorkersTourStore.getState().isActive).toBe(true);

    // Advance through all 4 steps
    useWorkersTourStore.getState().advanceStep(); // → add_worker
    useWorkersTourStore.getState().advanceStep(); // → attendance_tab
    useWorkersTourStore.getState().advanceStep(); // → mark_day
    useWorkersTourStore.getState().advanceStep(); // → completes

    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.hasSeenTour).toBe(true);
    expect(state.currentStep).toBe('tabs_overview');
  });
});

// ============================================================
// Add Worker form tour
// ============================================================

describe('Add Worker form tour', () => {
  it('starts inactive by default', () => {
    const state = useWorkersTourStore.getState();
    expect(state.isAddWorkerTourActive).toBe(false);
    expect(state.addWorkerTourStep).toBe('name_field');
    expect(state.hasSeenAddWorkerTour).toBe(false);
  });

  it('startAddWorkerTour activates and resets step', () => {
    useWorkersTourStore.getState().startAddWorkerTour();
    const state = useWorkersTourStore.getState();
    expect(state.isAddWorkerTourActive).toBe(true);
    expect(state.addWorkerTourStep).toBe('name_field');
  });

  it('advanceAddWorkerStep moves through all steps in order', () => {
    useWorkersTourStore.getState().startAddWorkerTour();

    useWorkersTourStore.getState().advanceAddWorkerStep();
    expect(useWorkersTourStore.getState().addWorkerTourStep).toBe('daily_rate_field');

    useWorkersTourStore.getState().advanceAddWorkerStep();
    expect(useWorkersTourStore.getState().addWorkerTourStep).toBe('save_button');
  });

  it('advanceAddWorkerStep on last step completes the tour', () => {
    useWorkersTourStore.setState({ isAddWorkerTourActive: true, addWorkerTourStep: 'save_button' });

    useWorkersTourStore.getState().advanceAddWorkerStep();
    const state = useWorkersTourStore.getState();
    expect(state.isAddWorkerTourActive).toBe(false);
    expect(state.hasSeenAddWorkerTour).toBe(true);
    expect(state.addWorkerTourStep).toBe('name_field');
  });

  it('skipAddWorkerTour deactivates and marks as seen', () => {
    useWorkersTourStore.setState({
      isAddWorkerTourActive: true,
      addWorkerTourStep: 'daily_rate_field',
    });

    useWorkersTourStore.getState().skipAddWorkerTour();
    const state = useWorkersTourStore.getState();
    expect(state.isAddWorkerTourActive).toBe(false);
    expect(state.hasSeenAddWorkerTour).toBe(true);
    expect(state.addWorkerTourStep).toBe('name_field');
  });

  it('full walkthrough: start → advance all → auto-complete', () => {
    useWorkersTourStore.getState().startAddWorkerTour();

    useWorkersTourStore.getState().advanceAddWorkerStep(); // → daily_rate_field
    useWorkersTourStore.getState().advanceAddWorkerStep(); // → save_button
    useWorkersTourStore.getState().advanceAddWorkerStep(); // → completes

    const state = useWorkersTourStore.getState();
    expect(state.isAddWorkerTourActive).toBe(false);
    expect(state.hasSeenAddWorkerTour).toBe(true);
  });
});

// ============================================================
// Settlement tour
// ============================================================

describe('Settlement tour', () => {
  it('starts inactive by default', () => {
    const state = useWorkersTourStore.getState();
    expect(state.isSettlementTourActive).toBe(false);
    expect(state.settlementTourStep).toBe('worker_picker');
    expect(state.hasSeenSettlementTour).toBe(false);
  });

  it('startSettlementTour activates and resets step', () => {
    useWorkersTourStore.getState().startSettlementTour();
    const state = useWorkersTourStore.getState();
    expect(state.isSettlementTourActive).toBe(true);
    expect(state.settlementTourStep).toBe('worker_picker');
  });

  it('advanceSettlementStep moves through all steps in order', () => {
    useWorkersTourStore.getState().startSettlementTour();

    useWorkersTourStore.getState().advanceSettlementStep();
    expect(useWorkersTourStore.getState().settlementTourStep).toBe('period_selector');

    useWorkersTourStore.getState().advanceSettlementStep();
    expect(useWorkersTourStore.getState().settlementTourStep).toBe('calculate_btn');
  });

  it('advanceSettlementStep on last step completes the tour', () => {
    useWorkersTourStore.setState({
      isSettlementTourActive: true,
      settlementTourStep: 'calculate_btn',
    });

    useWorkersTourStore.getState().advanceSettlementStep();
    const state = useWorkersTourStore.getState();
    expect(state.isSettlementTourActive).toBe(false);
    expect(state.hasSeenSettlementTour).toBe(true);
    expect(state.settlementTourStep).toBe('worker_picker');
  });

  it('skipSettlementTour deactivates and marks as seen', () => {
    useWorkersTourStore.setState({
      isSettlementTourActive: true,
      settlementTourStep: 'period_selector',
    });

    useWorkersTourStore.getState().skipSettlementTour();
    const state = useWorkersTourStore.getState();
    expect(state.isSettlementTourActive).toBe(false);
    expect(state.hasSeenSettlementTour).toBe(true);
    expect(state.settlementTourStep).toBe('worker_picker');
  });

  it('full walkthrough: start → advance all → auto-complete', () => {
    useWorkersTourStore.getState().startSettlementTour();

    useWorkersTourStore.getState().advanceSettlementStep(); // → period_selector
    useWorkersTourStore.getState().advanceSettlementStep(); // → calculate_btn
    useWorkersTourStore.getState().advanceSettlementStep(); // → completes

    const state = useWorkersTourStore.getState();
    expect(state.isSettlementTourActive).toBe(false);
    expect(state.hasSeenSettlementTour).toBe(true);
  });
});

// ============================================================
// resetAllTours
// ============================================================

describe('resetAllTours', () => {
  it('resets all three tours to initial state', () => {
    // Mark all tours as seen / in-progress
    useWorkersTourStore.setState({
      hasSeenTour: true,
      isActive: true,
      currentStep: 'mark_day',
      hasSeenAddWorkerTour: true,
      isAddWorkerTourActive: true,
      addWorkerTourStep: 'save_button',
      hasSeenSettlementTour: true,
      isSettlementTourActive: true,
      settlementTourStep: 'calculate_btn',
    });

    useWorkersTourStore.getState().resetAllTours();
    const state = useWorkersTourStore.getState();

    // Overview
    expect(state.hasSeenTour).toBe(false);
    expect(state.isActive).toBe(false);
    expect(state.currentStep).toBe('tabs_overview');

    // Add Worker
    expect(state.hasSeenAddWorkerTour).toBe(false);
    expect(state.isAddWorkerTourActive).toBe(false);
    expect(state.addWorkerTourStep).toBe('name_field');

    // Settlement
    expect(state.hasSeenSettlementTour).toBe(false);
    expect(state.isSettlementTourActive).toBe(false);
    expect(state.settlementTourStep).toBe('worker_picker');
  });
});

// ============================================================
// Tour independence (no cross-contamination)
// ============================================================

describe('Tour independence', () => {
  it('skipping overview tour does not affect add worker tour', () => {
    useWorkersTourStore.getState().startTour();
    useWorkersTourStore.getState().skipTour();

    const state = useWorkersTourStore.getState();
    expect(state.hasSeenTour).toBe(true);
    expect(state.hasSeenAddWorkerTour).toBe(false);
    expect(state.hasSeenSettlementTour).toBe(false);
  });

  it('completing add worker tour does not affect settlement tour', () => {
    useWorkersTourStore.getState().startAddWorkerTour();
    useWorkersTourStore.getState().advanceAddWorkerStep();
    useWorkersTourStore.getState().advanceAddWorkerStep();
    useWorkersTourStore.getState().advanceAddWorkerStep();

    const state = useWorkersTourStore.getState();
    expect(state.hasSeenAddWorkerTour).toBe(true);
    expect(state.hasSeenSettlementTour).toBe(false);
    expect(state.hasSeenTour).toBe(false);
  });

  it('multiple tours can run concurrently without interference', () => {
    useWorkersTourStore.getState().startTour();
    useWorkersTourStore.getState().startAddWorkerTour();

    expect(useWorkersTourStore.getState().isActive).toBe(true);
    expect(useWorkersTourStore.getState().isAddWorkerTourActive).toBe(true);

    // Advance overview
    useWorkersTourStore.getState().advanceStep();
    expect(useWorkersTourStore.getState().currentStep).toBe('add_worker');
    expect(useWorkersTourStore.getState().addWorkerTourStep).toBe('name_field');

    // Advance add worker
    useWorkersTourStore.getState().advanceAddWorkerStep();
    expect(useWorkersTourStore.getState().addWorkerTourStep).toBe('daily_rate_field');
    expect(useWorkersTourStore.getState().currentStep).toBe('add_worker');
  });
});

// ============================================================
// Persist partialize — only "seen" flags should be persisted
// ============================================================

describe('persist partialize', () => {
  it('does not persist isActive or step fields (only hasSeenX flags)', () => {
    // Access internal persist API to check partialize
    const persistApi = (
      useWorkersTourStore as unknown as {
        persist?: { getOptions?: () => { partialize?: (state: unknown) => unknown } };
      }
    ).persist;
    const options = persistApi?.getOptions?.();

    if (options?.partialize) {
      const fullState = useWorkersTourStore.getState();
      const partialized = options.partialize(fullState);

      // Should include only the "seen" flags
      expect(partialized).toHaveProperty('hasSeenTour');
      expect(partialized).toHaveProperty('hasSeenAddWorkerTour');
      expect(partialized).toHaveProperty('hasSeenSettlementTour');

      // Should NOT include active/step state
      expect(partialized).not.toHaveProperty('isActive');
      expect(partialized).not.toHaveProperty('currentStep');
      expect(partialized).not.toHaveProperty('isAddWorkerTourActive');
      expect(partialized).not.toHaveProperty('addWorkerTourStep');
      expect(partialized).not.toHaveProperty('isSettlementTourActive');
      expect(partialized).not.toHaveProperty('settlementTourStep');
      expect(partialized).not.toHaveProperty('_hydrated');
    }
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('Edge cases', () => {
  it('advanceStep when not active does not crash', () => {
    // Not started, currentStep is tabs_overview
    expect(() => useWorkersTourStore.getState().advanceStep()).not.toThrow();
    // Should advance to add_worker even when not active
    expect(useWorkersTourStore.getState().currentStep).toBe('add_worker');
  });

  it('skipTour when already seen is idempotent', () => {
    useWorkersTourStore.setState({ hasSeenTour: true, isActive: false });
    useWorkersTourStore.getState().skipTour();

    const state = useWorkersTourStore.getState();
    expect(state.hasSeenTour).toBe(true);
    expect(state.isActive).toBe(false);
  });

  it('startTour after completion reactivates', () => {
    useWorkersTourStore.setState({ hasSeenTour: true, isActive: false });
    useWorkersTourStore.getState().startTour();

    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.currentStep).toBe('tabs_overview');
  });

  it('resetTour then startTour gives a fresh walkthrough', () => {
    useWorkersTourStore.setState({ hasSeenTour: true });
    useWorkersTourStore.getState().resetTour();
    useWorkersTourStore.getState().startTour();

    const state = useWorkersTourStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.hasSeenTour).toBe(false);
    expect(state.currentStep).toBe('tabs_overview');
  });
});
