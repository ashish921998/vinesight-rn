import type { ReportSeasonContext, ReportPlanItemInput } from '../../types/report';
import type { AreaUnitPreference } from '@/utils/preferences';

interface ReportGenerationOptions {
  seasonContext?: ReportSeasonContext;
  seasonNameById?: Record<number, string>;
  seasonWindowById?: Record<number, string>;
  /** Current fertilizer-plan items — the join target for the compliance delta. */
  planItems?: ReportPlanItemInput[];
  /**
   * Unit `farm.area` was entered in (the user's area-unit preference).
   * `farm.area` is stored as the raw typed number, NOT canonical acres —
   * hectares-preference farms must be converted before any per-acre math.
   */
  areaUnit?: AreaUnitPreference;
  /**
   * FPC register lookups, keyed by catalog product id (chemical_products).
   * All optional — a missing map only blanks the corresponding column, it
   * never blocks the report.
   */
  fpcLookups?: FpcReportLookups;
}

export interface FpcReportLookups {
  /** Technical identity (active ingredient / composition name) per catalog product. */
  technicalNameByProductId?: Record<number, string>;
  /** Label-claim PHI days per catalog product (grape claims). */
  phiDaysByProductId?: Record<number, number>;
  /** Formatted MRL summary per catalog product (e.g. "EU: 0.5 mg/kg"). */
  mrlByProductId?: Record<number, string>;
}

export type { ReportGenerationOptions };
