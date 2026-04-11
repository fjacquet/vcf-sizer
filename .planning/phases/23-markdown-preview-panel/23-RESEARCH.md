# Phase 23: Markdown Preview Panel - Research

**Researched:** 2026-04-11
**Domain:** Vue 3 Markdown rendering with XSS sanitization, lazy loading
**Confidence:** HIGH

## Summary

Phase 23 adds a "Preview" button to the export toolbar that opens a panel rendering the existing `generateMarkdownReport()` output as styled HTML. The technical surface is small: parse Markdown to HTML with `marked`, sanitize with `DOMPurify`, render via `v-html`, and lazy-load both libraries on first use.

The project already has a locked decision (STATE.md) to pin `marked@^15.x` and use `dompurify@^3.3.3` with `DOMPurify.sanitize()` before any `v-html` usage (PITFALL-9). The pptxgenjs dynamic import pattern (PPTX-15) provides the exact template for lazy loading marked. The `generateMarkdownReport()` composable already produces the full localized Markdown string; the preview simply renders it instead of triggering a download.

**Primary recommendation:** Create a `MarkdownPreviewPanel.vue` component that lazy-loads marked + dompurify on first open, calls `generateMarkdownReport()`, parses with `marked.parse()`, sanitizes with `DOMPurify.sanitize()`, and renders via `v-html` in a closeable overlay/drawer. Add a "Preview" button to `ExportToolbar.vue` alongside existing export buttons.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-03 | User can preview rendered Markdown in-app before downloading | marked@^15.x parses MD to HTML; DOMPurify sanitizes; v-html renders; lazy import keeps bundle clean |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue/Pinia -- not relevant here (no engine changes)
- `calculationStore.ts` must never contain `ref()` -- not relevant here (no store schema changes)
- Validation warnings must use i18n message keys
- Export composables are plain TypeScript (no Vue lifecycle hooks) -- EXPORT-PURE
- `VueI18nPlugin` configured with `include` omitted (rolldown/JSON conflict)
- pptxgenjs dynamic import pattern keeps it out of initial bundle (PPTX-15) -- template for marked lazy loading
- DOMPurify.sanitize() required before v-html in MarkdownPreview to prevent XSS (PITFALL-9)
- marked pinned at ^15.x (v16+ drops CommonJS; v18 requires TypeScript v6)

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | ^15.0.12 | Markdown to HTML parsing | Locked decision in STATE.md; lightweight (~40KB unpacked), pure ESM in v15, well-maintained [VERIFIED: npm registry -- latest 15.x is 15.0.12] |
| dompurify | ^3.3.3 | HTML sanitization (XSS prevention) | Locked decision in STATE.md (PITFALL-9); industry standard XSS sanitizer [VERIFIED: npm registry -- latest is 3.3.3] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/dompurify | ^3.2.0 | TypeScript type definitions for DOMPurify | Always -- dompurify ships its own .d.ts but @types version provides better IDE support [VERIFIED: npm registry -- 3.2.0] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| marked | markdown-it | markdown-it is larger and more extensible; marked is simpler and already a locked decision |
| DOMPurify | sanitize-html | DOMPurify is DOM-based (more thorough), sanitize-html is string-based (less reliable for edge cases) |

**Installation:**
```bash
npm install marked@^15.0.12 dompurify@^3.3.3 @types/dompurify@^3.2.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    results/
      ExportToolbar.vue          # Add "Preview" button (modify existing)
      MarkdownPreviewPanel.vue   # NEW — overlay/drawer with rendered HTML
  composables/
    useMarkdownExport.ts         # EXISTING — generateMarkdownReport() (no changes needed)
```

### Pattern 1: Lazy-Loaded Markdown Rendering (mirrors PPTX-15)
**What:** Dynamic `import()` of marked and dompurify on first preview click, cached for subsequent opens
**When to use:** Always -- success criterion #5 requires lazy loading
**Example:**
```typescript
// Source: project pattern from usePptxExport.ts lines 305-317
let cachedMarked: typeof import('marked') | null = null
let cachedPurify: typeof import('dompurify') | null = null

async function renderMarkdown(mdString: string): Promise<string> {
  if (!cachedMarked) {
    cachedMarked = await import('marked')
  }
  if (!cachedPurify) {
    cachedPurify = await import('dompurify')
  }
  const rawHtml = await cachedMarked.marked.parse(mdString)
  return cachedPurify.default.sanitize(rawHtml)
}
```

