import os
import json
import numpy as np, pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter as CL, column_index_from_string as CI
from spec import *
from playbook import TYPES, FX

data = load_data()
NDATA = len(data)
LASTDATA = FIRST + NDATA - 1
BUF = 130
LASTF = LASTDATA + BUF
ZSTART = FIRST + LB - 1          # first row that can hold a full 252-row window
print('rows', NDATA, 'last data row', LASTDATA, 'last formula row', LASTF, data.index[-1].date())

wb = openpyxl.Workbook()
wb.remove(wb.active)
order = ['Dashboard', 'FX Board', 'History', 'Config', 'Playbook', 'Guide', 'Data', 'Clean']
WS = {n: wb.create_sheet(n) for n in order}

HFILL = PatternFill('solid', fgColor='F3F3F3')
INFILL = PatternFill('solid', fgColor='FFF4CC')
BOLD = Font(bold=True)
TITLE = Font(bold=True, size=16)
SEC = Font(bold=True, size=12)
GRAY = Font(color='808080', size=9)
BIG = Font(bold=True, size=14)
WRAP_R = Alignment(wrap_text=True, horizontal='right', vertical='top')
WRAP = Alignment(wrap_text=True, vertical='top')
PCT1 = '+0.0%;-0.0%;0.0%'
SGN2 = '+0.00;-0.00;0.00'
BP = '+0" bp";-0" bp";0" bp"'


def put(ws, addr, v, fmt=None, font=None, fill=None, align=None):
    c = ws[addr]
    c.value = v
    if fmt: c.number_format = fmt
    if font: c.font = font
    if fill: c.fill = fill
    if align: c.alignment = align
    return c


def header(ws, row, col0, labels):
    for i, lab in enumerate(labels):
        c = ws.cell(row=row, column=CI(col0) + i, value=lab)
        c.fill = HFILL; c.font = BOLD
        c.alignment = Alignment(wrap_text=True, vertical='center')


def widths(ws, d):
    for k, v in d.items():
        ws.column_dimensions[k].width = v / 7.0


DC = {k: l for l, k, *_ in DATA_COLS}          # Data column letters
IND_IDX = {ind[0]: i for i, ind in enumerate(INDICATORS)}
NI = len(INDICATORS)
ZCOL = {ind[0]: CL(CI('P') + i) for i, ind in enumerate(INDICATORS)}       # P..AD
ZFIRST, ZLAST = 'P', CL(CI('P') + NI - 1)
XKEYS = [ind[0] for ind in INDICATORS if ind[5] != 'LEVEL']
XCOL = {k: CL(CI(ZLAST) + 2 + i) for i, k in enumerate(XKEYS)}            # after a spacer
MATC0, MATC1 = 'B', CL(CI('B') + NI - 1)                                    # Config weight matrix columns
def cfg_row(iid): return CFG_IND_ROW0 + IND_IDX[iid]
LR = CFG['LR']; LD = CFG['LD']

def zsrc(iid):
    ind = INDICATORS[IND_IDX[iid]]
    if ind[5] == 'LEVEL':
        return 'Clean!', CCOL[ind[4]]
    return '', XCOL[iid]

# =====================================================================================
# Data
# =====================================================================================
ws = WS['Data']
put(ws, 'A1', '📥 Data | داده‌های خام روزانه (قیمت پایانی؛ هر روز کاری یک ردیف)', font=TITLE)
put(ws, 'A2', 'ردیف جدید را زیر آخرین ردیف اضافه کنید (تاریخ + قیمت‌ها). سلول خالی یعنی «بدون داده» و مدل از آخرین مقدار قبلی استفاده می‌کند. کد هر ستون در FRED/TradingView در شیت Guide آمده است.', font=GRAY)
header(ws, HDR, 'A', [h for _, _, h, *_ in DATA_COLS])
for r_i, (d, row) in enumerate(data.iterrows()):
    r = FIRST + r_i
    c = ws.cell(row=r, column=1, value=d.to_pydatetime().date()); c.number_format = 'yyyy-mm-dd'
    for j, (l, k, *_) in enumerate(DATA_COLS[1:], start=2):
        v = row[k]
        if pd.notna(v):
            ws.cell(row=r, column=j, value=float(v))
ws.freeze_panes = 'B5'
ws.column_dimensions['A'].width = 96 / 7
for l, k, *_ in DATA_COLS[1:]:
    ws.column_dimensions[l].width = 12

# =====================================================================================
# Clean
# =====================================================================================
ws = WS['Clean']
put(ws, 'A1', '🧹 Clean | سری‌های پر‌شده (Forward-fill) و مشتق — فرمولی؛ ویرایش نکنید', font=TITLE)
put(ws, 'A2', 'سلول خالی Data با آخرین مقدار قبلی پر می‌شود؛ کراس‌ها و سبد EM فقط وقتی همه اجزا موجودند محاسبه می‌شوند.', font=GRAY)
header(ws, HDR, 'A', [h for _, _, h, _ in CLEAN])
em_legs = ['USDMXN', 'USDBRL', 'USDZAR', 'USDKRW']
base = {k: float(data[k].dropna().iloc[0]) for k in em_legs}
assert all(pd.notna(data[k].iloc[0]) for k in em_legs)
for r in range(FIRST, LASTF + 1):
    prev = lambda col: '""' if r == FIRST else f'IF($A{r}="","",{col}{r-1})'
    for l, k, h, kind in CLEAN:
        if kind == 'date':
            f = f'=LET(d,Data!A{r},IF(ISNUMBER(d),d,""))'
        elif kind == 'ffill':
            f = f'=LET(v,Data!{DC[k]}{r},IF(ISNUMBER(v),v,{prev(l)}))'
        elif kind == 'cross':
            a, b = ('AUDUSD', 'USDJPY') if k == 'AUDJPY' else ('EURUSD', 'USDCHF')
            f = f'=LET(xa,Data!{DC[a]}{r},xb,Data!{DC[b]}{r},IF(AND(ISNUMBER(xa),ISNUMBER(xb)),xa*xb,{prev(l)}))'
        elif kind == 'basket':
            nm = ['xa', 'xb', 'xd', 'xe']
            lets = ','.join(f'{n},Data!{DC[k2]}{r}' for n, k2 in zip(nm, em_legs))
            avg = ','.join(f'{base[k2]!r}/{n}' for n, k2 in zip(nm, em_legs))
            f = f'=LET({lets},IF(COUNT(xa,xb,xd,xe)=4,100*AVERAGE({avg}),{prev(l)}))'
        elif kind == 'ratio':
            f = f'=IFERROR({CCOL["VIX"]}{r}/{CCOL["VIX3M"]}{r},"")'
        ws[f'{l}{r}'] = f
        if kind == 'date': ws[f'{l}{r}'].number_format = 'yyyy-mm-dd'
ws.freeze_panes = 'B5'
for l, *_ in CLEAN:
    ws.column_dimensions[l].width = 13

# =====================================================================================
# Config
# =====================================================================================
ws = WS['Config']
put(ws, 'A1', '⚙️ Config | تنظیمات مدل', font=TITLE)
put(ws, 'A2', 'سلول‌های زرد ورودی‌اند و قابل تغییر؛ هر تغییر کل مدل را دوباره حساب می‌کند. سلول‌های سفید محاسباتی یا ثابت‌اند.', font=GRAY)
put(ws, 'A4', 'پارامترهای کلی | Global parameters', font=SEC)
header(ws, 5, 'A', ['Parameter', 'Value', 'توضیح'])
params = [
    ('EMA span (days)', 5, 'هموارسازی شاخص ترکیبی (RAI)', True, '0'),
    ('EMA alpha (calc)', '=2/(B6+1)', 'محاسبه‌ای: 2/(span+1)', False, '0.000'),
    ('Confirmation days', 3, 'تعداد روز پیاپی لازم برای تأیید تغییر رژیم', True, '0'),
    ('Threshold: Strong Risk-On ≥', 0.60, 'آستانه‌ها روی RAI (EMA) و امتیاز دسته‌ها', True, '0.00'),
    ('Threshold: Risk-On ≥', 0.25, '', True, '0.00'),
    ('Threshold: Risk-Off ≤', -0.25, '', True, '0.00'),
    ('Threshold: Strong Risk-Off ≤', -0.75, '', True, '0.00'),
    ('Stale alert (calendar days)', 5, 'اگر آخرین داده یک شاخص از این تعداد روز قدیمی‌تر باشد هشدار می‌دهد', True, '0'),
    ('Latest data row (calc)', '=MATCH(MAX(Data!A:A),Data!A:A,0)', 'محاسبه‌ای: ردیف آخرین تاریخ در Data', False, '0'),
    ('Latest date (calc)', '=MAX(Data!A:A)', 'محاسبه‌ای', False, 'yyyy-mm-dd'),
    ('Z-score lookback (fixed)', LB, 'ثابت در فرمول‌ها: پنجره غلتان ۲۵۲ روزه (≈ یک سال کاری)', False, '0'),
    ('Change / return window (fixed)', NW, 'ثابت در فرمول‌ها: بازده/تغییر ۲۰ روزه (≈ یک ماه)', False, '0'),
    ('Winsor cap (fixed)', CAPV, 'ثابت در فرمول‌ها: سقف ±۳ برای z', False, '0'),
]
for i, (p, v, d, inp, fmt) in enumerate(params):
    r = 6 + i
    put(ws, f'A{r}', p); put(ws, f'B{r}', v, fmt=fmt, fill=INFILL if inp else None); put(ws, f'C{r}', d)
