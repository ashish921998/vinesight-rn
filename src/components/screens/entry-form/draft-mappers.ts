import type { LogTypeId } from '@/constants/calculator-models';
import type {
  IrrigationFormData,
  SprayFormData,
  HarvestFormData,
  ExpenseFormData,
  FertigationFormData,
  NoteFormData,
} from '@/components/forms';

/**
 * Pure presentation/normalization mappers for entry-form drafts. Kept free of
 * React and component state so the draft summary line and the spray PHI
 * normalization can be unit-tested independently of the (very large) entry form.
 */

/** One-line human summary shown for a pending draft in the review list. */
export function getLogDescription(type: LogTypeId, data: unknown): string {
  switch (type) {
    case 'irrigation':
      return `${(data as IrrigationFormData).duration} hours`;
    case 'spray': {
      const spray = data as SprayFormData;
      const mixName = spray.catalogMixName?.trim();
      if (mixName) {
        return `${mixName} • ${spray.waterVolume}L`;
      }
      const chemCount = spray.chemicals.length;
      return `${spray.waterVolume}L water, ${chemCount} chemical${chemCount !== 1 ? 's' : ''}`;
    }
    case 'harvest': {
      const harvest = data as HarvestFormData;
      return `${harvest.quantity} kg, Grade ${harvest.grade}`;
    }
    case 'expense': {
      const expense = data as ExpenseFormData;
      return `₹${expense.cost} - ${expense.type}`;
    }
    case 'fertigation': {
      const fert = data as FertigationFormData;
      const fertCount = fert.fertilizers.length;
      const waterText = fert.waterVolume ? `${fert.waterVolume}L water, ` : '';
      return `${waterText}${fertCount} fertilizer${fertCount !== 1 ? 's' : ''}`;
    }
    case 'note': {
      const note = data as NoteFormData;
      return note.notes?.trim() ?? '';
    }
    default:
      return '';
  }
}

/**
 * Normalizes the PHI metadata on a spray draft before it is enqueued. On a grape
 * farm with a fully-resolved catalog mix (catalog id + safe-harvest date +
 * governing PHI days all present) the verified PHI fields are preserved as-is;
 * otherwise the PHI fields are cleared and a status is inferred
 * (`legacy_unverified` when a catalog mix exists, else any caller-set status,
 * falling back to `unknown`).
 */
export function buildSprayPendingData(
  input: SprayFormData,
  { isGrapeFarm }: { isGrapeFarm: boolean },
): SprayFormData {
  return isGrapeFarm &&
    input.catalogMixId &&
    input.safeHarvestDate &&
    input.governingPhiDays != null
    ? {
        ...input,
      }
    : {
        ...input,
        governingPhiDays: null,
        safeHarvestDate: null,
        phiBlockingComponent: null,
        phiStatus: input.phiStatus ?? (input.catalogMixId ? 'legacy_unverified' : 'unknown'),
      };
}