### Pattern 2: Closeable Overlay Panel
**What:** A modal or slide-over panel that renders sanitized HTML and can be dismissed
**When to use:** Success criterion #4 requires closing without data loss
**Example:**
```vue
<!-- MarkdownPreviewPanel.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { generateMarkdownReport } from '@/composables/useMarkdownExport'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const htmlContent = ref('')
const loading = ref(false)

async function loadPreview() {
  loading.value = true
  const md = generateMarkdownReport()
  const { marked } = await import('marked')
  const DOMPurify = (await import('dompurify')).default
  htmlContent.value = DOMPurify.sanitize(await marked.parse(md))
  loading.value = false
}

// Trigger load when panel opens
watch(() => props.open, (isOpen) => {
  if (isOpen) loadPreview()
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 ...">
    <div class="prose max-w-none" v-html="htmlContent" />
    <button @click="emit('close')">Close</button>
  </div>
</template>
```

### Pattern 3: Tailwind Typography Prose Styling
**What:** Use Tailwind's `prose` class for Markdown HTML styling (headings, tables, code blocks)
**When to use:** Success criterion #2 requires correct HTML styling
**Note:** The project uses Tailwind v4. Tailwind v4 includes `@tailwindcss/typography` as a first-party plugin. Need to verify if it is already installed or needs adding. [ASSUMED]

