# Spray Catalog Data Model Notes

- Source types live in `src/types/phi.ts`.
- `ChemicalMix` exposes `id`, `name`, `target_problem`, `application_mode`, `source_page`, `is_active`, and `components`.
- `ChemicalMixComponent` exposes product-level metadata such as `product_name`, `active_ingredient`, dose fields, `phi_days`, `phi_verified`, and `phi_source`.
- The current catalog model does **not** expose:
  - chemical classification badges such as fungicide / insecticide / herbicide
  - usage-history fields such as "last used on"
  - a live boolean for "PHI active" status
- `phi_days` is static catalog metadata, not a runtime-safe-to-harvest flag. Active PHI/safe-window UI should come from computed safety data (for example `PhiComputationResult` / `SafeToSprayStatus`), not from `phi_days > 0`.
- When a wireframe asks for unavailable catalog semantics, preserve truthful data and document the gap instead of hardcoding placeholder types or warning states.
