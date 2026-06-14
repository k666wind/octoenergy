# Octopus Energy PWA — Phase 7 Handover

## Project State
- **Current version**: v6.0.0 (Phase 6 complete)
- **Stack**: React 18, TypeScript, Zustand, Vite, TailwindCSS, Recharts
- **Deploy**: GitHub Actions → GitHub Pages
- **Build command**: `npm run build` (tsc -b && vite build)
- **Zero-error policy**: `npx tsc -p tsconfig.app.json` must pass before every commit

---

## Phase 6 Completed Features

### Bug Fix: Dashboard 2063% "vs yesterday" error
- **Root cause**: `prevDay()` used `new Date("2026-06-13")` which parses as midnight UTC. In BST (UTC+1) this equals 11pm June 12, so `utcToUkDate()` returned June 11 instead of June 12 — two days off.
- **Fix**: Parse yyyy-mm-dd by splitting parts directly into `new Date(y, m-1, d)` (local midnight), then subtract 1 day. No UTC offset issue.
- File: `src/components/dashboard/Dashboard.tsx` — `prevDay()` function

### Colour Fix: Electricity vs Solar Export
- `--color-solar` changed from `#facc15` (yellow, too close to elec amber `#f59e0b`) → `#10b981` (emerald green)
- File: `src/index.css`
- All charts/cards using `var(--color-solar)` now clearly distinct from `var(--color-elec)`

### Standing Charge Annotation
- All cost displays now annotated "(incl. standing charge)" or "(excl. standing charge)"
- Dashboard UsageCards (elec/gas): incl. standing charge
- Dashboard total cost card (electricityCost row): incl. standing charge
- BudgetCard spent amount: incl. standing charge
- TrendsPage summary stats (elec/gas sub-labels): excl. standing charge
- AnalysisPage Top 5 most expensive days header: incl. standing charge
- New i18n keys: `inclStanding`, `exclStanding` in both `en` and `zh`

### Feature 1: Agile Rate Push Notification
- **Settings UI** (Agile tariff users only): toggle enable/disable + threshold p/kWh input + Save button
- **Permission flow**: `Notification.requestPermission()` called on save; shows error if denied
- **Service Worker** (`public/sw.js`): polls Agile rate API every 30 min; fires notification if rate < threshold; only alerts once per day; silent between 23:00–06:00 UK time
- **App.tsx**: `useEffect` posts `AGILE_ALERT_CONFIG` message to SW whenever agileAlert config or credentials change
- **Store**: `setAgileAlert(cfg)` action saves to config + localStorage
- New types: `AgileAlertConfig { enabled, thresholdPence }` in `types/index.ts`
- New i18n keys: `agileAlertTitle`, `agileAlertThreshold`, `agileAlertEnabled`, `agileAlertSave`, `agileAlertSaved`, `agileAlertDenied`, `agileAlertBody`

### Feature 2: PWA Offline Fallback Page
- `public/offline.html`: branded dark-themed offline page with "⚡ You're offline" message and "Go to App" link
- `public/sw.js`: precaches `/` and `/offline.html`; network-first strategy for all app assets; serves `offline.html` for navigation requests when offline
- `src/main.tsx`: registers `/sw.js` on `window load`

### Feature 3: Insights Gas Time-of-Day Chart
- `TimeOfDayChart` now accepts `fuel?: 'elec' | 'gas'` prop (defaults to `'elec'`)
- Gas variant uses cyan/teal colour scale (`BAND_COLORS_GAS`) instead of purple/green/amber/pink
- `AnalysisPage`: `gas30` memo (parallel to `elec30`) + `gasDateCache` memo; renders gas chart in Section A2 if `hasGas && gas30.length > 0`
- Component: `BAND_COLORS` computed at component level (not inside useMemo) to stay in JSX scope
- `fuel` added to useMemo dependency array for band grouping

### Feature 4: Multi-Property Support
- **Account API call** in SettingsPage: `GET /v1/accounts/{accountNumber}/` with Basic auth
- Parses `properties[]` → `PropertyInfo[]` with `address`, `electricity[]` (mpan, serialNumber, isExport), `gas[]` (mprn, serialNumber)
- **Property selector UI**: cards showing address + meter counts; "Use this property" button; active property shown with ✓ badge
- **Store action `setSelectedProperty(index)`**: picks first non-export elec meter + first gas meter + export meter from selected property; updates `credentials` in config; clears cache (forces re-fetch with new meters)
- **Store action `setProperties(props)`**: saves full property list to config/localStorage
- New types: `PropertyInfo`, `AppConfig.properties`, `AppConfig.selectedPropertyIndex`
- Settings uses `Building2` icon (lucide-react)

