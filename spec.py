"""Single source of truth: data series, indicators, categories, regimes and model parameters."""
import os
FRED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'fred')
ECB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'ecb')
ECB_FILE = os.path.join(ECB_DIR, 'ECB_EXR.csv')
import pandas as pd, numpy as np

START = '2022-11-01'

# ---- Data series: (key, header, FRED id, TradingView, unit/notes) ----
DATA_COLS = [
 ('DATE','Date',None,None,'تاریخ'),
 ('VIX','VIX','VIXCLS','CBOE:VIX','S&P 500 30-day implied volatility'),
 ('VIX3M','VIX3M','VXVCLS','CBOE:VIX3M','S&P 500 3-month implied volatility'),
 ('VXEEM','VXEEM','VXEEMCLS','CBOE:VXEEM','EM equity implied volatility'),
 ('HY_OAS','HY OAS %','BAMLH0A0HYM2','FRED:BAMLH0A0HYM2','ICE BofA US High Yield OAS'),
 ('IG_OAS','IG OAS %','BAMLC0A0CM','FRED:BAMLC0A0CM','ICE BofA US Investment Grade OAS'),
 ('EM_OAS','EM Corp OAS %','BAMLEMCBPIOAS','FRED:BAMLEMCBPIOAS','ICE BofA EM Corporate OAS'),
 ('CP3M','CP 3M AA Fin %','DCPF3M','FRED:DCPF3M','3-month AA financial commercial paper rate (sparse)'),
 ('TBILL3M','T-Bill 3M %','DTB3','FRED:DTB3','3-month T-bill rate'),
 ('USD_BROAD','USD Broad','DTWEXBGS','FRED:DTWEXBGS','Fed nominal broad dollar index'),
 ('SPX','S&P 500','SP500','SP:SPX','S&P 500 index'),
 ('UST10Y','UST 10Y %','DGS10','TVC:US10Y','10-year Treasury yield'),
 ('UST2Y','UST 2Y %','DGS2','TVC:US02Y','2-year Treasury yield'),
 ('BE10Y','Breakeven 10Y %','T10YIE','FRED:T10YIE','10-year breakeven inflation'),
 ('REAL10Y','Real 10Y %','DFII10','FRED:DFII10','10-year real yield (TIPS)'),
 ('WTI','WTI','DCOILWTICO','NYMEX:CL1!','WTI crude oil'),
 ('AUDUSD','AUDUSD','DEXUSAL','FX:AUDUSD',''),
 ('NZDUSD','NZDUSD','DEXUSNZ','FX:NZDUSD',''),
 ('USDCAD','USDCAD','DEXCAUS','FX:USDCAD',''),
 ('EURUSD','EURUSD','DEXUSEU','FX:EURUSD',''),
 ('GBPUSD','GBPUSD','DEXUSUK','FX:GBPUSD',''),
 ('USDJPY','USDJPY','DEXJPUS','FX:USDJPY',''),
 ('USDCHF','USDCHF','DEXSZUS','FX:USDCHF',''),
 ('USDNOK','USDNOK','DEXNOUS','FX:USDNOK',''),
 ('USDSEK','USDSEK','DEXSDUS','FX:USDSEK',''),
 ('USDMXN','USDMXN','DEXMXUS','FX:USDMXN',''),
 ('USDBRL','USDBRL','DEXBZUS','FX_IDC:USDBRL',''),
 ('USDZAR','USDZAR','DEXSFUS','FX:USDZAR',''),
 ('USDKRW','USDKRW','DEXKOUS','FX_IDC:USDKRW',''),
 ('USDINR','USDINR','DEXINUS','FX_IDC:USDINR',''),
 ('USDCNY','USDCNY','DEXCHUS','FX_IDC:USDCNY',''),
 ('STLFSI','StL Fed FSI (w)','STLFSI4','FRED:STLFSI4','St. Louis Fed Financial Stress Index (weekly)'),
 ('NFCI','Chicago NFCI (w)','NFCI','FRED:NFCI','Chicago Fed National Financial Conditions Index (weekly)'),
]

