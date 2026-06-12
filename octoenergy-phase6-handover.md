# Octopus Energy PWA — Phase 6 Handover

## Project State
- **Current version**: v5.0.0 (Phase 5 complete)
- **Stack**: React 18, TypeScript, Zustand, Vite, TailwindCSS, Recharts
- **Deploy**: GitHub Actions → GitHub Pages
- **Build command**: `npm run build` (tsc -b && vite build)
- **Zero-error policy**: `npx tsc --noEmit` must pass before every commit

---

## Phase 5 Completed Features

### Dashboard — Smart Fallback
- `bestAvailableDay()` helper: if today has < 4 half-hour slots (API delay or early morning), automatically falls back to the most recent date with ≥ 4 slots
- Amber banner shown: "Data delayed — showing most recent available — Data as of YYYY-MM-DD"
- "Total today" card label changes to "Data as of {date}" when fallback active
- Heatmap header shows fallback date in brackets

### Dashboard — Yesterday Comparison Fix
- `prevDay()` helper replaces old `elecDisplayDay === yesterday` logic
- "vs yesterday" label changes to "vs prev day" when fallback is active (via `isFallback` prop on `UsageCard`)
- Handles multi-day fallback correctly (e.g. 2-day API delay)

### BudgetCard — Projection Reliability Guard
- `daysElapsed` prop added; projection suppressed (shows `—`) when < 3 days elapsed in month
- Prevents misleading month-end projections based on 1–2 days of data

### TariffComparison — Agile Users
- Agile users now see a "Fixed Rate" comparison scenario
- Info card explains the fixed rate used is from Settings configuration
- Non-Agile users still see Agile scenario as before

### UsageHeatmap → Trends Drill-Down
- Clicking a heatmap cell navigates to Trends > Day view for that specific date
- State lifted through `App.tsx` (`drillDate`, `navigateToTrendsDay`)
- "Tap a cell to view day details →" hint shown when `onDaySelect` is wired
- Drill-down skips `fetchAll` — reuses existing cache for instant navigation

### Timezone Audit
- `UsageHeatmap`: fixed date bucketing to use `toUkDate()` (was `.slice(0,10)` UTC)
- `AnalysisPage`: fixed cutoff filter to use `toUkDate()` (was `.slice(0,10)` UTC)
- `Last24hChart` + `HeatmapChart` (Dashboard): confirmed correct, no change needed

### Performance — Insights Page
- `UsageHeatmap`: pre-builds `Map<isoStr, ukDate>` date cache once per intervals change; all cell/group calculations wrapped in `useMemo`
- `AnalysisPage`: `elecDateCache`, `elec30`, `top5` all memoised
- `TimeOfDayChart`: pre-computes `intervalsWithHour` once; band grouping memoised
- Result: mode switching (elec/gas/solar) is now instant; subsequent visits to Insights are fast

### fetchAll Stability Fix
- `useDataFetch`: `isCacheStale` removed from `useCallback` dependency array; replaced with `useAppStore.getState()` call inside callback to avoid unstable reference causing spurious refetches on every store update
- `TrendsPage`: drill-down entry (`initialDate` set) skips `fetchAll` entirely

### Error Retry — Exponential Backoff
- `withRetry()` helper added to `useDataFetch`: max 3 attempts, delays 1s → 2s → 4s
- All four fetch calls (elec, gas, outgoing, agile rates) wrapped with `withRetry`
- Dashboard error banner now shows "Try again" button for manual retry after all attempts exhausted

### AnalysisPage — Date Range Selector
- From / To date pickers added above Insights sections
- "Apply" button triggers re-filter of `elec30` to selected range
- Default: last 30 days (same as before); user can select any range within cache

### CSV Export — Active Range
- `handleExportCsv` in `TrendsPage` now filters to the currently displayed range
- Day view: exports `customFrom` → `customTo`
- Month view: exports selected month only
- Year view: exports selected year only
- Filename reflects the range (e.g. `octoenergy-2026-06-01_2026-06-13.csv`)

### Agile Rate Trend Chart (TariffPage)
- New `AgileRateTrendChart` component: Area chart showing last 7 days of Agile rates
- Three lines: Avg (purple), Peak (red), Off-peak 00:00–07:00 (green, dashed)
- `useMemo` for day grouping; only renders if ≥ 2 days of data available
- Inserted above the half-hourly rate list on Tariff page

### Version
- `SettingsPage`: `v5.0.0`

---

## Architecture Notes

### Navigation (no router)
App.tsx uses `useState<Page>` for navigation. All page switches unmount the old page and mount the new one. State that needs to survive navigation must live in Zustand or be passed as props from App.tsx.

**Drill-down pattern** (established in Phase 5):
```
App.tsx: drillDate state + navigateToTrendsDay()
  → AnalysisPage: receives onDayDrillDown prop → passes to UsageHeatmap as onDaySelect
  → TrendsPage: receives initialDate prop → skips fetchAll, sets Day view + date range
```

