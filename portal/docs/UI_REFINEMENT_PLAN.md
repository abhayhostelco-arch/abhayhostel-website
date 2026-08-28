# Abhay Hostel Portal UI Refinement Plan

## 1. Purpose

Refine the complete portal UI using the supplied dashboard reference as the visual direction: a deep-navy application shell, compact navigation, clear role-aware greetings, colored metric icons, dense white dashboard panels, accessible charts, attendance summaries, activity lists, and responsive student summaries.

This is a visual and interaction refinement of the existing product. Preserve the current authentication, authorization, Supabase data model, server actions, report calculations, role routing, and business rules unless a UI requirement below explicitly needs a derived view model.

## 2. Assumptions and Boundaries

- Preserve the Abhay Hostel name, logo, terminology, and navy/gold identity. Do not copy the reference brand.
- Treat the supplied image as a design guideline, not a pixel-for-pixel requirement.
- Keep Admin, Mentor, and Student permissions unchanged.
- Prefer existing data. A recent-activity panel may derive items from daily entries, attendance, alerts, and account events already available to each role.
- Do not add a persistent audit-log schema solely for the visual refinement. Treat a true historical activity feed as a separate product decision if existing data is insufficient.
- Do not introduce a component library or utility CSS framework. The current React, Lucide, Recharts, and CSS stack is sufficient.
- Do not change backend routes or server actions unless necessary to expose already-authorized data to a new presentation component.
- Desktop should resemble the density and composition of the reference, while tablet and mobile must remain first-class experiences.

## 3. End-to-End Success Criteria

The refinement is complete only when:

- Every route and shared component listed in Sections 8 and 9 has been reviewed and either refined or explicitly verified as visually unaffected.
- All role dashboards share one visual language while preserving role-specific priorities.
- The shell, page headers, filters, cards, tables, forms, charts, feedback, and empty states use one canonical design system.
- All filters and date/range selections that change the displayed dataset remain represented in the URL.
- Keyboard, screen-reader, reduced-motion, touch, long-content, empty-data, loading, error, and unavailable-data states have been checked.
- No horizontal page overflow occurs at 320px, 375px, 768px, 1024px, 1440px, or wide desktop widths.
- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.
- Admin, Mentor, and Student walkthroughs pass with no authorization or workflow regression.

## 4. Visual System

### 4.1 Color

- Application background: soft blue-gray, approximately `#F5F7FA`.
- Sidebar: deep navy, approximately `#081F3D`.
- Primary action and active navigation: royal navy/blue within the existing brand.
- Surfaces: white with subtle cool-gray borders.
- Primary text: dark slate; secondary text must maintain accessible contrast.
- Gold remains the brand accent, especially for emphasis and spiritual identity.
- Purple, green, orange, blue, and rose are semantic accents for metric icon tiles, chart series, and statuses. Never use color as the only status signal.

### 4.2 Type

- Continue using Inter.
- Establish a predictable scale for page title, section title, body, label, caption, and data value.
- Use `text-wrap: balance` or `text-wrap: pretty` for headings.
- Use tabular numerals for metrics, times, dates, scores, and table comparisons.
- Avoid reference-image text sizes that would be too small for production use.

### 4.3 Spacing and Shape

- Use a consistent 4px/8px spacing scale.
- Cards: 10–12px radius, 1px border, restrained shadow.
- Inputs and buttons: approximately 8px radius.
- Interactive controls: 44px touch target where practical; never below the current accessible mobile target.
- Use compact density on desktop without reducing readability.

### 4.4 Motion

- Restrict animations to opacity and transform.
- Keep route progress, skeleton, dialog, sheet, tab, and chart transitions subtle and interruptible.
- Disable nonessential motion under `prefers-reduced-motion`.
- Never use `transition: all`.

## 5. Information Architecture and Shell

### 5.1 Desktop Shell

- Keep the persistent deep-navy sidebar and current role-aware link sets.
- Refine the brand block so the Abhay Hostel logo/name has similar prominence to the reference.
- Use grouped navigation with clearer active pills, consistent icons, and larger hit areas.
- Keep the signed-in identity block at the bottom, with avatar, truncated name/email, role, online/account context, and profile link.
- Retain a sticky white top bar. Replace generic portal context with a role-aware greeting/context area and compact global actions where appropriate.
- The page body should use a wide, centered dashboard canvas capped around the current 1440px width.