assert LD == 'Config!$B$15'
put(ws, 'A20', 'وزن دسته‌ها | Category weights', font=SEC)
header(ws, 21, 'A', ['Code', 'دسته', 'Category', 'Weight', 'شاخص‌ها'])
catnote = {'VOL': 'VIX، ساختار زمانی VIX، VXEEM، MOVE', 'CREDIT': 'اسپرد HY، IG و اوراق شرکتی EM',
           'FX': 'AUDJPY، سبد EM FX، EURCHF، Custom 1', 'EQ': 'مومنتوم و افت S&P 500',
           'FUND': 'دلار گسترده، اسپرد اوراق تجاری'}
for i, (code, fa, en, w) in enumerate(CATS):
    r = CFG_CAT_ROW0 + i
    put(ws, f'A{r}', code); put(ws, f'B{r}', fa); put(ws, f'C{r}', en)
    put(ws, f'D{r}', w, fmt='0%', fill=INFILL); put(ws, f'E{r}', catnote[code])
put(ws, 'A27', 'Total', font=BOLD); put(ws, 'D27', '=SUM(D22:D26)', fmt='0%', font=BOLD)
put(ws, 'A29', 'شاخص‌ها | Indicator registry', font=SEC)
header(ws, 30, 'A', ['#', 'ID', 'Indicator', 'Category', 'Transform', 'Direction', 'Weight', 'Enabled',
                     'Input', 'FRED', 'TradingView', 'توضیح'])
key2meta = {k: (fid, tv) for l, k, h, fid, tv, note in DATA_COLS}
extra = {'AUDJPY': ('DEXUSAL × DEXJPUS', 'FX:AUDJPY'), 'EURCHF': ('DEXUSEU × DEXSZUS', 'FX:EURCHF'),
         'EMFX': ('DEXMXUS, DEXBZUS, DEXSFUS, DEXKOUS', 'MXN، BRL، ZAR، KRW'),
         'VIX_RATIO': ('VIXCLS ÷ VXVCLS', 'CBOE:VIX/CBOE:VIX3M'), 'CP': ('(DCPF3M − DTB3) × 100', '—')}
for i, (iid, name, fa, cat, ck, tr, d, w, fk) in enumerate(INDICATORS):
    r = CFG_IND_ROW0 + i
    fid, tv = extra.get(ck, key2meta.get(ck, (None, None)))
    inp = f'Clean!{CCOL[ck]}' if tr == 'LEVEL' else f'History!{XCOL[iid]}'
    put(ws, f'A{r}', i + 1); put(ws, f'B{r}', iid); put(ws, f'C{r}', name)
    put(ws, f'D{r}', cat, fill=INFILL)
    put(ws, f'E{r}', 'LEVEL' if tr == 'CUSTOM' else tr, fill=INFILL if tr == 'CUSTOM' else None)
    put(ws, f'F{r}', d, fill=INFILL, fmt='+0;-0'); put(ws, f'G{r}', w, fill=INFILL, fmt='0.0')
    put(ws, f'H{r}', True, fill=INFILL)
    put(ws, f'I{r}', inp); put(ws, f'J{r}', fid or '—'); put(ws, f'K{r}', tv or '—'); put(ws, f'L{r}', fa)
put(ws, 'A47', 'Transform: LEVEL = خود سطح | RET = بازده لگاریتمی ۲۰ روزه | DD = فاصله از سقف ۲۵۲ روزه | CP10 = میانگین ۱۰ روزه اسپرد. فقط Transform شاخص Custom 1 قابل تغییر است (LEVEL / RET / CHG).   Direction: +1 یعنی افزایش = ریسک‌آن، −1 یعنی افزایش = ریسک‌آف.', font=GRAY)
put(ws, 'A48', 'برچسب رژیم‌ها | Regime labels', font=SEC)
header(ws, 49, 'A', ['Regime', 'فارسی', 'Risk budget', 'رویکرد کلی'])
for i, (lab, fa, b, post) in enumerate(REGIMES):
    r = CFG_REG_ROW0 + i
    put(ws, f'A{r}', lab); put(ws, f'B{r}', fa); put(ws, f'C{r}', b, fmt='0%', fill=INFILL); put(ws, f'D{r}', post)
put(ws, 'A56', 'ماتریس وزن (محاسباتی؛ از جدول شاخص‌ها ساخته می‌شود)', font=SEC)
header(ws, 57, 'A', ['Category'] + [ind[0] for ind in INDICATORS])
for k, (code, *_r) in enumerate(CATS):
    m = CFG_MAT_ROW0 + k
    put(ws, f'A{m}', code)
    for i, ind in enumerate(INDICATORS):
        ri = cfg_row(ind[0]); col = CL(CI(MATC0) + i)
        put(ws, f'{col}{m}', f'=IF(AND($D${ri}=$A{m},$H${ri}=TRUE),$G${ri},0)', fmt='0.0')
EN_ROW = CFG_MAT_ROW0 + len(CATS)
put(ws, f'A{EN_ROW}', 'Enabled')
for i, ind in enumerate(INDICATORS):
    ri = cfg_row(ind[0]); col = CL(CI(MATC0) + i)
    put(ws, f'{col}{EN_ROW}', f'=IF($H${ri}=TRUE,1,0)', fmt='0')
widths(ws, {'A': 210, 'B': 120, 'C': 200, 'D': 110, 'E': 90, 'F': 80, 'G': 70, 'H': 80, 'I': 110, 'J': 230, 'K': 170, 'L': 280})

# =====================================================================================
# History
# =====================================================================================
ws = WS['History']
put(ws, 'A1', '🗂️ History | تاریخچه شاخص ترکیبی، رژیم و Z-scoreها', font=TITLE)
put(ws, 'A2', f'ستون‌های {ZFIRST} تا {ZLAST}: Z علامت‌دار هر شاخص (مثبت = ریسک‌آن). ستون‌های {XCOL[XKEYS[0]]} به بعد: سری‌های تبدیل‌شده (X).', font=GRAY)
out_hdr = ['Date', 'RAI', 'RAI EMA', 'Regime (raw)', 'Streak', 'Regime', 'Days in regime',
           'Volatility', 'Credit', 'FX', 'Equities', 'Funding & USD', 'Breadth', 'EMA Δ5d']
header(ws, HDR, 'A', out_hdr)
cat_cols = ['H', 'I', 'J', 'K', 'L']
for i, cc in enumerate(cat_cols):
    r = CFG_CAT_ROW0 + i
    put(ws, f'{cc}2', f'=Config!$D${r}', font=GRAY, fmt='0%')
for iid in ZCOL:
    put(ws, f'{ZCOL[iid]}{HDR}', f'z {INDICATORS[IND_IDX[iid]][1]}', fill=HFILL, font=BOLD)
for iid in XCOL:
    put(ws, f'{XCOL[iid]}{HDR}', f'X {INDICATORS[IND_IDX[iid]][1]}', fill=HFILL, font=BOLD)
TS = (f'IF(e>={CFG["TSON"]},"Strong Risk-On",IF(e>={CFG["TON"]},"Risk-On",IF(e>{CFG["TOFF"]},"Neutral",'
      f'IF(e>{CFG["TSOFF"]},"Risk-Off","Strong Risk-Off"))))')
