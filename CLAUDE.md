# Risk Regime Monitor — project context for Claude Code

FX-focused Risk-On / Risk-Off regime monitor (hedge-fund style). The product is the web dashboard in `site/`
(GitHub Pages, auto-updated). The Excel prototype was retired on 2026-11-21 and its code removed from the repo
(build.py, update_excel.py, update_template.py, cost.py, charts/); all work now goes into the website.
The user writes in Persian; reply in Persian.

**Wording rule (from the user):** Persian sentences, but keep financial terms and titles in English — regime
labels (Strong Risk-Off), category names (Credit), type names (Credit Stress), and jargon such as Carry, Safe haven,
Tail risk, High-beta, Spread, Defaults, Leveraged sectors, Private credit. Never write Persian calques like
«ریسک دنباله»، «پربتا»، «پناهگاه»، «نکول». Write currency lists with English commas: (AUD, NZD, ZAR).

## Deployment
- Repo: https://github.com/SinaFXD/RiskRegimeMonitor (public) · Site: https://sinafxd.github.io/RiskRegimeMonitor/
- `.github/workflows/update.yml`: weekdays 22:30 and 14:00 UTC (+ on push / manual) → fetch_fred.py (+ECB) →
  export_site.py → commits `site/data/latest.json` → deploys `site/` to Pages. Raw `/data/` is NOT committed
  (ICE BofA / S&P / CBOE redistribution terms); the workflow keeps it in actions/cache. ICE spreads are shown as z only
  (never publish ICE OAS levels — e.g. the HY guardrail alert shows only above/below).
- `/template/`, `/output/`, `*.xlsx` stay git-ignored (any local copies of the old Excel files).

## Files
- `spec.py` — single source of truth: data series (key, FRED id, TradingView ticker), indicators (category,
  transform, direction), categories & weights, regime labels, fixed params LB=252 (z lookback), NW=20 (change
  window), CAPV=3 (z cap), GUARD (absolute-level guardrail). `load_data()` builds the daily table from
  `data/fred/*.csv` (business days, start 2022-11-01).
- `reference2.py` — the model in pandas (transforms, z, categories, RAI, EMA, regime, diagnosis inputs, type scores).
- `playbook.py` — the 11 regime TYPES (Playbook text + 5 conditions) and the FX Board universe.
- `export_site.py` — runs the model and writes `site/data/latest.json` (KPIs incl. guardrail, categories,
  indicators, types + daily type history, alerts, diag inputs, FX board, history, regime episodes/stats). Asserts its
  vectorised diagnosis matches `reference2.diag_latest` on the last row.
- `fetch_fred.py` (+ `fetch_ecb.py`) — refresh all source CSVs.
- `site/` — static `index.html` + `assets/app.js` + `assets/style.css`, ECharts 5.5.1 from jsDelivr, Persian/English,
  RTL, dark/light. Sections: overview, history & stats, FX Board, indicators, playbook, model lab (re-computes
  RAI/EMA/regime in the browser from exported signed z; must match the exported EMA — console.assert), guide.
  Bump `?v=N` on asset links after edits (cache). Local preview: `.claude/launch.json` "site"
  (python -m http.server 8765 --directory site).

## Model (do not change semantics without updating reference2.py, export_site.py and the Model Lab in app.js)
- Inputs = forward-filled series + derived (AUDJPY, EURCHF, EM FX basket MXN/BRL/ZAR/KRW, VIX/VIX3M, UST_RV).
- Transforms: LEVEL, RET (20d log return), DD (vs 252d max), CP10 (10d avg of the CP-Tbill spread, bp; spread taken only
  on days both rates exist, since DCPF3M is missing on ~half the days; then forward-filled — z needs a full 252-obs
  window, so one unfilled gap used to blank CP z for a year).
- Missing inputs: a regime type with a NaN input has no score that day (type history keeps the other types); alerts
  treat None/NaN as "not firing". Regime stats hit rates drop the last NW days (future return not known yet).
- FX Board "regime fit" uses the return since the regime began (fit_n = days in regime, clamped 5..21), not 1M.
- z = (x - mean252)/stdev.s252, needs 252 obs, capped ±3, × direction → signed z (positive = risk-on).
- Category = mean of available signed z; RAI = weighted mean of categories; EMA span 5; regime from thresholds
  (0.60 / 0.25 / −0.25 / −0.75); directional confirmation (2026-11-21): KDN=2 consecutive raw days below the confirmed
  regime move it down to the mildest of them, KUP=3 days above move it up (Model Lab mirrors this and asserts the
  confirmed regime matches after the EMA warm-up).
- 11 regime "types" (5 conditions each on 20d-change z of 10Y, 2Y, breakeven, real yield, WTI, USDJPY, USD,
  categories, correlations); primary type chosen within the regime family. SBC = 60d corr(SPX return, −Δ10Y yield), i.e.
  the market (bond price) convention: positive = Treasuries not hedging equities.
- Guardrail: VIX ≥ 30 or HY OAS ≥ 5% → alerts + overview banner (red when the regime is Neutral or better).
  Alert only; does not change the regime. Reason: z is relative to 252 days, so a long crisis drifts toward 0.
- Volatility includes `USTRV` (2026-11-21), a MOVE proxy: 20-day realized vol of daily DGS10 changes, annualised bp
  (MOVE itself is ICE data with no free source). It shifts the regime on ~12% of historical days vs. without it and has
  ~0.2 correlation with VIX z. Custom 1 was removed the same day (14 indicators).

## Data notes
- FRED H.10 FX rates (DEX*, DTWEXBGS) are published weekly (Mondays). `fetch_fred.py` also runs
  `fetch_ecb.py` (ECB daily reference rates → `data/ecb/ECB_EXR.csv`); `spec.load_data()` fills only the
  days after FRED's last FX observation by chaining ECB daily changes onto FRED's last value
  (USD_BROAD via a Fed-weighted ECB basket, `USD_BROAD_W`). FRED replaces the estimates on its next release.
- FRED serves only the last 3 years of ICE BofA OAS (local history starts 2023-11), so windows longer than
  ~3 years are not possible for Credit.

## Typical tasks
- Local refresh: `python fetch_fred.py && python export_site.py`, then preview the site.
- After any model change: run `export_site.py` (it asserts consistency), check the Model Lab console.assert in the
  browser, and bump `?v=N`.
