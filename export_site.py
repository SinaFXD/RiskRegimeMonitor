"""Compute the full model (reference2.py semantics) and write site/data/latest.json for the web dashboard.

    python fetch_fred.py && python export_site.py

Everything the dashboard, FX Board and Playbook show is computed here; the site only renders it
(plus client-side re-weighting in the Model Lab, which uses the exported signed z-scores).
"""
import os, json, math, warnings
import numpy as np, pandas as pd
from spec import *
from playbook import TYPES, TYPES_EN, FX
from reference2 import reference, diag_latest, type_scores, ORD

warnings.filterwarnings('ignore', message='.*dayofweek')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site', 'data', 'latest.json')
THR = dict(TSON=0.60, TON=0.25, TOFF=-0.25, TSOFF=-0.75)
SPAN, KDN, KUP, STALE = 5, 2, 3, 5
HIST_START = '2023-11-01'        # first date with a valid RAI (252 obs after START)
ICE = {'HY', 'IG', 'EMC'}         # ICE BofA OAS indicators (FRED terms: no reproduction of the data)


def num(v, d=4):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return round(float(v), d)


def arr(s, d=4):
    return [num(v, d) for v in s]


def signal(v, on_s, on, off, off_s):
    if v is None or pd.isna(v):
        return None
    return 'SON' if v >= on_s else 'ON' if v >= on else 'NEU' if v > off else 'OFF' if v > off_s else 'SOFF'


# ---------- daily diagnosis inputs (vectorised version of reference2.diag_latest) ----------
def diag_history(df, c, Z, out):
    dirs = {i[0]: i[6] for i in INDICATORS}
    D = pd.DataFrame(index=df.index)

    def zchg(k, kind):
        v = df[k].dropna()
        dd = v - v.shift(NW) if kind == 'diff' else np.log(v / v.shift(NW))
        z = ((dd - dd.rolling(LB).mean()) / dd.rolling(LB).std()).clip(-CAPV, CAPV)
        return z.reindex(df.index).ffill()
    D['EQ'] = Z['SPXM'] * dirs['SPXM']
    for key, k, kind in [('Y10', 'UST10Y', 'diff'), ('Y2', 'UST2Y', 'diff'), ('BE', 'BE10Y', 'diff'),
                         ('RY', 'REAL10Y', 'diff'), ('OIL', 'WTI', 'log'), ('JPY', 'USDJPY', 'log')]:
        D[key] = zchg(k, kind)
    D['USD'] = Z['USD'] * dirs['USD']
    for k in ['AUDJPY', 'EMFX', 'EURCHF', 'HY', 'IG']:
        D[k] = Z[k]
    D['CPZ'] = Z['CP'] * dirs['CP']
    m = df['SPX'].notna() & df['UST10Y'].notna()
    sp, ty = df.loc[m, 'SPX'], df.loc[m, 'UST10Y']
    D['SBC'] = np.log(sp / sp.shift(1)).rolling(60).corr(-ty.diff()).reindex(df.index).ffill()
    r = pd.DataFrame({'sp': np.log(c['SPX'] / c['SPX'].shift(1)), 'aj': np.log(c['AUDJPY'] / c['AUDJPY'].shift(1)),
                      'em': np.log(c['EMFX'] / c['EMFX'].shift(1)), 'hy': -c['HY_OAS'].diff()})
    pairs = [('sp', 'aj'), ('sp', 'em'), ('aj', 'em'), ('sp', 'hy'), ('aj', 'hy'), ('em', 'hy')]
    D['AVGC'] = pd.concat([r[a].rolling(40).corr(r[b]) for a, b in pairs], axis=1).mean(axis=1)
    D['VIXR'] = c['VIX_RATIO']
    for code in ['VOL', 'CREDIT', 'FX', 'EQ', 'FUND']:
        D['EQC' if code == 'EQ' else code] = out[code]
    return D


def family(reg):
    return 'Risk-Off' if 'Off' in reg else 'Risk-On' if 'On' in reg else ''


