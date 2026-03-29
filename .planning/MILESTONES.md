# Milestones

## v1.0 — Initial Release (completed 2026-03-29)

**Goal:** Build a fully functional, zero-backend VCF 9.x sizing calculator with real-time compute, RAM, and storage results across all deployment models.

**Shipped:**
- Full calculation engine: management domain, compute, storage (vSAN ESA, FC, NFS), stretch cluster
- NVMe Memory Tiering (ESXi 9.x), AI/GPU workload sizing, Global Deduplication
- Split-screen UI with real-time Chart.js charts (Cores, RAM, Storage)
- Stretch cluster topology card (witness, bandwidth, per-site storage)
- URL sharing (lz-string + Zod), Markdown export, print-to-PDF
- 4 Swiss locales (FR, EN, DE, IT), auto dark mode (OS-driven)
- Validation: VCFA min 12 cores blocker, dedup/stretch mutual exclusion, stretch min 3 hosts/site

**Phases:** 3 phases, 7 plans, 72 tests passing

---