for r in range(FIRST, LASTF + 1):
    ws[f'A{r}'] = f'=LET(d,Data!A{r},IF(ISNUMBER(d),d,""))'; ws[f'A{r}'].number_format = 'yyyy-mm-dd'
    for iid in XKEYS:
        ind = INDICATORS[IND_IDX[iid]]; tr = ind[5]; X = XCOL[iid]
        f = None
        if tr == 'RET' and r - NW >= FIRST:
            c = CCOL[ind[4]]
            f = f'=IFERROR(LN(Clean!{c}{r}/Clean!{c}{r-NW}),"")'
        elif tr == 'DD' and r - LB + 1 >= FIRST:
            c = CCOL[ind[4]]
            f = f'=IFERROR(IF(ISNUMBER(Clean!{c}{r-LB+1}),Clean!{c}{r}/MAX(Clean!{c}{r-LB+1}:{c}{r})-1,""),"")'
        elif tr == 'CP10' and r - 9 >= FIRST:
            a, b = DC['CP3M'], DC['TBILL3M']
            f = f'=IF($A{r}="","",IFERROR((AVERAGE(Data!{a}{r-9}:{a}{r})-AVERAGE(Data!{b}{r-9}:{b}{r}))*100,""))'
        elif tr == 'CUSTOM' and r - NW >= FIRST:
            c = CCOL[ind[4]]; ri = cfg_row(iid)
            f = (f'=LET(v,Clean!{c}{r},tr,Config!$E${ri},IF(NOT(ISNUMBER(v)),"",IFERROR(IF(tr="RET",LN(v/Clean!{c}{r-NW}),'
                 f'IF(tr="CHG",v-Clean!{c}{r-NW},v)),"")))')
        if f: ws[f'{X}{r}'] = f
    if r >= ZSTART:
        for iid, name, fa, cat, ck, tr, d, w, fk in INDICATORS:
            sh, c = zsrc(iid); ri = cfg_row(iid)
            ws[f'{ZCOL[iid]}{r}'] = (f'=IFERROR(LET(w,{sh}{c}{r-LB+1}:{c}{r},IF(COUNT(w)<{LB},"",Config!$F${ri}*'
                                     f'MAX(-{CAPV},MIN({CAPV},({sh}{c}{r}-AVERAGE(w))/STDEV.S(w))))),"")')
            ws[f'{ZCOL[iid]}{r}'].number_format = '0.00'
        for k, cc in enumerate(cat_cols):
            m = CFG_MAT_ROW0 + k
            ws[f'{cc}{r}'] = (f'=LET(zs,${ZFIRST}{r}:${ZLAST}{r},ok,ISNUMBER(zs)*Config!${MATC0}${m}:${MATC1}${m},'
                              f'IFERROR(SUMPRODUCT(ok,IF(ISNUMBER(zs),zs,0))/SUM(ok),""))')
            ws[f'{cc}{r}'].number_format = '0.00'
        ws[f'B{r}'] = (f'=IF($A{r}="","",LET(cs,H{r}:L{r},ok,ISNUMBER(cs)*$H$2:$L$2,'
                       f'IFERROR(SUMPRODUCT(ok,IF(ISNUMBER(cs),cs,0))/SUM(ok),"")))')
        ws[f'M{r}'] = (f'=LET(zs,${ZFIRST}{r}:${ZLAST}{r},ok,ISNUMBER(zs)*Config!${MATC0}${EN_ROW}:${MATC1}${EN_ROW},'
                       f'IFERROR(SUMPRODUCT(ok,--(IF(ISNUMBER(zs),zs,0)>0))/SUM(ok),""))')
        ws[f'C{r}'] = f'=LET(b,B{r},pv,C{r-1},IF(b="","",IF(ISNUMBER(pv),pv+{CFG["ALPHA"]}*(b-pv),b)))'
        ws[f'D{r}'] = f'=LET(e,C{r},IF(e="","",{TS}))'
        ws[f'E{r}'] = f'=LET(d,D{r},IF(d="","",IF(d=D{r-1},N(E{r-1})+1,1)))'
        if r == ZSTART:
            ws[f'F{r}'] = f'=D{r}'
        else:
            ws[f'F{r}'] = f'=LET(d,D{r},pv,F{r-1},IF(d="","",IF(OR(E{r}>={CFG["K"]},pv=""),d,pv)))'
        ws[f'G{r}'] = f'=LET(fv,F{r},IF(fv="","",IF(fv=F{r-1},N(G{r-1})+1,1)))'
        ws[f'N{r}'] = (f'=IFERROR(C{r}-C{r-5},"")' if r >= ZSTART + 5 else
                       f'=IF(AND(ISNUMBER(C{r}),ISNUMBER(C{r-5})),C{r}-C{r-5},"")')
        for cc, fmt in (('B', '0.00'), ('C', '0.00'), ('M', '0%'), ('N', SGN2)):
            ws[f'{cc}{r}'].number_format = fmt
ws.freeze_panes = 'B5'
widths(ws, {'A': 96, 'B': 64, 'C': 72, 'D': 118, 'E': 56, 'F': 118, 'G': 70, 'H': 74, 'I': 64, 'J': 56, 'K': 70,
            'L': 84, 'M': 70, 'N': 72, 'O': 24})
for iid in ZCOL: ws.column_dimensions[ZCOL[iid]].width = 11
for iid in XCOL: ws.column_dimensions[XCOL[iid]].width = 12
ws.column_dimensions[CL(CI(ZLAST) + 1)].width = 24 / 7

# =====================================================================================
# Playbook
# =====================================================================================
ws = WS['Playbook']
put(ws, 'A1', '📘 Playbook | راهنمای عملیاتی FX برای هر نوع رژیم', font=TITLE)
put(ws, 'A2', 'چارچوب آموزشی بر پایه الگوهای تاریخی؛ توصیه سرمایه‌گذاری نیست. همیشه با Positioning، ارزش‌گذاری و کاتالیزورها تطبیق دهید.', font=GRAY)
header(ws, 4, 'A', ['Code', 'Type', 'نوع', 'Family', 'نشانه‌ها (Signature)', 'سوگیری خرید (Long)',
                    'فروش / پرهیز (Short)', 'مدیریت ریسک و پوشش', 'چه چیزی سناریو را باطل می‌کند', 'شرط‌های تشخیص (z)'])
for i, t in enumerate(TYPES):
    r = 5 + i
    code, en, fa, fam, sig, lg, sh, hd, inv, conds = t
    cond_txt = '  ؛  '.join(f'{k} {op} {thr:g}' for k, op, thr in conds)
    for j, v in enumerate([code, en, fa, fam, sig, lg, sh, hd, inv, cond_txt]):
        c = ws.cell(row=r, column=j + 1, value=v)
        c.alignment = WRAP_R if j >= 4 else WRAP
PB_LAST = 5 + len(TYPES) - 1
put(ws, f'A{PB_LAST + 2}', 'رویکرد کلی بر اساس رژیم', font=SEC)
header(ws, PB_LAST + 3, 'A', ['Regime', 'فارسی', 'Risk budget', 'رویکرد کلی'])
for i, (lab, fa, b, post) in enumerate(REGIMES):
    r = PB_LAST + 4 + i
    put(ws, f'A{r}', lab); put(ws, f'B{r}', fa); put(ws, f'C{r}', f'=Config!C{CFG_REG_ROW0 + i}', fmt='0%')
    put(ws, f'D{r}', post, align=WRAP_R)
widths(ws, {'A': 60, 'B': 170, 'C': 160, 'D': 80, 'E': 280, 'F': 260, 'G': 220, 'H': 280, 'I': 240, 'J': 300})

# =====================================================================================
# Dashboard
# =====================================================================================
ws = WS['Dashboard']
ws.sheet_view.showGridLines = False
widths(ws, {'A': 24, 'B': 340, 'C': 104, 'D': 112, 'E': 96, 'F': 104, 'G': 104, 'H': 104, 'I': 104, 'J': 70})
put(ws, 'B2', '🌐 Risk-On / Risk-Off Regime Monitor  |  مانیتور رژیم ریسک بازار', font=TITLE)
put(ws, 'B3', f'="آخرین داده: "&TEXT({LD},"yyyy-mm-dd")&"   •   پنجره Z: {LB} روز   •   پنجره تغییر: {NW} روز   •   منبع: FRED (St. Louis Fed)"', font=GRAY)
kpi_lab = ['رژیم (تأییدشده)', 'RAI (EMA)', 'تغییر ۵ روزه', 'صدک تاریخی', 'روز در رژیم', 'گستردگی', 'RAI خام', 'تاریخ داده']
for i, lab in enumerate(kpi_lab):
    c = ws.cell(row=5, column=2 + i, value=lab); c.font = GRAY
