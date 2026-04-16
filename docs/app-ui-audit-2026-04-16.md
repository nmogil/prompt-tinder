# Blind Bench App — UI Audit

**Date:** 2026-04-16
**Scope:** React app under `src/` across 6 anchor surfaces. Landing (`landing/`), Convex backend, and the 13 blind-eval security rules (tracked via UX Spec §10) are out of scope.
**Method:** `/impeccable:audit` across anchors 1–6. Read-only; no code changed.

---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **2/4** | Zero `aria-current` in codebase; icon-only buttons unlabeled; Tiptap lacks `role="textbox"` |
| 2 | Performance | **3/4** | Mostly clean; AnnotatedEditor re-mounts on every annotation; no virtualization on long lists |
| 3 | Responsive design | **1/4** | `SideNav` fixed `w-56` with no mobile drawer; touch targets <44px across evaluator flow |
| 4 | Theming | **1/4** | Dark-mode `--primary` is achromatic; red/green semantic colors in **23 files** |
| 5 | Anti-patterns | **2/4** | No gradient text / hero metrics / glassmorphism (clean), but systemic CLAUDE.md violations |
| **Total** | | **9/20** | **Poor — major overhaul needed before the evaluator mobile flow ships confidently** |

**Rating:** Poor (6–9 band). Technically functional but fails its own CLAUDE.md rules at scale.

---

## Anti-Patterns Verdict

**Would someone believe "AI made this"?** **No.** The app does not read as AI slop. It uses Geist Variable (not Inter), OKLch tokens (not hex), no gradient text, no glassmorphism, no hero metric layouts, no glowing dark accents, no identical card grids. Empty states are mostly actionable; errors are mostly specific; loading uses skeletons (per CLAUDE.md). The scientific-elegance direction is coming through.

**Where the shine cracks:** the distinctiveness is undermined by self-inflicted rule violations — the same CLAUDE.md forbids red/green, but red and green appear in 23 files. The `.impeccable.md` demands tinted dark-mode primary, but `--primary` goes achromatic the moment you toggle the theme. These aren't AI tells — they're drift from the project's own spec.

---

## Executive Summary

- **Score:** 9/20 (Poor)
- **Findings:** 6 × P0, 14 × P1, 13 × P2, 6 × P3 (39 total)
- **Security surface:** clean — no `data-version-id` / `data-run-id` leaked anywhere in evaluator or share routes ✓
- **Top 5 issues:**
  1. Dark-mode `--primary` is achromatic (`oklch(0.922 0 0)`) — brand regression on every dark-mode screen
  2. Red/green semantic colors in **23 files** — CLAUDE.md forbids this explicitly for color-blind safety
  3. `SideNav` hard-coded `w-56` with no mobile drawer — app is effectively broken below 768px
  4. Touch targets <44px on `RatingButtons` and `NotificationBell` — evaluators primarily use mobile
  5. Zero `aria-current` in the entire codebase — nav state invisible to screen readers
- **Next steps:** see Recommended Actions below. Start with `/impeccable:polish` for the theming P0s and `/impeccable:adapt` for mobile; those two pass clear ~60% of the P0/P1 count.

---

## Detailed Findings by Severity

### P0 — Blocking (fix immediately)

#### [P0-1] Dark-mode primary color is achromatic — brand regression
- **File:** `src/index.css:93`
- **Category:** Theming
- **Impact:** Every dark-mode surface loses the blue-purple brand tint. `--primary: oklch(0.922 0 0)` has chroma **0** — pure white-gray. `.impeccable.md` line 26 calls this out explicitly as "needs fixing." On light mode, `--primary: oklch(0.546 0.245 262.881)` — correct.
- **Recommendation:** Change line 93 to something like `oklch(0.72 0.18 262.881)` — same hue as light, boosted lightness for dark-mode contrast, chroma preserved. Verify WCAG AA against `oklch(0.205 0 0)` background afterward.
- **Follow-up:** `/impeccable:polish`

#### [P0-2] Light-mode sidebar goes achromatic near-black
- **File:** `src/index.css:78`
- **Category:** Theming
- **Impact:** `--sidebar-primary: oklch(0.205 0 0)` in light mode is functionally black, while dark mode correctly keeps `oklch(0.488 0.243 264.376)` (tinted). Light-mode sidebar highlight state loses the brand identity. Asymmetric theming with dark mode.
- **Recommendation:** `oklch(0.488 0.243 264.376)` works cross-theme; use it in `:root` too, or pick a lighter blue-purple like `oklch(0.60 0.22 264)`.
- **Follow-up:** `/impeccable:polish`

