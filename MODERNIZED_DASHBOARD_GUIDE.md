# Modernized Dashboard Implementation Guide

## Overview

The dashboard has been completely redesigned and modernized with a modern, clean aesthetic that eliminates gradients, tabs, and visual clutter. The new design implements a **single-scrolling-column layout** that presents all information in a logical top-to-bottom flow following the principle: **Glance → Understand → Investigate**.

## Key Design Philosophy

### What Changed
- ✅ **No Tabs** - Everything visible on one page, no hidden content
- ✅ **No Gradients** - Clean flat surfaces using semantic colors
- ✅ **No Emoji Icons** - Professional, minimal icon usage
- ✅ **Semantic Color Coding** - Meaning conveyed through small chips and progress bars, not entire card backgrounds
- ✅ **Single Column Layout** - Responsive, scrollable vertical flow
- ✅ **Status Through Chips & Bars** - Not color-saturated backgrounds

## Section-by-Section Breakdown

### Section 1: Page Header
**Purpose:** Provide context and controls for the entire dashboard

Located at the top of the page, spanning full width:

**Left Side:**
- Page title: "Dashboard" (18px, weight 500)
- Current date with live data badge
- Live badge: Pulsing teal dot with "Live" text that pulses on load

**Right Side:**
- Time Window Segmented Control: `Today / 7d / 14d / 30d / 90d`
- Refresh Button with spinning icon during load
- Selected window persists in URL query params: `?window=14d`

**Interactions:**
- Changing time window re-fetches all KPI sections simultaneously
- Each section shows individual skeleton loading states as they load
- Refresh button shows spinning icon while any fetch is in progress
- URL is shareable - recipients open the same time window view

---

### Section 2: Six KPI Cards (3×2 Grid)

A responsive grid of flat cards showing the most critical metrics.

**Responsive Layout:**
- Desktop: 3 columns × 2 rows (6 columns)
- Tablet: 2 columns × 3 rows
- Mobile: 2 columns (stacked)

**Card Anatomy (for each):**
1. **Muted Label** (11px, uppercase, fontWeight 600)
2. **Large Number** (28px, fontWeight 500)
3. **Progress Bar** (4px height, rounded) - *only for Quality Score*
4. **Delta Line** (11px, contextual color)

#### Card 1: Quality Score
- **Value:** First-pass yield as percentage (e.g., `87.4%`)
- **Delta:** `+2.1pp vs last month` (green if positive, red if negative)
- **Progress Bar:** Green if ≥85%, amber if 70–85%, red if <70%
- **Semantic Tint:** None (informational only)

#### Card 2: Units Manufactured
- **Value:** Count for selected time window (e.g., `156`)
- **Delta:** `+12% vs previous period`
- **Progress Bar:** None
- **Semantic Tint:** None

#### Card 3: Debug Queue
- **Value:** Current count of products in `debugging` stage (e.g., `23`)
- **Delta:** None
- **Progress Bar:** None
- **Semantic Tint:** Amber background if count > 10, Red if > 25
  - This is the **only card** with semantic background tinting because it represents an active workload alarm

#### Card 4: Open Repairs
- **Value:** Count of `received` + `in_progress` repair cases (e.g., `12`)
- **Sub-line:** `5 in warranty` (smaller, muted text)
- **Delta:** None
- **Progress Bar:** None

#### Card 5: Avg Debug Resolution
- **Value:** Average hours from `debugging` entry to first `resolved` debug session
- **Format:** `3.2h` if < 24 hours, `1.4d` if ≥ 24 hours
- **Delta:** vs previous period
- **Progress Bar:** None

#### Card 6: Scrapped Units
- **Value:** Count for the time window
- **Special Case:** If zero, displays "None" in green instead of "0"
- **Delta:** None
- **Progress Bar:** None

**Loading States:**
- Each card independently shows skeleton: two gray rectangles stacked, bottom one shorter
- If fetch fails: number replaced with muted `—` and small retry link

---

### Section 3: Test Trends + Stage Distribution (Side by Side)

**Layout:** 2:1 width ratio (left chart takes 2/3, right takes 1/3)

