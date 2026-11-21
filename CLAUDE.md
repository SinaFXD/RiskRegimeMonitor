# Risk Regime Monitor — project context for Claude Code

FX-focused Risk-On / Risk-Off regime monitor (hedge-fund style). Output is an Excel workbook
`output/RiskRegimeMonitor.xlsx` driven entirely by formulas; Python builds it and feeds data.
The user writes in Persian; reply in Persian. Workbook labels are Persian + English terms.

## Files
- `spec.py` — single source of truth: Data columns (letter, key, FRED id, TradingView ticker),
  indicators (category, transform, direction), categories & weights, regime labels, Config cell addresses,
  fixed params LB=252 (z lookback), NW=20 (change window), CAPV=3 (winsor cap). `load_data()` builds the
  daily table from `data/fred/*.csv` (business days, start 2022-11-01).
- `build.py` — generates the full workbook (Dashboard, FX Board, History, Config, Playbook, Guide, Data, Clean)
  with formulas. Writes `output/RiskRegimeMonitor.xlsx` + `output/layout.json` (row positions).
- `fetch_fred.py` — refreshes all FRED CSVs.
- `update_excel.py` — appends only NEW dates to the Data sheet of an existing (possibly hand-formatted)
  workbook and extends Clean/History formula rows. `--xlwings` writes through Excel (keeps native charts).
- `reference2.py` — independent pandas re-implementation of the model. ALWAYS use it to verify after changes
  (RAI, categories, z-scores, regime, type scores must match the workbook).
- `cost.py` — estimates formula "weight" (was needed for a 32 MB Claude Sheets limit; less relevant in Excel).
- `charts/*.jsx` — chart code for the Claude Sheets version only (not used by Excel).
- `playbook.py` — the 11 regime TYPES (Playbook text + 5 conditions) and the FX Board universe; shared by build.py and the site.
- `export_site.py` — runs the model (reference2.py) and writes `site/data/latest.json` (KPIs, categories, indicators,
  types + daily type history, alerts, diag inputs, FX board, history, regime episodes/stats). Asserts its vectorised
  diagnosis matches `reference2.diag_latest` on the last row.
- `site/` — the web dashboard (primary product going forward; Excel was the prototype): static `index.html` +
  `assets/app.js` + `assets/style.css`, ECharts 5.5.1 from jsDelivr, Persian RTL, dark/light. Sections: overview,
  history & stats, FX Board, indicators, playbook, model lab (re-computes RAI/EMA/regime in the browser from exported
  signed z; must match the exported EMA — console.assert), guide. Bump `?v=N` on asset links after edits (cache).
  Local preview: `.claude/launch.json` "site" (python -m http.server 8765 --directory site).

## Model (do not change semantics without updating reference2.py)
- Clean = forward-filled inputs + derived (AUDJPY, EURCHF, EM FX basket MXN/BRL/ZAR/KRW, VIX/VIX3M).
- Transforms: LEVEL, RET (20d log return), DD (vs 252d max), CP10 (10d avg CP-Tbill spread, bp), CUSTOM.
- z = (x - mean252)/stdev.s252, needs 252 obs, capped ±3, × direction → signed z (positive = risk-on).
- Category = weighted mean of available signed z (weights via Config matrix rows 58-63); RAI = weighted mean
  of categories; EMA span in Config; regime from thresholds; confirmed after K consecutive days.
- Dashboard: 11 regime "types" (5 conditions each on 20d-change z of 10Y, 2Y, breakeven, real yield, WTI,
  USDJPY, USD, categories, correlations); primary type chosen within the regime family.
- Formulas use LET / FILTER / XLOOKUP / TAKE / DROP → requires Excel 365 / 2021+.

## Data notes
- FRED H.10 FX rates (DEX*, DTWEXBGS) are published weekly (Mondays). `fetch_fred.py` also runs
  `fetch_ecb.py` (ECB daily reference rates → `data/ecb/ECB_EXR.csv`); `spec.load_data()` fills only the
  days after FRED's last FX observation by chaining ECB daily changes onto FRED's last value
  (USD_BROAD via a Fed-weighted ECB basket, `USD_BROAD_W`). `update_template.py` re-writes source-fed cells
  of the last 15 rows (REVISE) so FRED's official values replace the estimates. ICE OAS only from 2023-11.
- If FRED is unreachable, data can be pasted manually into Data (one row per business day; blanks OK).

## Typical tasks
- Daily update: `python fetch_fred.py && python update_excel.py output/RiskRegimeMonitor.xlsx`
- Full rebuild (loses manual Excel formatting): `python build.py`
- Schedule: Windows Task Scheduler / cron running the daily update after US close (~01:30 Tehran).
- After any model change: rebuild, open in Excel (or recalc with LibreOffice ≥ 24.8) and compare with
  `reference2.py` output.

## The user's formatted template (PRIMARY OUTPUT)
`template/Risk_Regime_Monitor.xlsx` is the user's hand-designed Excel version (native charts, conditional
formats, named ranges RRM_*, hidden sheets ChartHelpers and "Dropdown options"; History sheet is named `History_`).
NEVER regenerate it with build.py or save it with openpyxl (openpyxl drops charts). Update it only with:

    python fetch_fred.py && python update_template.py template/Risk_Regime_Monitor.xlsx

`update_template.py` edits only the Data sheet XML (new dates appended with the template's own cell styles),
keeps every other part of the .xlsx byte-for-byte, sets fullCalcOnLoad, makes a timestamped backup, and reports
spare formula rows in Clean/History_ (pre-built to row 1184). When spare < 20: `--extend 250` (needs Excel +
xlwings: fills Clean, History_, ChartHelpers down and widens the RRM_Rows name), or drag the last formula row
down in Excel and change RRM_Rows to the new last row.
Any design/formula change requested by the user should be made in this template (via Excel or xlwings),
then re-verified against reference2.py.