### 5.2 Mobile Shell

- Retain the fixed bottom navigation with 3 priority links plus More.
- Make the More sheet a fully managed dialog: initial focus, focus containment, Escape close, focus restoration, background isolation, overscroll containment, and safe-area padding.
- Keep the compact mobile brand top bar.
- Place page-specific filters and actions in the page content instead of overloading the mobile top bar.

### 5.3 Navigation and State

- Active location must remain visible with `aria-current="page"`.
- Navigation uses `Link`; actions use buttons.
- Query-backed filters, ranges, dates, selected students, and mentor scopes remain deep-linkable.
- If leaderboard tabs become shareable report state, migrate them from local state to a query parameter; otherwise keep them local and implement complete tab keyboard behavior.

## 6. Shared UI Primitives

Create or formalize only repeated patterns:

- `DashboardHeader`: eyebrow, greeting/title, description, contextual filters, secondary action, primary action.
- `MetricCard`: semantic icon tile, label, primary value, supporting text, optional trend/status.
- `DashboardPanel`: title, description, action, content, loading, empty, and unavailable states.
- `ScoreRing`: visible score text plus accessible label; category progress remains textual.
- `CategoryProgress`: label, score, progress track, and semantic accent.
- `AttendanceHeatmap`: day/status grid with legend and a non-color textual/table equivalent.
- `ActivityList`: icon, event, supporting detail, localized date/time, and empty state.
- `StudentSummaryCard`: avatar, name, score/status, wake/study/round summary, and profile link where authorized.
- `DataToolbar`: labeled filters, reset/apply actions, result count, and export/action slot.
- `EmptyState`: icon, heading, explanation, and optional direct next action.
- `StatusBadge`: semantic label plus optional icon; not color-only.
- `ResponsiveDataView`: table on wide screens and scan-friendly cards or controlled horizontal scrolling on small screens.

Do not abstract unique page sections until a second real use exists.

## 7. Dashboard Composition

### 7.1 Super Admin Dashboard (`/admin`)

- Header: personalized greeting, operational subtitle, range/date context, Mentor filter, report export, and Add Student action.
- KPI row: active students, active Mentors, submitted today, official attendance today, attendance completion, and unassigned students. Use colored icon tiles and supporting labels.
- Primary grid:
  - Attendance trend with clear gaps and an action to record attendance.
  - Mentor workload with avatar/name, assigned count, and capacity treatment.
  - Overall/group score presentation with score ring and category progress.
  - Attendance heatmap for recent Gita Class status where data is available.
- Secondary grid:
  - Priority alerts or student overview.
  - Recent activity derived from authorized data.
  - Category leaderboard.
- Bottom student summary strip: priority or top students with links to detail pages.
- Preserve all current empty and migration-unavailable states.

### 7.2 Mentor Dashboard (`/mentor`)

- Header: personalized greeting, 30-day report action, My Students action, and useful range context.
- KPI row: assigned students, submitted today, missing today, 30-day alerts, and assigned-group average score.
- Primary grid: assigned-group completion trend and students needing attention.
- Add compact selected/priority student summary using existing authorized details.
- Add group score breakdown or leaderboard without exposing unassigned student details beyond current policy.
- Add recent assigned-group activity when it can be derived without a schema change.
- Use the same panel dimensions and hierarchy as Admin, with fewer operational controls.

### 7.3 Student Dashboard (`/student`)

- Header: Hare Krishna greeting, current-day context, and Fill/Edit Today’s Entry action.
- KPI/score row: overall, Sadhana, Study, Discipline, and Seva scores with semantic icon tiles.
- Primary grid:
  - Today’s Sadhana checklist with completion/missing state and edit action.
  - Score ring with category progress and rank context.
  - 7-day submission calendar or compact attendance heatmap.
  - Study/sleep or overall-score trend.
- Secondary content: hostel scoreboard, personal rank, and recent personal activity.
- Keep scoring-period explanation and self-reported-data disclosure visible but quiet.

## 8. Route-by-Route Coverage

