/**
 * Task/Reminder Types for Vinesight
 */

// Task types matching the database schema
export type TaskType =
  | 'irrigation'
  | 'spray'
  | 'fertigation'
  | 'harvest'
  | 'soil_test'
  | 'petiole_test'
  | 'expense'
  | 'note';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high';

// Main task interface
export interface TaskReminder {
  id?: number;
  farm_id: number;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_duration_minutes: number | null;
  location: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
  assigned_to_user_id: string | null;
  created_by: string | null;
  linked_record_type: string | null;
  linked_record_id: number | null;
}

// Insert type (without auto-generated fields)
export type TaskReminderInsert = Omit<TaskReminder, 'id' | 'created_at' | 'updated_at'>;

// Update type
export type TaskReminderUpdate = Partial<Omit<TaskReminder, 'id' | 'farm_id' | 'created_at' | 'updated_at' | 'created_by'>>;

// Task template for quick creation
export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  estimatedDuration?: string;
  frequency?: 'once' | 'weekly' | 'biweekly' | 'monthly' | 'seasonal' | 'yearly';
  growthStage?: string[];
  season?: 'spring' | 'summer' | 'monsoon' | 'winter';
  instructions?: string;
}

// Task type display info
export const TASK_TYPE_INFO: Record<TaskType, { label: string; icon: string; color: string }> = {
  irrigation: { label: 'Irrigation', icon: 'water', color: '#4d8573' },
  spray: { label: 'Spray', icon: 'flask', color: '#598d6b' },
  fertigation: { label: 'Fertigation', icon: 'leaf', color: '#408059' },
  harvest: { label: 'Harvest', icon: 'basket', color: '#669475' },
  soil_test: { label: 'Soil Test', icon: 'layers', color: '#598266' },
  petiole_test: { label: 'Petiole Test', icon: 'analytics', color: '#7a9a5c' },
  expense: { label: 'Expense', icon: 'cash', color: '#598066' },
  note: { label: 'Note', icon: 'document-text', color: '#738c7a' },
};

// Priority display info
export const PRIORITY_INFO: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: '#166534', bgColor: '#DCFCE7' },
  medium: { label: 'Medium', color: '#92400E', bgColor: '#FEF3C7' },
  high: { label: 'High', color: '#991B1B', bgColor: '#FEE2E2' },
};

// Status display info
export const STATUS_INFO: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: '#92400E', bgColor: '#FEF3C7' },
  in_progress: { label: 'In Progress', color: '#1D4ED8', bgColor: '#DBEAFE' },
  completed: { label: 'Completed', color: '#166534', bgColor: '#DCFCE7' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bgColor: '#F3F4F6' },
};