#### [P0-3] Red/green semantic colors across 23 files — CLAUDE.md violation
- **Files (primary offenders):**
  - `src/components/RunStatusPill.tsx:17-24` (failed=red, completed=green)
  - `src/components/VersionStatusPill.tsx:6` (current=green)
  - `src/components/CycleStatusPill.tsx:4-9` (closed=green)
  - `src/components/FeedbackDigest.tsx:17` (severity high=red)
  - `src/components/FeedbackTagPicker.tsx:4` (Accuracy tag=red)
  - `src/components/RatingButtons.tsx:17,31` (best=green)
  - `src/components/PreferenceAggregate.tsx:23,29,35` (green for winner)
  - `src/components/PromptDiff.tsx:150-152` (dark-mode diff red/green)
  - `src/routes/orgs/projects/cycles/VersionDashboard.tsx:126,185,258` (green progress + counts)
  - `src/routes/orgs/settings/{OrgSettings,OrgMembers,OpenRouterKey}.tsx` (success `text-green-600`)
  - 12 more files surfaced by `rg bg-(red\|green)- src/` — 23 total
- **Category:** Theming + Accessibility
- **Impact:** ~7% of male evaluators are red/green colorblind. CLAUDE.md states: "no red/green for diffs — use blue/purple (color-blind safe)." The rule is violated in every status pill, every severity tag, the diff viewer, and every success toast.
- **WCAG:** 1.4.1 Use of Color
- **Recommendation:** Canonical replacement palette:
  - Success/best/positive → `bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300` (blue)
  - Warn/medium/watch → `bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200`
  - Fail/negative → `bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200` (or amber if semantic weight matters)
  - Neutral/draft → `bg-muted text-muted-foreground`
  - Always pair color with an icon (CheckCircle, AlertTriangle, XCircle) so meaning survives monochrome printing and colorblind viewing.
- **Follow-up:** `/impeccable:normalize` (extract a `STATUS_STYLES` token map), then `/impeccable:polish`

#### [P0-4] `SideNav` forces horizontal scroll on mobile
- **Files:** `src/components/SideNav.tsx:25`, `src/components/layouts/OrgLayout.tsx:40`
- **Category:** Responsive
- **Impact:** `w-56` = 224px, fixed. On 375px iPhone viewport that's 60% of the width with zero mobile affordance — no drawer, no collapse, no hidden-until-menu-tap. The authenticated app is unusable on phones. Evaluators authenticated into an org see a broken shell.
- **Recommendation:** `hidden md:block` on `<SideNav>`; add a mobile drawer triggered from `TopBar` with a hamburger-icon button. Preserve current desktop behavior.
- **Follow-up:** `/impeccable:adapt`