### 8.1 Global and Authentication Routes

| File / Route | Required Refinement |
|---|---|
| `src/app/layout.tsx` | Verify metadata/theme color matches the refined shell; preserve Inter, navigation progress, PWA registration, language, and zoom support. |
| `src/app/page.tsx` (`/`) | No visual surface; verify role redirects and password-change redirect remain unchanged. |
| `src/app/login/page.tsx` (`/login`) | Refine auth composition, branded story panel, form density, mobile simplification, and loading/error states. |
| `src/app/forgot-password/page.tsx` (`/forgot-password`) | Match login shell; clarify invalid/expired link, success state, return navigation, and form feedback. |
| `src/app/change-password/page.tsx` (`/change-password`) | Match auth shell; add clear password requirements, field-level errors, pending state, and completion hierarchy. |
| `src/app/loading.tsx` | Replace generic skeleton with shell-aware/page-aware geometry where feasible; preserve `aria-busy`, live text, and reduced motion. |
| `src/app/error.tsx` | Use canonical error state with a specific recovery action and readable full-page placement inside or outside the shell. |
| `src/app/not-found.tsx` | Use canonical standalone state and role-safe Return to Portal action. |

### 8.2 Super Admin Routes

| File / Route | Required Refinement |
|---|---|
| `src/app/admin/layout.tsx` | Verify the refined shell is applied once and authorization is unchanged. |
| `src/app/admin/page.tsx` (`/admin`) | Complete dashboard composition defined in Section 7.1. |
| `src/app/admin/students/page.tsx` (`/admin/students`) | Directory header, search/status toolbar, result count, avatar/name cell, Mentor assignment treatment, status badge, responsive actions, empty state, and safe destructive confirmations. |
| `src/app/admin/students/new/page.tsx` | Standard form-page header, numbered section, clearer required/optional fields, responsive 2-column layout, inline validation, temporary-password success state, and cancel/back actions. |
| `src/app/admin/students/[id]/page.tsx` | Student identity header, summary metrics, score breakdown, trends, correction workflow, wide daily-record view, responsive table/card handling, historical/inactive state, and data disclosure. |
| `src/app/admin/administrators/page.tsx` | Mentor directory with identity, role/status, assigned-student context where available, protected-account treatment, responsive actions, reset state, and empty state. |
| `src/app/admin/administrators/new/page.tsx` | Standard Mentor creation form, temporary-password presentation, inline errors, and clear completion path. |
| `src/app/admin/gita-attendance/page.tsx` | Date toolbar, completion status, bulk actions, accessible status segmented controls, sticky save bar, empty/unavailable states, and mobile one-student-per-card layout. |
| `src/app/admin/alerts/page.tsx` | Alert summary header, range/type toolbar, semantic alert variants, linked student identity, readable date/message, result count, and no-alert state. |
| `src/app/admin/reports/page.tsx` | Reference-style report toolbar with range/student/export, KPI row, score summary, category and routine charts, leaderboard, clock averages, disclosures, and responsive stacking. |
| `src/app/admin/settings/page.tsx` | Sticky section navigation, alert-rule grouping, score-weight/target grouping, visible total-weight guidance, inline validation, sticky save actions, and narrow-screen section tabs/links. |
| `src/app/admin/profile/page.tsx` | Refine the shared staff profile card and security action; keep Super Admin identity and protection clear. |

### 8.3 Mentor Routes

| File / Route | Required Refinement |
|---|---|
| `src/app/mentor/layout.tsx` | Verify refined shell and Mentor authorization. |
| `src/app/mentor/page.tsx` (`/mentor`) | Complete dashboard composition defined in Section 7.2. |
| `src/app/mentor/students/page.tsx` | Shared Student directory refinement with Mentor-specific copy, scoped results, hidden Admin-only creation/assignment actions, and correct links. |
| `src/app/mentor/students/[id]/page.tsx` | Shared student detail refinement; preserve assignment authorization, correction permissions, and Mentor URLs. |
| `src/app/mentor/gita-attendance/page.tsx` | Shared attendance refinement with assigned-student scope and Mentor-specific empty copy. |
| `src/app/mentor/alerts/page.tsx` | Shared alert refinement with assigned-student scope and Mentor detail links. |
| `src/app/mentor/reports/page.tsx` | Shared report refinement with assigned-student filter options and export authorization preserved. |
| `src/app/mentor/profile/page.tsx` | Avatar editor, account identity, success/error feedback, file-state handling, and change-password path using the refined profile system. |

