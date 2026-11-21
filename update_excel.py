"""Append new daily rows to the Data sheet of an existing workbook (keeps your formatting).

Usage:
    python fetch_fred.py
    python update_excel.py output/RiskRegimeMonitor.xlsx

- Only rows with dates AFTER the last date already in Data are added (values only).
- If the pre-built formula rows in Clean/History are about to run out, the last
  formula row is copied down (relative references are translated).
NOTE: openpyxl does not keep Excel charts/images. If your workbook has native charts,
run with --xlwings (needs Excel installed: pip install xlwings) to write through Excel itself.
"""
import sys, shutil, datetime as dt
import pandas as pd
from spec import DATA_COLS, load_data, HDR, FIRST

def last_row_with_date(ws):
    r = ws.max_row
    while r > HDR and not isinstance(ws.cell(r, 1).value, (dt.date, dt.datetime)):
        r -= 1
    return r

def run_openpyxl(path):
    import openpyxl
    from openpyxl.formula.translate import Translator
    shutil.copy(path, path.replace('.xlsx', f'.backup-{dt.date.today()}.xlsx'))
    wb = openpyxl.load_workbook(path)
    ws = wb['Data']
    lr = last_row_with_date(ws)
    last_date = pd.Timestamp(ws.cell(lr, 1).value)
    new = load_data()
    new = new[new.index > last_date]
    print('last date in workbook:', last_date.date(), '| new rows:', len(new))
    for i, (d, row) in enumerate(new.iterrows()):
        r = lr + 1 + i
        c = ws.cell(r, 1, d.date()); c.number_format = 'yyyy-mm-dd'
        for j, (l, k, *_) in enumerate(DATA_COLS[1:], start=2):
            if pd.notna(row[k]):
                ws.cell(r, j, float(row[k]))
    need = lr + len(new) + 20                     # keep 20 spare formula rows
    for name in ('Clean', 'History'):
        sh = wb[name]
        last_f = sh.max_row
        while last_f > HDR and not str(sh.cell(last_f, 1).value or '').startswith('='):
            last_f -= 1
        for r in range(last_f + 1, need + 1):
            for col in range(1, sh.max_column + 1):
                src = sh.cell(last_f, col)
                if isinstance(src.value, str) and src.value.startswith('='):
                    dst = sh.cell(r, col)
                    dst.value = Translator(src.value, origin=src.coordinate).translate_formula(dst.coordinate)
                    dst.number_format = src.number_format
        if need > last_f:
            print(f'{name}: extended formulas {last_f} -> {need}')
    wb.save(path)
    print('saved', path)

def run_xlwings(path):
    import xlwings as xw
    book = xw.Book(path)
    ws = book.sheets['Data']
    lr = ws.range('A' + str(ws.cells.last_cell.row)).end('up').row
    last_date = pd.Timestamp(ws.range(f'A{lr}').value)
    new = load_data()
    new = new[new.index > last_date]
    print('last date in workbook:', last_date.date(), '| new rows:', len(new))
    if len(new):
        vals = [[d.to_pydatetime()] + [None if pd.isna(row[k]) else float(row[k]) for _, k, *_ in DATA_COLS[1:]]
                for d, row in new.iterrows()]
        ws.range(f'A{lr + 1}').value = vals
    book.save()
    print('saved via Excel. Extend Clean/History formulas manually if fewer than 20 spare rows remain.')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    path = args[0] if args else 'output/RiskRegimeMonitor.xlsx'
    (run_xlwings if '--xlwings' in sys.argv else run_openpyxl)(path)