#### [P0-5] `TopBar` hides Cmd+K and shortcut triggers on mobile with no fallback
- **File:** `src/components/TopBar.tsx:31,41`
- **Category:** Responsive + discoverability
- **Impact:** `hidden sm:flex` means mobile users can't open the command palette or shortcut cheat sheet. On mobile the app has no discoverable search.
- **Recommendation:** Keep an icon-only `Search` button visible at all widths (44×44 touch target). Route the tap to the same command palette open handler. Same for `?` → drop on mobile is fine (shortcuts don't apply to touch), but the search is not negotiable.
- **Follow-up:** `/impeccable:adapt`

#### [P0-6] `BlindLabelBadge` fails WCAG AA contrast in dark mode
- **File:** `src/components/BlindLabelBadge.tsx:7`
- **Category:** Accessibility
- **Impact:** `text-slate-300` on `dark:bg-slate-800/30` ≈ 3.2:1 — below WCAG AA's 4.5:1. This is the **product's core blind-eval label** — if an evaluator can't read A/B/C on a phone in sunlight, the feature is broken.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** `text-slate-900 dark:text-slate-50` with `bg-slate-100 dark:bg-slate-800` (no alpha) — yields >10:1.
- **Follow-up:** `/impeccable:polish`

---

### P1 — Major (fix before next release)

#### [P1-1] Zero `aria-current` in codebase — nav state invisible to SR
- **Files:** `src/components/SideNav.tsx:51-87`, `src/components/ProjectTabs.tsx:39-50`, all `NavLink` usages project-wide (verified via `rg aria-current src/` = 0 matches)
- **Category:** Accessibility
- **WCAG:** 1.3.1 Info and Relationships
- **Recommendation:** On every `NavLink`, add `aria-current={isActive ? "page" : undefined}`. Wrap `SideNav` children in `<nav aria-label="Prompts">` and `ProjectTabs` in `<nav aria-label="Project sections">`.
- **Follow-up:** `/impeccable:harden`

#### [P1-2] Icon-only buttons missing `aria-label`
- **Files:** `src/components/HelpMenu.tsx:40-42`, `src/components/SideNav.tsx:30-35` (Plus/new), `src/components/NotificationBell.tsx:44-50`
- **Category:** Accessibility
- **WCAG:** 4.1.2 Name, Role, Value
- **Recommendation:** Labels as noted: `"Help and support"`, `"Create new prompt"`, `"Notifications"` (plus live-region count). `WelcomeCard`'s dismiss already has the label — replicate that pattern.
- **Follow-up:** `/impeccable:harden`

#### [P1-3] `RatingButtons` touch targets below 44×44
- **File:** `src/components/RatingButtons.tsx:59-60`
- **Category:** Responsive + a11y
- **Impact:** `px-2 py-1` + `h-3 w-3` icons ≈ 32×24px. Blind evaluators use these on phones. Mis-taps skew data.
- **WCAG:** 2.5.5 Target Size (AAA — recommended baseline for this product)
- **Recommendation:** `px-4 py-2.5 min-h-[44px]` with `h-4 w-4` icons. Verify the radio group still reads correctly.
- **Follow-up:** `/impeccable:adapt`

#### [P1-4] `NotificationBell` icon-sm is 28×28px
- **File:** `src/components/NotificationBell.tsx:44-50`
- **Category:** Responsive + a11y
- **WCAG:** 2.5.5
- **Recommendation:** Use `size="icon"` (32px) and wrap to 44×44 hit area, or `size="lg"` outright on `md:hidden`.
- **Follow-up:** `/impeccable:adapt`

#### [P1-5] Tiptap editors lack `role="textbox"` and `aria-label`
- **Files:** `src/components/tiptap/PromptEditor.tsx:24-55`, `src/components/tiptap/AnnotatedEditor.tsx`
- **Category:** Accessibility
- **WCAG:** 1.3.1, 4.1.2
- **Recommendation:** On `EditorContent` wrapper: `role="textbox" aria-multiline="true" aria-label="Prompt template"` (and `"Output annotations"` for `AnnotatedEditor`). Add `aria-describedby` to a visible or SR-only hint mentioning `Cmd+S`.
- **Follow-up:** `/impeccable:harden`

#### [P1-6] `StreamingOutputPanel` aria-live may miss token bursts
- **File:** `src/components/StreamingOutputPanel.tsx:116`
- **Category:** Accessibility
- **WCAG:** 4.1.3 Status Messages
- **Recommendation:** Add `role="status" aria-busy={isStreaming}`. Keep `aria-live="polite"`. Announce status transitions (`pending → running → completed`) via a separate `sr-only` live region with text like `"Output A finished streaming"`.
- **Follow-up:** `/impeccable:harden`

#### [P1-7] `AnnotatedEditor` re-creates Tiptap instance on every annotation/content change
- **File:** `src/components/tiptap/AnnotatedEditor.tsx:68-96, 99-115`
- **Category:** Performance
- **Impact:** Evaluators adding 5–10 annotations to large LLM outputs (code blocks, JSON responses) see visible lag as ProseMirror re-init and re-decorates ranges. This is the feedback-capture hot path.
- **Recommendation:** Memoize the editor with `useMemo`. Push annotations via `editor.view.dispatch(tr)` in a separate effect instead of depending on them in the useEditor hook. Previously fixed in `concepts/tiptap-bubblemenu-state-trap` — same class of bug.
- **Follow-up:** `/impeccable:optimize`

#### [P1-8] Empty state on `OrgHome` has no action
- **File:** `src/routes/orgs/OrgHome.tsx:34-38`
- **Category:** Anti-pattern (CLAUDE.md)
- **Recommendation:** Pass `action={{ label: "Create prompt", onClick: openNewProjectDialog }}` to `<EmptyState>`. The same pattern is done correctly in `Versions.tsx` and `TestCases.tsx` — just propagate it.
- **Follow-up:** `/impeccable:clarify`

#### [P1-9] `EvalInbox` empty copy is celebratory, not actionable
- **File:** `src/routes/eval/EvalInbox.tsx:37-41`
- **Category:** Anti-pattern (CLAUDE.md)
- **Recommendation:** Heading → `"No pending evaluations"`. Add action: link to `/eval/history` if implemented, else a link back to user's project dashboard. CLAUDE.md: "always actionable."
- **Follow-up:** `/impeccable:clarify`

#### [P1-10] `VersionEditor` sidebar collapses editor on narrow viewports
- **File:** `src/routes/orgs/projects/VersionEditor.tsx:366`
- **Category:** Responsive
- **Impact:** `w-[22%] min-w-[220px]` on sidebar + no breakpoint collapse → at 375px the editor pane is ~70px wide. Authoring becomes impossible.
- **Recommendation:** `hidden lg:flex` on sidebar; add a `Sheet` trigger on mobile to open sidebar as an overlay.
- **Follow-up:** `/impeccable:adapt`

#### [P1-11] `PromptDiff` forces two-column grid on mobile
- **File:** `src/components/PromptDiff.tsx:91`
- **Category:** Responsive
- **Recommendation:** `grid-cols-1 md:grid-cols-2`. Stacked diff is more readable on phone than 160px columns.
- **Follow-up:** `/impeccable:adapt`

#### [P1-12] `CycleEvalView` output cards hard-capped at `max-h-[400px]` on mobile
- **File:** `src/routes/eval/CycleEvalView.tsx:265`
- **Category:** Responsive
- **Impact:** On 640×800 phones, 400px fixed height after headers/rating strip leaves nothing. Evaluators scroll within the card and between cards — dual-scroll UX.
- **Recommendation:** `max-h-none sm:max-h-[400px]` (remove cap on mobile) or `max-h-[60vh]` throughout.
- **Follow-up:** `/impeccable:adapt`

#### [P1-13] Public share `/s/cycle/:token` ignores `prefers-color-scheme`
- **File:** `src/routes/share/CycleShareableEvalView.tsx:195`
- **Category:** Theming
- **Impact:** Anonymous evaluators arriving via email link see a hard-coded theme. `.impeccable.md` requires respecting user preference.
- **Recommendation:** Add a mount-time `matchMedia('(prefers-color-scheme: dark)')` check that toggles `.dark` on `<html>` for this route (or use the app's existing theme provider if one exists).
- **Follow-up:** `/impeccable:polish`

#### [P1-14] Collapsible sections missing `aria-expanded` / `aria-controls`
- **Files:** `src/routes/orgs/projects/VersionEditor.tsx:524-536` (System message, Meta Context), `src/components/tiptap/AnnotatedEditor.tsx` (comment toggle), `src/components/RunComment.tsx:87-89`
- **Category:** Accessibility
- **WCAG:** 4.1.2
- **Recommendation:** `aria-expanded={open} aria-controls="<section-id>"` on every disclosure button. Give target sections stable IDs.
- **Follow-up:** `/impeccable:harden`

---

### P2 — Minor (next pass)

- **[P2-1] Multiple `<h1>` across settings** — `OrgSettings.tsx:67`, `OrgMembers.tsx:40`, `OpenRouterKey.tsx:74`. Demote to `<h2>` since layout should own `<h1>`. `/impeccable:harden`
- **[P2-2] `Progress` bar in `CycleEvalView:197-205` lacks `aria-live`** — Add `role="status" aria-live="polite" aria-label="${n} of ${total} outputs rated"`. `/impeccable:harden`
- **[P2-3] `Summary` table in `RunConfigurator.tsx:1138-1198` not mobile-responsive** — Wrap in `overflow-x-auto`; consider card layout below `md`. `/impeccable:adapt`
- **[P2-4] `RunView.tsx:170-176` grid goes to `xl:grid-cols-5`** — cards become 380px wide at 1920px. Cap at 4 columns; allow horizontal scroll for 5+ outputs. `/impeccable:arrange`
- **[P2-5] `FeedbackSheet` feedback groups lack `role="region"` + labelledby** — `src/components/FeedbackSheet.tsx:84-98`. `/impeccable:harden`
- **[P2-6] `SendEvaluationDialog` email label not `htmlFor`-linked** — `src/components/SendEvaluationDialog.tsx:193-194`. `/impeccable:harden`
- **[P2-7] `OptimizeConfirmationDialog` + `RollbackConfirmationDialog` both modals for binary confirms** — Rollback is destructive, keep modal. Optimize is not; consider inline confirm banner. `/impeccable:distill`
- **[P2-8] Skeletons not announced** — missing `role="status" aria-label="Loading"` on skeleton containers (`OrgLayout.tsx:37-48`, `OrgHome.tsx:29-31`). `/impeccable:harden`
- **[P2-9] `NotificationBell` count badge uses `bg-destructive`** — `src/components/NotificationBell.tsx:52-54`. Non-error semantics; switch to `bg-primary`. `/impeccable:polish`
- **[P2-10] `EvalLayout` header lacks cycle/project context** — `src/components/layouts/EvalLayout.tsx:1-13`. Evaluators have no orientation between email → eval page. Add breadcrumb or cycle-name subtitle. `/impeccable:clarify`
- **[P2-11] `VersionEditor` has no unsaved-changes indicator** — `src/routes/orgs/projects/VersionEditor.tsx:147-165`. Add dot-marker or "Unsaved" pill on section headers when dirty. `/impeccable:harden`
- **[P2-12] `QualityTrend` SVG data points not keyboard-accessible** — `src/components/QualityTrend.tsx:122-134`. Circles have `role="button"` but no visible `:focus-visible` ring; mobile users get no focus affordance. `/impeccable:harden`
- **[P2-13] `CommandPalette` "No results" generic** — `src/components/CommandPalette.tsx:87`. Contextualize with suggested actions. `/impeccable:clarify`

---

### P3 — Polish

- **[P3-1] `WelcomeCard` nests bordered divs inside a `Card`** — `src/components/WelcomeCard.tsx:44-62`. Flatten to flex without inner borders. `/impeccable:distill`
- **[P3-2] Dialog animations may ignore `prefers-reduced-motion`** — `src/components/ui/dialog.tsx:32,54`. Verify Base UI respects it; if not, add media-query override. `/impeccable:harden`
- **[P3-3] `AnnotatedEditor` annotation highlight colors not contrast-checked in dark mode** — `src/components/tiptap/AnnotatedEditor.tsx:362-373`. 60% lightness blue at 15% bg + 50% border may fail AA on dark surface. `/impeccable:polish`
- **[P3-4] `VersionDashboard` stat percentages underemphasized** — `src/routes/orgs/projects/cycles/VersionDashboard.tsx:366-372`. `text-sm text-muted-foreground` buries the key insight. Promote to `text-base font-medium text-foreground`. `/impeccable:typeset`
- **[P3-5] `TrendInsight` copy is passive/flat** — `src/components/TrendInsight.tsx:24-68`. Add actionable second sentence. `/impeccable:clarify`
- **[P3-6] `OptimizeConfirmationDialog` feedback-count copy is grammatically awkward** — `src/components/OptimizeConfirmationDialog.tsx:76-83`. Rewrite in plain English. `/impeccable:clarify`

---

## Systemic Patterns

1. **Red/green semantic color** — **23 files** hit by `rg 'bg-(red|green)-|text-(red|green)-' src/`. Includes every status pill, severity tag, diff view, success toast. Single largest theming defect. **Fix via** centralized `STATUS_STYLES` token map → replace red/green with sky/amber/purple + icons.
2. **Zero `aria-current`** — `rg aria-current src/` returns 0 matches. Every `NavLink` in `SideNav`, `ProjectTabs`, and elsewhere is silent to screen readers about which page is active.
3. **Touch targets <44×44** — `RatingButtons` (32×24), `NotificationBell` (28×28), `ProjectTabs` settings icon, `HelpMenu` icon. Mobile-first evaluator UX at risk.
4. **Icon-only buttons without labels** — `HelpMenu`, `SideNav` Plus, `NotificationBell`. Inconsistent with the good `WelcomeCard` dismiss pattern already in the code.
5. **Hard-coded Tailwind color classes, no token indirection** — `RatingButtons`, `CycleStatusPill`, `VersionStatusPill`, `FeedbackTagPicker`, `FeedbackDigest`, `PreferenceAggregate`, `VersionDashboard`. No central `STATUS_STYLES` constant — updates require touching each file.
6. **Mobile layouts not handled** — `SideNav` fixed width, `TopBar` hidden search, `VersionEditor` sidebar collapse, `PromptDiff` two-column, `CycleEvalView` max-h, `RunConfigurator` summary table, `RunView` 5-column grid. Mobile is not a first-class target anywhere.

---

## Positive Findings

- **Security surface is clean** — `rg 'data-(version|run)-id' src/` returns **zero** matches. The 13 blind-eval rules from UX Spec §10 are holding up on the DOM side. Token-based routing on `/eval/cycle/:token` and `/s/cycle/:token` is correctly enforced.
- **Skeletons, not spinners** — Loading states across `OrgLayout`, `OrgHome`, `Versions`, `RunConfigurator`, `RunView`, `EvalInbox`, `CycleEvalView`, `CycleShareableEvalView` use shimmer skeletons. CLAUDE.md adherence is strong here.
- **Form labels solid** — `Onboarding.tsx:52-59`, `OrgMembers.tsx:98-107`, `OrgSettings.tsx:74-87`. Labels are `htmlFor`-bound, inputs sized adequately (`h-8` = 32px).
- **Errors name the resource** — `friendlyError()` is used consistently. No "Something went wrong" sightings.
- **Dialog focus management** — Base UI `Dialog` handles focus trap + Escape correctly in all dialog-using components.
- **No AI slop** — Geist Variable (not Inter), no gradient text on metrics, no glassmorphism, no hero metric layouts, no glowing dark accents, no identical card grids, no pure `#000`/`#fff`. The scientific-elegance direction shows.
- **`EmptyState` component** — well-designed primitive. The gap is propagation: it's present on `OrgHome` but without an `action` prop, and `EvalInbox` doesn't use it for its empty state.
- **Keyboard shortcuts visible where they exist** — `Cmd+S` in `VersionEditor.tsx:311`, `Cmd+Enter` in `RunConfigurator.tsx:1219-1236` render as `<kbd>` elements.
- **`SendEvaluationDialog` email input UX** — handles paste, comma/Enter, backspace removal. Polished beyond spec.

---

## Recommended Actions

Run in priority order. Each command addresses a cluster — don't run them all at once.

1. **[P0] `/impeccable:polish`** — Fix theming P0s (dark `--primary`, light sidebar, `BlindLabelBadge` contrast, public share `prefers-color-scheme`, notification badge color, annotation highlight contrast).
2. **[P0] `/impeccable:normalize`** — Extract a central `STATUS_STYLES` / `SEVERITY_STYLES` token map; migrate all 23 red/green files to sky/amber/purple with icons.
3. **[P0] `/impeccable:adapt`** — Mobile pass: `SideNav` drawer, `TopBar` mobile search, `VersionEditor` sidebar sheet, `PromptDiff` stacked grid, `CycleEvalView` max-h, `RunConfigurator` table, `RatingButtons` / `NotificationBell` touch targets.
4. **[P1] `/impeccable:harden`** — A11y pass: `aria-current` on every `NavLink`, `aria-label` on icon buttons, `role="textbox"` on Tiptap, `aria-expanded` on collapsibles, `role="region"` on `FeedbackSheet` groups, announce skeletons, fix heading hierarchy.
5. **[P1] `/impeccable:optimize`** — Memoize `AnnotatedEditor` so Tiptap doesn't re-mount per annotation.
6. **[P1] `/impeccable:clarify`** — Empty state + copy pass: `OrgHome` action, `EvalInbox` action, `EvalLayout` breadcrumb, `CommandPalette` no-results, `TrendInsight` next-step, `OptimizeConfirmationDialog` feedback-count copy.
7. **[P2] `/impeccable:distill`** — Flatten `WelcomeCard` nested borders, replace `OptimizeConfirmationDialog` modal with inline confirm.
8. **[P2] `/impeccable:arrange`** — Cap `RunView` columns, add `overflow-x-auto` on summary tables.
9. **[P3] `/impeccable:typeset`** — `VersionDashboard` stat percentage hierarchy.
10. **[Final] `/impeccable:polish`** — One more pass after the above lands to catch micro-regressions.

---

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable:audit` after fixes to see your score improve.
