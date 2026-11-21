import re, openpyxl, sys
REF = re.compile(r"(?:(?:'[^']+'|[A-Za-z_][A-Za-z0-9_ ]*)!)?(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3})(?![A-Za-z0-9_(])")
def strip_strings(f):
    return re.sub(r'"[^"]*"', '""', f)
def cost_formula(f, filled=True):
    g = strip_strings(f)
    singles = ranges = 0
    for m in REF.finditer(g):
        tok = m.group(1)
        if ':' in tok: ranges += 1
        else: singles += 1
    c = len(f.encode('utf-8')) + 52*singles + 144*ranges
    if not filled: c += 112*(singles+ranges)
    return c, singles, ranges
def cost_wb(path, filled=True, verbose=True):
    wb = openpyxl.load_workbook(path)
    total = 0; n = 0; first_fail = None
    per = {}
    for ws in wb:
        s = 0
        for row in ws.iter_rows():
            for c in row:
                v = c.value
                if v is None: continue
                n += 1
                if isinstance(v, str) and v.startswith('='):
                    cc = cost_formula(v, filled)[0]
                elif isinstance(v, str):
                    cc = len(v.encode('utf-8'))
                else:
                    cc = 8
                s += cc; total += cc
                if first_fail is None and total > 33554432: first_fail = n
        per[ws.title] = s
    if verbose:
        for k, v in per.items(): print(f'{k:12s} {v/1e6:8.2f} MB')
        print('TOTAL', round(total/1e6,2), 'MB; cells', n, 'first cell over 32MiB:', first_fail)
    return total
if __name__ == '__main__':
    for filled in (True, False):
        print('filled=', filled); cost_wb(sys.argv[1], filled)