### 8.4 Student Routes

| File / Route | Required Refinement |
|---|---|
| `src/app/student/layout.tsx` | Verify refined shell, compact Student navigation, and Student authorization. |
| `src/app/student/page.tsx` (`/student`) | Complete dashboard composition defined in Section 7.3. |
| `src/app/student/entry/page.tsx` | Strong Today/Yesterday switcher, sectioned Sadhana/Study/Discipline/Seva form, sticky save action, field errors, success dialog, recent-history table/cards, locked-history explanation, and unsaved-change protection. |
| `src/app/student/progress/page.tsx` | Range toolbar, submission status, score cards, overall/category charts, personal rank, accessible daily-score history, and empty range handling. |
| `src/app/student/settings/page.tsx` | Avatar upload/remove/preview, birthdate, file constraints, pending/success/error feedback, unavailable state, and safe small-screen layout. |

### 8.5 Shared Operations Routes

| File / Route | Required Refinement |
|---|---|
| `src/app/attendance/page.tsx` (`/attendance`) | Role-aware header; Admin/Mentor event/date toolbar and inline attendance sheet; Student history; Super Admin setup area; semantic statuses; responsive records; per-row save feedback; empty states. |
| `src/app/attendance/new-event/page.tsx` | Standard form page, status-options guidance, validation feedback, and clear cancel/create actions. |
| `src/app/attendance/new-attendee/page.tsx` | Standard form page, linked-student/external-person distinction, contact fields, validation, and clear completion path. |
| `src/app/weekly-program/page.tsx` (`/weekly-program`) | Active-session status, Student attendance/clothing form, Super Admin Mentor filter, staff participation matrix, semantic status/icon treatment, responsive table/card view, and no-session state. |
| `src/app/weekly-program/new/page.tsx` | Standard session-opening form, date constraints, consequence explanation, and clear cancel/open actions. |
| `src/app/resources/page.tsx` (`/resources`) | Resource count, category filtering if useful with existing data, clearer resource cards, external-link treatment, Admin edit/archive/publish actions, long URL/title handling, and empty state. |
| `src/app/resources/new/page.tsx` | Standard resource form, URL/category/publication fields, validation, publication explanation, and clear actions. |
| `src/app/resources/[id]/edit/page.tsx` | Same form system with current-state visibility, archive/publication status, validation, and safe navigation. |

### 8.6 Nonvisual Application Routes

| File | Verification |
|---|---|
| `src/app/api/reports/export/route.ts` | No visual redesign; verify refined report filters generate the same authorized export query. |
| `src/app/auth/callback/route.ts` | No visual redesign; verify authentication recovery and redirects still reach the refined auth screens. |
| `src/app/actions/*.ts` | Keep behavior stable; verify pending, success, field-error, global-error, confirmation, and revalidation states are all represented by the refined UI. |
| `src/app/manifest.ts` | Verify PWA colors/icons match the refined brand shell. |

## 9. Component-by-Component Coverage

