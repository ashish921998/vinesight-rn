export interface GuidedTourEventMap {
  'guidedTour.addFarmFocusField': { field: 'name' | 'region' | 'area' };
  'guidedTour.addFarmPhaseChanged': {
    phase:
      | 'cta'
      | 'name'
      | 'region'
      | 'area'
      | 'crop'
      | 'crop_option'
      | 'variety'
      | 'variety_option'
      | 'custom_variety'
      | 'submit';
    lockScroll: boolean;
    focusField?: 'name' | 'region' | 'area';
  };
  'guidedTour.farmCreated': { farmId: number };
  'guidedTour.addFarmNameEntered': { isFilled: boolean };
  'guidedTour.addFarmRegionEntered': { isFilled: boolean };
  'guidedTour.addFarmAreaEntered': { isFilled: boolean };
  'guidedTour.addFarmCropSelected': { crop: string; shouldAdvance?: boolean };
  'guidedTour.addFarmCropPickerToggled': { open: boolean };
  'guidedTour.addFarmVarietyPickerOpened': Record<string, never>;
  'guidedTour.addFarmVarietySelected': { isCustom: boolean };
  'guidedTour.addFarmCustomVarietyEntered': Record<string, never>;
  'guidedTour.logTypeSelected': { recordType: string };
  'guidedTour.addLogSelectionState': {
    hasSelection: boolean;
    hasPendingDrafts: boolean;
    recordType?: string;
    isCurrentLogValid?: boolean;
  };
  'guidedTour.logCreated': { farmId: number; recordType: string };
  'guidedTour.notificationOpened': { sequence: 1 | 2 };
  'guidedTour.appReadyHome': Record<string, never>;
}

type EventKey = keyof GuidedTourEventMap;
type Listener<K extends EventKey> = (payload: GuidedTourEventMap[K]) => void;
type ListenerSet<K extends EventKey> = Set<Listener<K>>;

const listeners = new Map<EventKey, ListenerSet<EventKey>>();

export function guidedTourEmit<K extends EventKey>(event: K, payload: GuidedTourEventMap[K]): void {
  const set = listeners.get(event) as ListenerSet<K> | undefined;
  if (!set) return;
  for (const listener of set) {
    try {
      listener(payload);
    } catch (error) {
      if (__DEV__) {
        console.error('[guided-tour] event listener failed', event, error);
      }
    }
  }
}

export function guidedTourOn<K extends EventKey>(event: K, listener: Listener<K>): () => void {
  const set = ((listeners.get(event) as ListenerSet<K> | undefined) ?? new Set()) as ListenerSet<K>;
  set.add(listener);
  listeners.set(event, set as ListenerSet<EventKey>);
  return () => {
    const current = listeners.get(event) as ListenerSet<K> | undefined;
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(event);
    } else {
      listeners.set(event, current as ListenerSet<EventKey>);
    }
  };
}
