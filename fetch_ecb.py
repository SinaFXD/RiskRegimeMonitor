"""Download ECB daily reference rates (foreign currency per EUR) into data/ecb/ECB_EXR.csv.

FRED's H.10 FX series (DEX*, DTWEXBGS) are published weekly, so the last ~5-8 business days
are missing. spec.load_data() fills only those days (after FRED's last observation) by chaining
ECB day-to-day changes onto FRED's last value; once FRED publishes, its official values win.
"""
import io, os, sys, time, urllib.request
import pandas as pd
from spec import ECB_DIR, ECB_FILE, ECB_CCYS

START = '2021-01-01'

def fetch():
    url = ('https://data-api.ecb.europa.eu/service/data/EXR/D.' + '+'.join(ECB_CCYS)
           + f'.EUR.SP00.A?startPeriod={START}&format=csvdata')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                body = r.read()
            d = pd.read_csv(io.BytesIO(body), usecols=['TIME_PERIOD', 'CURRENCY', 'OBS_VALUE'])
            w = d.pivot(index='TIME_PERIOD', columns='CURRENCY', values='OBS_VALUE').sort_index()
            w.index.name = 'date'
            os.makedirs(ECB_DIR, exist_ok=True)
            w.to_csv(ECB_FILE)
            missing = sorted(set(ECB_CCYS) - set(w.columns))
            print(f'{"ECB EXR":16s} ok   last={w.index[-1]}  ccys={w.shape[1]}'
                  + (f'  missing={missing}' if missing else ''))
            return True
        except Exception as e:
            print(f'{"ECB EXR":16s} retry {attempt + 1}: {e}')
            time.sleep(3)
    return False

if __name__ == '__main__':
    sys.exit(0 if fetch() else 1)
