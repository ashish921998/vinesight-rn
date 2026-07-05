# ICAR-NRCG Grapes Annexure 5 Import Review

Dataset: `icar-nrcg-grapes-2025-09-17.csv`

Important: the analyzed edition, revised 17 Sep 2025, is superseded by a 03 Nov 2025 revision on `nrcgrapes.in`. This starter import must not be promoted as verified production data. The live import target is the current revision, and every row here remains `pending_review` until a human verifies it against the live PDF.

## Review Protocol

1. Download the current Annexure 5 grapes PDF from the official NRC Grapes site and record URL, filename, checksum, revision date, and retrieval date.
2. For every source row, verify page, serial, exact formulation, active ingredient, target problem, dose, PHI, MRL, systemic class, restrictions, resistance markers, and application interval text.
3. Confirm the product mapping is explicit. Use an existing `chemical_products.id` or an exact product/formulation name. Do not merge by similar active ingredient, OCR similarity, or trade-name guesswork.
4. Mark rows as `verified` only after second-person review. Keep disputed rows as `pending_review`; mark replaced rows as `superseded` with the newer source revision.
5. Re-run `npm run import:label-claims -- --csv <path>` in dry-run mode, then run with `--write` only from an environment that has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Counts Template

| Disposition | Count | Reviewer notes |
| --- | ---: | --- |
| Imported | 0 | Pending live revision review |
| Skipped | 0 |  |
| Ambiguous | 0 |  |
| Superseded | 0 | 17 Sep 2025 edition superseded by 03 Nov 2025 revision |
| Blocked | 0 |  |

## Row Checklist

| Source serial | Page | Target problem | Product mapping | Status | Reviewer | Notes |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | 5 | downy mildew | exact_name: Amisulbrom 17.7 SC | pending_review |  | Verify against live PDF |
| 2 | 5 | downy mildew | exact_name: Azoxystrobin 23 SC | pending_review |  | Verify against live PDF |
| 3 | 5 | downy mildew | exact_name: Cyazofamid 34.5 SC | pending_review |  | Verify against live PDF |
| 4 | 6 | downy mildew | exact_name: Mancozeb 75 WP | pending_review |  | Verify residue expression |
| 5 | 6 | downy mildew | exact_name: Metalaxyl-M 4% + Mancozeb 64% WP | pending_review |  | Verify both MRL rows |
| 6 | 7 | powdery mildew | exact_name: Difenoconazole 25 EC | pending_review |  | Verify against live PDF |
| 7 | 7 | powdery mildew | exact_name: Tebuconazole 25.9 EC | pending_review |  | Verify against live PDF |
| 8 | 8 | mealybug | exact_name: Spirotetramat 15.31 OD | pending_review |  | Verify pest/stage restrictions |
| 9 | 8 | mites | exact_name: Abamectin 1.9 EC | pending_review |  | Verify against live PDF |
| 10 | 9 | powdery mildew | exact_name: Sulphur 80 WDG | pending_review |  | Verify no-MRL/PHI interpretation |
