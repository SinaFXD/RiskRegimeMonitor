"""Independent pandas re-implementation of the LEAN workbook semantics (for verification)."""
import numpy as np, pandas as pd
from spec import *

def ffill_where(s):
    return s.ffill()

def reference(span=5, K=3, thr=(0.60, 0.25, -0.25, -0.75)):
    df = load_data()
    n = len(df)
    c = pd.DataFrame(index=df.index)
    for k in ['VIX', 'VIX3M', 'VXEEM', 'MOVE', 'HY_OAS', 'IG_OAS', 'EM_OAS', 'SPX', 'USD_BROAD', 'CUSTOM1']:
        c[k] = df[k].ffill()
    both = df['AUDUSD'].notna() & df['USDJPY'].notna()
    c['AUDJPY'] = (df['AUDUSD'] * df['USDJPY']).where(both).ffill()
    both = df['EURUSD'].notna() & df['USDCHF'].notna()
    c['EURCHF'] = (df['EURUSD'] * df['USDCHF']).where(both).ffill()
    legs = ['USDMXN', 'USDBRL', 'USDZAR', 'USDKRW']
    base = df[legs].iloc[0]
    allp = df[legs].notna().all(axis=1)
    c['EMFX'] = (100 * (base / df[legs]).mean(axis=1)).where(allp).ffill()
    c['VIX_RATIO'] = c['VIX'] / c['VIX3M']
    X = {}
    for iid, name, fa, cat, ck, tr, d, w, fk in INDICATORS:
        if tr == 'RET':
            x = np.log(c[ck] / c[ck].shift(NW))
        elif tr == 'DD':
            v = c[ck]
            ok = v.shift(LB - 1).notna()
            x = (v / v.rolling(LB, min_periods=1).max() - 1).where(ok)
        elif tr == 'CP10':
            cp = df['CP3M'].rolling(10, min_periods=1).mean(); tb = df['TBILL3M'].rolling(10, min_periods=1).mean()
            x = (cp - tb) * 100
            x.iloc[:9] = np.nan
        elif tr == 'CUSTOM':
            x = c[ck]
        else:
            x = c[ck]
        X[iid] = x
    X = pd.DataFrame(X)
    Z = {}
    for iid, name, fa, cat, ck, tr, d, w, fk in INDICATORS:
        x = X[iid]
        m = x.rolling(LB, min_periods=LB).mean(); sd = x.rolling(LB, min_periods=LB).std()
        Z[iid] = d * ((x - m) / sd).clip(-CAPV, CAPV)
    Z = pd.DataFrame(Z)
    Z.iloc[:LB - 1] = np.nan
    cats = {}
    for code, fa, en, w in CATS:
        ids = [i[0] for i in INDICATORS if i[3] == code]
        cats[code] = Z[ids].mean(axis=1)
    cats = pd.DataFrame(cats)
    cw = pd.Series({k: w for k, _, _, w in CATS})
    m = cats.notna()
    rai = (cats.fillna(0) * cw).sum(axis=1) / (m * cw).sum(axis=1).replace(0, np.nan)
    a = 2 / (span + 1); ema = []; prev = np.nan
    for v in rai.values:
        if np.isnan(v): ema.append(np.nan); continue
        prev = v if np.isnan(prev) else prev + a * (v - prev)
        ema.append(prev)
    ema = pd.Series(ema, index=rai.index)
    def lab(e):
        if np.isnan(e): return ''
        if e >= thr[0]: return 'Strong Risk-On'
        if e >= thr[1]: return 'Risk-On'
        if e > thr[2]: return 'Neutral'
        if e > thr[3]: return 'Risk-Off'
        return 'Strong Risk-Off'
    raw = ema.apply(lab)
    streak, conf, days = [], [], []
    for i, r in enumerate(raw):
        if r == '':
            streak.append(np.nan); conf.append(''); days.append(np.nan); continue
        s = (streak[-1] + 1) if (i > 0 and raw.iloc[i - 1] == r and not np.isnan(streak[-1])) else 1
        streak.append(s)
        prevc = conf[-1] if conf else ''
        cc = r if (s >= K or prevc == '') else prevc
        conf.append(cc)
        dd = (days[-1] + 1) if (len(conf) > 1 and conf[-2] == cc and not np.isnan(days[-1])) else 1
        days.append(dd)
    breadth = (Z > 0).sum(axis=1) / Z.notna().sum(axis=1).replace(0, np.nan)
    out = pd.DataFrame({'RAI': rai, 'EMA': ema, 'RAW': raw, 'STREAK': streak, 'REG': conf, 'DAYS': days,
                        'BREADTH': breadth})
    out = pd.concat([out, cats], axis=1)
    out['D5'] = out['EMA'] - out['EMA'].shift(5)
    return df, c, X, Z, out