put(ws, 'B6', f'=IFERROR(INDEX(History!F:F,{LR}),"")', font=BIG)
put(ws, 'C6', f'=IFERROR(INDEX(History!C:C,{LR}),"")', fmt='0.00', font=BIG)
put(ws, 'D6', f'=IFERROR(INDEX(History!N:N,{LR}),"")', fmt=SGN2, font=BIG)
put(ws, 'E6', f'=IFERROR(COUNTIF(History!$C${FIRST}:$C$5000,"<="&C6)/COUNT(History!$C${FIRST}:$C$5000),"")', fmt='0%', font=BIG)
put(ws, 'F6', f'=IFERROR(INDEX(History!G:G,{LR}),"")', fmt='0', font=BIG)
put(ws, 'G6', f'=IFERROR(INDEX(History!M:M,{LR}),"")', fmt='0%', font=BIG)
put(ws, 'H6', f'=IFERROR(INDEX(History!B:B,{LR}),"")', fmt='0.00', font=BIG)
put(ws, 'I6', f'={LD}', fmt='yyyy-mm-dd', font=BIG)
REGTAB = f'Config!$A${CFG_REG_ROW0}:$D${CFG_REG_ROW0 + 4}'

row = 10
put(ws, f'B{row}', '📈 شاخص ترکیبی اشتهای ریسک (RAI) — تاریخچه و نوارهای رژیم', font=SEC)
CHART1_ANCHOR = f'B{row + 1}'
row += 15
TYPE_HDR_ROW = row
put(ws, f'B{row}', '🧭 تشخیص نوع رژیم (چرا ریسک‌آف/آن است؟)', font=SEC)
PRIM_ROW, SEC_ROW = row + 1, row + 2
row += 9
put(ws, f'B{row}', '📊 امتیاز دسته‌ها (Z-score علامت‌دار؛ مثبت = ریسک‌آن)', font=SEC)
header(ws, row + 1, 'B', ['دسته | Category', 'Score', 'Signal', 'Δ ۵ روز', 'وزن'])
CAT_ROW0 = row + 2
CATCELL = {}
def sig_formula(cell, on_s, on, off, off_s, blank='""'):
    return (f'=IF(NOT(ISNUMBER({cell})),{blank},IF({cell}>={on_s},"▲▲ Strong On",IF({cell}>={on},"▲ On",'
            f'IF({cell}>{off},"● Neutral",IF({cell}>{off_s},"▼ Off","▼▼ Strong Off")))))')
for i, (code, fa, en, w) in enumerate(CATS):
    r = CAT_ROW0 + i; hc = cat_cols[i]
    put(ws, f'B{r}', f'=Config!$B${CFG_CAT_ROW0 + i}&"  |  "&Config!$C${CFG_CAT_ROW0 + i}')
    put(ws, f'C{r}', f'=IFERROR(INDEX(History!{hc}:{hc},{LR}),"")', fmt='0.00')
    put(ws, f'D{r}', sig_formula(f'C{r}', CFG['TSON'], CFG['TON'], CFG['TOFF'], CFG['TSOFF']))
    put(ws, f'E{r}', f'=IFERROR(INDEX(History!{hc}:{hc},{LR})-INDEX(History!{hc}:{hc},{LR}-5),"")', fmt=SGN2)
    put(ws, f'F{r}', f'=Config!$D${CFG_CAT_ROW0 + i}', fmt='0%')
    CATCELL[code] = f'$C${r}'
row = CAT_ROW0 + len(CATS) + 1
put(ws, f'B{row}', '📉 امتیاز دسته‌ها در ۶ ماه اخیر', font=SEC)
CHART2_ANCHOR = f'B{row + 1}'
row += 15
put(ws, f'B{row}', '🔎 شاخص‌ها (آخرین وضعیت)', font=SEC)
header(ws, row + 1, 'B', ['شاخص | Indicator', 'Z علامت‌دار', 'Signal', 'Δ ۵ روز', 'آخرین مقدار', 'مقدار تبدیل‌شده', 'آخرین داده', 'تازگی', 'Stale'])
IND_ROW0 = row + 2
for i, (iid, name, fa, cat, ck, tr, d, w, fk) in enumerate(INDICATORS):
    r = IND_ROW0 + i; ri = cfg_row(iid); Z = ZCOL[iid]; fc = DC[fk]
    put(ws, f'B{r}', f'=Config!$C${ri}&"  ·  "&Config!$D${ri}&"  ·  {fa}"')
    put(ws, f'C{r}', f'=IFERROR(INDEX(History!{Z}:{Z},{LR}),"")', fmt='0.00')
    put(ws, f'D{r}', sig_formula(f'C{r}', 1.5, 0.5, -0.5, -1.5, blank='"—"'))
    put(ws, f'E{r}', f'=IFERROR(INDEX(History!{Z}:{Z},{LR})-INDEX(History!{Z}:{Z},{LR}-5),"")', fmt=SGN2)
    if iid == 'CP':
        src = f'History!{XCOL["CP"]}:{XCOL["CP"]}'; vfmt = '0.0" bp"'
    else:
        c = CCOL[ck]; src = f'Clean!{c}:{c}'
        vfmt = '0.0000' if ck in ('VIX_RATIO', 'EURCHF') else '#,##0.00'
    put(ws, f'F{r}', f'=IFERROR(INDEX({src},{LR}),"")', fmt=vfmt)
    if iid in XCOL and iid != 'CP':
        X = XCOL[iid]
        put(ws, f'G{r}', f'=IFERROR(INDEX(History!{X}:{X},{LR}),"")', fmt=PCT1 if tr in ('RET', 'DD') else '0.00')
    else:
        put(ws, f'G{r}', '—')
    put(ws, f'H{r}', f'=IFERROR(MAX(FILTER(Data!$A${FIRST}:$A$5000,ISNUMBER(Data!{fc}${FIRST}:{fc}$5000))),"")', fmt='yyyy-mm-dd')
    put(ws, f'I{r}', f'=IF(H{r}="","no data",IF({LD}-H{r}>{CFG["STALE"]},"⚠️ "&TEXT({LD}-H{r},"0")&"d","✓"))')
    put(ws, f'J{r}', f'=IF(H{r}="",0,IF({LD}-H{r}>{CFG["STALE"]},1,0))', font=GRAY)
IND_ROW1 = IND_ROW0 + NI - 1
put(ws, 'B7', f'=IFERROR("وضعیت: "&VLOOKUP(B6,{REGTAB},2,FALSE)&"   •   بودجه ریسک پیشنهادی: "&TEXT(VLOOKUP(B6,{REGTAB},3,FALSE),"0%")&"   •   پوشش: "&COUNT(C{IND_ROW0}:C{IND_ROW1})&" از "&COUNTIF(Config!$H${CFG_IND_ROW0}:$H${CFG_IND_ROW0 + NI - 1},TRUE)&" شاخص","")', font=BOLD)
put(ws, 'B8', f'=IFERROR(VLOOKUP(B6,{REGTAB},4,FALSE),"")', font=GRAY)

TYPES_TITLE = IND_ROW1 + 2
TYPE_ROW0 = TYPES_TITLE + 2
TYPE_ROW1 = TYPE_ROW0 + len(TYPES) - 1
ALERT_TITLE = TYPE_ROW1 + 2
ALERT_ROW0 = ALERT_TITLE + 2
N_ALERTS = 12
DIAG_TITLE = ALERT_ROW0 + N_ALERTS + 1
DIAG_ROW0 = DIAG_TITLE + 2

def obs(col):
    return f'FILTER(Data!${col}${FIRST}:${col}$5000,ISNUMBER(Data!${col}${FIRST}:${col}$5000))'
def zchg(key, kind):
    col = DC[key]
    expr = 'va-vb' if kind == 'diff' else 'LN(va/vb)'
    return (f'=IFERROR(LET(v,{obs(col)},w,TAKE(v,-{LB + NW}),va,DROP(w,{NW}),vb,DROP(w,-{NW}),dd,{expr},'
            f'zz,(INDEX(dd,{LB})-AVERAGE(dd))/STDEV.S(dd),MAX(-{CAPV},MIN({CAPV},zz))),"")')
def chg_obs(key, kind):
    col = DC[key]
    if kind == 'bp':
        return f'=IFERROR(LET(v,{obs(col)},n,ROWS(v),(INDEX(v,n)-INDEX(v,n-{NW}))*100),"")'
    return f'=IFERROR(LET(v,{obs(col)},n,ROWS(v),INDEX(v,n)/INDEX(v,n-{NW})-1),"")'
def chg_clean(ck, kind):
    c = CCOL[ck]
    if kind == 'bp':
        return f'=IFERROR((INDEX(Clean!{c}:{c},{LR})-INDEX(Clean!{c}:{c},{LR}-{NW}))*100,"")'
    return f'=IFERROR(INDEX(Clean!{c}:{c},{LR})/INDEX(Clean!{c}:{c},{LR}-{NW})-1,"")'
def zsig(iid, raw=False):
    Z = ZCOL[iid]; ri = cfg_row(iid)
    if raw:
        return f'=IFERROR(INDEX(History!{Z}:{Z},{LR})*Config!$F${ri},"")'
    return f'=IFERROR(INDEX(History!{Z}:{Z},{LR}),"")'