| Component | Required Refinement / Verification |
|---|---|
| `account-menu.tsx` | Route-change, outside-click, and Escape dismissal; focus restoration; identity details; profile navigation; and sign-out action. |
| `dashboard-ui.tsx` | Shared metrics, panels, score ring, activity list, attendance heatmap, and horizontally scrollable Student summaries with accessible text equivalents. |
| `portal-shell.tsx` | Desktop/sidebar/topbar structure, skip link, identity and account menu, content landmarks, role-aware context, and mobile integration. |
| `portal-navigation.tsx` | Group hierarchy, active/hover/focus states, link truncation, mobile sheet focus management, Escape/backdrop behavior, and safe areas. |
| `brand.tsx` | Logo sizing, explicit image dimensions, high-contrast sidebar/auth variants, and non-translated brand treatment. |
| `profile-avatar.tsx` | Consistent sizes, explicit dimensions, meaningful alt text, initials fallback, and image cropping. |
| `role-badge.tsx` | Canonical semantic badge appearance and readable role labels. |
| `auth-shell.tsx` | Shared branded authentication composition and compact mobile presentation. |
| `auth-form.tsx` | Field hierarchy, password visibility control, Turnstile readiness, pending/error states, autocomplete/spellcheck, and security note. |
| `forgot-password-form.tsx` | Email autocomplete/spellcheck, private response language, invalid-link state, success state, and navigation. |
| `change-password-form.tsx` | Requirements, show/hide affordance if added, field errors linked to controls, pending state, and success transition. |
| `turnstile-widget.tsx` | Reserved layout space, loading/failure/expiry feedback, accessible status, theme alignment, and no layout shift. |
| `navigation-progress.tsx` | Refined color, reduced motion, no interaction blocking, and route-change accuracy. |
| `service-worker-registration.tsx` | No visual surface; verify no console/UI regression. |
| `account-form.tsx` | Standard field grid, required/optional labels, field errors, create progress, result focus, and temporary-password handoff. |
| `account-reset-form.tsx` | Clear action hierarchy, pending state, success/error feedback, and protection from repeated submission. |
| `copyable-temporary-password.tsx` | Monospace/token presentation, copy label/state, keyboard access, live confirmation, and long-content handling. |
| `confirm-submit-button.tsx` | Replace browser-confirm styling only if a shared accessible confirmation dialog is implemented; otherwise verify action wording and cancellation. |
| `daily-entry-form.tsx` | Section layout, number/time controls, checkbox hit areas, inline errors, sticky save bar, unsaved changes, success dialog focus/close behavior, and reduced motion. |
| `gita-attendance-form.tsx` | Bulk controls, completion count, accessible radio cards, sticky save bar, status feedback, long student names, and large-roster performance. |
| `profile-settings-form.tsx` | File picker, validation, preview, remove state, object URL cleanup, upload progress/failure, birthdate, and success feedback. |
| `alert-settings-form.tsx` | Logical grouping, enabled/disabled dependencies, inline validation, live feedback, and sticky save behavior. |
| `score-settings-form.tsx` | Weight/target grouping, 100% total context, inline errors, numeric input behavior, live feedback, and sticky save. |
| `growth-score-cards.tsx` | Convert to shared semantic metric cards, readable `/100` treatment, accessible progress values, and responsive density. |
| `growth-score-charts.tsx` | Unified chart palette, accessible names/descriptions, tooltips, tabular values, empty state, responsive axes, and reduced motion. |
| `trend-chart.tsx` | Same chart system; distinguish missing data from zero, localized dates, responsive labels, and accessible summary. |
| `growth-leaderboard.tsx` | Rank hierarchy, current-student treatment, long names, empty state, tabular scores, and responsive table/card behavior. |
| `category-leaderboard.tsx` | Tab styling, Arrow/Home/End keyboard behavior, focus management, panel linkage, optional URL state, accessible progress values, current-student summary, and empty state. |
| `staff-profile-page.tsx` | Identity card, avatar, role, email wrapping, security action, and mobile alignment. |

## 10. Accessibility and Interaction Checklist

- Preserve a visible skip link and logical `main`, `nav`, `header`, section, heading, form, table, and dialog structure.
- Every icon-only control has an `aria-label`; decorative icons use `aria-hidden="true"`.
- Form controls have visible labels, meaningful names, correct types/input modes, autocomplete, and inline error association.
- Async feedback uses `role="status"`/`aria-live="polite"`; blocking errors use `role="alert"` where appropriate.
- Focus is visible with `:focus-visible`; compound controls use `:focus-within` where it improves clarity.
- Sticky top bars, bottom navigation, and save bars do not obscure focused controls.
- Dialogs and sheets contain focus, close with Escape, restore focus, and prevent background interaction.
- Destructive operations retain confirmation or gain an accessible confirmation dialog/undo path.
- Charts, score rings, progress bars, and heatmaps include text values and do not rely on color.
- Tables keep semantic headers and provide a practical small-screen alternative.
- Dates and times use existing localization helpers or `Intl.DateTimeFormat`; counts use tabular numerals.
- User-generated names, emails, notes, titles, categories, and URLs support empty, short, average, and very long values.
- Large rosters and tables are checked for rendering cost; use pagination, `content-visibility`, or virtualization only when real sizes justify it.
- Page, dialog, and sheet layouts respect safe-area insets and do not disable browser zoom.