### Timezone handling (CRITICAL)
All date bucketing MUST use UK local time. Never use `.slice(0,10)` on UTC ISO strings.

```ts
// WRONG
interval.interval_start.slice(0, 10)

// RIGHT
new Date(isoStr).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).split('/').reverse().join('-') // → yyyy-mm-dd
```

`toUkDate()` is defined locally in: `costCalculator.ts`, `Dashboard.tsx`, `UsageHeatmap.tsx`, `AnalysisPage.tsx`, `AgileRateTrendChart.tsx`. If adding date bucketing elsewhere, always use this pattern.

### Data flow
```
fetchAll() → octopusClient → Zustand cache (30d halfhour intervals)
fetchRangeData(from, to) → local React state (rangeElec/rangeGas in TrendsPage)
```
Range data is NOT stored in Zustand — intentional to avoid cache bloat.

### Performance pattern (established Phase 5)
For any component receiving large intervals arrays:
1. Build `Map<isoStr, ukDate>` once with `useMemo([intervals])`
2. Group by date using that map (O(1) lookup, not O(n) `toUkDate` per cell)
3. Wrap all derived computations in `useMemo` with correct dependencies

### File locations
```
src/
  components/
    analysis/
      AnalysisPage.tsx       ← date range selector, elecDateCache, memoised elec30/top5
      TimeOfDayChart.tsx     ← memoised intervalsWithHour + band grouping
      UsageHeatmap.tsx       ← date cache + useMemo cells, onDaySelect drill-down
      TariffComparison.tsx   ← Agile users now see Fixed scenario
    dashboard/
      Dashboard.tsx          ← bestAvailableDay(), prevDay(), fallback banner, retry button
      BudgetCard.tsx         ← daysElapsed prop, projection reliability guard
    tariff/
      TariffPage.tsx         ← AgileRateTrendChart inserted
      AgileRateTrendChart.tsx ← NEW: 7-day avg/peak/off-peak area chart
    trends/
      TrendsPage.tsx         ← CSV export uses active range, initialDate drill-down
    shared/
      SkeletonCard.tsx
  hooks/
    useDataFetch.ts          ← withRetry(), isCacheStale via getState(), drill-down skip
  lib/
    costCalculator.ts        ← toUkDate(), agileCost() (epoch ms)
    csvExport.ts             ← exportTrendsCsv() (range-aware from Phase 5)
    octopusClient.ts
  store/
    useAppStore.ts
```

---

## Known Limitations / Not Yet Done

### High priority for Phase 6
1. **Agile rate push notification** — alert user when rate drops below a threshold they set; requires service worker + Notification API + a user-configurable threshold in Settings
2. **PWA offline fallback page** — service worker exists but offline page is generic browser default
3. **Multi-property support** — Octopus account API returns multiple properties; currently only first property is used

### Medium priority
4. **Insights gas time-of-day chart** — `TimeOfDayChart` currently electricity only; gas variant would use same component with gas intervals
5. **Export to PDF** — Insights page snapshot; would use `window.print()` + print CSS or a library like `jspdf`
6. **Comparison to national average** — Ofgem publishes average household consumption figures; show user vs national average in Insights

### Low priority / Nice to have
7. **AnalysisPage — auto-fetch outside 30d cache** — date range selector currently limited to cached data; could trigger `fetchRangeData` like TrendsPage does for ranges outside cache
8. **TrendsPage — keep mounted across nav** — currently unmounts on tab switch; could use CSS `display:none` to preserve state without re-mounting

---

## Established Rules (DO NOT BREAK)

1. **Never use Tailwind colour classes** — always `style={{ color: 'var(--color-xxx)' }}`
2. **Never use `sed -i` for multi-line edits** — always Python scripts
3. **All hooks before any conditional returns**
4. **No HTML `<form>` tags** — use `onClick` handlers
5. **Every new store action in both the interface AND `create()` body**
6. **`npx tsc --noEmit` must return zero errors before build**
7. **Emoji in source files can cause `str_replace` to fail** — use Python for those files
8. **Check for declared-but-never-used variables** (`noUnusedLocals: true` in tsconfig)
9. **All date bucketing must use `toUkDate()` / `Europe/London`** — NEVER `.slice(0,10)` on UTC ISO strings
10. **Agile rate matching must use epoch ms** — NEVER string comparison
11. **`isCacheStale` must not appear in `useCallback` dependency arrays** — use `useAppStore.getState().isCacheStale()` inside the callback instead

---

## Recommended Phase 6 Start Order

1. Agile rate push notification — service worker + Settings threshold input
2. PWA offline fallback page — custom offline.html wired into vite-plugin-pwa
3. Insights gas time-of-day chart — low effort, same pattern as electricity
4. Multi-property support — requires account API parsing + property selector UI in Settings
5. Export to PDF — Insights page only, `window.print()` approach first