SPX_D, UST_D = DC['SPX'], DC['UST10Y']
SBC_F = (f'=IFERROR(LET(m,ISNUMBER(Data!${SPX_D}${FIRST}:${SPX_D}$5000)*ISNUMBER(Data!${UST_D}${FIRST}:${UST_D}$5000),'
         f'sp,TAKE(FILTER(Data!${SPX_D}${FIRST}:${SPX_D}$5000,m),-61),ty,TAKE(FILTER(Data!${UST_D}${FIRST}:${UST_D}$5000,m),-61),'
         'CORREL(LN(DROP(sp,1)/DROP(sp,-1)),DROP(ty,1)-DROP(ty,-1))),"")')
cS, cA, cE, cH = CCOL['SPX'], CCOL['AUDJPY'], CCOL['EMFX'], CCOL['HY_OAS']
AVGC_F = (f'=IFERROR(LET(lr,{LR},rw,ROW(Clean!$A${FIRST}:$A$5000),spx,Clean!${cS}${FIRST}:${cS}$5000,aj,Clean!${cA}${FIRST}:${cA}$5000,'
          f'em,Clean!${cE}${FIRST}:${cE}$5000,hy,Clean!${cH}${FIRST}:${cH}$5000,wa,(rw>lr-40)*(rw<=lr),wb,(rw>lr-41)*(rw<=lr-1),'
          'rsp,LN(FILTER(spx,wa)/FILTER(spx,wb)),raj,LN(FILTER(aj,wa)/FILTER(aj,wb)),rem,LN(FILTER(em,wa)/FILTER(em,wb)),'
          'rhy,FILTER(hy,wb)-FILTER(hy,wa),ka,IFERROR(CORREL(rsp,raj),""),kb,IFERROR(CORREL(rsp,rem),""),kc,IFERROR(CORREL(raj,rem),""),'
          'kd,IFERROR(CORREL(rsp,rhy),""),ke,IFERROR(CORREL(raj,rhy),""),kf,IFERROR(CORREL(rem,rhy),""),'
          'cnt,COUNT(ka,kb,kc,kd,ke,kf),IF(cnt=0,"",(N(ka)+N(kb)+N(kc)+N(kd)+N(ke)+N(kf))/cnt)),"")')
lastobs = lambda col: f'=IFERROR(MAX(FILTER(Data!$A${FIRST}:$A$5000,ISNUMBER(Data!{col}${FIRST}:{col}$5000))),"")'
lastval = lambda col: f'=IFERROR(LET(v,{obs(col)},INDEX(v,ROWS(v))),"")'
DIAG = [
 ('EQ', 'S&P 500 — مومنتوم ۲۰ روزه (z)', zsig('SPXM', raw=True), '0.00', chg_clean('SPX', 'pct'), PCT1, 'تغییر ۲۰ روزه S&P 500'),
 ('Y10', 'بازده ۱۰ ساله — تغییر ۲۰ روزه (z)', zchg('UST10Y', 'diff'), '0.00', chg_obs('UST10Y', 'bp'), BP, 'مثبت = بازده بالا رفته (اوراق ریخته)'),
 ('Y2', 'بازده ۲ ساله — تغییر ۲۰ روزه (z)', zchg('UST2Y', 'diff'), '0.00', chg_obs('UST2Y', 'bp'), BP, 'انتظارات سیاست پولی'),
 ('BE', 'انتظارات تورمی ۱۰ ساله — تغییر (z)', zchg('BE10Y', 'diff'), '0.00', chg_obs('BE10Y', 'bp'), BP, 'Breakeven'),
 ('RY', 'بازده واقعی ۱۰ ساله — تغییر (z)', zchg('REAL10Y', 'diff'), '0.00', chg_obs('REAL10Y', 'bp'), BP, 'TIPS'),
 ('OIL', 'نفت WTI — بازده ۲۰ روزه (z)', zchg('WTI', 'log'), '0.00', chg_obs('WTI', 'pct'), PCT1, ''),
 ('JPY', 'USDJPY — بازده ۲۰ روزه (z)', zchg('USDJPY', 'log'), '0.00', chg_obs('USDJPY', 'pct'), PCT1, 'منفی = ین قوی شده'),
 ('USD', 'دلار گسترده — بازده ۲۰ روزه (z خام)', zsig('USD', raw=True), '0.00', chg_clean('USD_BROAD', 'pct'), PCT1, 'مثبت = دلار قوی'),
 ('AUDJPY', 'AUDJPY (z علامت‌دار)', zsig('AUDJPY'), '0.00', chg_clean('AUDJPY', 'pct'), PCT1, ''),
 ('EMFX', 'سبد EM FX (z علامت‌دار)', zsig('EMFX'), '0.00', chg_clean('EMFX', 'pct'), PCT1, 'MXN، BRL، ZAR، KRW'),
 ('EURCHF', 'EURCHF (z علامت‌دار)', zsig('EURCHF'), '0.00', chg_clean('EURCHF', 'pct'), PCT1, ''),
 ('HY', 'اسپرد HY (z علامت‌دار)', zsig('HY'), '0.00', chg_clean('HY_OAS', 'bp'), BP, 'منفی = اسپرد باز شده'),
 ('IG', 'اسپرد IG (z علامت‌دار)', zsig('IG'), '0.00', chg_clean('IG_OAS', 'bp'), BP, ''),
 ('CPZ', 'اسپرد اوراق تجاری (z خام)', zsig('CP', raw=True), '0.00', f'=IFERROR(INDEX(History!{XCOL["CP"]}:{XCOL["CP"]},{LR}),"")', '0.0" bp"', 'مثبت = فشار تأمین مالی'),
 ('SBC', 'همبستگی ۶۰ روزه سهام–بازده ۱۰ ساله', SBC_F, '0.00', '', None, 'منفی = اوراق دیگر پوشش سهام نیستند'),
 ('AVGC', 'میانگین همبستگی ۴۰ روزه دارایی‌های ریسکی', AVGC_F, '0.00', '', None, 'S&P، AUDJPY، EM FX، اسپرد HY'),
 ('VIXR', 'VIX ÷ VIX3M', f'=IFERROR(INDEX(Clean!{CCOL["VIX_RATIO"]}:{CCOL["VIX_RATIO"]},{LR}),"")', '0.00', f'=IFERROR(INDEX(Clean!{CCOL["VIX"]}:{CCOL["VIX"]},{LR}),"")', '"VIX "0.0', '> ۱ یعنی منحنی معکوس'),
 ('STL', 'شاخص استرس مالی سنت‌لوئیس (هفتگی)', lastval(DC['STLFSI']), '0.00', lastobs(DC['STLFSI']), 'yyyy-mm-dd', '> ۰ = استرس بالاتر از میانگین'),
 ('NFCI', 'شاخص شرایط مالی شیکاگو NFCI (هفتگی)', lastval(DC['NFCI']), '0.00', lastobs(DC['NFCI']), 'yyyy-mm-dd', '> ۰ = شرایط سخت‌تر از میانگین'),
]
VAL = {k: f'$C${DIAG_ROW0 + i}' for i, (k, *_r) in enumerate(DIAG)}
for code in CATCELL: VAL['EQC' if code == 'EQ' else code] = CATCELL[code]

def margin(key, op, thr):
    s = 1 if op == '>' else -1
    if key == 'Y10|RY':
        return f'MAX(IFERROR(MAX(-1,MIN(1,{VAL["Y10"]})),-1),IFERROR(MAX(-1,MIN(1,{VAL["RY"]}-0.5)),-1))'
    if key == 'CRED-VOL': x = f'({VAL["CREDIT"]}-{VAL["VOL"]})'
    elif key.startswith('|'): x = f'ABS({VAL[key.strip("|")]})'
    else: x = VAL[key]
    return f'IFERROR(MAX(-1,MIN(1,({x}-({thr}))*{s})),-1)'

put(ws, f'B{TYPES_TITLE}', '🧪 امتیاز الگوهای رژیم (۵ شرط برای هر الگو)', font=SEC)
header(ws, TYPES_TITLE + 1, 'B', ['الگو | Type', 'شرط‌های برقرار', 'قدرت', 'خانواده', 'رتبه', 'کد'])
for i, t in enumerate(TYPES):
    r = TYPE_ROW0 + i
    code, en, fa, fam, sig, lg, sh, hd, inv, conds = t
    names = ['ma', 'mb', 'mc', 'md', 'me']
    let = ','.join(f'{n},{margin(*cnd)}' for n, cnd in zip(names, conds))
    put(ws, f'B{r}', f'{fa}  |  {en}')
    put(ws, f'C{r}', f'=LET({let},(ma>0)+(mb>0)+(mc>0)+(md>0)+(me>0))', fmt='0"/5"')
    put(ws, f'D{r}', f'=LET({let},(AVERAGE(ma,mb,mc,md,me)+1)/2)', fmt='0%')
    put(ws, f'E{r}', fam)
    put(ws, f'F{r}', f'=C{r}+0.99*D{r}', fmt='0.00', font=GRAY)
    put(ws, f'G{r}', code, font=GRAY)
