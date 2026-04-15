# Export Composables — Conditional Patterns

## Storage-type conditionals in exports
FC/NFS and vSAN have different export rows:
- **Host Configuration**: `storagePerHost` hidden for FC/NFS (external storage, not local)
- **Storage Sizing**: FC/NFS shows `workloadStorageRequired` + `externalPoolCapacity`; vSAN-ESA shows full overhead stack (RAID/raw/usable/LFS/metadata/safeUsable)
- **Aggregates**: `totalWorkloadStorageRequiredTiB` shown when >0 (any FC/NFS domain)

## Deployment-mode conditionals
- Stretch: additional rows (preferred/secondary site hosts, bandwidth, witness)
- Stretch + vSAN-ESA: 0.5× mirroring factor on effective/safe capacity
- Stretch + FC/NFS: no mirroring factor (SAN/NAS handles replication)

## PPTX data-mapping helpers (tested contract)
`buildConfigSummaryData()`, `buildStorageResultsData()`, `buildAggregateSlideData()` etc.
These are pure functions that return data arrays — rendering is separate.
Tests assert row counts and field values.

## Files
- `src/composables/useMarkdownExport.ts` — `generateMarkdownReport()` string template
- `src/composables/usePptxExport.ts` — `generatePptxReport()` with pptxgenjs dynamic import
- `src/composables/usePptxExport.test.ts` — Tests for data-mapping helpers
