"""Append new daily data to YOUR formatted Excel template without touching its design.

    python fetch_fred.py
    python update_template.py template/Risk_Regime_Monitor.xlsx

How it works: the .xlsx is edited at XML level. Only the <row> elements of the Data sheet
for the new dates are written; every other part of the file (styles, charts, conditional
formats, named ranges, hidden helper sheets, column widths) is copied byte-for-byte.
Excel is told to fully recalculate on open (fullCalcOnLoad), so the Dashboard refreshes.
The last REVISE existing rows are also refreshed (FRED/ECB-fed columns only; MOVE / Custom 1 untouched),
so FX estimated from ECB is replaced by FRED's weekly H.10 values once they are published.

Formula rows in Clean / History_ / ChartHelpers are pre-built to a fixed row (1184 in the
current template). When fewer than WARN_SPARE rows remain, the script warns: open Excel and
drag the last formula row down (or run with --extend 250 if xlwings + Excel are installed).
"""
import sys, re, shutil, zipfile, datetime as dt
import pandas as pd
from spec import DATA_COLS, ECB_PAIRS, load_data, HDR

WARN_SPARE = 20
REVISE = 15      # last N existing rows are re-written from the sources (FRED's weekly FX replaces ECB estimates)
SRC = {k for _, k, _, fid, *_ in DATA_COLS if fid}        # columns fed by FRED / ECB (manual columns untouched)
ECB_KEYS = set(ECB_PAIRS) | {'USD_BROAD'}
NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

def col_letter(i):
    s = ''
    while i:
        i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s

def sheet_path(z, name):
    wb = z.read('xl/workbook.xml').decode('utf-8')
    rid = re.search(r'<sheet [^>]*name="%s"[^>]*r:id="([^"]+)"' % re.escape(name), wb).group(1)
    rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
    target = re.search(r'<Relationship [^>]*Id="%s"[^>]*Target="([^"]+)"' % rid, rels)
    if not target:
        target = re.search(r'<Relationship [^>]*Target="([^"]+)"[^>]*Id="%s"' % rid, rels)
    t = target.group(1).lstrip('/')
    return t if t.startswith('xl/') else 'xl/' + t

def excel_serial(d):
    return (pd.Timestamp(d) - pd.Timestamp('1899-12-30')).days

def last_formula_row(xml):
    rows = [int(m) for m in re.findall(r'<c r="A(\d+)"[^>]*>(?:(?!</c>).)*<f', xml, re.S)]
    return max(rows) if rows else 0

def col_num(l):
    n = 0
    for ch in l:
        n = n * 26 + ord(ch) - 64
    return n

def num_cell(l, r, s, v):
    sa = f' s="{s}"' if s else ''
    return f'<c r="{l}{r}"{sa}><v>{repr(float(v))}</v></c>' if pd.notna(v) else f'<c r="{l}{r}"{sa}/>'

def revise_rows(xml, rows, data, styles):
    """Re-write source-fed cells of existing rows whose values changed (e.g. ECB estimate -> FRED).
    Blank source values clear a cell only for ECB-filled columns; other cells are kept."""
    n = 0
    for r, serial in rows:
        d = pd.Timestamp('1899-12-30') + pd.Timedelta(days=int(serial))
        if d not in data.index:
            continue
        rec = data.loc[d]
        m = re.search(r'(<row r="%d"[^>]*>)(.*?)</row>' % r, xml, re.S)
        cells = {l: c for c, l in re.findall(r'(<c r="([A-Z]+)%d"[^>]*?(?:/>|>.*?</c>))' % r, m.group(2), re.S)}
        changed = 0
        for l, k, *_ in DATA_COLS:
            if k not in SRC:
                continue
            v, old = rec[k], cells.get(l, '')
            ov = re.search(r'<v>([^<]*)</v>', old)
            ov = float(ov.group(1)) if ov else float('nan')
            if pd.isna(v) and k not in ECB_KEYS:
                continue
            if (pd.isna(v) and pd.isna(ov)) or (pd.notna(v) and pd.notna(ov) and abs(v - ov) <= 1e-9 * max(1, abs(v))):
                continue
            s = re.search(r' s="(\d+)"', old)
            cells[l] = num_cell(l, r, s.group(1) if s else styles.get(l), v)
            changed += 1
        if changed:
            row = m.group(1) + ''.join(cells[l] for l in sorted(cells, key=col_num)) + '</row>'
            xml = xml[:m.start()] + row + xml[m.end():]
            n += changed
    return xml, n