def pick_types(scores, reg):
    fam = family(reg)
    sc = {t[0]: scores[t[0]] for t in TYPES if scores[t[0]] is not None}   # types with all inputs available
    if not sc:
        return None, None
    key = {k: v[0] + 0.99 * v[1] for k, v in sc.items()}
    elig = {t[0]: (key[t[0]] if fam == '' or t[3] == fam else -1) for t in TYPES if t[0] in sc}
    order = sorted(elig, key=lambda k: -elig[k])
    prim = order[0]
    sec = order[1] if len(order) > 1 and sc[order[1]][0] >= 3 and elig[order[1]] >= 0 else None
    return prim, sec


def main():
    df, c, X, Z, out = reference(span=SPAN, kdn=KDN, kup=KUP, thr=tuple(THR.values()))
    last = out.index[-1]
    LD = df.index[-1]
    D_hist = diag_history(df, c, Z, out)
    D = diag_latest(df, c, X, Z, out)
    # sanity: vectorised diagnosis must match reference2 at the latest row
    for k, v in D.items():
        hv = D_hist[k].iloc[-1]
        assert (pd.isna(v) and pd.isna(hv)) or abs(v - hv) < 1e-6, (k, v, hv)

    ema = out['EMA']
    reg = out['REG'].iloc[-1]
    hist = out[out.index >= HIST_START]
    kpi = dict(regime=reg, ema=num(ema.iloc[-1]), rai=num(out['RAI'].iloc[-1]), d5=num(out['D5'].iloc[-1]),
               pct=num((hist['EMA'] <= ema.iloc[-1]).mean()), days=int(out['DAYS'].iloc[-1]),
               breadth=num(out['BREADTH'].iloc[-1]), raw=out['RAW'].iloc[-1], date=str(LD.date()))
    # days in a row the raw label sits below (-) / above (+) the confirmed regime, and the days needed to move it
    rord, rc = out['RAW'].map(ORD), ORD[reg]
    nb = int((rord < rc)[::-1].astype(int).cumprod().sum()); na_ = int((rord > rc)[::-1].astype(int).cumprod().sum())
    kpi.update(pend=-nb if nb else na_, need=KDN if nb else KUP if na_ else None)
    # ---- absolute-level guardrail (independent of the rolling z-scores) ----
    vix, hy = c['VIX'].iloc[-1], c['HY_OAS'].iloc[-1]
    g_vix, g_hy = bool(vix >= GUARD['VIX']), bool(hy >= GUARD['HY'])
    kpi['guard'] = dict(on=g_vix or g_hy, vix=g_vix, hy=g_hy, vix_v=num(vix, 2),
                        conflict=(g_vix or g_hy) and 'Off' not in reg)

    cats = []
    for code, fa, en, w in CATS:
        s = out[code]
        cats.append(dict(code=code, fa=fa, en=en, w=w, v=num(s.iloc[-1]), d5=num(s.iloc[-1] - s.iloc[-6]),
                         sig=signal(s.iloc[-1], *THR.values())))

    inds = []
    fills = df.attrs.get('ecb_fill', {})
    for iid, name, fa, cat, ck, tr, d, w, fk in INDICATORS:
        z = Z[iid]
        lo = df[fk].dropna()
        lastd = lo.index[-1] if len(lo) else None
        if iid in ICE:                 # ICE BofA data: redistribution restricted, publish z only
            val, xv = None, None
        elif iid == 'CP':
            val, xv = X['CP'].iloc[-1], None
        else:
            val = c[ck].iloc[-1] if ck in c else None
            xv = X[iid].iloc[-1] if tr in ('RET', 'DD') else None
        inds.append(dict(id=iid, name=name, fa=fa, cat=cat, tr=tr, dir=d, z=num(z.iloc[-1]),
                         d5=num(z.iloc[-1] - z.iloc[-6]), sig=signal(z.iloc[-1], 1.5, 0.5, -0.5, -1.5),
                         val=num(val), x=num(xv), last=str(lastd.date()) if lastd is not None else None,
                         age=(LD - lastd).days if lastd is not None else None,
                         stale=bool(lastd is None or (LD - lastd).days > STALE),
                         est=fk in fills, spark=arr(z.iloc[-130:], 3)))

    # ---- regime types (today + daily history) ----
    ts = type_scores(D, TYPES)
    prim, sec = pick_types(ts, reg)
    types = []
    for t in TYPES:
        code, en, fa, fam, sig, lg, sh, hd, inv, conds = t
        cv = []
        for key, op, thr in conds:
            if key == 'Y10|RY':
                x = max(D['Y10'], D['RY'] - 0.5)
            elif key == 'CRED-VOL':
                x = D['CREDIT'] - D['VOL']
            elif key.startswith('|'):
                x = abs(D[key.strip('|')])
            else:
                x = D[key]
            ok = bool((x - thr) * (1 if op == '>' else -1) > 0)
            cv.append(dict(k=key, op=op, thr=thr, v=num(x, 3), ok=ok))
        e_sig, e_lg, e_sh, e_hd, e_inv = TYPES_EN[code]
        met, st = ts[code] if ts[code] is not None else (0, 0.0)
        types.append(dict(code=code, en=en, fa=fa, fam=fam, sig=sig, long=lg, short=sh, hedge=hd, inv=inv,
                          sig_en=e_sig, long_en=e_lg, short_en=e_sh, hedge_en=e_hd, inv_en=e_inv,
                          met=met, str=num(st, 3), na=ts[code] is None, conds=cv))

    th = []
    Dh = D_hist[D_hist.index >= HIST_START]
    for d_, row in Dh.iterrows():
        if out.loc[d_, 'REG'] == '':
            th.append(None)
            continue
        s = type_scores(row.to_dict(), TYPES)      # a type is None on days one of its inputs is missing
        p, _ = pick_types(s, out.loc[d_, 'REG'])
        th.append(None if p is None else [p] + [None if s[t[0]] is None else num(s[t[0]][0] + s[t[0]][1] * 0.99, 2)
                                               for t in TYPES])

    # ---- alerts ----
    V = D
    E = {c_['code']: c_['v'] for c_ in cats}
    stale_n = sum(i['stale'] for i in inds)
    n_cats = sum(v is not None for v in E.values())
    ro = 'Off' in reg
    ok = lambda v: v is not None and not pd.isna(v)       # a missing input never fires (or crashes) an alert
    gt = lambda v, t: ok(v) and v > t
    lt = lambda v, t: ok(v) and v < t
    f2 = lambda v, s='': f"{v:{s}.2f}" if ok(v) else '—'
    fund = max((v for v in (V['USD'], V['CPZ']) if ok(v)), default=None)
    A = [  # (text fa, text en), on, value, threshold -- value/threshold may be a (fa, en) pair
        (('Guardrail: استرس مطلق بالاست ولی رژیم Risk-Off نیست', 'Guardrail: absolute stress is high but the regime is not Risk-Off'),
         kpi['guard']['conflict'], reg,
         ('VIX یا HY OAS بالای آستانه و رژیم Neutral یا بهتر', 'VIX or HY OAS above its level and the regime Neutral or better')),
        (('Guardrail: VIX در سطح مطلق استرس', 'Guardrail: VIX at an absolute stress level'),
         g_vix, f"{vix:.1f}", f"≥ {GUARD['VIX']:.0f}"),
        (('Guardrail: HY OAS در سطح مطلق استرس', 'Guardrail: HY OAS at an absolute stress level'),
         g_hy, ('بالای آستانه', 'above') if g_hy else ('زیر آستانه', 'below'), f"≥ {GUARD['HY']:.0f}%"),   # ICE: no level shown
        (('VIX term structure معکوس شده (VIX > VIX3M) — استرس حاد', 'VIX term structure inverted (VIX > VIX3M) — acute stress'),
         gt(V['VIXR'], 1), f2(V['VIXR']), '> 1.00'),
        (('Credit رالی Equities را تأیید نمی‌کند', 'Credit is not confirming the equity rally'),
         gt(E['EQ'], 0.25) and lt(E['CREDIT'], -0.5), f"{f2(E['EQ'])} / {f2(E['CREDIT'])}", ('Equities > 0.25 و Credit < −0.5', 'Equities > 0.25 and Credit < −0.5')),
        (('FX زودتر از Equities هشدار می‌دهد', 'FX is warning ahead of equities'),
         lt(E['FX'], -0.75) and gt(E['EQ'], 0), f"{f2(E['FX'])} / {f2(E['EQ'])}", ('FX < −0.75 و Equities > 0', 'FX < −0.75 and Equities > 0')),
        (('USD funding stress', 'USD funding stress'),
         gt(fund, 1.5), f2(fund), ('USD z یا CP spread z > 1.5', 'USD z or CP spread z > 1.5')),
        (('Breadth divergence', 'Breadth divergence'),
         (gt(kpi['rai'], 0) and lt(kpi['breadth'], 0.4)) or (lt(kpi['rai'], 0) and gt(kpi['breadth'], 0.6)),
         f"{kpi['breadth']:.0%}" if ok(kpi['breadth']) else '—',
         ('RAI > 0 و Breadth < 40% یا برعکس', 'RAI > 0 and Breadth < 40%, or the reverse')),
        (('JPY نقش Safe haven را بازی نمی‌کند', 'JPY is not acting as a Safe haven'),
         ro and gt(V['JPY'], 0.25), f2(V['JPY']), ('Risk-Off و USDJPY z > 0.25', 'Risk-Off and USDJPY z > 0.25')),
        (('Correlation spike (حرکت گله‌ای Macro)', 'Correlation spike (macro herding)'),
         gt(V['AVGC'], 0.5), f2(V['AVGC']), '> 0.50'),
        (('Treasuries دیگر Hedge سهام نیستند (Stock–bond correlation مثبت)', 'Treasuries no longer hedge equities (positive stock–bond correlation)'),
         gt(V['SBC'], 0.2), f2(V['SBC'], '+'), '> +0.20'),
        (('وخامت سریع (افت ۵ روزه RAI)', 'Rapid deterioration (5-day RAI drop)'),
         lt(kpi['d5'], -0.5), f2(kpi['d5'], '+'), 'Δ5 < −0.50'),
        (('احتمال Bottoming (بهبود در دل استرس)', 'Possible bottoming (improvement under stress)'),
         lt(kpi['ema'], -0.75) and gt(kpi['d5'], 0.3), f2(kpi['d5'], '+'), ('RAI < −0.75 و Δ5 > +0.30', 'RAI < −0.75 and Δ5 > +0.30')),
        (('Stale data', 'Stale data'),
         stale_n > 0, (f'{stale_n} شاخص', f'{stale_n} indicators'), (f'قدیمی‌تر از {STALE} روز', f'older than {STALE} days')),
        (('پوشش ناقص Categories', 'Incomplete category coverage'),
         n_cats < 5, f'{n_cats} / 5', '5 Category'),
    ]
    two = lambda x: x if isinstance(x, tuple) else (x, x)
    alerts = [dict(t=t[0], t_en=t[1], on=bool(on), v=two(v)[0], v_en=two(v)[1], thr=two(thr)[0], thr_en=two(thr)[1])
              for t, on, v, thr in A]

    # ---- diagnosis inputs table ----
    def pct_chg(s, n=NW):
        return num(s.iloc[-1] / s.iloc[-1 - n] - 1)

    def obs_chg(k, kind):
        v = df[k].dropna()
        return num((v.iloc[-1] - v.iloc[-1 - NW]) * 100, 1) if kind == 'bp' else num(v.iloc[-1] / v.iloc[-1 - NW] - 1)
    DIAG = [
        ('EQ', 'S&P 500 momentum (20d)', pct_chg(c['SPX']), 'pct', ('تغییر ۲۰ روزه S&P 500', '20-day change in the S&P 500')),
        ('Y10', 'UST 10Y yield (20d change)', obs_chg('UST10Y', 'bp'), 'bp', ('مثبت = بازده بالا رفته (Bond sell-off)', 'Positive = yields up (bond sell-off)')),
        ('Y2', 'UST 2Y yield (20d change)', obs_chg('UST2Y', 'bp'), 'bp', ('انتظارات Policy rate', 'Policy-rate expectations')),
        ('BE', '10Y Breakeven (20d change)', obs_chg('BE10Y', 'bp'), 'bp', 'Inflation expectations'),
        ('RY', '10Y Real yield (20d change)', obs_chg('REAL10Y', 'bp'), 'bp', 'TIPS'),
        ('OIL', 'WTI (20d return)', obs_chg('WTI', 'pct'), 'pct', ''),
        ('JPY', 'USDJPY (20d return)', obs_chg('USDJPY', 'pct'), 'pct', ('منفی = JPY قوی شده', 'Negative = JPY stronger')),
        ('USD', 'USD Broad (20d return, raw z)', pct_chg(c['USD_BROAD']), 'pct', ('مثبت = USD قوی', 'Positive = strong USD')),
        ('AUDJPY', 'AUDJPY (signed z)', pct_chg(c['AUDJPY']), 'pct', ''),
        ('EMFX', 'EM FX basket (signed z)', pct_chg(c['EMFX']), 'pct', 'MXN, BRL, ZAR, KRW'),
        ('EURCHF', 'EURCHF (signed z)', pct_chg(c['EURCHF']), 'pct', ''),
        ('HY', 'HY spread (signed z)', None, '', ('منفی = Spread widening', 'Negative = spread widening')),
        ('IG', 'IG spread (signed z)', None, '', ''),
        ('CPZ', 'CP – T-bill spread (raw z)', num(X['CP'].iloc[-1], 1), 'bpl', ('مثبت = Funding stress', 'Positive = funding stress')),
        ('SBC', 'Stock–bond correlation (60d)', None, '', ('بر اساس قیمت اوراق؛ مثبت = Treasuries دیگر Hedge سهام نیستند', 'Bond price, not yield; positive = Treasuries no longer hedge equities')),
        ('AVGC', 'Avg risk-asset correlation (40d)', None, '', 'S&P 500, AUDJPY, EM FX, HY spread'),
        ('VIXR', 'VIX ÷ VIX3M', num(c['VIX'].iloc[-1], 2), 'vix', ('> 1 یعنی Inverted term structure', '> 1 means an inverted term structure')),
    ]
    diag = [dict(k=k, t=t, z=num(D[k], 3), raw=r, fmt=f, note=two(n)[0], note_en=two(n)[1]) for k, t, r, f, n in DIAG]
    weekly = []
    for k, fid, t, note in [('STLFSI', 'STLFSI4', 'St. Louis Fed Financial Stress Index', ('> 0 = استرس بالاتر از میانگین', '> 0 = above-average stress')),
                            ('NFCI', 'NFCI', 'Chicago Fed NFCI', ('> 0 = Financial conditions سخت‌تر از میانگین', '> 0 = tighter-than-average financial conditions'))]:
        w = ld(fid).dropna()
        w = w[w.index >= HIST_START]
        weekly.append(dict(k=k, t=t, note=note[0], note_en=note[1], v=num(w.iloc[-1], 3), date=str(w.index[-1].date()),
                           dates=[str(d.date()) for d in w.index], vals=arr(w, 3)))

    # ---- FX board ----
    fx = []
    nfit = min(max(kpi['days'], 5), 21)        # regime-fit horizon: since the regime began, 5..21 business days
    kpi['fit_n'] = nfit
    ystart = pd.Timestamp(year=LD.year - 1, month=12, day=31)
    for ccy, grp, pk, s, exp in FX:
        v = df[pk].dropna()
        ret = lambda n: num(math.exp(s * math.log(v.iloc[-1] / v.iloc[-1 - n])) - 1)
        pv = v[v.index <= ystart]
        r1m = ret(21)
        fx.append(dict(ccy=ccy, grp=grp, pair=pk, last=num(v.iloc[-1]), date=str(v.index[-1].date()),
                       est=pk in fills and v.index[-1] >= fills[pk],
                       r1d=ret(1), r1w=ret(5), r1m=r1m, r3m=ret(63), rfit=ret(nfit),
                       ytd=num(math.exp(s * math.log(v.iloc[-1] / pv.iloc[-1])) - 1) if len(pv) else None,
                       exp=exp, spark=arr((np.exp(s * np.log(v / v.iloc[-64])) - 1).iloc[-64:], 4)))
    order = sorted(fx, key=lambda r: -(r['r1m'] if r['r1m'] is not None else -9))
    for i, r in enumerate(order):
        r['rank'] = i + 1
    for r in fx:
        m = r['rfit']
        if m is None:
            r['fit'] = 'mixed'
        elif 'Off' in reg:
            r['fit'] = ('ok' if m > 0 else 'haven-fail') if r['exp'] == '↑' else ('ok' if m < 0 else 'resilient') if r['exp'] == '↓' else 'mixed'
        elif 'On' in reg:
            r['fit'] = ('ok' if m > 0 else 'lagging') if r['exp'] == '↓' else ('ok' if m < 0 else 'haven-bid') if r['exp'] == '↑' else 'mixed'
        else:
            r['fit'] = 'mixed'
    gavg = {g: num(np.mean([r['r1m'] for r in fx if r['grp'] == g])) for g in ['High-beta G10', 'Haven', 'EM carry', 'EM Asia', 'Low-beta G10']}

    # ---- history ----
    H = out[out.index >= HIST_START]
    code = {'Strong Risk-On': 2, 'Risk-On': 1, 'Neutral': 0, 'Risk-Off': -1, 'Strong Risk-Off': -2}
    history = dict(dates=[str(d.date()) for d in H.index], rai=arr(H['RAI'], 3), ema=arr(H['EMA'], 3),
                   reg=[code.get(r) for r in H['REG']], raw=[code.get(r) for r in H['RAW']],
                   breadth=arr(H['BREADTH'], 3), cats={k: arr(H[k], 3) for k, *_ in CATS},
                   z={i[0]: arr(Z.loc[H.index, i[0]], 3) for i in INDICATORS},
                   mkt={k: arr(c.loc[H.index, k], 4) for k in ['SPX', 'VIX', 'AUDJPY', 'USD_BROAD', 'EMFX']},
                   types=th)

    # ---- regime episodes & statistics ----
    eps, cur = [], None
    for d_, r in H['REG'].items():
        if not r:
            continue
        if cur and cur['reg'] == r:
            cur['end'] = str(d_.date()); cur['n'] += 1
        else:
            cur = dict(reg=r, start=str(d_.date()), end=str(d_.date()), n=1); eps.append(cur)
    fwd = {}
    for k in ['SPX', 'AUDJPY', 'EMFX']:
        f = np.log(c[k].shift(-NW) / c[k])
        fwd[k] = f.loc[H.index]
    stats = []
    for lab, fa, b, post in REGIMES:
        m = H['REG'] == lab
        stats.append(dict(reg=lab, share=num(m.mean(), 3), days=int(m.sum()),
                          episodes=sum(1 for e in eps if e['reg'] == lab),
                          fwd={k: num(fwd[k][m].mean(), 4) for k in fwd},
                          hit={k: num((fwd[k][m].dropna() > 0).mean(), 3) for k in fwd}))

    data = dict(
        meta=dict(updated=pd.Timestamp.now(tz='UTC').strftime('%Y-%m-%d %H:%M UTC'), last=str(LD.date()),
                  lb=LB, nw=NW, cap=CAPV, span=SPAN, kdn=KDN, kup=KUP, thr=THR, stale=STALE, guard=GUARD,
                  ecb_from=str(min(fills.values()).date()) if fills else None),
        kpi=kpi, regimes=[dict(reg=l, fa=f, budget=b, post=p, post_en=REGIMES_POST_EN[l]) for l, f, b, p in REGIMES],
        cats=cats, inds=inds, types=types, primary=prim, secondary=sec, alerts=alerts, diag=diag, weekly=weekly,
        fx=fx, fxg=gavg, history=history, episodes=eps, stats=stats,
        indicators_def=[dict(id=i[0], cat=i[3], dir=i[6], w=i[7]) for i in INDICATORS],
        datacols=[dict(k=k, h=h, fred=fid, tv=tv, note=note) for k, h, fid, tv, note in DATA_COLS[1:]],
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'saved {OUT}  ({os.path.getsize(OUT) / 1024:.0f} KB)  last={LD.date()}  regime={reg}  primary={prim} secondary={sec}')


if __name__ == '__main__':
    main()
