# Risk Regime Monitor

مانیتور رژیم Risk-On / Risk-Off با تمرکز بر بازار FX — به‌روزرسانی خودکار روزانه.

**سایت:** https://sinafxd.github.io/RiskRegimeMonitor/

## چه می‌کند؟

14 شاخص بازار در 5 Category (Volatility، Credit، FX، Equities & Growth، Funding & USD) با Rolling z-score
252 روزه ترکیب می‌شوند و Risk Appetite Index (RAI) را می‌سازند. RAI با EMA هموار می‌شود و رژیم بازار
(Strong Risk-On تا Strong Risk-Off) پس از Confirmation تعیین می‌شود. 11 Regime type (مثل Credit Stress،
Carry Unwind، Inflation Shock) توضیح می‌دهند Risk-Off یا Risk-On از چه نوعی است و کدام Safe haven کار می‌کند.

یک Guardrail مطلق هم مستقل از z-score کار می‌کند: اگر VIX ≥ 30 یا HY OAS ≥ 5% باشد Alert فعال می‌شود، چون z-score
نسبی است و در یک بحران طولانی کم‌کم «عادی» نشان می‌دهد.

بخش‌های سایت: نمای کلی، تاریخچه و آمار رژیم‌ها، FX Board، شاخص‌ها، Playbook، Model Lab (تغییر پارامترها و
محاسبه دوباره مدل در مرورگر) و روش‌شناسی.

## به‌روزرسانی

GitHub Actions هر روز کاری پس از بسته شدن بازار آمریکا اجرا می‌شود (`.github/workflows/update.yml`):

1. `fetch_fred.py` داده‌ها را از FRED و نرخ‌های روزانه FX را از ECB می‌گیرد (FX در FRED هفتگی منتشر می‌شود؛
   روزهای جاافتاده با ECB تخمین زده می‌شوند).
2. `export_site.py` مدل را اجرا می‌کند و `site/data/latest.json` را می‌سازد.
3. پوشه `site/` روی GitHub Pages منتشر می‌شود.

## اجرای محلی

```bash
pip install -r requirements.txt
python fetch_fred.py
python export_site.py
python -m http.server 8765 --directory site
```

## فایل‌ها

| فایل | کار |
|---|---|
| `spec.py` | تعریف داده‌ها، شاخص‌ها، Categoryها و پارامترها |
| `playbook.py` | 11 Regime type و FX universe |
| `reference2.py` | پیاده‌سازی مدل با pandas |
| `export_site.py` | محاسبه کامل و خروجی JSON برای سایت |
| `fetch_fred.py`, `fetch_ecb.py` | دریافت داده |
| `site/` | وب‌سایت (HTML + JS + CSS، بدون Build step) |

منابع داده: FRED (St. Louis Fed)، ECB، ICE BofA، CBOE. داده‌های ICE BofA فقط به‌صورت z-score نمایش داده می‌شوند.
این ابزار آموزشی و تحلیلی است و توصیه سرمایه‌گذاری نیست.

سازنده: [@SinaFXD](https://t.me/SinaFXD)