# ---- ECB gap-fill for FRED's weekly H.10 FX (see fetch_ecb.py) ----
# key -> (ECB currency, True if quoted as USD per unit like FRED's DEXUS**)
ECB_PAIRS = {'AUDUSD': ('AUD', True), 'NZDUSD': ('NZD', True), 'USDCAD': ('CAD', False),
             'EURUSD': ('EUR', True), 'GBPUSD': ('GBP', True), 'USDJPY': ('JPY', False),
             'USDCHF': ('CHF', False), 'USDNOK': ('NOK', False), 'USDSEK': ('SEK', False),
             'USDMXN': ('MXN', False), 'USDBRL': ('BRL', False), 'USDZAR': ('ZAR', False),
             'USDKRW': ('KRW', False), 'USDINR': ('INR', False), 'USDCNY': ('CNY', False)}
# USD Broad proxy: geometric basket of foreign-per-USD rates, Fed broad-index weights (approx.)
USD_BROAD_W = {'EUR': 18.5, 'MXN': 13.6, 'CAD': 13.3, 'CNY': 13.1, 'JPY': 6.1, 'GBP': 5.3, 'KRW': 3.9,
               'INR': 3.0, 'CHF': 2.6, 'SGD': 1.9, 'BRL': 1.7, 'MYR': 1.5, 'THB': 1.4, 'AUD': 1.3,
               'HKD': 1.1, 'ILS': 1.0, 'PHP': 0.8, 'IDR': 0.6, 'SEK': 0.5}
ECB_CCYS = sorted({c for c, _ in ECB_PAIRS.values() if c != 'EUR'} | {'USD'} | set(USD_BROAD_W) - {'EUR'})

# ---- Indicators (composite) ----
# id, name, name_fa, category, input, transform, direction, weight, freshness data key
#   input: key of the forward-filled / derived input series built in reference2.reference()
INDICATORS = [
 ('VIX','VIX','S&P 500 implied volatility','VOL','VIX','LEVEL',-1,1,'VIX'),
 ('VIXTS','VIX / VIX3M','VIX term structure (> 1 = inverted)','VOL','VIX_RATIO','LEVEL',-1,1,'VIX3M'),
 ('VXEEM','VXEEM','EM equity implied volatility','VOL','VXEEM','LEVEL',-1,1,'VXEEM'),
 ('USTRV','UST 10Y Realized Vol','10Y yield realized volatility, 20-day, bp/yr (MOVE proxy)','VOL','UST_RV','LEVEL',-1,1,'UST10Y'),
 ('HY','US HY OAS','US High Yield spread','CREDIT','HY_OAS','LEVEL',-1,1,'HY_OAS'),
 ('IG','US IG OAS','US Investment Grade spread','CREDIT','IG_OAS','LEVEL',-1,1,'IG_OAS'),
 ('EMC','EM Corp OAS','EM corporate spread','CREDIT','EM_OAS','LEVEL',-1,1,'EM_OAS'),
 ('AUDJPY','AUDJPY','20-day return','FX','AUDJPY','RET',1,1,'AUDUSD'),
 ('EMFX','EM FX Basket','MXN, BRL, ZAR, KRW basket','FX','EMFX','RET',1,1,'USDMXN'),
 ('EURCHF','EURCHF','20-day return','FX','EURCHF','RET',1,1,'EURUSD'),
 ('SPXM','S&P 500 Momentum','20-day return','EQ','SPX','RET',1,1,'SPX'),
 ('SPXDD','S&P 500 Drawdown','Distance from 52-week high','EQ','SPX','DD',1,1,'SPX'),
 ('USD','USD Broad','Fed broad dollar index, 20-day return','FUND','USD_BROAD','RET',-1,1,'USD_BROAD'),
 ('CP','CP–Bill Spread','Commercial paper – T-bill spread (10-day avg)','FUND','CP','CP10',-1,1,'CP3M'),
]
CATS = [  # code, fa, en, weight
 ('VOL','نوسان','Volatility',0.20),
 ('CREDIT','اعتبار','Credit',0.20),
 ('FX','ارز','FX',0.25),
 ('EQ','سهام و رشد','Equities & Growth',0.20),
 ('FUND','تأمین مالی و دلار','Funding & USD',0.15),
]
REGIMES = [  # label, fa, budget, posture
 ('Strong Risk-On','ریسک‌آن قوی',1.00,'اشتهای ریسک گسترده؛ Carry و High-beta FX در اولویت؛ Hedging ارزان است'),
 ('Risk-On','ریسک‌آن',0.75,'سوگیری به ریسک با انتخاب‌گری؛ Carry با Sizing معمول'),
 ('Neutral','خنثی / گذار',0.50,'سیگنال‌ها متناقض‌اند؛ Relative value و Sizing کوچک‌تر'),
 ('Risk-Off','ریسک‌آف',0.35,'کاهش Carry و Leverage؛ سوگیری به Safe haven متناسب با Regime type'),
 ('Strong Risk-Off','ریسک‌آف قوی',0.20,'Capital preservation؛ کاهش Gross؛ Liquidity و Hedging؛ منتظر تأیید Reversal'),
]
REGIMES_POST_EN = {  # English posture text for the web dashboard
 'Strong Risk-On': 'Broad risk appetite; Carry and High-beta FX first; hedging is cheap',
 'Risk-On': 'Lean into risk selectively; Carry with normal sizing',
 'Neutral': 'Signals conflict; relative value and smaller sizing',
 'Risk-Off': 'Cut Carry and leverage; tilt to Safe havens according to the regime type',
 'Strong Risk-Off': 'Capital preservation; cut gross; liquidity and hedging; wait for a confirmed reversal',
}

