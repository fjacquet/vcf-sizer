# Contributing to VCF Sizer

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/fjacquet/vcf-sizer.git
cd vcf-sizer
npm install
npm run dev       # dev server at http://localhost:5173
```

## Code Quality

Before submitting a PR, ensure:

```bash
npm run lint       # ESLint check
npm run format     # Prettier formatting
npm run test       # Vitest test suite (242 tests)
npm run type-check # vue-tsc type validation
```

## Architecture Rules

The codebase enforces strict layer separation:

- **Engine** (`src/engine/`) — Pure TypeScript, **zero Vue imports** (CALC-01)
- **Stores** (`src/stores/calculationStore.ts`) — **Zero `ref()`**, only `computed()` (CALC-02)
- **Components** read from stores; they never call engine functions directly

## Commit Style

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(engine): add NVMe tiering overhead calculation
fix(i18n): correct FR-CH number formatting for storage values
docs(readme): update test count badge
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests for any new engine logic
3. Ensure all checks pass (`lint`, `test`, `type-check`)
4. Fill out the PR template
5. Request review

## Adding a New Locale

1. Create `src/i18n/locales/{locale}.json` with all required keys
2. Add the locale to `src/stores/uiStore.ts`
3. Add `numberFormats` — do not inherit from parent locale

## Adding Engine Calculations

1. Add the function in `src/engine/` (pure TS, no Vue imports)
2. Write tests in the corresponding `*.test.ts` file
3. Wire it up in `src/stores/calculationStore.ts` as a `computed()`