T0, T1 = TYPE_ROW0, TYPE_ROW1
FAMX = (f'reg,$B$6,fam,IF(OR(reg="Risk-Off",reg="Strong Risk-Off"),"Risk-Off",'
        f'IF(OR(reg="Risk-On",reg="Strong Risk-On"),"Risk-On","")),keyv,$F${T0}:$F${T1},famc,$E${T0}:$E${T1},'
        'elig,IF(fam="",keyv,IF(famc=fam,keyv,-1))')
PRIM_CODE, SEC_CODE = f'$H${PRIM_ROW}', f'$H${SEC_ROW}'
put(ws, f'H{PRIM_ROW}', f'=IFERROR(LET({FAMX},INDEX($G${T0}:$G${T1},XMATCH(MAX(elig),elig))),"")', font=GRAY)
put(ws, f'H{SEC_ROW}', (f'=IFERROR(LET({FAMX},ia,XMATCH(MAX(elig),elig),elx,IF(ROW($G${T0}:$G${T1})-ROW($G${T0})+1=ia,-9,elig),'
                         f'ib,XMATCH(MAX(elx),elx),IF(INDEX($C${T0}:$C${T1},ib)>=3,INDEX($G${T0}:$G${T1},ib),"")),"")'), font=GRAY)
put(ws, f'I{PRIM_ROW}', '← کد الگوی اصلی', font=GRAY); put(ws, f'I{SEC_ROW}', '← کد الگوی دوم', font=GRAY)
put(ws, f'C{TYPE_HDR_ROW}', 'شرط‌ها', font=GRAY); put(ws, f'D{TYPE_HDR_ROW}', 'قدرت', font=GRAY)
lk = lambda code_cell, col: f'XLOOKUP({code_cell},$G${T0}:$G${T1},${col}${T0}:${col}${T1})'
put(ws, f'B{PRIM_ROW}', f'=IFERROR("نوع اصلی:  "&{lk(PRIM_CODE, "B")}&IF(OR(B6="Neutral",B6=""),"   (رژیم خنثی/گذار)",""),"")', font=Font(bold=True, size=13))
put(ws, f'C{PRIM_ROW}', f'=IFERROR({lk(PRIM_CODE, "C")},"")', fmt='0"/5"', font=BOLD)
put(ws, f'D{PRIM_ROW}', f'=IFERROR({lk(PRIM_CODE, "D")},"")', fmt='0%', font=BOLD)
put(ws, f'B{SEC_ROW}', f'=IF({SEC_CODE}="","نوع دوم:  —",IFERROR("نوع دوم:  "&{lk(SEC_CODE, "B")},""))', font=BOLD)
put(ws, f'C{SEC_ROW}', f'=IF({SEC_CODE}="","",IFERROR({lk(SEC_CODE, "C")},""))', fmt='0"/5"')
put(ws, f'D{SEC_ROW}', f'=IF({SEC_CODE}="","",IFERROR({lk(SEC_CODE, "D")},""))', fmt='0%')
pb = lambda col: f'IFERROR(XLOOKUP({PRIM_CODE},Playbook!$A$5:$A${PB_LAST},Playbook!${col}$5:${col}${PB_LAST}),"")'
for j, (lab, col) in enumerate([('🔍 نشانه‌ها: ', 'E'), ('✅ سوگیری خرید (Long): ', 'F'), ('⛔ فروش / پرهیز: ', 'G'),
                                 ('🛡️ مدیریت ریسک: ', 'H'), ('🔄 ابطال سناریو: ', 'I')]):
    put(ws, f'B{SEC_ROW + 1 + j}', f'="{lab}"&{pb(col)}', align=WRAP)

put(ws, f'B{ALERT_TITLE}', '⚠️ هشدارها و واگرایی‌ها', font=SEC)
header(ws, ALERT_TITLE + 1, 'B', ['هشدار | Alert', 'وضعیت', 'مقدار', 'آستانه'])
V = VAL
ON, OFF = '"⚠️ فعال"', '"✓"'
ALERTS = [
 ('منحنی VIX معکوس (VIX > VIX3M) — استرس حاد', f'=IF(ISNUMBER({V["VIXR"]}),IF({V["VIXR"]}>1,{ON},{OFF}),"")', f'={V["VIXR"]}', '0.00', '> 1.00'),
 ('اعتبار رالی سهام را تأیید نمی‌کند', f'=IF(AND(ISNUMBER({V["EQC"]}),ISNUMBER({V["CREDIT"]})),IF(AND({V["EQC"]}>0.25,{V["CREDIT"]}<-0.5),{ON},{OFF}),"")',
  f'=IFERROR(TEXT({V["EQC"]},"0.00")&" / "&TEXT({V["CREDIT"]},"0.00"),"")', '@', 'سهام > 0.25 و اعتبار < −0.5'),
 ('ارز جلوتر از سهام هشدار می‌دهد', f'=IF(AND(ISNUMBER({V["FX"]}),ISNUMBER({V["EQC"]})),IF(AND({V["FX"]}<-0.75,{V["EQC"]}>0),{ON},{OFF}),"")',
  f'=IFERROR(TEXT({V["FX"]},"0.00")&" / "&TEXT({V["EQC"]},"0.00"),"")', '@', 'FX < −0.75 و سهام > 0'),
 ('فشار تأمین مالی دلاری', f'=IF(OR(N({V["USD"]})>1.5,N({V["CPZ"]})>1.5),{ON},{OFF})', f'=MAX(N({V["USD"]}),N({V["CPZ"]}))', '0.00', 'z دلار یا z اسپرد CP > 1.5'),
 ('واگرایی گستردگی (Breadth)', f'=IF(AND(ISNUMBER(H6),ISNUMBER(G6)),IF(OR(AND(H6>0,G6<0.4),AND(H6<0,G6>0.6)),{ON},{OFF}),"")', '=G6', '0%', 'RAI>0 و Breadth<40٪ یا برعکس'),
 ('ین نقش پناهگاه را بازی نمی‌کند', f'=IF(AND(OR(B6="Risk-Off",B6="Strong Risk-Off"),N({V["JPY"]})>0.25),{ON},{OFF})', f'={V["JPY"]}', '0.00', 'ریسک‌آف و z USDJPY > 0.25'),
 ('جهش همبستگی (حرکت گله‌ای ماکرو)', f'=IF(ISNUMBER({V["AVGC"]}),IF({V["AVGC"]}>0.5,{ON},{OFF}),"")', f'={V["AVGC"]}', '0.00', '> 0.50'),
 ('اوراق پوشش سهام نیستند (همبستگی سهام–بازده منفی)', f'=IF(ISNUMBER({V["SBC"]}),IF({V["SBC"]}<-0.2,{ON},{OFF}),"")', f'={V["SBC"]}', '0.00', '< −0.20'),
 ('وخامت سریع (افت ۵ روزه RAI)', f'=IF(ISNUMBER(D6),IF(D6<-0.5,{ON},{OFF}),"")', '=D6', SGN2, 'Δ۵ < −0.50'),
 ('احتمال بازگشت از کف (بهبود در استرس)', f'=IF(AND(ISNUMBER(C6),ISNUMBER(D6)),IF(AND(C6<-0.75,D6>0.3),{ON},{OFF}),"")', '=D6', SGN2, 'RAI < −0.75 و Δ۵ > +0.30'),
 ('داده قدیمی', f'=IF(SUM(J{IND_ROW0}:J{IND_ROW1})>0,{ON},{OFF})', f'=SUM(J{IND_ROW0}:J{IND_ROW1})', '0" شاخص"', 'قدیمی‌تر از روزهای تعیین‌شده در Config'),
 ('پوشش ناقص دسته‌ها', f'=IF(COUNT(C{CAT_ROW0}:C{CAT_ROW0 + 4})<5,{ON},{OFF})', f'=COUNT(C{CAT_ROW0}:C{CAT_ROW0 + 4})', '0" از 5"', '۵ دسته'),
]
assert len(ALERTS) == N_ALERTS
for i, (lab, st, val, vfmt, thr) in enumerate(ALERTS):
    r = ALERT_ROW0 + i
    put(ws, f'B{r}', lab); put(ws, f'C{r}', st); put(ws, f'D{r}', val, fmt=vfmt); put(ws, f'E{r}', thr, font=GRAY)