def diag_latest(df, c, X, Z, out):
    """Dashboard diagnosis inputs (observation-based) at the latest row."""
    def zchg(k, kind):
        v = df[k].dropna().values
        w = v[-(LB + NW):]
        a, b = w[NW:], w[:-NW]
        dd = a - b if kind == 'diff' else np.log(a / b)
        z = (dd[-1] - dd.mean()) / dd.std(ddof=1)
        return float(np.clip(z, -CAPV, CAPV))
    last = out.index[-1]
    dirs = {i[0]: i[6] for i in INDICATORS}
    D = {}
    D['EQ'] = Z.loc[last, 'SPXM'] * dirs['SPXM']
    D['Y10'] = zchg('UST10Y', 'diff'); D['Y2'] = zchg('UST2Y', 'diff'); D['BE'] = zchg('BE10Y', 'diff')
    D['RY'] = zchg('REAL10Y', 'diff'); D['OIL'] = zchg('WTI', 'log'); D['JPY'] = zchg('USDJPY', 'log')
    D['USD'] = Z.loc[last, 'USD'] * dirs['USD']
    for k in ['AUDJPY', 'EMFX', 'EURCHF', 'HY', 'IG']: D[k] = Z.loc[last, k]
    D['CPZ'] = Z.loc[last, 'CP'] * dirs['CP']
    m = df['SPX'].notna() & df['UST10Y'].notna()
    sp = df.loc[m, 'SPX'].values[-61:]; ty = df.loc[m, 'UST10Y'].values[-61:]
    D['SBC'] = float(np.corrcoef(np.log(sp[1:] / sp[:-1]), ty[1:] - ty[:-1])[0, 1])
    win = c.iloc[-41:]
    rsp = np.log(win['SPX'].values[1:] / win['SPX'].values[:-1])
    raj = np.log(win['AUDJPY'].values[1:] / win['AUDJPY'].values[:-1])
    rem = np.log(win['EMFX'].values[1:] / win['EMFX'].values[:-1])
    rhy = -(win['HY_OAS'].values[1:] - win['HY_OAS'].values[:-1])
    cs = []
    for a_, b_ in [(rsp, raj), (rsp, rem), (raj, rem), (rsp, rhy), (raj, rhy), (rem, rhy)]:
        if np.std(a_) > 0 and np.std(b_) > 0: cs.append(np.corrcoef(a_, b_)[0, 1])
    D['AVGC'] = float(np.mean(cs))
    D['VIXR'] = c['VIX_RATIO'].iloc[-1]
    for code in ['VOL', 'CREDIT', 'FX', 'EQ', 'FUND']:
        D['EQC' if code == 'EQ' else code] = out[code].iloc[-1]
    return D


def type_scores(D, TYPES):
    res = {}
    for t in TYPES:
        code, conds = t[0], t[-1]
        ms = []
        for key, op, thr in conds:
            s = 1 if op == '>' else -1
            if key == 'Y10|RY':
                m_ = max(np.clip(D['Y10'], -1, 1), np.clip(D['RY'] - 0.5, -1, 1))
            else:
                if key == 'CRED-VOL': x = D['CREDIT'] - D['VOL']
                elif key.startswith('|'): x = abs(D[key.strip('|')])
                else: x = D[key]
                m_ = float(np.clip((x - thr) * s, -1, 1))
            ms.append(m_)
        met = sum(1 for m_ in ms if m_ > 0)
        res[code] = (met, (np.mean(ms) + 1) / 2)
    return res

if __name__ == '__main__':
    df, c, X, Z, out = reference()
    print(out.tail(3).round(4).to_string())