#### Left Card: Test Results Over Time (Stacked Bar Chart)
- **Chart Type:** Chart.js stacked bar chart
- **X-Axis:** Dates formatted as `"Mar 17"`, `"Mar 18"`, etc.
- **Stacked Data:** 
  - Pass (green, `--color-background-success` tint with success border)
  - Fail (red)
  - Partial (orange/warning)
- **Bar Style:** Rounded at top (`borderRadius: 4` on topmost segment only)
- **Window Selector:** Independent 7d / 14d / 30d pill selector **above** the chart
  - Zooms into just this chart without affecting global time window
- **Tooltip:** Shows all three counts + yield percentage in bold at top
- **Summary Line:** Below chart in muted text
  - `"Average yield over this period: 87.4% · Best day: Mar 19 (96%) · Worst day: Mar 22 (71%)"`
  - Computed from chart data, no extra fetch

#### Right Card: Products by Stage (Horizontal Bars, Not Pie)
- **Layout:** Vertical list of horizontal bars, one per stage
- **Bar Row Anatomy:**
  - Stage name on left (12px)
  - Count number on right (12px, fontWeight 500)
  - Proportional filled bar between them
  - Bar height: 8px, rounded, color-coded by stage:
    - testing → blue
    - debugging → amber
    - qc → teal
    - stock → gray
    - shipped → green
    - repair → orange
    - scrapped → red
- **Footer Caption:** `"358 products total"` (muted)
- **Implementation:** Pure CSS flex bars, no chart library needed

**Why Not Pie Charts?**
Pie charts require comparing arc lengths, which humans do poorly. Horizontal bars of different lengths are immediately comparable.

---

### Section 4: Common Issues Panel (Full Width)

The most important and unique section. Provides transparent clustering of recurring failures.

#### Panel Header
- **Title:** "Recurring Issues" (left)
- **Controls** (right):
  - Project filter dropdown: `All projects` or pick one
  - Days selector: `14 / 30 / 60 / 90` (toggle buttons)
  - Muted caption: `"Analysed 156 failure records"` (updates live)

#### Issue Cluster Card (2-column grid)
**Card Header Row:**
- Issue label text (14px, fontWeight 500, max 2 lines, truncate with ellipsis)
- Trend badge (right): 
  - `↑` in red pill if increasing
  - `↓` in green pill if decreasing
  - `→` in gray pill if stable
  - (11px pill, not large icon)

**Stats Row:** Two inline stat chips (small gray pills, 11px):
- `23 occurrences`
- `18 products affected`
- Optional severity indicator:
  - Red `"High impact"` if cluster is >20% of all failures
  - Amber `"Notable"` if 10–20%
  - None if <10%

**Source Breakdown Mini-bar:** 
- 6px tall stacked horizontal bar showing proportion of sources:
  - Teal segment: Test symptoms
  - Amber segment: Debug issues
  - Purple segment: Root causes
- Below bar: Legend (11px muted) 
  - `"Test symptoms 65% · Debug issues 26% · Root causes 9%"`
- **Why This Matters:** 
  - If mostly test symptoms → caught early, testing team doing well
  - If mostly debug/root causes → slipping through testing, expensive, caught late

**Example Texts:**
- Up to 3 raw text examples from the cluster, each on own line
- Styled as left-border quote:
  - `border-left: 2px solid var(--palette-border-tertiary, #e0e0e0)`
  - `padding-left: 8px`
  - `font-size: 12px`
  - `color: var(--palette-text-secondary)`
  - `font-style: italic`
- **Why This Matters:** Shows actual words your team used, lets users verify clustering is sensible

**Footer Row:**
- Left: `"First seen Mar 14 · Last seen Mar 28"` (11px muted)
- Right: `"View affected products →"` text link (navigates to Products page pre-filtered)

**Sorting:** Cards sorted by occurrence count descending

**Empty State:** Full green success box
- `"No recurring patterns found in this window"` with green background
- Good news deserves visual reward!

**Loading State:** 4 skeleton cards with 3 gray rectangles each, pulsing at staggered intervals

---

### Section 5: Operator Performance + Project Health (Side by Side)

Two equal-width cards showing human and project-level metrics.

#### Left Card: Operator Performance
**Title:** `"Operator performance · last 30 days"`

**Sortable Table** with columns:
- Operator
- Station
- Tested
- Yield
- Tests/day