put(ws, f'B{DIAG_TITLE}', '🔧 ورودی‌های تشخیص (z-score تغییرات ۲۰ روزه نسبت به یک سال اخیر)', font=SEC)
header(ws, DIAG_TITLE + 1, 'B', ['ورودی | Input', 'z / مقدار', 'تغییر خام', 'توضیح'])
for i, (k, lab, f, fmt, rawf, rfmt, note) in enumerate(DIAG):
    r = DIAG_ROW0 + i
    put(ws, f'B{r}', lab); put(ws, f'C{r}', f, fmt=fmt)
    if rawf: put(ws, f'D{r}', rawf, fmt=rfmt)
    put(ws, f'E{r}', note, font=GRAY)
DASH_LAST = DIAG_ROW0 + len(DIAG) - 1

# =====================================================================================
# FX Board
# =====================================================================================
ws = WS['FX Board']
ws.sheet_view.showGridLines = False
widths(ws, {'A': 24, 'B': 120, 'C': 130, 'D': 80, 'E': 90, 'F': 92, 'G': 70, 'H': 70, 'I': 70, 'J': 70, 'K': 80,
            'L': 64, 'M': 120, 'N': 160})
put(ws, 'B2', '💱 FX Board | عملکرد ارزها در برابر دلار و سازگاری با رژیم', font=TITLE)
put(ws, 'B3', f'="رژیم فعلی: "&Dashboard!B6&"   •   نوع اصلی: "&IFERROR(XLOOKUP(Dashboard!H{PRIM_ROW},Dashboard!$G${T0}:$G${T1},Dashboard!$B${T0}:$B${T1}),"—")&"   •   ارزهای FRED (H.10) هفتگی به‌روز می‌شوند؛ تاریخ هر ردیف را ببینید"', font=GRAY)
labs = ['High-beta G10 (۱ماه)', 'پناهگاه‌ها JPY+CHF (۱ماه)', 'EM carry (۱ماه)', 'EM Asia (۱ماه)', 'شکاف بتا: پربتا − پناهگاه', 'شکاف EM carry − پناهگاه']
for i, lab in enumerate(labs):
    c = ws.cell(row=5, column=2 + i, value=lab); c.font = GRAY; c.alignment = Alignment(wrap_text=True, vertical='bottom')
TB0 = 11; TB1 = TB0 + len(FX) - 1
avg = lambda g: f'=IFERROR(AVERAGEIFS($I${TB0}:$I${TB1},$C${TB0}:$C${TB1},"{g}"),"")'
for col, g in zip('BCDE', ['High-beta G10', 'Haven', 'EM carry', 'EM Asia']):
    put(ws, f'{col}6', avg(g), fmt=PCT1, font=BIG)
put(ws, 'F6', '=IFERROR(B6-C6,"")', fmt=PCT1, font=BIG)
put(ws, 'G6', '=IFERROR(D6-C6,"")', fmt=PCT1, font=BIG)
put(ws, 'B7', '=IF(NOT(ISNUMBER(F6)),"",IF(F6<0,"ارزهای پربتا از پناهگاه‌ها عقب‌اند (رفتار ریسک‌آف)","ارزهای پربتا از پناهگاه‌ها جلوترند (رفتار ریسک‌آن)"))', font=BOLD)
put(ws, f'B{TB0 - 2}', 'عملکرد در برابر USD (مثبت = ارز قوی‌تر از دلار)', font=SEC)
header(ws, TB0 - 1, 'B', ['ارز', 'گروه', 'جفت‌ارز', 'آخرین نرخ', 'تاریخ', '۱ روز', '۱ هفته', '۱ ماه', '۳ ماه', 'از ابتدای سال', 'رتبه ۱ماه', 'انتظار در ریسک‌آف', 'سازگاری با رژیم'])
for i, (ccy, grp, pk, s, exp) in enumerate(FX):
    r = TB0 + i; d = DC[pk]
    put(ws, f'B{r}', ccy, font=BOLD); put(ws, f'C{r}', grp); put(ws, f'D{r}', pk)
    put(ws, f'E{r}', lastval(d), fmt='0.0000' if pk not in ('USDJPY', 'USDKRW', 'USDINR') else '#,##0.00')
    put(ws, f'F{r}', lastobs(d), fmt='yyyy-mm-dd')
    for col, k in (('G', 1), ('H', 5), ('I', 21), ('J', 63)):
        put(ws, f'{col}{r}', f'=IFERROR(LET(v,{obs(d)},n,ROWS(v),EXP({s}*LN(INDEX(v,n)/INDEX(v,n-{k})))-1),"")', fmt=PCT1)
    put(ws, f'K{r}', (f'=IFERROR(LET(m,ISNUMBER(Data!${d}${FIRST}:${d}$5000),v,FILTER(Data!${d}${FIRST}:${d}$5000,m),'
                      f'dts,FILTER(Data!$A${FIRST}:$A$5000,m),pv,XLOOKUP(DATE(YEAR(MAX(dts))-1,12,31),dts,v,"",-1),'
                      f'EXP({s}*LN(INDEX(v,ROWS(v))/pv))-1),"")'), fmt=PCT1)
    put(ws, f'L{r}', f'=IFERROR(RANK(I{r},$I${TB0}:$I${TB1},0),"")', fmt='0')
    put(ws, f'M{r}', {'↓': '↓ ضعیف می‌شود', '↑': '↑ قوی می‌شود', '≈': '≈ خنثی/مختلط'}[exp])
    put(ws, f'N{r}', (f'=IF(NOT(ISNUMBER(I{r})),"",IF(OR(Dashboard!$B$6="Risk-Off",Dashboard!$B$6="Strong Risk-Off"),'
                      f'IF(LEFT(M{r},1)="↑",IF(I{r}>0,"✓ طبق انتظار","⚠️ پناهگاه کار نمی‌کند"),IF(LEFT(M{r},1)="↓",IF(I{r}<0,"✓ طبق انتظار","⚠️ مقاوم"),"–")),'
                      f'IF(OR(Dashboard!$B$6="Risk-On",Dashboard!$B$6="Strong Risk-On"),'
                      f'IF(LEFT(M{r},1)="↓",IF(I{r}>0,"✓ طبق انتظار","⚠️ عقب‌مانده"),IF(LEFT(M{r},1)="↑",IF(I{r}<0,"✓ طبق انتظار","⚠️ تقاضای پناهگاه"),"–")),"–")))'))
put(ws, f'B{TB1 + 2}', 'نکته: «انتظار در ریسک‌آف» رفتار معمول هر ارز در برابر USD است. ⚠️ یعنی ارز برخلاف الگوی معمول رفتار می‌کند — اغلب نشانه نوع خاصی از رژیم (مثلاً ضعف ین در شوک نرخ) یا یک داستان مستقل کشوری است.', font=GRAY)

