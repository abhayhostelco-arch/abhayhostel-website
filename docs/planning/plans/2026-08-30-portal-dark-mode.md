# Portal Dark Mode Implementation Plan

> **For agentic workers:** Execute one task at a time with a fresh implementer and an independent task reviewer, but keep every change uncommitted. Steps use checkbox syntax for tracking.

**Goal:** Add a flash-free, accessible System/Light/Dark mode to the Next.js portal.

**Architecture:** A one-shot pre-paint script resolves the saved browser preference and applies it to the document. A single client provider subsequently owns storage, live system changes, and controls. Semantic CSS tokens theme the portal and chart/Turnstile integrations consume the resolved theme.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, Vitest, Testing Library, Recharts, Cloudflare Turnstile.

**Spec:** `docs/planning/specs/2026-08-30-portal-dark-mode-design.md`

## Global Constraints

- All application paths are relative to `portal/`; all npm commands execute from `portal/`.
- No database changes, new production dependencies, public-site changes, commits, merges, pushes, or deployment.
- Preference key is `abhay-hostel-theme`; light and dark runtime theme colors are `#f5f7fa` and `#081f3d`.
- Browser-local preference values are exactly `system`, `light`, and `dark`; invalid/missing/unreadable values default to System.
- Manifest `background_color` and `theme_color` are exactly `#081f3d`.

---

### Task 1: Theme contract and pre-paint initialization

**Files:**
- Create: `src/lib/theme.ts`, `src/lib/theme-bootstrap.ts`, `src/lib/theme.test.ts`, `src/lib/theme-bootstrap.test.ts`, `src/app/layout.test.tsx`, `src/app/manifest.test.ts`
- Modify: `src/app/layout.tsx`, `src/app/manifest.ts`

**Interfaces:**
- Produces `ThemePreference`, `ResolvedTheme`, `THEME_STORAGE_KEY`, `resolveTheme`, `readThemePreference`, `applyResolvedTheme`, and `themeBootstrapScript`.

- [ ] Write jsdom tests that execute `themeBootstrapScript` against saved System/Light/Dark values, malformed/throwing storage, absent `matchMedia`, and missing theme meta; assert `data-theme`, `style.colorScheme`, and meta content.
- [ ] Run `npm test -- src/lib/theme.test.ts src/lib/theme-bootstrap.test.ts src/app/layout.test.tsx src/app/manifest.test.ts`; verify tests fail because the contract does not exist.
- [ ] Implement the pure contract including exported `LIGHT_THEME_COLOR` and `DARK_THEME_COLOR` constants. Add a `beforeInteractive` `Script` with id `theme-bootstrap`, exact script body, `suppressHydrationWarning`, imported `viewport.themeColor: LIGHT_THEME_COLOR`, and `viewport.colorScheme: "light dark"`. Do not add a handwritten theme-color meta: Next emits it from the exported viewport.
- [ ] Add manifest tests and set both manifest colors to `#081f3d`; run the focused tests green.

### Task 2: Provider and accessible theme controls

**Files:**
- Create: `src/components/theme-provider.tsx`, `src/components/theme-control.tsx`, `src/components/theme-provider.test.tsx`, `src/components/theme-control.test.tsx`, `src/components/portal-navigation.test.tsx`
- Modify: `src/app/layout.tsx`, `src/components/auth-shell.tsx`, `src/components/account-menu.tsx`, `src/components/portal-navigation.tsx`

**Interfaces:**
- Consumes Task 1 theme contract.
- Produces `ThemeProvider`, `useTheme`, and `ThemeControl`.