**Sorting:**
- Click column header to sort
- Active sort column shows `↑` or `↓` indicator
- Sorts client-side, no re-fetch

**Yield Column:** Colored pills
- Green if ≥90%
- Amber if 75–89%
- Red if <75%
- Uses semantic CSS variables

**Row Limit:** Max 8 visible rows
- If more: `"Show all N operators"` link below expands inline

#### Right Card: Project Health
**Title:** `"Project Health"`

**Table Columns:**
- Project name
- Products (count)
- Yield % (colored pill)
- Debug rate % (colored pill if >15%)
- Open repairs (count)
- Top issue (truncated to 36 chars, native title attribute for tooltip)

**Interactions:**
- Clicking row navigates to `/projects/:id`
- Rows have hover highlight: `background-secondary`

**Conditional Highlighting:**
- Yield <75% → red pill
- Debug rate >15% → amber pill
- Makes problems immediately scannable

---

### Section 6: Root Cause Analysis Table (Full Width)

Full-width card replacing the current "Root Causes" tab.

**Title:** `"Root Cause Breakdown · debug sessions"`

**Table Columns:**
- Root cause (truncated, native tooltip for full text)
- Frequency (count)
- Resolution rate (inline progress bar + percentage)
- Trend (`↑ ↓ →` pills)

**Resolution Rate Bar:**
- 100px wide, 4px tall, sits inside the cell
- Fills with:
  - Green if >70%
  - Amber if 50–70%
  - Red if <50%
- Percentage number sits to right of bar

**Sorting:** By frequency descending

**Top 3 Accent:** First 3 rows highlighted with:
- Left border: `3px solid var(--palette-border-warning, #ff9800)`
- Background: `#fafafa`
- Draws eye to what needs attention most

---

## Interaction Behaviors

### Time Window Selector (Global)
- **Trigger:** User selects new window in header
- **Action:** All 6 KPI cards + operator/project tables re-fetch simultaneously
- **Loading:** Each section's skeleton loads independently
- **Chart Behavior:**
  - Test trends chart and issues panel: re-fetch (time-windowed)
  - Stage distribution: Does NOT re-fetch (always shows current live state, not time-windowed)

### Common Issues Project Filter
- **Trigger:** User selects different project in dropdown
- **Action:** Only issues panel and root cause table re-fetch
- **Impact:** All other sections unaffected

### Refresh Button
- **Trigger:** User clicks Refresh
- **Action:** Re-fetches everything
- **Visual:** Button shows spinning icon while any fetch is in progress
- **Updates:** Each section updates as its data arrives (no "all at once then show" behavior)

### Number Formatting
- All counts: `toLocaleString('en-US')`
- All decimals: `toFixed(1)` for percentages and hours
- No raw floats ever shown to user

### Empty States
Each section has its own empty state:
- KPI cards: Show `—`
- Trend chart: Shows centered `"No test data in this window"` message in chart area
- Issues panel: Shows green success box `"No recurring patterns found in this window"`
- Operator table: `"No test logs in this window"`

### Error States
- Each section independently shows error inline
- Small red alert with error message and retry link, sized to the card
- Broken section does not hide or break other sections

---

## Data Loading & API Integration

### Initial Load Flow
```
1. Component mounts
2. loadKPIs() fetches:
   - Products (all)
   - Test logs (all)
   - Debug sessions (all)
   - Repairs (all)
3. Filter by time window, compute metrics
4. Update KPI state
5. loadCharts() computes stage distribution, test trends
6. loadIssues() clusters debug sessions
7. loadOperatorAndProjectData() aggregates by operator/project
8. loadRootCauses() clusters root causes
```

### What Each Endpoint Provides
See service files for detailed API contract:
- `productService.getProducts()`
- `testLogService.getTestLogs()`
- `debugSessionService.getDebugSessions()`
- `customerRepairService.getRepairs()`

---

## Responsive Behavior

### Desktop (≥1280px)
- Full 6-column KPI grid: 3 × 2
- Section 3: 8:4 ratio (test trends + stage distribution)
- Section 5: Equal-width tables
- All tables show all rows (with scroll if needed)