def main(path, extend=0):
    z = zipfile.ZipFile(path)
    data_p = sheet_path(z, 'Data')
    xml = z.read(data_p).decode('utf-8')
    # last row whose column A holds a value
    rows_a = [(int(r), float(v)) for r, v in re.findall(r'<c r="A(\d+)"[^>]*><v>([^<]+)</v></c>', xml)]
    last_row, last_serial = max(rows_a)
    last_date = pd.Timestamp('1899-12-30') + pd.Timedelta(days=int(last_serial))
    data = load_data()
    new = data[data.index > last_date]
    print(f'Data sheet: last date {last_date.date()} at row {last_row}; new rows to add: {len(new)}')
    fill = data.attrs.get('ecb_fill', {})
    if fill:
        print(f'FX after FRED\'s last weekly release estimated from ECB from {min(fill.values()).date()} '
              f'({len(fill)} series); replaced automatically once FRED publishes')

    # styles of the last data row, per column (keeps your formatting)
    last_row_xml = re.search(r'<row r="%d"[^>]*>.*?</row>' % last_row, xml, re.S).group(0)
    styles = dict(re.findall(r'<c r="([A-Z]+)%d" s="(\d+)"' % last_row, last_row_xml))
    row_attrs = re.search(r'<row r="%d"([^>]*)>' % last_row, last_row_xml).group(1)

    xml, revised = revise_rows(xml, sorted(rows_a)[-REVISE:], data, styles)
    print(f'revised cells in the last {REVISE} rows: {revised}')

    for i, (d, rec) in enumerate(new.iterrows()):
        r = last_row + 1 + i
        cells = []
        for j, (l, k, *_) in enumerate(DATA_COLS):
            s = styles.get(l)
            sa = f' s="{s}"' if s else ''
            if k == 'DATE':
                cells.append(f'<c r="{l}{r}"{sa}><v>{excel_serial(d)}</v></c>')
            elif pd.notna(rec[k]):
                cells.append(f'<c r="{l}{r}"{sa}><v>{repr(float(rec[k]))}</v></c>')
            else:
                cells.append(f'<c r="{l}{r}"{sa}/>')
        new_row = f'<row r="{r}"{row_attrs}>' + ''.join(cells) + '</row>'
        pat = re.compile(r'<row r="%d"[^>]*?(?:/>|>.*?</row>)' % r, re.S)
        if pat.search(xml):
            xml = pat.sub(lambda m: new_row, xml, count=1)
        else:  # insert before the first row with a larger number (or before </sheetData>)
            nxt = [int(n) for n in re.findall(r'<row r="(\d+)"', xml) if int(n) > r]
            anchor = f'<row r="{min(nxt)}"' if nxt else '</sheetData>'
            xml = xml.replace(anchor, new_row + anchor, 1)
    new_last = last_row + len(new)

    wbxml = z.read('xl/workbook.xml').decode('utf-8')
    if 'fullCalcOnLoad' not in wbxml:
        wbxml = re.sub(r'<calcPr([^>]*?)/>', r'<calcPr\1 fullCalcOnLoad="1"/>', wbxml, count=1)

    # how many formula rows remain in History_/Clean
    spare = []
    for nm in ('Clean', 'History_', 'History'):
        try:
            p = sheet_path(z, nm)
        except AttributeError:
            continue
        lf = last_formula_row(z.read(p).decode('utf-8'))
        spare.append((nm, lf, lf - new_last))

    if len(new) or revised:
        backup = path.replace('.xlsx', f'.backup-{dt.datetime.now():%Y%m%d-%H%M}.xlsx')
        shutil.copy(path, backup)
        tmp = path + '.tmp'
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
            for item in z.infolist():
                if item.filename == data_p:
                    out.writestr(item, xml.encode('utf-8'))
                elif item.filename == 'xl/workbook.xml':
                    out.writestr(item, wbxml.encode('utf-8'))
                else:
                    out.writestr(item, z.read(item.filename))
        z.close()
        shutil.move(tmp, path)
        print(f'saved {path} (backup: {backup})')
    else:
        z.close()
        print('nothing to change')

    for nm, lf, sp in spare:
        flag = '  <-- extend soon!' if sp < WARN_SPARE else ''
        print(f'{nm}: formulas to row {lf}, spare rows {sp}{flag}')
    if extend:
        extend_with_excel(path, extend)

def extend_with_excel(path, n):
    """Copy the last formula row down n rows using Excel itself (keeps shared formulas/styles)."""
    import xlwings as xw
    app = xw.App(visible=False)
    try:
        book = app.books.open(path)
        for nm in ('Clean', 'History_', 'ChartHelpers'):
            if nm not in [s.name for s in book.sheets]:
                continue
            sh = book.sheets[nm]
            last = sh.range('A' + str(sh.cells.last_cell.row)).end('up').row
            last_col = sh.used_range.last_cell.column
            src = sh.range((last, 1), (last, last_col))
            src.api.AutoFill(sh.range((last, 1), (last + n, last_col)).api, 0)
            print(f'{nm}: extended {last} -> {last + n}')
        # widen the chart driver name if present
        for name in book.names:
            if name.name == 'RRM_Rows':
                name.refers_to = name.refers_to.replace('$A$1184', f'$A${1184 + n}')
        book.save()
    finally:
        app.quit()

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ext = int(sys.argv[sys.argv.index('--extend') + 1]) if '--extend' in sys.argv else 0
    if ext:
        args = [a for a in args if a != str(ext)]
    main(args[0] if args else 'template/Risk_Regime_Monitor.xlsx', ext)
