# Blind Bench App — UI Audit (Post-Remediation)

**Date:** 2026-04-16
**Scope:** Same 6 anchor surfaces as the pre-remediation audit (`app-ui-audit-2026-04-16.md`).
**Baseline score:** 9/20 (Poor).
**Target score:** ≥17/20 (Good).
**Method:** Post-wave re-audit across the five remediation branches that shipped to `main` (PRs #101–#105).

---

## Audit Health Score — Post

| # | Dimension | Before | After | Delta | Key change |
|---|-----------|--------|-------|-------|------------|
| 1 | Accessibility | 2/4 | **4/4** | +2 | `aria-current`, `aria-label`, `role=textbox`, `aria-expanded`, `aria-busy`, labelled live regions, 44×44 targets |
| 2 | Performance | 3/4 | **4/4** | +1 | `AnnotatedEditor` dedups annotation-range dispatches; no more ProseMirror re-decoration on parent renders |
| 3 | Responsive design | 1/4 | **4/4** | +3 | Mobile drawer, mobile search, touch targets, `VersionEditor` sheet, stacked diff, grid caps |
| 4 | Theming | 1/4 | **4/4** | +3 | Dark-mode primary restored, light-mode sidebar restored, 23-file red/green migration complete, public share honors OS theme |
| 5 | Anti-Patterns | 2/4 | **3/4** | +1 | CLAUDE.md violations cleared; empty states + microcopy now actionable throughout |
| **Total** | | **9/20** | **19/20** | **+10** | **Excellent band** |

**Rating:** Excellent (18–20). Target exceeded.

Two deliberately deferred items keep this short of a perfect 20: the `OptimizeConfirmationDialog` modal-vs-banner refactor (P2-7) and a `VersionEditor` unsaved-changes indicator (P2-11). Both are product-design calls, not drift, and are cheap to revisit.

---

## P0–P3 Burn-Down

| Severity | Pre | Post | Status |
|----------|-----|------|--------|
| P0 | 6 | **0** | All addressed in Wave 1 + Wave 2 |
| P1 | 14 | **0** | All addressed across Waves 2–4 |
| P2 | 13 | **2** | 11 addressed; 2 deferred (P2-7, P2-11) |
| P3 | 6 | **0** | All addressed in Wave 4 + Wave 5 |

---

## What Each Wave Delivered

### Wave 1 — Token foundation + red/green migration (PR #101)

- `src/index.css` — dark `--primary` restored to `oklch(0.72 0.18 262.881)`; light `--sidebar-primary` restored to `oklch(0.488 0.243 264.376)`
- `src/lib/statusStyles.ts` (new) — central map of `RunStatus`, `VersionStatus`, `CycleStatus`, severity, rating
- 23 files migrated from red/green to `sky` / `amber` / `purple` with icon pairing
- `BlindLabelBadge` contrast boosted to `text-slate-900 dark:text-slate-50`

**Cleared:** P0-1, P0-2, P0-3, P0-6.

### Wave 2 — Mobile responsive pass (PR #102)

- `SideNavContent` extracted; `SideNav` desktop-only (`hidden md:block`); new `MobileNavDrawer` with base-ui Drawer primitives (left slide-in)
- `TopBar` mobile Cmd+K icon button (44×44); `HelpMenu`, `NotificationBell`, `ProjectTabs` icons bumped to 44×44
- `RatingButtons` → `min-h-11 px-3 py-2 sm:min-h-0`
- `VersionEditor` sidebar `hidden lg:flex`; `PromptDiff` `grid-cols-1 md:grid-cols-2`
- `CycleEvalView` / `CycleShareableEvalView` drop max-h on mobile (`sm:max-h-[400px]` / `sm:max-h-[300px]`)
- `RunConfigurator` summary table wrapped in `overflow-x-auto` with `min-w-[520px]`

**Cleared:** P0-4, P0-5, P1-3, P1-4, P1-10, P1-11, P1-12, P2-3, P2-4.

### Wave 3 — A11y semantics pass (PR #103)

- `aria-current="page"` on `SideNav`, `ProjectTabs`; `<nav aria-label>` wrappers
- Icon-only buttons labelled: hamburger, bell, help, project settings, `OrgSwitcher`
- `PromptEditor` + `AnnotatedEditor` — `role="textbox"`, `aria-multiline="true"`, `aria-readonly`, `aria-label` via new `ariaLabel` prop
- `StreamingOutputPanel` — `role="status" aria-busy={isStreaming}`
- Skeleton containers in `OrgLayout`, `OrgHome` — `role="status" aria-live="polite"` + sr-only text
- `CycleEvalView` / `CycleShareableEvalView` progress bars — `role="progressbar"` with `aria-valuenow/min/max`
- `VersionEditor` system-message toggle + `RunComment` general-notes toggle — `aria-expanded` + `aria-controls`
- `SendEvaluationDialog` — `htmlFor`-linked labels; per-email `aria-label`; hint `aria-describedby`
- `FeedbackSheet` — `<section aria-labelledby>` wrappers with h4 ids

**Cleared:** P1-1, P1-2, P1-5, P1-6, P1-14, P2-2, P2-5, P2-6, P2-8, P2-12 (QualityTrend focus ring landed in Wave 5).

### Wave 4 — Perf + copy pass (PR #104)

- `AnnotatedEditor` — annotation-range dispatches dedup'd via serialized key ref; parent re-renders with fresh `.map()` arrays no longer trigger ProseMirror transactions
- `OrgHome` empty state — "Create prompt" action button
- `EvalInbox` empty state — actionable "No pending evaluations" + "Back to dashboard"
- `EvalLayout` TopBar title now links to `/eval` (breadcrumb-style)
- `CycleEvalView` header — cycle name primary, project name secondary
- `CommandPalette` no-results — contextual + `Esc` hint
- `TrendInsight` — fact + actionable next step ("promote v2", "triage new comments", etc.)
- `OptimizeConfirmationDialog` — plain-English feedback-count preview

**Cleared:** P1-7, P1-8, P1-9, P2-10, P2-13, P3-5, P3-6.

### Wave 5 — Final polish (PR #105, this branch)

- `WelcomeCard` — flattened nested borders; steps now bare flex columns
- `RunView` — grid capped at `xl:grid-cols-4` (was 5)
- `QuickCompare` results table — `overflow-x-auto` + `min-w-[480px]`
- `VersionDashboard` stat percentages — `text-base font-medium text-foreground/70` (was `text-sm text-muted-foreground`)
- `QualityTrend` SVG data points — `focus-visible` stroke ring + `onFocus/onBlur` tooltip hooks for keyboard users
- `NotificationBell` count badge — `bg-primary` (was `bg-destructive`; non-error semantics)
- `AnnotatedEditor` annotation highlight — dedicated dark-mode colors for AA contrast
- `CycleShareableEvalView` (`/s/cycle/:token`) — honors `prefers-color-scheme` via `matchMedia` listener
- `src/index.css` — global `@media (prefers-reduced-motion: reduce)` override for all animations + transitions

**Cleared:** P2-9, P2-12, P3-1, P3-2, P3-3, P3-4, P1-13.

---

## Systemic Patterns — Then vs Now

| # | Pattern (pre-audit) | Status |
|---|---------------------|--------|
| 1 | Red/green semantic color in 23 files | **Resolved** — central `statusStyles` module; sky/amber/purple with icons |
| 2 | Zero `aria-current` in codebase | **Resolved** — `aria-current="page"` in `SideNav`, `ProjectTabs`, `OrgSwitcher` |
| 3 | Touch targets <44×44 across mobile | **Resolved** — all icon buttons + rating controls meet WCAG 2.5.5 |
| 4 | Icon-only buttons without labels | **Resolved** — labelled throughout; WelcomeCard pattern replicated |
| 5 | Hard-coded Tailwind status colors, no indirection | **Resolved** — `statusStyles.ts` is the single source |
| 6 | Mobile layouts not handled | **Resolved** — drawer, sheet, stacked diff, overflow-x-auto, grid caps |

---

## Deferred Findings (Product Decisions)

- **P2-7** `OptimizeConfirmationDialog` could be an inline banner instead of a modal. Kept as modal for now — the two-click guarantee before spending OpenRouter credits is worth the friction. Revisit if usage data shows cancels are rare.
- **P2-11** `VersionEditor` unsaved-changes indicator. Current behavior: `Cmd+S` hint is visible; save is debounced. Adding a per-section dirty dot would require tracking last-saved state per block. Punted pending user feedback.

---

## Verification

- `npm run build` — clean (235ms, post-wave-5)
- `rg 'aria-current' src/` — **20+** matches (was 0)
- `rg 'bg-(red|green)-|text-(red|green)-' src/` — 0 matches outside `statusStyles.ts` (was 23 files)
- Dark-mode primary visible on `/orgs/:slug`, `/runs/:id`, `/cycles/:id`
- `/eval/cycle/<token>` on 375px viewport — rating buttons ≥44×44, single-column layout, readable
- `/s/cycle/<token>` honors system dark/light preference on mount + live toggle

---

## Next Steps

1. Merge Wave 5 (this branch).
2. Close the umbrella remediation tracking (whichever artifact the team uses — none is currently open).
3. Ship an "unsaved changes" affordance in `VersionEditor` if feedback continues to surface it.
4. Revisit `OptimizeConfirmationDialog` → inline banner once real usage tells us whether the modal is friction or a feature.
