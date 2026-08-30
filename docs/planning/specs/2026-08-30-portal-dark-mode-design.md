# Portal Dark Mode Design

## Goal

Add an accessible, persistent dark mode to the Next.js portal in `portal/`. The public WordPress marketing site is excluded.

## User experience

- Every portal visitor can choose **System**, **Light**, or **Dark**.
- The default is System. The choice is stored only in the current browser under `abhay-hostel-theme`; it is not stored in Supabase and does not sync between accounts or devices.
- The selected or system-resolved theme applies before first paint, remains synchronized across open tabs, and updates live when the OS theme changes while System is selected.
- The control appears on authentication screens, the desktop account-menu popover, and the mobile navigation sheet. It uses a labelled native radio group with unique IDs and group names per rendered control.
- Before provider hydration, each control renders a disabled, `aria-busy="true"` fieldset with no checked option. After the first storage read, the provider preference is authoritative and the radios become enabled. The mobile-sheet focus trap treats enabled radio inputs as focusable.
- All existing portal screens—including authentication, standalone error/loading states, dialogs, menus, forms, tables, charts, and Turnstile—render coherently in both themes. No public-site styles change.

## Theme contract

`ThemePreference` is `"system" | "light" | "dark"`; `ResolvedTheme` is `"light" | "dark"`.

- Missing, malformed, or inaccessible storage resolves to System.
- System is dark only when `matchMedia("(prefers-color-scheme: dark)").matches` is true; absent media-query support resolves to light.
- A one-shot root bootstrap runs with Next.js `beforeInteractive`. It reads the preference, resolves the theme, and sets `<html data-theme>`, `documentElement.style.colorScheme`, and the sole `meta[name="theme-color"]`. It never registers a listener.
- `<html suppressHydrationWarning>` is required. The client provider begins unhydrated and preserves the bootstrap DOM until its first storage read completes.
- The provider owns live `matchMedia` listening only in System mode and handles valid `storage` events from other tabs. Explicit preferences ignore OS changes. Storage write failures do not prevent the same-tab UI and DOM from updating.
- The static viewport fallback is `themeColor: "#f5f7fa"`, `colorScheme: "light dark"`; runtime resolved values are `#f5f7fa` (light) and `#081f3d` (dark). The manifest always uses `#081f3d` for both `background_color` and `theme_color`. That dark installed-app splash and the existing platform-owned `appleWebApp.statusBarStyle: "default"` are explicit static-browser-chrome exceptions; the page applies the user preference before its own first paint.

## Visual system and accessibility

The stylesheet must use semantic tokens, with light and dark values, for canvas, surface, elevated surface, subtle surface, primary and muted text, borders, control borders, focus, status backgrounds/foregrounds, overlays, shadows, and charts. Tokens are introduced after the existing final base tokens; dark overrides follow them. Existing earlier cascade blocks must be audited because not every earlier declaration is replaced later.

Raw literal colors are permitted only in the final `:root` and `html[data-theme="dark"]` token declaration blocks. Those blocks include immutable `--brand-sidebar-*`, `--status-*`, and `--chart-*` tokens; logo/artwork uses image assets and has no CSS color exception. No JSX/TSX chart or UI presentation literal is allowed. All other active UI literals are replaced by tokens. The literal scanner permits hexadecimal and `rgb`/`rgba` values only in those two declaration blocks and fails every other CSS/TSX occurrence. This is tokenization, not a visual redesign.

The design must meet WCAG 2.2 AA: normal text is at least 4.5:1; large text, visible control boundaries, focus indicators, status icons/borders, and chart marks are at least 3:1 against their actual backgrounds. Tests resolve final CSS precedence, `var()` aliases, and alpha compositing. The required pair matrix covers text on each canvas/surface/tooltip/status background; borders and focus on adjacent surfaces; status foreground/border/icon on its status background; and every chart series, axis, grid, and cursor on the plot surface.

The final token values are: light `--canvas #f5f7fa`, `--surface #ffffff`, `--surface-elevated #ffffff`, `--surface-subtle #f8fafc`, `--text #172033`, `--heading #081f3d`, `--muted #596779`, `--border-control #718096`, `--focus #8a5b00`; dark `--canvas #0b1220`, `--surface #121d2b`, `--surface-elevated #182638`, `--surface-subtle #1e2d3f`, `--text #f4f7fa`, `--heading #ffffff`, `--muted #b7c2cf`, `--border-control #6d8198`, `--focus #f0bd5a`. Status and chart tokens must be selected and tested against those surfaces before use; no status or chart token may be below its required contrast threshold.

Charts retain their category meaning but use contrast-safe variants by theme. Multi-series charts add distinct dash patterns or markers so series are not color-only. Axes, ticks, grid, cursor, legend, and tooltip surfaces are theme-aware. The reduced-motion rule disables transitions for the new control and the existing account chevron, student overview link, and weekly-program cards.

## Turnstile

Turnstile receives the resolved `"light"` or `"dark"` render theme. On a resolved-theme change, it clears its token and readiness state, removes the old widget, and creates a new generation. Callbacks from a removed generation are ignored. Reset behavior remains available, and unmount removes the widget. This uses Cloudflare’s documented explicit rendering lifecycle.

## Verification

Automated tests cover the exact bootstrap, provider DOM effects, controls, CSS contrast/literal scanning/reduced motion, charts, Turnstile lifecycle, layout contract, and manifest values. The full portal verification command is `cd portal && npm run verify`.

Manual visual QA uses only a local or test Supabase environment, never production-connected data. It records desktop (1440×900) and mobile (390×844) evidence for explicit Light, explicit Dark, System with a light OS, and System with a dark OS. The matrix covers login, forgot/change password, error, not-found, loading/skeleton, student, mentor, admin, forms, tables, charts, dialogs/backdrops, account/mobile menus, and Turnstile. If isolated authenticated fixtures are unavailable, that is recorded as a completion blocker rather than using production.

The QA runbook uses `/login` (unauthenticated and Turnstile), `/forgot-password` (unauthenticated form), `/change-password` (authenticated form), `/__theme-qa-not-found` (unauthenticated not-found), `/student` (student dashboard/chart), `/student/entry` (student form and success-dialog/backdrop after a local test-safe submission), `/student/settings` (student form), `/mentor` (mentor dashboard/table/chart), and `/admin` (super-admin dashboard/table/chart); student, mentor, and super-admin test accounts from the isolated environment; and deliberately opening the account/mobile controls without submitting. It records the route, role, viewport, theme mode, OS mode, state trigger, and screenshot/observation for every matrix row. Error and loading evidence requires a documented deterministic local trigger; an unavailable trigger or fixture is recorded as a blocker rather than approximated or tested against production.
