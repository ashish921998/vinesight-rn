export interface FertilizerPlanItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface FertilizerPlan {
  id?: string;
  farm_id: number;
  title?: string | null;
  consultant_name?: string | null;
  updated_at?: string | null;
  notes?: string | null;
  items: FertilizerPlanItem[];
}