### Feature 5: Export to PDF
- **Insights page**: print button (Printer icon, top-right of page header) calls `window.print()`
- **Print CSS** added to `index.css` (`@media print`):
  - White background, black text
  - Hides nav, buttons, inputs
  - Removes card shadows/dark backgrounds
  - `break-inside: avoid` on cards
  - Reduces bottom padding (removes nav space)

### Version
- `SettingsPage`: `v6.0.0`

---

## Architecture Notes

### Navigation (no router)
(unchanged from Phase 5)

### Service Worker architecture
```
public/sw.js          ← manually maintained (not vite-plugin-pwa)
main.tsx              ← registers sw.js on window load
App.tsx               ← posts AGILE_ALERT_CONFIG message on config change
public/offline.html   ← served when navigation request fails offline
```
SW caching strategy: precache `/` + `/offline.html`; network-first with cache fallback for all GET requests; Octopus API calls not intercepted.

### Multi-property data flow
```
SettingsPage.handleLoadProperties()
  → fetch /v1/accounts/{accountNumber}/
  → parse PropertyInfo[]
  → setProperties(props) → config.properties → localStorage

SettingsPage.handleApplyProperty(idx)
  → setSelectedProperty(idx)
  → updates config.credentials with selected meters
  → clears cache (lastRefresh = null)
  → next fetchAll uses new meters automatically
```

### Timezone handling (CRITICAL — unchanged)
All date bucketing MUST use UK local time via `toUkDate()`. Never `.slice(0,10)`.

### File locations (additions in Phase 6)
```
public/
  sw.js                        ← NEW: service worker (offline + Agile alerts)
  offline.html                 ← NEW: branded offline fallback page
src/
  main.tsx                     ← SW registration added
  App.tsx                      ← AGILE_ALERT_CONFIG message to SW
  types/index.ts               ← AgileAlertConfig, PropertyInfo added
  store/useAppStore.ts         ← setAgileAlert, setProperties, setSelectedProperty
  lib/i18n.ts                  ← Phase 6 keys added (both en + zh)
  index.css                    ← @media print section added; --color-solar changed
  components/
    analysis/
      AnalysisPage.tsx         ← gas30 memo, gas TimeOfDayChart, PDF button
      TimeOfDayChart.tsx       ← fuel prop, BAND_COLORS_GAS, component-level BAND_COLORS
    dashboard/
      Dashboard.tsx            ← prevDay() fix, standingNote on UsageCard
      BudgetCard.tsx           ← inclStanding note on spent amount
    settings/
      SettingsPage.tsx         ← AgileAlert section, MultiProperty section, v6.0.0
    trends/
      TrendsPage.tsx           ← exclStanding on cost sub-labels
```

---

## Known Limitations / Not Yet Done

### Potential Phase 7 work
1. **AnalysisPage — auto-fetch outside 30d cache** — date range selector limited to cached data; could trigger `fetchRangeData` like TrendsPage for ranges outside cache
2. **TrendsPage — keep mounted across nav** — unmounts on tab switch; `display:none` pattern to preserve state
3. **Comparison to national average** — Ofgem average household consumption figures
4. **Agile alert — negative rate handling** — rates can go negative (grid paying you); could show "negative rate!" alert separately
5. **Multi-property — tariff auto-detect** — when switching property, could auto-detect tariff code from meter point API instead of keeping manual tariff settings

---

## Established Rules (DO NOT BREAK)

1. **Never use Tailwind colour classes** — always `style={{ color: 'var(--color-xxx)' }}`
2. **Never use `sed -i` for multi-line edits** — always Python scripts
3. **All hooks before any conditional returns**
4. **No HTML `<form>` tags** — use `onClick` handlers
5. **Every new store action in both the interface AND `create()` body**
6. **`npx tsc -p tsconfig.app.json` must return zero errors before build**
7. **Emoji in source files can cause `str_replace` to fail** — use Python for those files
8. **Check for declared-but-never-used variables** (`noUnusedLocals: true` in tsconfig)
9. **All date bucketing must use `toUkDate()` / `Europe/London`** — NEVER `.slice(0,10)` on UTC ISO strings
10. **Agile rate matching must use epoch ms** — NEVER string comparison
11. **`isCacheStale` must not appear in `useCallback` dependency arrays** — use `useAppStore.getState().isCacheStale()` inside the callback instead
12. **`prevDay()` must parse yyyy-mm-dd by splitting, not `new Date(dateStr)`** — the latter is midnight UTC, wrong in BST