### Tablet (768px–1279px)
- KPI grid: 2 columns
- Section 3: Stack vertically or reduce proportions
- Section 5: Stack vertically
- Tables scroll horizontally if needed

### Mobile (<768px)
- KPI grid: 1–2 columns (depends on space)
- Section 3: Stack vertically
- Section 5: Stack vertically
- Tables scroll horizontally
- Cards may reduce padding

---

## Color Palette & Semantic Styling

### Semantic Colors (from MUI theme variables)
```
Success:     #4caf50 (green)
Warning:     #ff9800 (amber/orange)
Error:       #f44336 (red)
Info:        #2196f3 (blue)
Neutral:     #999 / #bdbdbd (gray)
Teal/Tint:   #009688
```

### Stage Distribution Colors
```
testing     → #2196f3 (blue)
debugging   → #ff9800 (amber)
qc          → #009688 (teal)
stock       → #bdbdbd (gray)
shipped     → #4caf50 (green)
repair      → #ff6f00 (deep orange)
scrapped    → #f44336 (red)
flashing    → #9c27b0 (purple)
```

### Trend Badges
```
↑ (increasing) → Red pill (#ffebee bg, #f44336 text)
↓ (decreasing) → Green pill (#e8f5e9 bg, #4caf50 text)
→ (stable)     → Gray pill (#f5f5f5 bg, #999 text)
```

---

## Performance Considerations

### What Loads Together
- On mount: All 4 data sources fetched in parallel (products, test logs, debug sessions, repairs)
- Time window change: KPIs re-fetch in parallel
- Charts computed from cached data (no extra API call)

### Caching Strategy
- Data loaded once on mount, cached in component state
- Time window changes trigger re-filter + re-compute
- Refresh button explicitly re-fetches everything

### Skeleton Loading
- Each section has independent skeleton
- Staggered pulse animation on issue skeleton cards creates sense of liveliness

---

## File Structure

```
src/pages/DashboardPage.tsx    (modernized component, ~1200 lines)
  ├── Interfaces
  │   ├── KPICardProps
  │   ├── IssueCluster
  │   ├── OperatorMetrics
  │   ├── ProjectMetrics
  │   └── RootCauseKPI
  ├── Components
  │   ├── KPICard (presentational)
  │   ├── StageBar (presentational)
  │   ├── TrendBadge (presentational)
  │   └── IssueClusterCard (presentational)
  └── DashboardModern (main component)
      ├── State management
      ├── Data fetching callbacks
      ├── 6 render sections
      └── Interaction handlers
```

---

## Future Enhancements

### Possible Improvements
1. **Real-time WebSocket updates** for Live badge instead of polling
2. **Export dashboard as PDF/PNG** for reports
3. **Custom metric selection** - let users choose which KPIs to display
4. **Comparison mode** - overlay two time windows side by side
5. **Trend analysis** - show 30-day rolling average alongside raw values
6. **Drill-down capabilities** - click any metric to see filtered product list
7. **Dark mode support** using theme context
8. **Keyboard shortcuts** - R for refresh, E for expand charts, etc.
9. **Analytics audit trail** - track which dashboard views were opened and when
10. **Anomaly detection** - highlight unusual spikes or dips in metrics

---

## Testing Checklist

- [ ] Page loads without errors on initial visit
- [ ] Time window selector updates URL and persists on reload
- [ ] Refresh button shows spinner and updates all sections
- [ ] Mobile responsive: view on phone, tablet, desktop
- [ ] Error states: simulate API failure, verify error message + retry link
- [ ] Empty states: test with no data in each section
- [ ] Sorting in tables: click headers, verify ascending/descending
- [ ] Hover states: verify highlighting and cursor changes
- [ ] Tooltips: hover on truncated text, verify tooltip appears
- [ ] Keyboard navigation: Tab through all interactive elements
- [ ] Color contrast: verify all text meets WCAG AA standards
- [ ] Loading skeleton animations: verify natural pacing

---

## Migration Notes

**Previous Dashboard:** Had gradient KPI cards, 4 tabs, pie chart, emoji icons
**New Dashboard:** Single-page, flat design, no tabs, horizontal bars, professional styling

**Breaking Changes:** None - same component export name (`DashboardPage`)

**Data Layer:** No API changes - uses same services as before