## 11. Responsive Behavior

### Wide Desktop (approximately 1280px and above)

- Persistent 232px-class sidebar.
- Wide dashboard canvas with 5–6 KPI cards where content fits.
- Reference-style multi-column dashboard panels.
- Tables remain tables; filters remain compact toolbars.

### Tablet / Small Desktop (approximately 781–1279px)

- Sidebar remains until the existing mobile breakpoint unless real-content testing shows crowding.
- KPI cards collapse to 2–3 columns.
- Primary dashboard panels collapse from 3 areas to 2 or 1 based on minimum content width.
- Toolbars wrap without separating labels from controls.

### Mobile (780px and below)

- Sidebar becomes bottom navigation plus More sheet.
- Headers, filters, actions, KPI cards, charts, forms, and panels use a single-column reading order.
- Important metric sets may remain 2 columns only when labels and values fit; otherwise use 1 column.
- Tables become cards where actions or dense content cannot be understood through horizontal scrolling.
- Sticky save bars sit above bottom navigation and safe areas.

## 12. Loading, Empty, Error, and Edge States

Every data-bearing panel must define:

- Initial loading/skeleton state matching final geometry.
- Empty state with a useful explanation and authorized next action.
- Partial-data state where some days or categories are missing.
- Unavailable/migration state distinct from an empty dataset.
- Error state with recovery guidance.
- Long-content behavior.
- Pending and success state for mutations.
- Disabled state with an understandable reason when the user cannot proceed.

## 13. Implementation Sequence

1. Capture baseline screenshots for every unique page and all 3 roles at desktop and mobile widths.
2. Consolidate the three overlapping style layers in `src/app/globals.css` into one canonical token and component system.
3. Refine `Brand`, `ProfileAvatar`, `RoleBadge`, buttons, fields, badges, panels, tables, empty states, and feedback primitives.
4. Refine `PortalShell` and desktop/mobile navigation, including focus-managed account and navigation overlays.
5. Build the Admin dashboard as the approved reference implementation.
6. Apply the dashboard system to Mentor and Student dashboards.
7. Refine shared chart, score, leaderboard, activity, heatmap, and student-summary components.
8. Refine directories, student detail, reports, alerts, attendance, weekly program, and resources.
9. Refine all creation/editing forms, profile/settings screens, and authentication screens.
10. Complete loading/error/not-found/unavailable states.
11. Run accessibility, responsive, long-content, empty-data, and role-based QA.
12. Run the full repository verification commands and capture final comparison screenshots.

## 14. Phase Acceptance Gates

### Gate A: Foundation

- One canonical design system; no conflicting legacy/revamp overrides.
- Shared primitives cover all repeated visual patterns.
- Focus, hover, active, disabled, and reduced-motion states verified.

### Gate B: Shell

- Desktop and mobile navigation work for every role.
- Long names/emails and maximum link counts do not overflow.
- Mobile sheet and account interactions pass keyboard testing.

### Gate C: Dashboards

- Admin dashboard approved as visual baseline.
- Mentor and Student dashboards match the same system.
- All chart/heatmap/score information is also available as text.

### Gate D: Workflows

- Every list, detail, report, attendance, resource, settings, profile, and form route in Section 8 is checked off.
- Mutation feedback, destructive confirmations, sticky actions, and URL-backed filters work.

### Gate E: Release Readiness

- All success criteria in Section 3 pass.
- No functional, authorization, export, PWA, or mobile regression.
- Final desktop/mobile screenshots exist for each unique route family.

## 15. Explicit Out of Scope

- Changing scoring formulas or alert rules beyond their presentation.
- Replacing Supabase or changing the authorization model.
- Adding messaging, payments, notifications, or other new product modules.
- Creating a persistent activity/audit-log backend without a separate requirement.
- Copying the reference organization’s name, logo, copy, or student data.
- Pushing or deploying changes without a separate explicit user request.