- [ ] Write jsdom tests for the unhydrated disabled `aria-busy` fieldset, bootstrap preservation, setting each preference, storage write failure, system-media changes, explicit-mode media suppression, valid/null/invalid/unrelated storage events, and all document/browser-chrome effects.
- [ ] Write control tests for labels, native radio keyboard semantics, unique names/IDs with two mounted controls, and synchronized checked state. Add mobile-sheet tests for initial focus and forward/reverse Tab traversal through hydrated theme radios while disabled pre-hydration radios remain excluded.
- [ ] Run focused tests and verify expected missing-module failures.
- [ ] Implement one root provider; read storage after hydration, register media listeners only for System, and include enabled radio inputs in the mobile focus selector. Render controls in AuthShell, AccountMenu, and MobilePortalNavigation.
- [ ] Run focused tests green.

### Task 3: Semantic CSS theme and accessibility enforcement

**Files:**
- Create: `src/app/theme-css.test.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes document `data-theme` from Task 1.
- Produces semantic token blocks and CSS-only light/dark rendering.

- [ ] Write tests that parse the stylesheet with last-declaration precedence, `var()` aliases, and alpha compositing. Use the exact token values in the spec and encode the full contrast matrix: normal text on canvas/surface/elevated/subtle/tooltip/status backgrounds; large text; control borders and focus against each adjacent surface; status foreground/border/icon; every chart mark/axis/grid/cursor against plot surface.
- [ ] Add structural tests requiring the reduced-motion rule to disable transitions for theme controls, account chevrons, student overview links, and weekly-program session cards.
- [ ] Run the test and verify it fails against the current stylesheet.
- [ ] Add exact final light/dark tokens and replace all active raw light UI colors throughout the full cascade, including dialogs, mobile surfaces, skeletons, overlays, forms, tables, sticky bars, and responsive declarations. Keep sidebar/status/chart hues as named tokens only.
- [ ] Run the CSS tests green.

### Task 4: Charts, Turnstile, and PWA integration

**Files:**
- Create: `src/components/trend-chart.test.tsx`, `src/components/growth-score-charts.test.tsx`, `src/components/turnstile-widget.test.tsx`
- Modify: `src/app/theme-css.test.ts`, `src/components/trend-chart.tsx`, `src/components/growth-score-charts.tsx`, `src/components/turnstile-widget.tsx`

**Interfaces:**
- Consumes `ResolvedTheme` from `useTheme` and CSS chart tokens.

- [ ] Write chart tests asserting themed axes/ticks/grid/cursor/legend/tooltips and distinct dash/marker cues for every multi-series line.
- [ ] Write Turnstile tests for theme-driven remove/re-render before and after script availability, readiness/token invalidation, stale-generation callback rejection, reset, and unmount removal.
- [ ] Run focused tests and verify expected failures.
- [ ] Replace chart presentation literals with theme variables and non-color cues. Extend Turnstile’s API type with `light | dark` and `remove`, implement generation-safe lifecycle behavior, and preserve reset semantics.
- [ ] Add the full `src/**/*.{css,tsx}` literal-color scanner after chart tokenization; it permits literals only in the two final CSS token blocks and fails every other source occurrence.
- [ ] Run `npm test -- src/components/trend-chart.test.tsx src/components/growth-score-charts.test.tsx src/components/turnstile-widget.test.tsx src/app/theme-css.test.ts` green.

### Task 5: Full verification and isolated visual QA

**Files:**
- Create: `.superpowers/sdd/.gitignore`, `.superpowers/sdd/2026-08-30-portal-dark-mode/visual-qa.md` (git-ignored execution evidence)

- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run security:secrets`, and `npm run build` from `portal/`.
- [ ] Use only local/test Supabase credentials to inspect 1440×900 and 390×844 viewports for explicit Light, explicit Dark, System/light OS, and System/dark OS.
- [ ] Add `.superpowers/sdd/.gitignore` containing `*` and `!.gitignore` before creating evidence. Record the exact route/role/state checklist from the spec, deterministic triggers, role prerequisites, and evidence in the QA file. Do not submit forms or mutate data, except the single isolated test-safe `/student/entry` submission needed to render its success dialog.
- [ ] If isolated authenticated credentials are unavailable, record that as the remaining QA blocker; do not inspect production.