### Anti-Patterns to Avoid
- **Rendering unsanitized HTML:** Never use `v-html` without `DOMPurify.sanitize()` first (PITFALL-9)
- **Top-level import of marked:** Would defeat lazy-loading requirement (success criterion #5)
- **Creating a new composable for preview:** The existing `generateMarkdownReport()` already produces the Markdown string -- just call it from the component
- **Storing preview state in inputStore:** Preview open/close is ephemeral UI state; use local component `ref()` or uiStore if needed

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex parser | `marked` | Tables, GFM, edge cases are deceptively complex |
| XSS sanitization | Manual string escaping | `DOMPurify` | Script injection has hundreds of vectors; manual escaping always misses some |
| Markdown HTML styling | Custom CSS for every element | Tailwind `prose` class | Consistent typography for headings, tables, code, lists out of the box |

## Common Pitfalls

### Pitfall 1: XSS via Domain Names (PITFALL-9 -- already documented)
**What goes wrong:** User enters `<script>alert('xss')</script>` as a domain name; it flows through `generateMarkdownReport()` into raw HTML via `marked.parse()`
**Why it happens:** marked does not sanitize output -- it is a parser, not a sanitizer
**How to avoid:** Always call `DOMPurify.sanitize()` on the output of `marked.parse()` before passing to `v-html`
**Warning signs:** Any `v-html` binding without a `.sanitize()` call in the data flow

### Pitfall 2: marked.parse() Returns Promise in v15
**What goes wrong:** Treating `marked.parse()` as synchronous when it returns `Promise<string>` in async mode
**Why it happens:** marked v12+ defaults to async when using async extensions; v15 `parse()` returns `string | Promise<string>`
**How to avoid:** Always `await marked.parse(md)` or use `marked.parseInline()` for inline content
**Warning signs:** `[object Promise]` appearing in rendered output

### Pitfall 3: Bundle Size Regression
**What goes wrong:** marked or dompurify appear in the initial chunk, increasing page load time
**Why it happens:** Static `import` at module top level
**How to avoid:** Use dynamic `import()` inside the preview handler function, exactly like pptxgenjs pattern (PPTX-15)
**Warning signs:** `npm run build` output showing marked/dompurify in the initial chunk

### Pitfall 4: Locale Loading Race on Preview
**What goes wrong:** Preview opens while locale JSON is still loading, rendering English fallback text
**Why it happens:** Same race condition as export buttons (PITFALL-10)
**How to avoid:** Disable the Preview button when `uiStore.localeLoading` is true (same pattern as existing export buttons)
**Warning signs:** Preview showing English text when UI is set to French

### Pitfall 5: Tailwind Typography Plugin Missing
**What goes wrong:** `prose` class has no effect; rendered HTML shows unstyled raw elements
**Why it happens:** Tailwind v4 requires explicit typography plugin inclusion
**How to avoid:** Verify `@tailwindcss/typography` is configured; if not, add it
**Warning signs:** Tables rendering without borders, headings without size differentiation

## Code Examples

### Lazy Import with Module Caching
```typescript
// Source: mirrors usePptxExport.ts PPTX-15 pattern
let markedModule: typeof import('marked') | null = null
let purifyModule: typeof import('dompurify') | null = null

export async function renderMarkdownToSafeHtml(md: string): Promise<string> {
  if (!markedModule) markedModule = await import('marked')
  if (!purifyModule) purifyModule = await import('dompurify')
  const rawHtml = await markedModule.marked.parse(md)
  return purifyModule.default.sanitize(rawHtml)
}
```

### ExportToolbar Preview Button Addition
```vue
<!-- Add alongside existing buttons in ExportToolbar.vue -->
<button
  class="px-3 py-1.5 text-sm font-medium rounded border ..."
  :disabled="uiStore.localeLoading"
  @click="emit('preview')"
>
  {{ t('results.toolbar.preview') }}
</button>
```

### i18n Keys Needed (all 4 locales)
```json
{
  "results": {
    "toolbar": {
      "preview": "Preview",
      "previewClose": "Close Preview"
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| marked v12 sync-only API | marked v15 async-capable parse() | 2024 | Must await parse() result |
| DOMPurify 2.x | DOMPurify 3.x (ESM-first) | 2023 | Clean dynamic import support |
| @tailwindcss/typography separate package | Tailwind v4 first-party integration | 2025 | May already be available via Tailwind v4 [ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4 includes @tailwindcss/typography as first-party or it needs separate install | Architecture Patterns / Pitfall 5 | Prose class won't work; need to install plugin and configure |
| A2 | DOMPurify 3.x default export works with dynamic import() in Vite 8 ESM context | Code Examples | May need named import adjustment |

## Open Questions

1. **Tailwind Typography plugin status**
   - What we know: Project uses Tailwind v4.2.2 via @tailwindcss/vite
   - What's unclear: Whether @tailwindcss/typography is already available or needs separate installation
   - Recommendation: Check during plan execution; if missing, add `@tailwindcss/typography` and configure in CSS

2. **Panel UX: Modal vs. Drawer vs. Inline**
   - What we know: Must be closeable without data loss (criterion #4)
   - What's unclear: Whether a full-screen modal, side drawer, or inline expandable section is preferred
   - Recommendation: Full-screen modal overlay (simplest, most readable for a full report)

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified -- marked and dompurify are npm packages installed at build time)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | DOMPurify.sanitize() on all user-influenced content before v-html |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via domain names in Markdown | Tampering | DOMPurify.sanitize() after marked.parse() -- never render unsanitized HTML |
| Script injection via Markdown code blocks | Tampering | DOMPurify strips script tags by default; marked renders code blocks as `<pre><code>` (safe) |

## Sources

### Primary (HIGH confidence)
- npm registry: marked@15.0.12 verified current [VERIFIED: npm view]
- npm registry: dompurify@3.3.3 verified current [VERIFIED: npm view]
- npm registry: @types/dompurify@3.2.0 verified current [VERIFIED: npm view]
- Project STATE.md: locked decisions on marked ^15.x pin, DOMPurify PITFALL-9 [VERIFIED: codebase]
- Project usePptxExport.ts: dynamic import pattern PPTX-15 [VERIFIED: codebase]
- Project ExportToolbar.vue: current button layout and localeLoading guard [VERIFIED: codebase]
- Project useMarkdownExport.ts: generateMarkdownReport() API [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- marked v15 async parse() behavior [CITED: marked changelog / npm description]

### Tertiary (LOW confidence)
- Tailwind v4 typography plugin integration [ASSUMED -- needs verification at execution time]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- libraries locked in STATE.md, versions verified against npm
- Architecture: HIGH -- follows established project patterns (PPTX-15, ExportToolbar layout)
- Pitfalls: HIGH -- XSS sanitization already documented as PITFALL-9; bundle splitting follows PPTX-15

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable libraries, no fast-moving concerns)