LB, NW, CAPV = 252, 20, 3      # fixed structural parameters (z lookback, change window, winsor cap)
# Absolute-level guardrail: z-scores are relative to the last LB days, so a long crisis slowly looks "normal".
# These levels flag stress regardless of z (VIX in points, HY OAS in %). Alert only; the regime logic is unchanged.
GUARD = dict(VIX=30.0, HY=5.0)

def ld(fid):
    d = pd.read_csv(os.path.join(FRED_DIR, f'{fid}.csv' if fid != 'DCPF3M' else 'x_DCPF3M.csv'),
                    na_values=['.', ''])
    d.columns = ['date', fid]
    d['date'] = pd.to_datetime(d['date'])
    return d.set_index('date')[fid]


def load_data():
    s = {}
    for k, h, fid, tv, note in DATA_COLS:
        if fid and k not in ('STLFSI', 'NFCI'):
            s[k] = ld(fid)
    df = pd.concat(s, axis=1, sort=True)
    df = df[(df.index >= START) & (df.index.dayofweek < 5)]
    core = ['VIX', 'SPX', 'HY_OAS', 'UST10Y', 'USD_BROAD', 'AUDUSD']
    df = df[df[core].notna().any(axis=1)].copy()
    # weekly series: put each observation on the last data row on/before its date
    for k, fid in (('STLFSI', 'STLFSI4'), ('NFCI', 'NFCI')):
        w = ld(fid).dropna()
        df[k] = np.nan
        for d, v in w.items():
            pos = df.index.searchsorted(d, side='right') - 1
            if pos >= 0 and d >= df.index[0]:
                df.iloc[pos, df.columns.get_loc(k)] = v
    for k, *_ in DATA_COLS[1:]:
        if k not in df.columns:
            df[k] = np.nan
    df = df[[k for k, *_ in DATA_COLS[1:]]].copy()
    df.attrs['ecb_fill'] = ecb_fill(df)
    return df


def ecb_series():
    """ECB reference rates converted to the FRED quoting of each Data column (+ USD_BROAD proxy)."""
    if not os.path.exists(ECB_FILE):
        return {}
    e = pd.read_csv(ECB_FILE, index_col=0, parse_dates=True)
    xusd = {c: (e[c] / e['USD'] if c != 'EUR' else 1 / e['USD']) for c in set(USD_BROAD_W) | {'EUR'}
            if c == 'EUR' or c in e.columns}       # foreign currency per USD
    out = {k: (e['USD'] / e[c] if usd_per else e[c] / e['USD']) if c != 'EUR' else e['USD']
           for k, (c, usd_per) in ECB_PAIRS.items() if c in e.columns or c == 'EUR'}
    w = {c: v for c, v in USD_BROAD_W.items() if c in xusd}
    out['USD_BROAD'] = np.exp(sum(np.log(xusd[c]) * v for c, v in w.items()) / sum(w.values()))
    return out


def ecb_fill(df):
    """Fill FX cells after FRED's last observation (H.10 is weekly) by chaining ECB day-to-day
    changes onto FRED's last value. Only existing rows are filled. Returns {key: first filled date}."""
    filled = {}
    for k, g in ecb_series().items():
        f = df[k].dropna()
        if f.empty:
            continue
        last = f.index[-1]
        base = g[g.index <= last].dropna()
        if base.empty:
            continue
        rows = df.index[df.index > last]
        ext = (g.reindex(rows) / base.iloc[-1] * f.iloc[-1]).round(4).dropna()
        if len(ext):
            df.loc[ext.index, k] = ext
            filled[k] = ext.index[0]
    return filled
