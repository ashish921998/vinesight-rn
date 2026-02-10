import { create } from 'zustand';

import type {
  Farm,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
  ExpenseRecord,
} from '@/types';
import type { TaskReminder } from '@/types/task';
import type { PlannedInputItem } from '@/types/task';
import type { WarehouseItem, Worker } from '@/types';
import type { LogTypeId } from '@/constants/calculator-models';

type EditActivityRecord =
  | IrrigationRecord
  | SprayRecord
  | HarvestRecord
  | ExpenseRecord
  | FertigationRecord;

export type AddEntryRoutePayload = {
  tabs?: Array<'log' | 'task'>;
  initialTab?: 'log' | 'task';
  initialFarmId?: number | null;
  initialLogType?: LogTypeId | null;
  editingTask?: TaskReminder | null;
  sourceTaskId?: number | null;
  logPrefill?: {
    sprayChemicals?: PlannedInputItem[];
    fertigationItems?: PlannedInputItem[];
  } | null;
};

export type EditActivityRoutePayload = {
  farm: Farm;
  logType: LogTypeId;
  record: EditActivityRecord;
};

export type AddWorkerRoutePayload = {
  worker?: Worker | null;
};

export type AddWarehouseItemRoutePayload = {
  editingItem?: WarehouseItem | null;
};

export type AddStockRoutePayload = {
  item?: WarehouseItem | null;
};

type ModalStore = {
  addEntry: AddEntryRoutePayload | null;
  editActivity: EditActivityRoutePayload | null;
  addWorker: AddWorkerRoutePayload | null;
  addWarehouseItem: AddWarehouseItemRoutePayload | null;
  addStock: AddStockRoutePayload | null;
  setAddEntry: (payload: AddEntryRoutePayload | null) => void;
  setEditActivity: (payload: EditActivityRoutePayload | null) => void;
  setAddWorker: (payload: AddWorkerRoutePayload | null) => void;
  setAddWarehouseItem: (payload: AddWarehouseItemRoutePayload | null) => void;
  setAddStock: (payload: AddStockRoutePayload | null) => void;
};

export const useModalStore = create<ModalStore>((set) => ({
  addEntry: null,
  editActivity: null,
  addWorker: null,
  addWarehouseItem: null,
  addStock: null,
  setAddEntry: (payload) => set({ addEntry: payload }),
  setEditActivity: (payload) => set({ editActivity: payload }),
  setAddWorker: (payload) => set({ addWorker: payload }),
  setAddWarehouseItem: (payload) => set({ addWarehouseItem: payload }),
  setAddStock: (payload) => set({ addStock: payload }),
}));