# =====================================================================================
# Guide
# =====================================================================================
ws = WS['Guide']
ws.column_dimensions['A'].width = 640 / 7
G = [
 ('h', '📖 Guide | راهنمای استفاده و روش‌شناسی'),
 ('', ''),
 ('s', '🎯 این ابزار چه می‌کند؟'),
 ('p', 'این شیت ۱۴ شاخص بازار (به‌علاوه یک جایگاه دلخواه) را در ۵ دسته — نوسان، اعتبار، ارز، سهام و رشد، تأمین مالی و دلار — ترکیب می‌کند و یک «شاخص ترکیبی اشتهای ریسک» (RAI) می‌سازد. بر اساس RAI رژیم بازار را برچسب می‌زند (ریسک‌آن قوی تا ریسک‌آف قوی) و با ۱۱ الگو تشخیص می‌دهد که ریسک‌آف/آن از چه «نوعی» است؛ چون در بازار ارز، نوع رژیم تعیین می‌کند کدام پناهگاه کار می‌کند.'),
 ('s', '🧭 ترتیب پیشنهادی خواندن داشبورد'),
 ('p', '۱) رژیم تأییدشده و RAI (EMA): جهت کلی.   ۲) تغییر ۵ روزه: شتاب و نقطه چرخش.   ۳) نوع رژیم: چرا؟ (مثلاً در شوک نرخ/تورم، ین پناهگاه نیست).   ۴) هشدارها: واگرایی‌ها.   ۵) دسته‌ها و شاخص‌ها: کدام بخش بازار رهبری می‌کند.   ۶) FX Board: آیا ارزها همان رفتاری را دارند که رژیم انتظار دارد؟'),
 ('s', '📐 روش‌شناسی'),
 ('p', '• تبدیل‌ها: LEVEL = خود سطح (نوسان و اسپردها)؛ RET = بازده لگاریتمی ۲۰ روزه (قیمت‌ها)؛ DD = فاصله از سقف ۲۵۲ روزه؛ CP10 = میانگین ۱۰ روزه اسپرد اوراق تجاری.'),
 ('p', '• Z-score غلتان: z = (x − میانگین ۲۵۲ روز اخیر) ÷ انحراف معیار نمونه‌ای ۲۵۲ روز اخیر (شامل امروز). مقدار z به ±۳ محدود می‌شود (Winsorize). z فقط وقتی محاسبه می‌شود که هر ۲۵۲ مشاهده موجود باشد.'),
 ('p', '• جهت: ‎+1 یعنی افزایش = ریسک‌آن؛ ‎−1 یعنی افزایش = ریسک‌آف. «Z علامت‌دار» = z × جهت؛ بنابراین مثبت همیشه یعنی ریسک‌آن.'),
 ('p', '• امتیاز هر دسته = میانگین وزنی Z علامت‌دار شاخص‌های در دسترس آن دسته. RAI = میانگین وزنی دسته‌های در دسترس. اگر داده‌ای نباشد، وزن‌ها خودکار دوباره نرمال می‌شوند.'),
 ('p', '• هموارسازی و تأیید: RAI با EMA (پیش‌فرض ۵ روزه) هموار می‌شود و با آستانه‌های Config برچسب می‌خورد. رژیم «تأییدشده» فقط وقتی عوض می‌شود که برچسب جدید K روز پیاپی (پیش‌فرض ۳) تکرار شود تا سیگنال کاذب کم شود.'),
 ('p', '• گستردگی (Breadth): درصد شاخص‌هایی که Z علامت‌دار مثبت دارند. RAI مثبت با Breadth پایین یعنی رالی باریک و شکننده.'),
 ('p', '• تشخیص نوع: هر الگو ۵ شرط روی z-score تغییرات ۲۰ روزه (بازده ۱۰ و ۲ ساله، انتظارات تورمی، بازده واقعی، نفت، ین، دلار)، امتیاز دسته‌ها و همبستگی‌ها دارد. «شرط‌های برقرار» تعداد شرط‌های برقرار است و «قدرت» میانگین فاصله از آستانه‌ها (۰ تا ۱۰۰٪). نوع اصلی از میان الگوهای هم‌خانواده با رژیم فعلی انتخاب می‌شود و در رژیم خنثی از میان همه. شرط‌ها در شیت Playbook آمده‌اند.'),
 ('p', '• همبستگی سهام–بازده: همبستگی ۶۰ روزه بازده روزانه S&P 500 با تغییر روزانه بازده ۱۰ ساله. منفی یعنی وقتی بازده بالا می‌رود سهام می‌ریزد: اوراق دیگر پوشش سهام نیستند (رژیم تورمی).'),
 ('p', '• پارامترهای ساختاری (پنجره ۲۵۲، تغییر ۲۰ روزه، سقف ±۳) برای سبک ماندن شیت در فرمول‌ها ثابت‌اند. وزن‌ها، جهت‌ها، دسته‌ها، فعال/غیرفعال، آستانه‌ها، EMA و روزهای تأیید در Config قابل تغییرند.'),
 ('s', '🔄 به‌روزرسانی داده‌ها'),
 ('p', '• در شیت Data زیر آخرین ردیف، یک ردیف جدید با تاریخ (yyyy-mm-dd) و قیمت‌های پایانی وارد کنید. سلول خالی اشکالی ندارد: آخرین مقدار قبلی استفاده می‌شود.'),
 ('p', f'• فرمول‌های Clean و History از پیش برای {BUF} ردیف آینده (حدود ۶ ماه) آماده‌اند. پس از آن، آخرین ردیف فرمول‌دار این دو شیت را به پایین کپی کنید (فرمول‌ها نسبی‌اند).'),
 ('p', '• FRED نرخ‌های ارز (سری H.10) را هفتگی و معمولاً دوشنبه‌ها منتشر می‌کند؛ برای به‌روزرسانی روزانه، ارزها را از TradingView بردارید. ستون «تازگی» در داشبورد قدیمی بودن داده را نشان می‌دهد.'),
 ('p', '• دانلود یک‌جا از FRED: چند کد را با کاما در آدرس fredgraph.csv?id=CODE1,CODE2 وارد کنید؛ یک فایل zip شامل CSV دریافت می‌شود.'),
 ('p', '• حداقل ستون‌های لازم برای RAI: VIX، VIX3M، VXEEM، HY/IG/EM OAS، CP 3M، T-Bill 3M، USD Broad، S&P 500، AUDUSD، USDJPY، EURUSD، USDCHF، USDMXN، USDBRL، USDZAR، USDKRW. برای تشخیص نوع: UST 10Y، UST 2Y، Breakeven 10Y، Real 10Y، WTI.'),
 ('p', '• اگر به‌جای شاخص گسترده دلار از DXY استفاده می‌کنید، کل ستون را با همان سری پر کنید تا z-score سازگار بماند.'),
 ('s', '⚙️ شخصی‌سازی'),
 ('p', '• در Config: Span هموارسازی، روزهای تأیید، آستانه‌های رژیم، وزن دسته‌ها و برای هر شاخص: دسته، جهت، وزن و فعال/غیرفعال.'),
 ('p', '• ستون Custom 1: هر سری دلخواه، مثل Risk Reversal ۲۵ دلتای USDJPY، CDX HY، شاخص نوسان ارزی (CVIX) یا نسبت مس به طلا. در Config دسته، تبدیل (LEVEL / RET / CHG) و جهت آن را تعیین کنید.'),
 ('p', '• MOVE اختیاری است؛ به محض واردکردن حداقل ۲۵۲ روز داده، خودکار وارد مدل می‌شود.'),
 ('s', '⚠️ محدودیت‌ها'),
 ('p', '• z-score نسبی است: پس از یک سال بسیار آرام، افزایش معمولی هم «استرس» دیده می‌شود.'),
 ('p', '• اسپردهای ICE در FRED فقط از نوامبر ۲۰۲۳ در دسترس‌اند؛ تا پیش از نوامبر ۲۰۲۴ (یک پنجره کامل) دسته اعتبار در RAI غایب است.'),
 ('p', '• اسپرد اوراق تجاری (CP) داده پراکنده دارد و فقط شاخص تقریبی فشار تأمین مالی است؛ سنجه‌های حرفه‌ای‌تر (Cross-currency basis، FRA-OIS) در FRED نیستند.'),
 ('p', '• شاخص، رژیم را نشان می‌دهد، نه نقطه ورود. آن را با Positioning (گزارش COT)، ارزش‌گذاری و کاتالیزورها ترکیب کنید. این ابزار آموزشی و تحلیلی است و توصیه سرمایه‌گذاری نیست.'),
 ('s', '🗂️ فرهنگ ستون‌های Data'),
]
r = 1
for kind, txt in G:
    c = ws.cell(row=r, column=1, value=txt)
    if kind == 'h': c.font = TITLE
    elif kind == 's': c.font = SEC
    elif kind == 'p': c.alignment = WRAP_R
    r += 1
GD_HDR = r
header(ws, GD_HDR, 'A', ['ستون در Data — نام | توضیح', 'کد FRED', 'TradingView'])
ws.column_dimensions['B'].width = 26; ws.column_dimensions['C'].width = 22
for i, (l, k, h, fid, tv, note) in enumerate(DATA_COLS):
    rr = GD_HDR + 1 + i
    ws.cell(row=rr, column=1, value=f'{l} — {h}' + (f'   |   {note}' if note else ''))
    ws.cell(row=rr, column=2, value=fid or '—'); ws.cell(row=rr, column=3, value=tv or '—')

wb.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output', 'RiskRegimeMonitor.xlsx'))
json.dump(dict(NDATA=NDATA, LASTDATA=LASTDATA, LASTF=LASTF, ZSTART=ZSTART, CHART1=CHART1_ANCHOR, CHART2=CHART2_ANCHOR,
               CAT_ROW0=CAT_ROW0, IND_ROW0=IND_ROW0, IND_ROW1=IND_ROW1, TYPE_ROW0=T0, TYPE_ROW1=T1,
               ALERT_ROW0=ALERT_ROW0, DIAG_ROW0=DIAG_ROW0, DASH_LAST=DASH_LAST, PRIM_ROW=PRIM_ROW, SEC_ROW=SEC_ROW,
               TYPE_HDR_ROW=TYPE_HDR_ROW, FX_TB0=TB0, FX_TB1=TB1, GD_HDR=GD_HDR, PB_LAST=PB_LAST,
               ZCOL=ZCOL, XCOL=XCOL, DIAG=[d[0] for d in DIAG], TYPES=[t[0] for t in TYPES]),
          open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output', 'layout.json'), 'w'), indent=1)
print('saved')
