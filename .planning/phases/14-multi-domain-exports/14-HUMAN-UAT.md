---
status: partial
phase: 14-multi-domain-exports
source: [14-VERIFICATION.md]
started: 2026-03-30T17:40:00.000Z
updated: 2026-03-30T17:40:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Markdown export contains per-domain sections
expected: Clicking "Download Markdown" produces a .md file with one `## Domain: {name}` H2 section per workload domain, each containing Host Configuration, Workload Profile, Compute Sizing, Storage Sizing, Network Configuration subsections
result: [pending]

### 2. Markdown export ends with aggregate totals section
expected: The downloaded .md file ends with a `## Aggregate Totals` section showing total recommended hosts, total raw storage TB, total effective storage TB, and grand total hosts (workload + management)
result: [pending]

### 3. PPTX export contains per-domain slides
expected: Clicking "Download PPTX" produces a .pptx file with one slide group per workload domain — each group showing the domain name in slide titles, key inputs, and sizing results
result: [pending]

### 4. PPTX export contains aggregate totals slide
expected: The downloaded .pptx file includes an "Aggregate Totals" slide after all per-domain slide groups, showing combined metrics across all domains
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
