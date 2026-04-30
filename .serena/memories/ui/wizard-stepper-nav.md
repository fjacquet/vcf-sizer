# Wizard Stepper — Navigation Pattern

## Current Model
`WizardStepper.vue` has NO Previous/Next buttons — only step pills.

## Pill Click Rules
A pill is clickable when:
- `s.step < currentWizardStep` → go back (completed step)
- `s.step === currentWizardStep + 1 && canAdvance` → go forward (validation gates)

`canAdvance` computed checks:
- Step 1: topology selected
- Step 2: mgmt domain valid
- Step 3: N/A (terminal)

## Styling
- Completed (past) steps: green pill (filled bg/text/border) — no checkmark icon, color signals completion
- Next-available step: blue outline/ring (indicates gated forward nav)
- Current step: active/highlighted (solid blue)
- Future locked steps: gray (not clickable)

## Why
Previous pattern had dedicated Prev/Next buttons plus pill-back-nav. Consolidated to one interaction model.

## File
`src/components/shared/WizardStepper.vue`
