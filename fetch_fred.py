"""Download/refresh every FRED series used by the model into data/fred/*.csv."""
import os, sys, time, urllib.request
from spec import DATA_COLS, FRED_DIR

START = '2021-01-01'
IDS = sorted({fid for _, _, fid, _, _ in DATA_COLS if fid})

def fetch(fid):
    url = f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={fid}&cosd={START}'
    out = os.path.join(FRED_DIR, ('x_' if fid == 'DCPF3M' else '') + f'{fid}.csv')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                body = r.read()
            if not body.startswith(b'observation_date'):
                raise ValueError('unexpected response (not CSV)')
            open(out, 'wb').write(body)
            last = body.decode().strip().splitlines()[-1]
            print(f'{fid:16s} ok   last={last}')
            return True
        except Exception as e:
            print(f'{fid:16s} retry {attempt + 1}: {e}')
            time.sleep(3)
    return False

if __name__ == '__main__':
    os.makedirs(FRED_DIR, exist_ok=True)
    bad = [f for f in IDS if not fetch(f)]
    # ECB daily FX fills the days FRED's weekly H.10 release has not covered yet (non-fatal)
    import fetch_ecb
    if not fetch_ecb.fetch():
        print('ECB fetch failed: recent FX stays blank until FRED publishes')
    if bad:
        print('FAILED:', bad); sys.exit(1)
