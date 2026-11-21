'use strict';
/* Risk Regime Monitor — web dashboard. Data: data/latest.json (export_site.py). Bilingual: Persian (RTL) / English (LTR). */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MIN = '−';
const f2 = (v, d = 2) => v == null ? '—' : (v < 0 ? MIN : '') + Math.abs(v).toFixed(d);
const sg = (v, d = 2) => v == null ? '—' : (v > 0 ? '+' : v < 0 ? MIN : '') + Math.abs(v).toFixed(d);
const pc = (v, d = 1, sign = true) => v == null ? '—' : (sign ? (v > 0 ? '+' : v < 0 ? MIN : '') : (v < 0 ? MIN : '')) + Math.abs(v * 100).toFixed(d) + '%';
const N = s => `<span class="n">${s}</span>`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TG = '<a class="tg" href="https://t.me/SinaFXD" target="_blank" rel="noopener">@SinaFXD</a>';
const GH = 'https://github.com/SinaFXD/RiskRegimeMonitor';
const rgba = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- language ---------------- */
// The first visit asks for a language (picker); the choice is kept in localStorage and can be changed with the header flags.
let LANG = (() => { try { return localStorage.getItem('rrm-lang'); } catch (e) { return null; } })();
const ASKED = LANG === 'fa' || LANG === 'en';
if (!ASKED) LANG = /^fa\b/i.test(navigator.language || '') ? 'fa' : 'en';
const EN = () => LANG === 'en';
const L = (fa, en) => LANG === 'en' ? en : fa;                                  // pick the string for the current language
const dx = (o, k) => (LANG === 'en' && o[k + '_en'] != null) ? o[k + '_en'] : o[k];  // data field with an optional *_en twin
const jalali = d => { if (EN()) return ''; try { return ' · ' + new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00Z')); } catch (e) { return ''; } };
const FONT_FA = 'Vazirmatn, system-ui, -apple-system, Segoe UI, sans-serif';
const FONT_EN = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
let FONT = EN() ? FONT_EN : FONT_FA;

let flagN = 0;
function flag(code) {
  if (code === 'fa') return '<svg class="flag" viewBox="0 0 30 18" aria-hidden="true"><rect width="30" height="6" fill="#239f40"/><rect y="6" width="30" height="6" fill="#fff"/><rect y="12" width="30" height="6" fill="#da0000"/></svg>';
  const id = 'uk' + (++flagN);
  return `<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="${id}a"><path d="M0,0v30h60V0z"/></clipPath><clipPath id="${id}b"><path d="M30,15h30v15zv15H0zH0V0zV0h30z"/></clipPath>
    <g clip-path="url(#${id}a)"><path d="M0,0v30h60V0z" fill="#012169"/><path d="M0,0 60,30M60,0 0,30" stroke="#fff" stroke-width="6"/>
    <path d="M0,0 60,30M60,0 0,30" clip-path="url(#${id}b)" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>
    <path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></svg>`;
}

const REG = {
  'Strong Risk-On': { k: 'SON', fa: 'Strong Risk-On', n: 2 },
  'Risk-On': { k: 'ON', fa: 'Risk-On', n: 1 },
  'Neutral': { k: 'NEU', fa: 'Neutral', n: 0 },
  'Risk-Off': { k: 'OFF', fa: 'Risk-Off', n: -1 },
  'Strong Risk-Off': { k: 'SOFF', fa: 'Strong Risk-Off', n: -2 },
};
const BYN = { 2: 'Strong Risk-On', 1: 'Risk-On', 0: 'Neutral', '-1': 'Risk-Off', '-2': 'Strong Risk-Off' };
const SIG = { SON: 'Strong On', ON: 'On', NEU: 'Neutral', OFF: 'Off', SOFF: 'Strong Off' };
const SIGA = { SON: '▲▲', ON: '▲', NEU: '●', OFF: '▼', SOFF: '▼▼' };
const regCol = k => css('--' + k.toLowerCase());
const chipSig = s => s ? `<span class="chip reg rc-${s}"><i></i>${SIGA[s]} ${SIG[s]}</span>` : '<span class="muted">—</span>';
const chipReg = r => { const g = REG[r]; return g ? `<span class="chip reg rc-${g.k}"><i></i>${g.fa}</span>` : '—'; };
const COND = {
  Y10: '10Y yield', Y2: '2Y yield', BE: 'Breakeven', RY: 'Real yield', OIL: 'WTI', JPY: 'USDJPY', USD: 'USD',
  SBC: 'Stock–bond corr', FUND: 'Funding', EMFX: 'EM FX', CREDIT: 'Credit', AUDJPY: 'AUDJPY', VOL: 'Volatility',
  EURCHF: 'EURCHF', EQ: 'S&P momentum', FX: 'FX', HY: 'HY spread', IG: 'IG spread', 'CRED-VOL': 'Credit − Vol', AVGC: 'Avg correlation',
  '|Y10|': '|10Y yield|', '|BE|': '|Breakeven|', 'Y10|RY': '10Y or Real yield',
};
const CATCOL = { VOL: '--s1', CREDIT: '--s2', FX: '--s3', EQ: '--s4', FUND: '--s5' };
const FAM = { 'Risk-Off': 'Risk-Off family', 'Risk-On': 'Risk-On family' };
const GRP = { 'High-beta G10': 'High-beta G10', 'Low-beta G10': 'Low-beta G10', 'Haven': 'Safe haven', 'EM carry': 'EM carry', 'EM Asia': 'EM Asia' };
const FIT = () => ({
  ok: ['good', L('طبق انتظار', 'As expected')], 'haven-fail': ['warn', L('Safe haven کار نمی‌کند', 'Safe haven not working')],
  resilient: ['warn', L('مقاوم (Resilient)', 'Resilient')], lagging: ['warn', L('عقب‌مانده (Lagging)', 'Lagging')],
  'haven-bid': ['warn', L('تقاضای Safe haven', 'Safe-haven bid')], mixed: ['off', 'Mixed'],
});
const EXP = () => ({ '↓': L('↓ ضعیف می‌شود', '↓ Weakens'), '↑': L('↑ قوی می‌شود', '↑ Strengthens'), '≈': '≈ Mixed' });

const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5L1.5 21h21L12 2.5zm0 6.2c.6 0 1 .4 1 1v4.8c0 .6-.4 1-1 1s-1-.4-1-1V9.7c0-.6.4-1 1-1zm0 9.6a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="M8 5L4 9l4 4"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
};

let D = null;
const charts = new Set();
const rendered = {};
const state = { range: '1Y', mkt: 'SPX' };

/* ---------------- tooltips for HTML elements ---------------- */
const tip = $('#tip');
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.classList.remove('show'); return; }
  tip.innerHTML = t.dataset.tip; isolateLatin(tip); tip.classList.add('show');
});

/* English phrases inside the RTL page ("High-beta EM (AUD, NZD, ZAR)", "20-day return"): wrap each Latin run in
   an LTR isolate so its words, digits, commas and parentheses keep their order inside right-to-left lines.
   Not needed (and skipped) when the page itself is English / LTR. */
const LATIN_RUN = /[A-Za-z0-9Δ−–—.,\/&+\-'’()%:<>=×÷±|_ ]*[A-Za-z][A-Za-z0-9Δ−–—.,\/&+\-'’()%:<>=×÷±|_ ]*/g;
const SKIP = '.n,.num,.en,.en-i,svg,canvas,.chart,script,style,code,select,option,[dir="ltr"]';
function trimRun(r) {
  let pre = '', post = '';
  // move edge spaces/punctuation and unpaired brackets outside the run (they belong to the Persian sentence)
  for (let guard = 0; guard < 8; guard++) {
    const lead = r.match(/^[\s.,:–—]+/); if (lead) { pre += lead[0]; r = r.slice(lead[0].length); }
    const tail = r.match(/[\s.,:–—]+$/); if (tail) { post = tail[0] + post; r = r.slice(0, -tail[0].length); }
    const open = (r.match(/\(/g) || []).length, close = (r.match(/\)/g) || []).length;
    if (open > close && r.endsWith('(')) { post = '(' + post; r = r.slice(0, -1); continue; }
    if (open > close && r.startsWith('(')) { pre += '('; r = r.slice(1); continue; }
    if (close > open && r.endsWith(')')) { post = ')' + post; r = r.slice(0, -1); continue; }
    if (close > open && r.startsWith(')')) { pre += ')'; r = r.slice(1); continue; }
    break;
  }
  return [pre, r, post];
}
function isolateLatin(root) {
  if (EN()) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => !n.parentElement || n.parentElement.closest(SKIP) || !/[A-Za-z]/.test(n.data)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment(); let last = 0;
    n.data.replace(LATIN_RUN, (m, off) => {
      const [pre, core, post] = trimRun(m);
      if (!core.trim()) return m;
      frag.append(n.data.slice(last, off) + pre);
      const sp = document.createElement('span'); sp.className = core.length <= 24 ? 'en-i nw' : 'en-i'; sp.textContent = core; frag.append(sp);
      last = off + m.length - post.length;
      return m;
    });
    if (last === 0) continue;
    frag.append(n.data.slice(last));
    n.replaceWith(frag);
  }
}
document.addEventListener('mousemove', e => {
  if (!tip.classList.contains('show')) return;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
});

/* ---------------- echarts helpers ---------------- */
function mk(el) { const c = echarts.init(el, null, { renderer: 'canvas' }); charts.add(c); return c; }
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => charts.forEach(c => c.resize()), 120); });
function T() {
  return {
    ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), grid: css('--grid'), axis: css('--axis'),
    surface: css('--surface'), surface2: css('--surface-2'), surface3: css('--surface-3'), border: css('--border-2'),
    son: css('--son'), on: css('--on'), neu: css('--neu'), off: css('--off'), soff: css('--soff'),
    dark: document.documentElement.dataset.theme === 'dark',
  };
}
function baseTooltip(t) {
  return {
    trigger: 'axis', backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: [8, 12],
    textStyle: { color: t.ink, fontFamily: FONT, fontSize: 12 }, extraCssText: 'border-radius:10px;box-shadow:0 10px 30px -10px rgba(0,0,0,.45);',
    axisPointer: { type: 'line', lineStyle: { color: t.muted, width: 1, type: 'dashed' } }, confine: true,
  };
}
const timeAxis = (t, extra = {}) => ({
  type: 'time', axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
  axisLabel: { color: t.muted, fontFamily: FONT, fontSize: 11, hideOverlap: true }, splitLine: { show: false }, ...extra,
});
const valAxis = (t, extra = {}) => ({
  type: 'value', axisLabel: { color: t.muted, fontFamily: FONT, fontSize: 11, formatter: v => f2(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) },
  splitLine: { lineStyle: { color: t.grid } }, axisLine: { show: false }, ...extra,
});
function regBands(dates, regs, alpha, t) {
  const out = []; let s = 0; const n = regs.length;
  for (let i = 1; i <= n; i++) {
    if (i === n || regs[i] !== regs[s]) {
      if (regs[s] != null) {
        const k = REG[BYN[regs[s]]].k.toLowerCase();
        out.push([{ xAxis: dates[s], itemStyle: { color: rgba(t[k], alpha) } }, { xAxis: dates[Math.min(i, n - 1)] }]);
      }
      s = i;
    }
  }
  return out;
}
function rangeStart(dates, r) {
  const last = new Date(dates[dates.length - 1]);
  const m = { '3M': 3, '6M': 6, '1Y': 12, '2Y': 24 }[r];
  if (!m) return dates[0];
  const d = new Date(last); d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
}
const segHTML = (id, opts, cur) => `<div class="seg" id="${id}">${opts.map(o => `<button data-v="${o}" class="${o === cur ? 'on' : ''}">${o === 'All' ? L('همه', 'All') : o}</button>`).join('')}</div>`;
function bindSeg(id, fn) {
  const el = $('#' + id);
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', el).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v);
  });
}

/* ---------------- small visual helpers ---------------- */
function spark(vals, { band = 1.5, lo = -3, hi = 3, color, h = 54, zero = true, w = 300 } = {}) {
  const v = vals.map(x => x == null ? null : clamp(x, lo, hi));
  const y = x => h - 3 - (x - lo) / (hi - lo) * (h - 6);
  const n = v.length; let d = '', pen = false;
  v.forEach((x, i) => { if (x == null) { pen = false; return; } d += (pen ? 'L' : 'M') + (i / (n - 1) * w).toFixed(1) + ' ' + y(x).toFixed(1); pen = true; });
  const lastI = v.map((x, i) => x == null ? -1 : i).filter(i => i >= 0).pop();
  const c = color || css('--ink');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    ${band ? `<rect x="0" y="${y(band)}" width="${w}" height="${y(-band) - y(band)}" fill="${css('--surface-2')}"/>` : ''}
    ${zero ? `<line x1="0" x2="${w}" y1="${y(0)}" y2="${y(0)}" stroke="${css('--axis')}" stroke-width="1" vector-effect="non-scaling-stroke"/>` : ''}
    <path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    ${lastI != null ? `<circle cx="${lastI / (n - 1) * w}" cy="${y(v[lastI])}" r="3" fill="${c}" vector-effect="non-scaling-stroke"/>` : ''}
  </svg>`;
}
function dbars(rows, { lim = 3, fmt = v => f2(v), sub, ref } = {}) {
  const t = T();
  return `<div class="dbars">${rows.map(r => {
    const v = r.v, w = v == null ? 0 : Math.min(Math.abs(v), lim) / lim * 50;
    const col = r.color || (v >= 0 ? t.son : t.soff);
    const refs = (ref || []).map(x => `<span class="ref" style="left:${50 + clamp(x, -lim, lim) / lim * 50}%"></span>`).join('');
    return `<div class="dbar" ${r.tip ? `data-tip="${esc(r.tip)}"` : ''}>
      <div class="nm">${r.name}${r.small ? `<small>${r.small}</small>` : ''}</div>
      <div class="trk">${refs}<b class="${v >= 0 ? 'pos' : 'neg'}" style="width:${w}%;background:${col}"></b></div>
      <div class="val num">${fmt(v)}${sub ? `<small>${sub(r)}</small>` : ''}</div></div>`;
  }).join('')}</div>`;
}
const heatBg = (v, cap = 0.05) => {
  if (v == null) return '';
  const a = Math.round(clamp(Math.abs(v) / cap, 0, 1) * 42 + 6);
  return `background:color-mix(in srgb, var(${v >= 0 ? '--son' : '--soff'}) ${a}%, transparent)`;
};
const stIcon = (kind, label) => `<span class="st ${kind}">${kind === 'good' ? IC.check : kind === 'off' ? IC.dash : IC.warn}${label}</span>`;

/* absolute-level guardrail: z-scores are relative, these levels are not */
function guardBanner(gd) {
  if (!gd || !gd.on) return '';
  const G = D.meta.guard;
  const why = [gd.vix && `VIX ${f2(gd.vix_v, 1)} ≥ ${G.VIX}`, gd.hy && `HY OAS ≥ ${G.HY}%`].filter(Boolean).join(' · ');
  const msg = gd.conflict
    ? L('سطح مطلق استرس بالاست ولی مدل نسبی رژیم را Risk-Off نمی‌بیند؛ رژیم ممکن است استرس را کمتر از واقع نشان دهد.', 'Absolute stress is high, but the relative model does not read Risk-Off; the regime may be understating stress.')
    : L('سطح مطلق استرس هم رژیم Risk-Off را تأیید می‌کند.', 'Absolute stress levels confirm the Risk-Off regime.');
  return `<div class="guard ${gd.conflict ? 'hot' : ''}" data-tip="${L('Guardrail مستقل از z-score است', 'The guardrail does not depend on z-scores')}">
    <span class="ic">${IC.warn}</span><div><b>Guardrail · <span class="num" dir="ltr">${why}</span></b><span>${msg}</span></div></div>`;
}

/* ================= OVERVIEW ================= */
function renderOverview(el) {
  const k = D.kpi, g = REG[k.regime], t = T();
  const rp = D.regimes.find(r => r.reg === k.regime) || {};
  const prim = D.types.find(x => x.code === D.primary), sec = D.types.find(x => x.code === D.secondary);
  const thr = D.meta.thr, lo = -2.5, hi = 2.5, pos = v => (clamp(v, lo, hi) - lo) / (hi - lo) * 100;
  const zones = [['SOFF', lo, thr.TSOFF], ['OFF', thr.TSOFF, thr.TOFF], ['NEU', thr.TOFF, thr.TON], ['ON', thr.TON, thr.TSON], ['SON', thr.TSON, hi]];
  const prev = k.ema - k.d5;
  const onAlerts = D.alerts.filter(a => a.on);
  el.innerHTML = `
  <div class="grid fade-in">
    <div class="card hero c5 rc-${g.k}">
      <div class="eyebrow"><span class="live"></span>${L('رژیم تأییدشده', 'Confirmed regime')} · ${N(k.date)}${jalali(k.date)}</div>
      <div class="regime-name">${g.fa}</div>
      <div class="regime-en">Raw signal: ${k.raw || '—'} · ${L(`${k.streak} روز پیاپی`, `${k.streak} days in a row`)}</div>
      ${guardBanner(k.guard)}
      <div class="scale" aria-label="${L('موقعیت RAI روی مقیاس رژیم', 'RAI position on the regime scale')}">
        <div class="scale-track">
          ${zones.map(([z, a, b]) => `<span class="z" style="width:${(b - a) / (hi - lo) * 100}%;background:var(--${z.toLowerCase()})" data-tip="${REG[BYN[{ SOFF: -2, OFF: -1, NEU: 0, ON: 1, SON: 2 }[z]]].fa}: ${f2(a)} ${L('تا', 'to')} ${f2(b)}"></span>`).join('')}
          <span class="scale-arrow" style="left:${Math.min(pos(prev), pos(k.ema))}%;width:${Math.abs(pos(prev) - pos(k.ema))}%"></span>
          <span class="scale-ghost" style="left:${pos(prev)}%" data-tip="${L('۵ روز پیش', '5 days ago')}: ${f2(prev)}"></span>
          <span class="scale-mark" style="left:${pos(k.ema)}%" data-tip="${L('RAI (EMA) امروز', 'RAI (EMA) today')}: ${f2(k.ema)}"></span>
        </div>
        <div class="scale-ticks">
          ${[[thr.TSOFF, ''], [thr.TOFF, 't-mid'], [0, ''], [thr.TON, 't-mid'], [thr.TSON, '']].map(([v, cl]) => `<span class="${cl}" style="left:${pos(v)}%">${f2(v, 2).replace(/\.?0+$/, '') || '0'}</span>`).join('')}
        </div>
        <div class="flex" style="justify-content:space-between;direction:ltr;font-size:11.5px">
          <span style="color:var(--soff-t)">← Risk-Off</span><span style="color:var(--son-t)">Risk-On →</span></div>
      </div>
      <p class="posture">${dx(rp, 'post') || ''}</p>
      <div class="budget">
        <span class="muted" style="font-size:12.5px">${L('Risk budget پیشنهادی', 'Suggested risk budget')}</span>
        <div class="budget-bar"><i style="width:${(rp.budget || 0) * 100}%"></i></div>
        <b class="num">${Math.round((rp.budget || 0) * 100)}%</b>
      </div>
    </div>
    <div class="c7"><div class="kpis">
      ${kpiTile('RAI (EMA)', N(f2(k.ema)), `<span class="delta ${k.d5 >= 0 ? 'up' : 'dn'}">${k.d5 >= 0 ? '▲' : '▼'} ${sg(k.d5)}</span> ${L('در ۵ روز', 'over 5 days')}`, null, L('Risk Appetite Index، هموارشده با EMA ۵ روزه', 'Risk Appetite Index, smoothed with a 5-day EMA'))}
      ${kpiTile(L('Percentile تاریخی', 'Historical percentile'), N(Math.round(k.pct * 100) + '%'), L(`پایین‌تر از ${N(Math.round((1 - k.pct) * 100) + '%')} روزهای ثبت‌شده`, `Below ${N(Math.round((1 - k.pct) * 100) + '%')} of recorded days`), k.pct, L('جایگاه RAI امروز در کل تاریخچه مدل', "Where today's RAI sits in the model's full history"))}
      ${kpiTile(L('روز در رژیم', 'Days in regime'), N(k.days) + ` <small>${L('روز', 'days')}</small>`, L(`سیگنال خام: ${N(k.streak)} روز پیاپی`, `Raw signal: ${N(k.streak)} days in a row`), null, L('تعداد روزهایی که رژیم تأییدشده فعلی برقرار است', 'How many days the current confirmed regime has lasted'))}
      ${kpiTile('Breadth', N(Math.round(k.breadth * 100) + '%'), L('شاخص‌های با z مثبت', 'Indicators with positive z'), k.breadth, L('درصد شاخص‌هایی که سیگنال Risk-On دارند', 'Share of indicators signalling Risk-On'))}
      ${kpiTile('Raw RAI', N(f2(k.rai)), L('بدون هموارسازی', 'Unsmoothed'), null, L('میانگین وزنی امروز Categoryها، پیش از EMA', "Today's weighted mean of the categories, before the EMA"))}
      ${kpiTile(L('نوع اصلی رژیم', 'Primary regime type'), `<span style="font-size:20px">${prim.en}</span>`, `${N(prim.met + '/5')} ${L('شرط', 'conditions')} · Strength ${N(Math.round(prim.str * 100) + '%')}`, null, dx(prim, 'sig'))}
    </div></div>

    <div class="card c12">
      <div class="card-h">
        <div><h3>Risk Appetite Index (RAI)</h3><div class="sub">${L(`خط پررنگ: EMA ${D.meta.span} روزه · خط کم‌رنگ: Raw RAI · رنگ پس‌زمینه: رژیم تأییدشده`, `Bold line: ${D.meta.span}-day EMA · faint line: Raw RAI · background colour: confirmed regime`)}</div></div>
        ${segHTML('raiRange', ['3M', '6M', '1Y', '2Y', 'All'], state.range)}
      </div>
      <div class="chart tall" id="raiChart"></div>
      <div class="legend" style="margin-top:6px">${Object.entries(REG).reverse().map(([r, g2]) => `<span><i style="background:var(--${g2.k.toLowerCase()})"></i>${g2.fa}</span>`).join('')}</div>
    </div>

    <div class="card c7 rc-${g.k}">
      <div class="card-h"><div><h3>${L(`چرا ${g.fa}؟ — تشخیص نوع رژیم`, `Why ${g.fa}? — regime type diagnosis`)}</h3><div class="sub">${L('۱۱ الگو، هر کدام ۵ شرط روی z-score تغییرات ۲۰ روزه', '11 patterns, each with 5 conditions on the z-score of 20-day changes')}</div></div>
        ${sec ? `<span class="chip ghost">${L('نوع دوم', 'Secondary')}: ${sec.en} · ${N(sec.met + '/5')}</span>` : ''}</div>
      ${typeBlock(prim, true)}
      <div style="margin-top:18px;padding-top:14px;border-top:1px dashed var(--border-2)">
        <div class="muted" style="font-size:12.5px;margin-bottom:8px">${L('رتبه‌بندی همه الگوها امروز', "Today's ranking of all patterns")}</div>
        ${[...D.types].sort((a, b) => (b.met + .99 * b.str) - (a.met + .99 * a.str)).map(x => `
          <div class="flex" style="gap:10px;padding:3px 0;font-size:13px" data-tip="${esc(x.en)} · ${x.met}/5 · Strength ${Math.round(x.str * 100)}%">
            <span style="width:190px;flex:none;${x.code === prim.code ? 'font-weight:700' : 'color:var(--ink-2)'}">${x.en}</span>
            <div class="strength" style="flex:1"><i style="width:${(x.met + .99 * x.str) / 5.99 * 100}%;background:${x.fam === 'Risk-Off' ? 'var(--soff)' : 'var(--son)'};opacity:${x.code === prim.code ? 1 : .55}"></i></div>
            <b class="num" style="width:30px;text-align:end">${x.met}/5</b></div>`).join('')}
      </div>
    </div>
    <div class="card c5">
      <div class="card-h"><div><h3>${L('هشدارها و واگرایی‌ها', 'Alerts & divergences')}</h3><div class="sub">${L(`${D.alerts.length} قاعده · فعال‌ها در بالا`, `${D.alerts.length} rules · active ones first`)}</div></div>
        <span class="count-badge">${N(onAlerts.length)} ${L('فعال', 'active')}</span></div>
      <div class="alerts">${[...onAlerts, ...D.alerts.filter(a => !a.on)].map(a => `
        <div class="alert ${a.on ? 'on' : 'off'}"><span class="ic">${a.on ? IC.warn : IC.check}</span>
          <div><div class="t">${dx(a, 't')}</div><div class="thr">${L('آستانه', 'Threshold')}: ${dx(a, 'thr')}</div></div>
          <div class="v num">${dx(a, 'v')}</div></div>`).join('')}</div>
    </div>

    <div class="card c5">
      <div class="card-h"><div><h3>Category scores</h3><div class="sub">${L('Signed z · مثبت = Risk-On · خط‌چین: آستانه‌های Strong On / Strong Off', 'Signed z · positive = Risk-On · dashed: Strong On / Strong Off thresholds')}</div></div></div>
      ${dbars(D.cats.map(c => ({ name: c.en, v: c.v, d5: c.d5, color: css(CATCOL[c.code]), tip: `${c.en}<br>Score: ${f2(c.v)} · Δ5: ${sg(c.d5)}<br>Weight: ${Math.round(c.w * 100)}%` })),
        { lim: 2.5, sub: r => 'Δ5 ' + sg(r.d5), ref: [thr.TSOFF, thr.TSON] })}
      <div class="dbar-axis"><span></span><div><span>${MIN}2.5</span><span>0</span><span>+2.5</span></div><span></span></div>
      <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">${D.cats.map(c => `<span class="chip ghost" style="font-weight:500">${c.en}: ${chipSig(c.sig)}</span>`).join('')}</div>
    </div>
    <div class="card c7">
      <div class="card-h"><div><h3>${L('Category scores — ۶ ماه اخیر', 'Category scores — last 6 months')}</h3><div class="sub">${L('کدام بخش بازار رهبری می‌کند؟', 'Which part of the market is leading?')}</div></div></div>
      <div class="chart" id="catChart"></div>
    </div>

    <div class="card c12">
      <div class="card-h"><div><h3>${L('نقشه شاخص‌ها', 'Indicator map')}</h3><div class="sub">${L('Signed z هر شاخص امروز، مرتب‌شده · رنگ = Category', "Each indicator's signed z today, sorted · colour = category")}</div></div>
        <a class="btn" href="#indicators">${IC.search} ${L('جزئیات شاخص‌ها', 'Indicator details')}</a></div>
      ${dbars([...D.inds].filter(i => i.z != null).sort((a, b) => b.z - a.z).map(i => ({
        name: i.name, small: i.fa, v: i.z, d5: i.d5, color: css(CATCOL[i.cat]),
        tip: `${i.name} — ${i.fa}<br>z: ${f2(i.z)} · Δ5: ${sg(i.d5)}${i.est ? `<br>⚠ ${L('شامل تخمین ECB', 'Includes ECB estimate')}` : ''}`,
      })), { lim: 3, sub: r => 'Δ5 ' + sg(r.d5), ref: [-1.5, 1.5] })}
      <div class="dbar-axis"><span></span><div><span>${MIN}3</span><span>0</span><span>+3</span></div><span></span></div>
      <div class="legend" style="margin-top:12px">${D.cats.map(c => `<span><i style="background:var(${CATCOL[c.code]})"></i>${c.en}</span>`).join('')}</div>
    </div>
  </div>`;
  bindSeg('raiRange', v => { state.range = v; zoomTo(raiChart, v); });
  const raiChart = drawRAI($('#raiChart'));
  drawCats($('#catChart'));
}
function kpiTile(l, v, d, bar, tipTxt) {
  return `<div class="kpi" ${tipTxt ? `data-tip="${esc(tipTxt)}"` : ''}><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div>
    ${bar != null ? `<div class="mini-bar"><i style="width:${bar * 100}%"></i></div>` : ''}</div>`;
}
function typeBlock(tp, big) {
  return `
    <div class="type-head">
      <div><div class="type-code">${tp.code} · ${FAM[tp.fam]}</div>
      <div class="type-name en">${tp.en}</div></div>
      <div class="score-ring" data-tip="${L(`شرط‌های برقرار: ${tp.met} از 5`, `Conditions met: ${tp.met} of 5`)} · Strength: ${Math.round(tp.str * 100)}%">
        <div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < tp.met ? 'on' : ''}"></i>`).join('')}</div>
        <b class="num" style="font-size:18px">${tp.met}/5</b>
      </div>
    </div>
    <p class="sig">${dx(tp, 'sig')}</p>
    <div class="conds">${tp.conds.map(c => `<span class="cond ${c.ok ? 'met' : ''}" data-tip="${L('مقدار فعلی', 'Current value of')} ${esc(c.k)}: ${f2(c.v)}"><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span>
      <span class="k">${COND[c.k] || c.k}</span> ${N(`${c.op === '>' ? '>' : '<'} ${f2(c.thr, c.thr % 1 ? (String(c.thr).split('.')[1].length) : 0)}`)} <span class="muted">·</span> ${N(f2(c.v))}</span>`).join('')}</div>
    ${big ? `<div class="pb">
      <div><h4 style="color:var(--son-t)">${IC.up}Long</h4><p>${dx(tp, 'long')}</p></div>
      <div><h4 style="color:var(--soff-t)">${IC.down}Short / Avoid</h4><p>${dx(tp, 'short')}</p></div>
      <div><h4>${IC.shield}${L('Risk management و Hedging', 'Risk management & hedging')}</h4><p>${dx(tp, 'hedge')}</p></div>
      <div><h4>${IC.undo}Invalidation</h4><p>${dx(tp, 'inv')}</p></div>
    </div>` : ''}`;
}
function zoomTo(ch, r) {
  const dates = D.history.dates;
  ch.dispatchAction({ type: 'dataZoom', startValue: rangeStart(dates, r), endValue: dates[dates.length - 1] });
}
function raiTooltip(params) {
  const d = params[0].value[0] ?? params[0].axisValue;
  const i = D.history.dates.indexOf(typeof d === 'string' ? d : new Date(d).toISOString().slice(0, 10));
  const reg = i >= 0 ? BYN[D.history.reg[i]] : null;
  const tp = i >= 0 && D.history.types[i] ? D.types.find(x => x.code === D.history.types[i][0]) : null;
  return `<div class="tt"><div class="d">${i >= 0 ? D.history.dates[i] : ''}</div>
    ${params.map(p => `<div class="r"><span><i style="background:${p.color}"></i>${p.seriesName}</span><b>${f2(p.value[1])}</b></div>`).join('')}
    ${reg ? `<div class="r" style="margin-top:4px"><span>${L('رژیم', 'Regime')}</span>${chipReg(reg)}</div>` : ''}
    ${tp ? `<div class="r"><span>${L('نوع اصلی', 'Primary type')}</span><b>${tp.en}</b></div>` : ''}</div>`;
}
function drawRAI(el) {
  const t = T(), H = D.history, thr = D.meta.thr, ch = mk(el);
  ch.setOption({
    textStyle: { fontFamily: FONT }, animationDuration: 600,
    grid: { left: 42, right: 18, top: 16, bottom: 70 },
    tooltip: { ...baseTooltip(t), formatter: raiTooltip },
    xAxis: timeAxis(t), yAxis: valAxis(t, { min: v => Math.floor(v.min * 2) / 2, max: v => Math.ceil(v.max * 2) / 2 }),
    dataZoom: [{ type: 'inside', startValue: rangeStart(H.dates, state.range), endValue: H.dates.at(-1) },
      { type: 'slider', height: 26, bottom: 14, borderColor: t.border, backgroundColor: 'transparent', fillerColor: rgba(t.muted, .12),
        dataBackground: { lineStyle: { color: t.muted, opacity: .6 }, areaStyle: { color: t.muted, opacity: .08 } },
        selectedDataBackground: { lineStyle: { color: t.ink2 }, areaStyle: { color: t.ink2, opacity: .1 } },
        handleStyle: { color: t.surface, borderColor: t.muted }, moveHandleStyle: { color: t.muted, opacity: .4 },
        textStyle: { color: t.muted, fontFamily: FONT, fontSize: 10 }, labelFormatter: v => new Date(v).toISOString().slice(0, 10) }],
    series: [
      { name: 'RAI (EMA)', type: 'line', data: H.dates.map((d, i) => [d, H.ema[i]]), showSymbol: false, symbolSize: 8,
        lineStyle: { width: 2.2, color: t.ink }, itemStyle: { color: t.ink }, z: 3,
        markArea: { silent: true, data: regBands(H.dates, H.reg, t.dark ? .28 : .2, t) },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: [4, 4], color: t.muted, width: 1, opacity: .7 },
          label: { color: t.muted, fontSize: 10, fontFamily: FONT, position: 'insideStartTop', formatter: p => f2(p.value) },
          data: [thr.TSON, thr.TON, thr.TOFF, thr.TSOFF].map(y => ({ yAxis: y })) } },
      { name: 'Raw RAI', type: 'line', data: H.dates.map((d, i) => [d, H.rai[i]]), showSymbol: false,
        lineStyle: { width: 1, color: t.muted, opacity: .7 }, itemStyle: { color: t.muted }, z: 2 },
    ],
  });
  return ch;
}
function drawCats(el) {
  const t = T(), H = D.history, ch = mk(el);
  const start = rangeStart(H.dates, '6M'), i0 = H.dates.findIndex(d => d >= start);
  const dates = H.dates.slice(i0);
  ch.setOption({
    textStyle: { fontFamily: FONT }, animationDuration: 600,
    grid: { left: 40, right: 52, top: 34, bottom: 28 },
    legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 4, textStyle: { color: t.ink2, fontFamily: FONT, fontSize: 12 } },
    tooltip: { ...baseTooltip(t), formatter: ps => `<div class="tt"><div class="d">${new Date(ps[0].value[0]).toISOString().slice(0, 10)}</div>${[...ps].sort((a, b) => b.value[1] - a.value[1]).map(p => `<div class="r"><span><i style="background:${p.color}"></i>${p.seriesName}</span><b>${f2(p.value[1])}</b></div>`).join('')}</div>` },
    xAxis: timeAxis(t), yAxis: valAxis(t),
    series: D.cats.map(c => ({
      name: c.en, type: 'line', showSymbol: false, data: dates.map((d, i) => [d, H.cats[c.code][i0 + i]]),
      lineStyle: { width: 2, color: css(CATCOL[c.code]) }, itemStyle: { color: css(CATCOL[c.code]) },
      endLabel: { show: true, formatter: p => f2(p.value[1]), color: t.ink2, fontFamily: FONT, fontSize: 11, distance: 6 },
      labelLayout: { moveOverlap: 'shiftY' }, emphasis: { focus: 'series' },
      markLine: c.code === 'VOL' ? { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.axis, type: 'solid' }, data: [{ yAxis: 0 }] } : undefined,
    })),
  });
  return ch;
}

/* ================= HISTORY ================= */
const MKT = { SPX: ['S&P 500', 2], VIX: ['VIX', 2], AUDJPY: ['AUDJPY', 2], USD_BROAD: ['USD Broad', 2], EMFX: ['EM FX basket', 2] };
function renderHistory(el) {
  const H = D.history, t = T();
  const eps = D.episodes, total = eps.reduce((s, e) => s + e.n, 0);
  el.innerHTML = `
  <div class="page-head fade-in"><div><h1>${L('تاریخچه و آمار رژیم‌ها', 'Regime history & statistics')}</h1><p>${L(`${N(H.dates[0])} تا ${N(H.dates.at(-1))} · ${N(H.dates.length)} روز کاری · ${N(eps.length)} دوره رژیم`, `${N(H.dates[0])} to ${N(H.dates.at(-1))} · ${N(H.dates.length)} business days · ${N(eps.length)} regime episodes`)}</p></div>
    <button class="btn" id="csvBtn">${IC.dl} ${L('دانلود CSV تاریخچه', 'Download history CSV')}</button></div>
  <div class="grid fade-in">
    <div class="card c12">
      <div class="card-h"><div><h3>${L('RAI در کنار بازار', 'RAI alongside the market')}</h3><div class="sub">${L('بالا: RAI با نوار رژیم · پایین: سری بازار انتخاب‌شده (محور جدا)', 'Top: RAI with regime bands · bottom: selected market series (separate axis)')}</div></div>
        <div class="flex"><select class="sel" id="mktSel">${Object.entries(MKT).map(([k, [n]]) => `<option value="${k}" ${k === state.mkt ? 'selected' : ''}>${n}</option>`).join('')}</select>
        ${segHTML('histRange', ['6M', '1Y', '2Y', 'All'], 'All')}</div></div>
      <div class="chart" id="histChart" style="height:480px"></div>
    </div>
    <div class="card c12">
      <div class="card-h"><div><h3>${L('دوره‌های رژیم', 'Regime episodes')}</h3><div class="sub">${L('هر بلوک یک دوره پیوسته از رژیم تأییدشده؛ عرض = طول دوره', 'Each block is one continuous confirmed-regime episode; width = length')}</div></div>
        <div class="legend">${Object.entries(REG).reverse().map(([r, g]) => `<span><i style="background:var(--${g.k.toLowerCase()})"></i>${g.fa}</span>`).join('')}</div></div>
      <div class="strip">${eps.map(e => `<i style="flex:${e.n};background:var(--${REG[e.reg].k.toLowerCase()})" data-tip="${REG[e.reg].fa}<br>${e.start} → ${e.end}<br>${e.n} ${L('روز', 'days')}"></i>`).join('')}</div>
      <div class="strip-axis"><span>${eps[0].start}</span><span>${eps.at(-1).end}</span></div>
    </div>
    <div class="card c7">
      <div class="card-h"><div><h3>${L('آمار هر رژیم', 'Statistics by regime')}</h3><div class="sub">${L('میانگین بازده ۲۰ روز <b>بعد</b> از هر روز در آن رژیم و درصد مثبت‌ها', 'Average return over the 20 days <b>after</b> each day in that regime, and hit rate')}</div></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${L('رژیم', 'Regime')}</th><th class="r">${L('سهم زمان', 'Time share')}</th><th class="r">${L('دوره‌ها', 'Episodes')}</th><th class="r">S&P 500</th><th class="r">AUDJPY</th><th class="r">EM FX</th></tr></thead><tbody>
      ${[...D.stats].reverse().map(s => `<tr><td>${chipReg(s.reg)}</td><td class="r num">${pc(s.share, 0, false)} <span class="muted">(${s.days})</span></td><td class="r num">${s.episodes}</td>
        ${['SPX', 'AUDJPY', 'EMFX'].map(k => `<td class="r num"><span class="heat" style="${heatBg(s.fwd[k], 0.02)}">${pc(s.fwd[k], 2)}</span> <span class="muted" style="font-size:11.5px">${pc(s.hit[k], 0, false)}</span></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <p class="note">${L('درون‌نمونه‌ای و با پنجره‌های هم‌پوشان است؛ برای ارزیابی کیفیت سیگنال است، نه پیش‌بینی.', 'In-sample with overlapping windows; meant to judge signal quality, not to forecast.')}</p>
    </div>
    <div class="card c5">
      <div class="card-h"><div><h3>${L('آخرین دوره‌ها', 'Latest episodes')}</h3><div class="sub">${L('۱۰ دوره اخیر', 'Last 10 episodes')}</div></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${L('رژیم', 'Regime')}</th><th>${L('از', 'From')}</th><th>${L('تا', 'To')}</th><th class="r">${L('روز', 'Days')}</th></tr></thead><tbody>
      ${eps.slice(-10).reverse().map(e => `<tr><td>${chipReg(e.reg)}</td><td class="num">${e.start}</td><td class="num">${e.end}</td><td class="r num">${e.n}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="card c12">
      <div class="card-h"><div><h3>Category heatmap</h3><div class="sub">${L('امتیاز روزانه هر Category · آبی = Risk-On، قرمز = Risk-Off', 'Daily score of each category · blue = Risk-On, red = Risk-Off')}</div></div></div>
      <div class="chart short" id="heatCats"></div>
    </div>
    <div class="card c12">
      <div class="card-h"><div><h3>${L('تاریخچه الگوهای رژیم', 'Regime type history')}</h3><div class="sub">${L('امتیاز روزانه هر الگو (شرط‌های برقرار + Strength، از 0 تا 6) · پررنگ‌تر = قوی‌تر · نقطه سفید = نوع اصلی آن روز', "Daily score of each pattern (conditions met + Strength, 0 to 6) · darker = stronger · white dot = that day's primary type")}</div></div></div>
      <div class="chart" id="heatTypes" style="height:400px"></div>
    </div>
  </div>`;
  const hc = drawHist($('#histChart'));
  $('#mktSel').addEventListener('change', e => { state.mkt = e.target.value; hc.dispose(); charts.delete(hc); drawHist($('#histChart')); });
  bindSeg('histRange', v => { const c = echarts.getInstanceByDom($('#histChart')); zoomTo(c, v); });
  $('#csvBtn').addEventListener('click', downloadCSV);
  drawHeatCats($('#heatCats'));
  drawHeatTypes($('#heatTypes'));
}
function drawHist(el) {
  const t = T(), H = D.history, ch = mk(el), k = state.mkt;
  ch.setOption({
    textStyle: { fontFamily: FONT }, animationDuration: 500,
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [{ left: 50, right: 18, top: 14, height: '48%' }, { left: 50, right: 18, top: '62%', bottom: 66 }],
    tooltip: { ...baseTooltip(t), formatter: raiTooltip },
    xAxis: [timeAxis(t, { gridIndex: 0, axisLabel: { show: false } }), timeAxis(t, { gridIndex: 1 })],
    yAxis: [valAxis(t, { gridIndex: 0 }), valAxis(t, { gridIndex: 1, scale: true, axisLabel: { color: t.muted, fontSize: 11, formatter: v => v.toLocaleString('en-US', { maximumFractionDigits: 2 }) } })],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }, { type: 'slider', xAxisIndex: [0, 1], height: 24, bottom: 14, borderColor: t.border, backgroundColor: 'transparent',
      fillerColor: rgba(t.muted, .12), dataBackground: { lineStyle: { color: t.muted, opacity: .5 }, areaStyle: { opacity: 0 } },
      handleStyle: { color: t.surface, borderColor: t.muted }, textStyle: { color: t.muted, fontSize: 10 }, labelFormatter: v => new Date(v).toISOString().slice(0, 10) }],
    series: [
      { name: 'RAI (EMA)', type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, data: H.dates.map((d, i) => [d, H.ema[i]]),
        lineStyle: { width: 2, color: t.ink }, itemStyle: { color: t.ink }, markArea: { silent: true, data: regBands(H.dates, H.reg, t.dark ? .28 : .2, t) } },
      { name: MKT[k][0], type: 'line', xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: H.dates.map((d, i) => [d, H.mkt[k][i]]),
        lineStyle: { width: 1.8, color: css('--s1') }, itemStyle: { color: css('--s1') },
        markArea: { silent: true, data: regBands(H.dates, H.reg, t.dark ? .16 : .12, t) } },
    ],
  });
  return ch;
}
function divergingColors(t) {
  return t.dark ? ['#ef5350', '#9a3a39', '#383835', '#2b5d99', '#3f8cf0'] : ['#b3302f', '#f0a19f', '#f0efec', '#86b6ef', '#1c5cab'];
}
function drawHeatCats(el) {
  const t = T(), H = D.history, ch = mk(el);
  const data = []; D.cats.forEach((c, j) => H.cats[c.code].forEach((v, i) => { if (v != null) data.push([i, j, v]); }));
  ch.setOption({
    textStyle: { fontFamily: FONT },
    grid: { left: 92, right: 18, top: 6, bottom: 58 },
    tooltip: { backgroundColor: t.surface, borderColor: t.border, textStyle: { color: t.ink, fontFamily: FONT, fontSize: 12 },
      formatter: p => `<div class="tt"><div class="d">${H.dates[p.value[0]]}</div><div class="r"><span>${D.cats[p.value[1]].en}</span><b>${f2(p.value[2])}</b></div></div>` },
    xAxis: { type: 'category', data: H.dates, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: v => v.slice(0, 7) }, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: 'category', data: D.cats.map(c => c.en), axisLabel: { color: t.ink2, fontFamily: FONT, fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { show: true, min: -2.5, max: 2.5, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 160, itemWidth: 10,
      text: ['Risk-On', 'Risk-Off'], textStyle: { color: t.muted, fontFamily: FONT, fontSize: 11 }, inRange: { color: divergingColors(t) } },
    series: [{ type: 'heatmap', data, progressive: 0, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } } }],
  });
}
function drawHeatTypes(el) {
  const t = T(), H = D.history, ch = mk(el);
  const i0 = H.types.findIndex(r => r), dates = H.dates.slice(i0), data = [];
  H.types.slice(i0).forEach((r, i) => { if (r) D.types.forEach((tp, j) => data.push([i, j, r[j + 1]])); });
  const prim = H.types.slice(i0).map((r, i) => r ? [i, D.types.findIndex(x => x.code === r[0])] : null).filter(Boolean);
  const seq = t.dark ? ['#1f1f1e', '#184f95', '#3987e5', '#9ec5f4'] : ['#f5f5f1', '#9ec5f4', '#2a78d6', '#0d366b'];
  ch.setOption({
    textStyle: { fontFamily: FONT },
    grid: { left: 190, right: 18, top: 6, bottom: 58 },
    tooltip: { backgroundColor: t.surface, borderColor: t.border, textStyle: { color: t.ink, fontFamily: FONT, fontSize: 12 },
      formatter: p => { const tp = D.types[p.value[1]]; const r = H.types[i0 + p.value[0]]; const pr = D.types.find(x => x.code === r[0]);
        return `<div class="tt"><div class="d">${dates[p.value[0]]}</div><div class="r"><span>${tp.en}</span><b>${f2(p.value[2])}</b></div><div class="r"><span>${L('نوع اصلی آن روز', "That day's primary type")}</span><b>${pr.en}</b></div></div>`; } },
    xAxis: { type: 'category', data: dates, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true, formatter: v => v.slice(0, 7) }, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: 'category', data: D.types.map(x => `${x.code} · ${x.en}`), inverse: true, axisLabel: { color: t.ink2, fontFamily: FONT, fontSize: 11.5 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { min: 0, max: 6, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 160, itemWidth: 10, text: [L('قوی', 'Strong'), L('ضعیف', 'Weak')],
      textStyle: { color: t.muted, fontFamily: FONT, fontSize: 11 }, inRange: { color: seq }, seriesIndex: 0 },
    series: [{ type: 'heatmap', data, progressive: 0 },
      { type: 'scatter', data: prim, symbol: 'rect', symbolSize: [2, 2], itemStyle: { color: t.dark ? '#f0efec' : '#0b0b0b', opacity: .75 }, silent: true, z: 5 }],
  });
}
function downloadCSV() {
  const H = D.history, cats = D.cats.map(c => c.code), inds = D.indicators_def.map(i => i.id);
  const rows = [['date', 'RAI', 'EMA', 'regime', 'breadth', ...cats, ...inds.map(i => 'z_' + i), 'primary_type'].join(',')];
  H.dates.forEach((d, i) => rows.push([d, H.rai[i], H.ema[i], BYN[H.reg[i]] || '', H.breadth[i], ...cats.map(c => H.cats[c][i]), ...inds.map(k => H.z[k][i]), H.types[i] ? H.types[i][0] : ''].map(v => v ?? '').join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  a.download = `risk-regime-history-${D.meta.last}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

/* ================= FX BOARD ================= */
function renderFX(el) {
  const g = D.fxg, k = D.kpi, beta = g['High-beta G10'] - g['Haven'], emg = g['EM carry'] - g['Haven'];
  const fx = [...D.fx].sort((a, b) => b.r1m - a.r1m);
  const fit = FIT(), exp = EXP();
  el.innerHTML = `
  <div class="page-head fade-in"><div><h1>FX Board</h1><p>${L(`عملکرد ارزها در برابر USD (مثبت = ارز قوی‌تر از USD) و سازگاری با رژیم ${chipReg(k.regime)}`, `Currency performance vs USD (positive = currency stronger than USD) and fit with the ${chipReg(k.regime)} regime`)}</p></div>
    ${D.meta.ecb_from ? `<span class="pill est"><span class="dot"></span>${L(`نرخ‌ها از ${N(D.meta.ecb_from)} با ECB تخمین زده شده‌اند`, `Rates from ${N(D.meta.ecb_from)} are ECB estimates`)}</span>` : ''}</div>
  <div class="grid fade-in">
    ${[['High-beta G10', g['High-beta G10'], 'AUD, NZD, NOK, SEK'], ['Safe havens', g['Haven'], 'JPY + CHF'], ['EM carry', g['EM carry'], 'MXN, BRL, ZAR'], ['EM Asia', g['EM Asia'], 'KRW, INR, CNY']].map(([l, v, s]) => `
      <div class="kpi c3"><div class="l">${l} · 1M</div><div class="v num" style="color:${v >= 0 ? 'var(--son-t)' : 'var(--soff-t)'}">${pc(v, 2)}</div><div class="d">${s}</div></div>`).join('')}
    <div class="card c12">
      <div class="flex">
        <div class="callout" style="flex:1;min-width:260px">${IC.info}<div><b>${beta < 0 ? L('High-beta FX عقب‌تر از Safe havens است — رفتار Risk-Off', 'High-beta FX is lagging Safe havens — Risk-Off behaviour') : L('High-beta FX جلوتر از Safe havens است — رفتار Risk-On', 'High-beta FX is leading Safe havens — Risk-On behaviour')}</b><br>
          <span dir="ltr">Beta gap (High-beta − Safe haven): ${pc(beta, 2)}</span> · <span dir="ltr">EM carry − Safe haven: ${pc(emg, 2)}</span></div></div>
      </div>
    </div>
    <div class="card c12 flush">
      <div class="card-h" style="padding:20px 20px 0"><div><h3>${L('جدول عملکرد', 'Performance table')}</h3><div class="sub">${L('رنگ سلول: شدت حرکت · نمودار: ۳ ماه اخیر', 'Cell colour: size of the move · chart: last 3 months')}</div></div></div>
      <div class="tbl-wrap" style="padding:0 16px 12px"><table class="tbl"><thead><tr><th>${L('ارز', 'Currency')}</th><th class="r">1D</th><th class="r">1W</th><th class="r">1M</th><th class="r">3M</th><th class="r">YTD</th><th>3M trend</th><th>${L('انتظار در Risk-Off', 'Expected in Risk-Off')}</th><th>${L('سازگاری با رژیم', 'Regime fit')}</th></tr></thead><tbody>
      ${fx.map(r => `<tr>
        <td><div class="ccy"><span class="flag">${r.ccy}</span><div><b>${r.pair}</b>${r.est ? `<span class="est-tag" data-tip="${L('آخرین نرخ از ECB تخمین زده شده؛ با انتشار FRED جایگزین می‌شود', 'Latest rate estimated from the ECB; replaced when FRED publishes')}">ECB</span>` : ''}<div class="muted" style="font-size:11.5px">${GRP[r.grp]} · <span class="num">${r.last.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span></div></div></div></td>
        ${['r1d', 'r1w', 'r1m', 'r3m', 'ytd'].map(c => `<td class="r num"><span class="heat" style="${heatBg(r[c], c === 'r1d' ? .01 : c === 'r1w' ? .02 : .06)}">${pc(r[c], 2)}</span></td>`).join('')}
        <td style="width:110px;min-width:110px">${spark(r.spark, { band: 0, lo: Math.min(...r.spark.filter(v => v != null), 0), hi: Math.max(...r.spark.filter(v => v != null), 0), h: 30, color: r.r3m >= 0 ? css('--son') : css('--soff') })}</td>
        <td class="ink2">${exp[r.exp]}</td><td>${stIcon(...fit[r.fit])}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="card c6">
      <div class="card-h"><div><h3>${L('رتبه‌بندی 1M', '1M ranking')}</h3><div class="sub">${L('بازده ۲۱ روز کاری در برابر USD', '21-business-day return vs USD')}</div></div></div>
      ${dbars(fx.map(r => ({ name: `<b class="en">${r.ccy}</b>`, small: GRP[r.grp], v: r.r1m, tip: `${r.ccy} (${r.pair})<br>1M: ${pc(r.r1m, 2)} · 3M: ${pc(r.r3m, 2)}` })), { lim: Math.max(...fx.map(r => Math.abs(r.r1m))) * 1.05, fmt: v => pc(v, 1) })}
    </div>
    <div class="card c6">
      <div class="card-h"><div><h3>${L('گروه‌های ارزی در ۳ ماه اخیر', 'Currency groups over the last 3 months')}</h3><div class="sub">${L('بازده تجمعی میانگین هر گروه در برابر USD (۶۴ مشاهده اخیر)', "Each group's average cumulative return vs USD (last 64 observations)")}</div></div></div>
      <div class="chart" id="fxGroups" style="height:420px"></div>
    </div>
  </div>
  <p class="note">${L('«انتظار در Risk-Off» رفتار معمول هر ارز در برابر USD است. ⚠ یعنی ارز برخلاف الگوی معمول رفتار می‌کند؛ اغلب نشانه نوع خاصی از رژیم (مثلاً ضعف JPY در Rates shock) یا یک Idiosyncratic story است.', '"Expected in Risk-Off" is each currency\'s usual behaviour vs USD. ⚠ means the currency is breaking its usual pattern — often a sign of a specific regime type (e.g. JPY weakness in a rates shock) or an idiosyncratic story.')}</p>`;
  const t = T(), ch = mk($('#fxGroups')), G = Object.keys(GRP), n = D.fx[0].spark.length;
  const ser = G.map((g, j) => {
    const rows = D.fx.filter(r => r.grp === g);
    const col = css(['--s1', '--s2', '--s3', '--s4', '--s5'][j]);
    return { name: GRP[g], type: 'line', showSymbol: false, lineStyle: { width: 2, color: col }, itemStyle: { color: col }, emphasis: { focus: 'series' },
      data: Array.from({ length: n }, (_, i) => { const v = rows.map(r => r.spark[i]).filter(x => x != null); return [i - n + 1, v.length ? v.reduce((a, b) => a + b, 0) / v.length * 100 : null]; }),
      endLabel: { show: true, formatter: p => sg(p.value[1], 1) + '%', color: t.ink2, fontFamily: FONT, fontSize: 11 }, labelLayout: { moveOverlap: 'shiftY' } };
  });
  ch.setOption({ textStyle: { fontFamily: FONT }, grid: { left: 40, right: 60, top: 34, bottom: 28 },
    legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 4, textStyle: { color: t.ink2, fontFamily: FONT, fontSize: 12 } },
    tooltip: { ...baseTooltip(t), formatter: ps => `<div class="tt"><div class="d">${ps[0].value[0] === 0 ? L('آخرین مشاهده', 'Latest observation') : ps[0].value[0] + L(' مشاهده قبل', ' observations ago')}</div>${[...ps].sort((a, b) => b.value[1] - a.value[1]).map(p => `<div class="r"><span><i style="background:${p.color}"></i>${p.seriesName}</span><b>${sg(p.value[1], 2)}%</b></div>`).join('')}</div>` },
    xAxis: { type: 'value', min: -n + 1, max: 0, axisLabel: { color: t.muted, fontSize: 11, formatter: v => v === 0 ? L('اکنون', 'Now') : v }, splitLine: { show: false }, axisLine: { lineStyle: { color: t.axis } } },
    yAxis: valAxis(t, { axisLabel: { color: t.muted, fontSize: 11, formatter: v => sg(v, 0) + '%' } }),
    series: [...ser, { type: 'line', data: [], markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.axis, type: 'solid' }, data: [{ yAxis: 0 }] } }] });
}

/* ================= INDICATORS ================= */
function renderIndicators(el) {
  const fmtVal = i => i.val == null ? '—' : i.id === 'CP' ? f2(i.val, 1) + ' bp' : i.id === 'USTRV' ? f2(i.val, 0) + ' bp' : ['VIXTS', 'EURCHF'].includes(i.id) ? f2(i.val, 4) : i.val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  el.innerHTML = `
  <div class="page-head fade-in"><div><h1>${L('شاخص‌ها', 'Indicators')}</h1><p>${L(`${D.inds.length} شاخص در 5 Category · Rolling z-score ${D.meta.lb} روزه، Capped در ±${D.meta.cap} · مثبت همیشه = Risk-On`, `${D.inds.length} indicators in 5 categories · ${D.meta.lb}-day rolling z-score, capped at ±${D.meta.cap} · positive always = Risk-On`)}</p></div></div>
  ${D.cats.map(c => {
    const items = D.inds.filter(i => i.cat === c.code);
    return `<div class="section-title fade-in"><h2 class="en">${c.en}</h2><p>Score: ${N(f2(c.v))} · Weight: ${N(Math.round(c.w * 100) + '%')}</p></div>
    <div class="ind-grid fade-in">${items.map(i => `
      <div class="ind">
        <div class="ind-top"><div><h4>${i.name}</h4><div class="fa">${i.fa}</div></div>${chipSig(i.sig)}</div>
        <div class="flex" style="align-items:baseline"><span class="zv num">${f2(i.z)}</span><span class="muted" style="font-size:12px">Signed z</span>
          <span class="sp"></span><span class="delta ${i.d5 >= 0 ? 'up' : 'dn'}" style="font-size:12.5px">${i.d5 == null ? '' : (i.d5 >= 0 ? '▲ ' : '▼ ') + sg(i.d5)}</span></div>
        ${i.spark.some(v => v != null) ? spark(i.spark, { color: css(CATCOL[i.cat]) }) : `<div class="muted" style="height:54px;display:grid;place-items:center;font-size:12px">${L('داده کافی نیست', 'Not enough data')}</div>`}
        <div class="meta"><span>${['HY', 'IG', 'EMC'].includes(i.id) ? `<span data-tip="${L('ICE BofA data: طبق شرایط FRED فقط z-score منتشر می‌شود', "ICE BofA data: under FRED's terms only the z-score is published")}">${L('ICE BofA · فقط z-score', 'ICE BofA · z-score only')}</span>` : `${L('مقدار', 'Value')}: ${N(fmtVal(i))}`}${i.x != null ? ` · Transformed: ${N(i.tr === 'RET' || i.tr === 'DD' ? pc(i.x, 1) : f2(i.x))}` : ''}</span>
          <span>${i.last ? (i.stale ? stIcon('warn', L(`${i.age} روز`, `${i.age} days`)) : stIcon('good', N(i.last))) : L('بدون داده', 'No data')}${i.est ? '<span class="est-tag">ECB</span>' : ''}</span></div>
      </div>`).join('')}</div>`;
  }).join('')}
  <div class="grid fade-in" style="margin-top:28px">
    <div class="card c7 flush">
      <div class="card-h" style="padding:20px 20px 0"><div><h3>${L('ورودی‌های تشخیص نوع رژیم', 'Regime type diagnosis inputs')}</h3><div class="sub">${L('z-score تغییرات ۲۰ روزه نسبت به یک سال اخیر', 'z-score of 20-day changes relative to the past year')}</div></div></div>
      <div class="tbl-wrap" style="padding:0 16px 12px"><table class="tbl"><thead><tr><th>${L('ورودی', 'Input')}</th><th class="r">${L('z / مقدار', 'z / value')}</th><th class="r">${L('تغییر خام', 'Raw change')}</th><th>${L('توضیح', 'Note')}</th></tr></thead><tbody>
      ${D.diag.map(r => `<tr><td>${r.t}</td><td class="r num"><b>${f2(r.z)}</b></td><td class="r num">${r.raw == null ? '—' : r.fmt === 'pct' ? pc(r.raw, 2) : r.fmt === 'bp' ? sg(r.raw, 1) + ' bp' : r.fmt === 'bpl' ? f2(r.raw, 1) + ' bp' : r.fmt === 'vix' ? 'VIX ' + f2(r.raw, 1) : r.raw}</td><td class="muted" style="white-space:normal;min-width:160px">${dx(r, 'note')}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="c5" style="display:grid;gap:16px">
      ${D.weekly.map((w, j) => `<div class="card"><div class="card-h"><div><h3>${w.t}</h3><div class="sub">${L('هفتگی', 'Weekly')} · ${dx(w, 'note')}</div></div><div class="num" style="font-size:22px;font-weight:700">${f2(w.v)}</div></div>
        <div class="chart" id="wk${j}" style="height:150px"></div><div class="note">${L('آخرین داده', 'Latest data')}: ${N(w.date)}</div></div>`).join('')}
    </div>
  </div>`;
  D.weekly.forEach((w, j) => {
    const t = T(), ch = mk($('#wk' + j));
    ch.setOption({ grid: { left: 36, right: 8, top: 8, bottom: 22 }, tooltip: { ...baseTooltip(t), formatter: ps => `<div class="tt"><div class="d">${ps[0].value[0]}</div><div class="r"><span>${w.k}</span><b>${f2(ps[0].value[1])}</b></div></div>` },
      xAxis: timeAxis(t), yAxis: valAxis(t, { splitNumber: 3 }),
      series: [{ type: 'line', showSymbol: false, data: w.dates.map((d, i) => [d, w.vals[i]]), lineStyle: { width: 1.8, color: css('--s7') }, itemStyle: { color: css('--s7') },
        areaStyle: { color: rgba(css('--s7'), .08) }, markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.axis, type: 'solid' }, data: [{ yAxis: 0 }] } }] });
  });
}

/* ================= PLAYBOOK ================= */
function renderPlaybook(el) {
  const fam = f => D.types.filter(x => x.fam === f).sort((a, b) => (b.met + b.str) - (a.met + a.str));
  const card = tp => `<div class="tcard ${tp.code === D.primary ? 'primary rc-' + REG[D.kpi.regime].k : ''}">
      <div class="row"><span class="type-code">${tp.code}${tp.code === D.primary ? ` · <b style="color:var(--rc-t)">${L('نوع اصلی امروز', "Today's primary type")}</b>` : tp.code === D.secondary ? ` · ${L('نوع دوم امروز', "Today's secondary type")}` : ''}</span>
        <span class="flex"><span class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < tp.met ? 'on' : ''}"></i>`).join('')}</span><b class="num">${tp.met}/5</b></span></div>
      <h3 class="en">${tp.en}</h3>
      <div><div class="flex" style="justify-content:space-between;font-size:12px" class="muted"><span class="muted">Strength</span><span class="num muted">${Math.round(tp.str * 100)}%</span></div>
        <div class="strength"><i style="width:${tp.str * 100}%"></i></div></div>
      <p style="margin:0;font-size:13.5px;color:var(--ink-2)">${dx(tp, 'sig')}</p>
      <div class="conds" style="margin:4px 0 0">${tp.conds.map(c => `<span class="cond ${c.ok ? 'met' : ''}"><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span><span class="k">${COND[c.k] || c.k}</span> ${N((c.op === '>' ? '> ' : '< ') + c.thr)} <span class="muted">·</span> ${N(f2(c.v))}</span>`).join('')}</div>
      <details class="more"><summary>FX Playbook ▾</summary><div class="kv">
        <div><b>Long</b>${dx(tp, 'long')}</div><div><b>Short / Avoid</b>${dx(tp, 'short')}</div>
        <div><b>${L('Risk management و Hedging', 'Risk management & hedging')}</b>${dx(tp, 'hedge')}</div><div><b>Invalidation</b>${dx(tp, 'inv')}</div></div></details>
    </div>`;
  el.innerHTML = `
  <div class="page-head fade-in"><div><h1>${L('الگوهای رژیم و Playbook', 'Regime types & Playbook')}</h1><p>${L('چارچوب آموزشی بر پایه الگوهای تاریخی؛ توصیه سرمایه‌گذاری نیست. همیشه با Positioning، ارزش‌گذاری و کاتالیزورها تطبیق دهید.', 'An educational framework based on historical patterns; not investment advice. Always cross-check with positioning, valuation and catalysts.')}</p></div></div>
  <div class="section-title"><h2>Risk-Off family</h2><p>${L('مرتب‌شده بر اساس امتیاز امروز', "Sorted by today's score")}</p></div>
  <div class="types fade-in">${fam('Risk-Off').map(card).join('')}</div>
  <div class="section-title"><h2>Risk-On family</h2></div>
  <div class="types fade-in">${fam('Risk-On').map(card).join('')}</div>
  <div class="section-title"><h2>${L('رویکرد کلی بر اساس رژیم', 'General approach by regime')}</h2></div>
  <div class="card flush fade-in"><div class="tbl-wrap" style="padding:8px 16px"><table class="tbl"><thead><tr><th>${L('رژیم', 'Regime')}</th><th class="r">Risk budget</th><th>${L('رویکرد کلی', 'Approach')}</th></tr></thead><tbody>
    ${D.regimes.map(r => `<tr><td>${chipReg(r.reg)}</td><td class="r num"><b>${Math.round(r.budget * 100)}%</b></td><td style="white-space:normal">${dx(r, 'post')}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}

/* ================= MODEL LAB ================= */
const LAB0 = () => ({ span: D.meta.span, K: D.meta.k, thr: [D.meta.thr.TSON, D.meta.thr.TON, D.meta.thr.TOFF, D.meta.thr.TSOFF],
  cw: Object.fromEntries(D.cats.map(c => [c.code, c.w])), en: Object.fromEntries(D.indicators_def.map(i => [i.id, true])) });
let LAB = null;
function computeModel(p) {
  const H = D.history, n = H.dates.length, defs = D.indicators_def;
  const rai = new Array(n).fill(null), ema = new Array(n).fill(null), raw = new Array(n).fill(null), conf = new Array(n).fill(null);
  const a = 2 / (p.span + 1); let prev = null, streak = 0, prc = null;
  const lab = e => e >= p.thr[0] ? 2 : e >= p.thr[1] ? 1 : e > p.thr[2] ? 0 : e > p.thr[3] ? -1 : -2;
  for (let i = 0; i < n; i++) {
    let num = 0, den = 0;
    for (const c of D.cats) {
      const cw = p.cw[c.code]; if (!(cw > 0)) continue;
      let s = 0, w = 0;
      for (const d of defs) { if (d.cat !== c.code || !p.en[d.id]) continue; const z = H.z[d.id][i]; if (z != null) { s += z * d.w; w += d.w; } }
      if (w > 0) { num += cw * s / w; den += cw; }
    }
    if (den === 0) continue;
    rai[i] = num / den;
    prev = prev == null ? rai[i] : prev + a * (rai[i] - prev); ema[i] = prev;
    raw[i] = lab(prev);
    streak = i > 0 && raw[i - 1] === raw[i] ? streak + 1 : 1;
    prc = (streak >= p.K || prc == null) ? raw[i] : prc; conf[i] = prc;
  }
  return { rai, ema, raw, conf };
}
function renderLab(el) {
  if (!LAB) LAB = LAB0();
  const p = LAB;
  el.innerHTML = `
  <div class="page-head fade-in"><div><h1>Model Lab</h1><p>${L('تنظیمات Config را تغییر دهید؛ کل مدل در مرورگر دوباره محاسبه می‌شود و با مدل پایه مقایسه می‌شود.', 'Change the Config settings; the whole model is recomputed in your browser and compared with the base model.')}</p></div>
    <button class="btn" id="labReset">${IC.reset} ${L('بازگشت به پیش‌فرض', 'Reset to defaults')}</button></div>
  <div class="grid fade-in">
    <div class="card c4">
      <div class="lab-ctl">
        <div class="ctl-grid">
          ${ctl('span', L('EMA span (روز)', 'EMA span (days)'), p.span, 1, 30, 1)}${ctl('K', 'Confirmation days', p.K, 1, 10, 1)}
        </div>
        <div><div class="muted" style="font-size:12.5px;margin-bottom:8px">${L('آستانه‌های رژیم روی RAI (EMA)', 'Regime thresholds on RAI (EMA)')}</div><div class="ctl-grid">
          ${ctl('thr0', 'Strong Risk-On ≥', p.thr[0], 0, 2, .05)}${ctl('thr1', 'Risk-On ≥', p.thr[1], 0, 1.5, .05)}
          ${ctl('thr2', 'Risk-Off ≤', p.thr[2], -1.5, 0, .05)}${ctl('thr3', 'Strong Risk-Off ≤', p.thr[3], -2, 0, .05)}</div></div>
        <div><div class="muted" style="font-size:12.5px;margin-bottom:8px">Category weights</div><div class="ctl-grid">
          ${D.cats.map(c => ctl('cw_' + c.code, c.en, p.cw[c.code], 0, 0.5, .05)).join('')}</div></div>
        <div><div class="muted" style="font-size:12.5px;margin-bottom:8px">${L('شاخص‌های فعال', 'Active indicators')}</div>
          <div class="toggles">${D.indicators_def.map(i => `<button class="tog ${p.en[i.id] ? '' : 'off'}" data-id="${i.id}">${D.inds.find(x => x.id === i.id).name}</button>`).join('')}</div></div>
      </div>
    </div>
    <div class="card c8">
      <div class="lab-out" id="labOut"></div>
      <div class="chart tall" id="labChart"></div>
      <p class="note">${L('خط‌چین: مدل پایه (تنظیمات پیش‌فرض) · نوار رنگی: رژیم تأییدشده با تنظیمات شما', 'Dashed: base model (default settings) · colour bands: confirmed regime with your settings')}</p>
    </div>
  </div>`;
  const ch = mk($('#labChart'));
  const base = computeModel(LAB0());
  const upd = () => {
    const r = computeModel(p), t = T(), H = D.history, n = H.dates.length - 1;
    const changes = r.conf.reduce((s, v, i) => s + (i > 0 && v != null && r.conf[i - 1] != null && v !== r.conf[i - 1] ? 1 : 0), 0);
    const changes0 = base.conf.reduce((s, v, i) => s + (i > 0 && v != null && base.conf[i - 1] != null && v !== base.conf[i - 1] ? 1 : 0), 0);
    const reg = BYN[r.conf[n]], B = L('پایه', 'Base');
    $('#labOut').innerHTML = `
      <div class="kpi"><div class="l">${L('رژیم امروز', "Today's regime")}</div><div class="v" style="font-size:18px">${chipReg(reg)}</div><div class="d">${B}: ${REG[BYN[base.conf[n]]].fa}</div></div>
      <div class="kpi"><div class="l">RAI (EMA)</div><div class="v num">${f2(r.ema[n])}</div><div class="d">${B}: ${N(f2(base.ema[n]))}</div></div>
      <div class="kpi"><div class="l">${L('تعداد تغییر رژیم', 'Regime changes')}</div><div class="v num">${changes}</div><div class="d">${B}: ${N(changes0)}</div></div>
      <div class="kpi"><div class="l">${L('زمان در Risk-Off', 'Time in Risk-Off')}</div><div class="v num">${pc(r.conf.filter(v => v != null && v < 0).length / r.conf.filter(v => v != null).length, 0, false)}</div><div class="d">${B}: ${N(pc(base.conf.filter(v => v != null && v < 0).length / base.conf.filter(v => v != null).length, 0, false))}</div></div>`;
    ch.setOption({
      textStyle: { fontFamily: FONT }, animation: false,
      grid: { left: 42, right: 18, top: 30, bottom: 30 },
      legend: { top: 0, right: 0, textStyle: { color: t.ink2, fontFamily: FONT, fontSize: 12 }, itemWidth: 14, itemHeight: 3 },
      tooltip: { ...baseTooltip(t), formatter: ps => `<div class="tt"><div class="d">${new Date(ps[0].value[0]).toISOString().slice(0, 10)}</div>${ps.map(q => `<div class="r"><span><i style="background:${q.color}"></i>${q.seriesName}</span><b>${f2(q.value[1])}</b></div>`).join('')}</div>` },
      xAxis: timeAxis(t), yAxis: valAxis(t),
      series: [
        { name: L('RAI (EMA) — تنظیمات شما', 'RAI (EMA) — your settings'), type: 'line', showSymbol: false, data: H.dates.map((d, i) => [d, r.ema[i]]), lineStyle: { width: 2.2, color: t.ink }, itemStyle: { color: t.ink },
          markArea: { silent: true, data: regBands(H.dates, r.conf, t.dark ? .28 : .2, t) },
          markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { type: [4, 4], color: t.muted, opacity: .7 }, data: p.thr.map(y => ({ yAxis: y })) } },
        { name: L('مدل پایه', 'Base model'), type: 'line', showSymbol: false, data: H.dates.map((d, i) => [d, base.ema[i]]), lineStyle: { width: 1.4, color: css('--s2'), type: [5, 4] }, itemStyle: { color: css('--s2') } },
      ],
    }, true);
  };
  el.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    const v = +e.target.value; $(`[data-out="${k}"]`).textContent = Number.isInteger(v) ? v : f2(v);
    if (k === 'span') p.span = v; else if (k === 'K') p.K = v; else if (k.startsWith('thr')) p.thr[+k[3]] = v; else if (k.startsWith('cw_')) p.cw[k.slice(3)] = v;
    upd();
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('.tog'); if (b) { p.en[b.dataset.id] = !p.en[b.dataset.id]; b.classList.toggle('off'); upd(); }
  });
  $('#labReset').addEventListener('click', () => { LAB = LAB0(); charts.delete(ch); ch.dispose(); renderLab(el); });
  upd();
  // the browser re-implementation must reproduce the exported model
  const n = D.history.dates.length - 1;
  console.assert(Math.abs(base.ema[n] - D.history.ema[n]) < 1e-3, 'lab model mismatch', base.ema[n], D.history.ema[n]);
}
const ctl = (k, l, v, min, max, step) => `<div class="ctl"><label><span>${l}</span><b data-out="${k}">${Number.isInteger(v) ? v : f2(v)}</b></label><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;

/* ================= GUIDE ================= */
// plain-language guide: weather analogy, today's reading from live data, daily routine, glossary, FAQ
const WX = () => ({
  SON: { ic: '☀️', sky: L('آفتابی کامل', 'Clear sunshine'), plain: L('همه شجاع‌اند و پول با خیال راحت به سمت دارایی‌های پرریسک می‌رود.', 'Everyone feels brave and money flows freely into risky assets.'), todo: L('می‌توانی با اندازه‌ی معمول معامله کنی. ارزهای پرریسک و Carry معمولاً خوب جواب می‌دهند.', 'You can trade at normal size. Risky currencies and Carry usually do well.') },
  ON: { ic: '🌤️', sky: L('بیشتر آفتابی', 'Mostly sunny'), plain: L('حال بازار خوب است، ولی نه بی‌نقص.', 'The market mood is good, but not perfect.'), todo: L('معامله‌ی معمولی، ولی گزینش‌گر باش و دنبال هر فرصتی نرو.', "Normal trading, but be selective and don't chase every opportunity.") },
  NEU: { ic: '⛅', sky: L('ابری', 'Cloudy'), plain: L('نشانه‌ها با هم نمی‌خوانند و جهت بازار معلوم نیست.', "The signals disagree and the market's direction is unclear."), todo: L('معامله‌های کوچک‌تر. صبر کن تا هوا روشن‌تر شود.', 'Smaller trades. Wait for the sky to clear.') },
  OFF: { ic: '🌧️', sky: L('بارانی', 'Rainy'), plain: L('بازار نگران است و پول به سمت جاهای امن (Safe haven) می‌رود.', 'The market is worried and money is moving to safe places (Safe havens).'), todo: L('اندازه‌ی معامله را کم کن، Carry را کم کن و حواست به Safe havenها باشد.', 'Cut position size, cut Carry, and keep an eye on Safe havens.') },
  SOFF: { ic: '⛈️', sky: L('طوفانی', 'Stormy'), plain: L('ترس شدید است؛ همه با هم از ریسک فرار می‌کنند.', 'Fear is intense; everyone is running from risk at the same time.'), todo: L('اولویت، حفظ سرمایه است. خیلی کم معامله کن، Hedge داشته باش و منتظر نشانه‌ی بهبود بمان.', 'Protecting capital comes first. Trade very little, stay hedged and wait for signs of improvement.') },
});
const CAT_SIMPLE = () => ({
  VOL: [L('دماسنج ترس', 'Fear thermometer'), L('نشان می‌دهد قیمت‌ها چقدر تکان می‌خورند. VIX که بالا برود یعنی سرمایه‌گذارها نگران‌اند. نوسان بازده ۱۰ ساله آمریکا هم اینجاست، چون استرس گاهی اول در Bonds دیده می‌شود.', 'Shows how much prices are swinging. When VIX rises, investors are worried. Swings in the US 10-year yield are here too, because stress sometimes shows up in bonds first.')],
  CREDIT: [L('اعتماد به شرکت‌ها', 'Trust in companies'), L('اگر شرکت‌ها برای قرض گرفتن بهره‌ی خیلی بیشتری بدهند (Spread بالا)، یعنی بازار به آن‌ها اعتماد ندارد.', 'If companies must pay much more interest to borrow (a high Spread), the market does not trust them.')],
  FX: [L('رفتار ارزها', 'Currency behaviour'), L('ارزهای پرریسک (مثل AUD و ارزهای EM) در برابر ارزهای امن (مثل JPY و CHF) قوی شده‌اند یا ضعیف؟', 'Have risky currencies (like AUD and EM currencies) strengthened or weakened against safe ones (like JPY and CHF)?')],
  EQ: [L('حال بازار سهام', 'Stock-market mood'), L('S&P 500 در یک ماه اخیر بالا رفته؟ چقدر از سقفش فاصله دارد؟', 'Has the S&P 500 risen over the past month? How far is it from its high?')],
  FUND: [L('کمبود دلار', 'Dollar shortage'), L('اگر دلار ناگهان خیلی قوی شود یا قرض گرفتن کوتاه‌مدت گران شود، یعنی دنیا دنبال دلار است؛ نشانه‌ی ترس.', 'If the dollar suddenly gets very strong or short-term borrowing gets expensive, the world is scrambling for dollars — a sign of fear.')],
});
const GLOSSARY = () => [
  ['Risk-On', L('حالتی که سرمایه‌گذارها شجاع‌اند و دارایی‌های پرریسک (سهام، ارزهای پربازده) را می‌خرند.', 'When investors feel brave and buy risky assets (stocks, high-yielding currencies).')],
  ['Risk-Off', L('حالتی که سرمایه‌گذارها می‌ترسند و پولشان را به جای امن می‌برند.', 'When investors are scared and move their money somewhere safe.')],
  ['RAI (Risk Appetite Index)', L('عدد اصلی این سایت؛ دماسنجِ شجاعتِ بازار. بالای صفر یعنی شجاعت، زیر صفر یعنی ترس. معمولاً بین −2 و +2 است.', "The site's main number: a thermometer of market courage. Above zero means courage, below zero means fear. Usually between −2 and +2.")],
  ['EMA', L('میانگینِ نرمِ چند روز اخیر. باعث می‌شود یک روز عجیب، عدد را ناگهان بالا و پایین نکند.', "A smooth average of the last few days, so one odd day doesn't make the number jump around.")],
  ['Raw RAI', L('RAI خودِ امروز، قبل از نرم شدن با EMA. تندتر تکان می‌خورد.', "Today's RAI before EMA smoothing. It moves more sharply.")],
  ['z-score', L('می‌گوید امروز چقدر با یک سال گذشته فرق دارد. 0 یعنی عادی، +2 یعنی خیلی بالاتر از عادی، −2 یعنی خیلی پایین‌تر. مثل مقایسه‌ی قد تو با میانگین قد هم‌کلاسی‌ها.', "Tells you how different today is from the past year. 0 means normal, +2 means far above normal, −2 far below. Like comparing your height with your classmates' average.")],
  ['Signed z', L('همان z-score، ولی علامتش طوری تنظیم شده که مثبت همیشه یعنی «خوب برای ریسک» و منفی یعنی «ترس». مثلاً VIX بالا برود، Signed z آن منفی می‌شود.', 'The same z-score, but with its sign set so positive always means "good for risk" and negative means "fear". For example, when VIX rises its signed z turns negative.')],
  ['Category', L('گروهی از شاخص‌ها که یک موضوع را می‌سنجند؛ مثل یک درس در کارنامه. ۵ Category داریم.', 'A group of indicators that measure one theme — like one subject on a report card. There are 5 categories.')],
  ['Regime', L('وضعیت کلی بازار؛ یکی از ۵ حالت، از Strong Risk-On تا Strong Risk-Off.', 'The overall market state: one of 5 levels, from Strong Risk-On to Strong Risk-Off.')],
  ['Confirmation', L('قانون صبر: رژیم فقط وقتی عوض می‌شود که نشانه‌ی جدید چند روز پشت سر هم تکرار شود.', 'The patience rule: the regime only changes when the new signal repeats several days in a row.')],
  ['Raw signal', L('رژیمی که فقط عدد امروز نشان می‌دهد، قبل از قانون Confirmation.', "The regime that today's number alone points to, before the confirmation rule.")],
  ['Regime type', L('دلیلِ رژیم. Risk-Off می‌تواند از ترسِ رکود باشد یا از تورم؛ درمان هر کدام فرق دارد.', 'The reason behind the regime. Risk-Off can come from recession fears or from inflation; each needs a different response.')],
  ['Breadth', L('چند درصد شاخص‌ها مثبت‌اند؛ مثل اینکه بپرسی چند نفر از کلاس دستشان را بالا برده‌اند.', 'What share of indicators is positive — like asking how many people in the class raised their hand.')],
  ['Percentile', L('رتبه‌ی امروز بین همه‌ی روزهای ثبت‌شده. 10% یعنی از هر ۱۰۰ روز، فقط ۱۰ روز این‌قدر بد یا بدتر بوده.', "Today's rank among all recorded days. 10% means only 10 days in every 100 were this bad or worse.")],
  ['Δ5', L('تغییر نسبت به ۵ روز کاری قبل (حدود یک هفته). مثبت یعنی بهتر شده، منفی یعنی بدتر.', 'Change versus 5 business days ago (about a week). Positive means better, negative means worse.')],
  ['Risk budget', L('چه مقدار از ریسکِ همیشگی‌ات را الان استفاده کنی. 50% یعنی نصفِ حالت معمول.', 'How much of your usual risk to use right now. 50% means half your normal amount.')],
  ['Safe haven', L('جای امن؛ دارایی‌هایی که موقع ترس معمولاً قوی می‌شوند: JPY، CHF، USD و طلا.', 'A safe place: assets that usually strengthen when fear rises — JPY, CHF, USD and gold.')],
  ['Carry', L('قرض گرفتن ارزی با بهره‌ی کم (مثل JPY) و خریدن ارزی با بهره‌ی زیاد (مثل MXN) برای گرفتن اختلاف بهره. در هوای آرام سود می‌دهد، در طوفان ضرر سنگین.', 'Borrowing a low-interest currency (like JPY) to buy a high-interest one (like MXN) and pocket the difference. Profitable in calm weather, very costly in a storm.')],
  ['High-beta', L('ارزهایی که تندتر از بقیه با حال بازار بالا و پایین می‌روند، مثل AUD، NZD و ZAR.', 'Currencies that swing harder than others with the market mood, like AUD, NZD and ZAR.')],
  ['EM (Emerging Markets)', L('کشورهای در حال رشد، مثل مکزیک (MXN)، برزیل (BRL)، آفریقای جنوبی (ZAR) و کره (KRW).', 'Developing economies such as Mexico (MXN), Brazil (BRL), South Africa (ZAR) and Korea (KRW).')],
  ['Volatility / VIX', L('میزان تکان خوردن قیمت‌ها. VIX را «شاخص ترس» بازار سهام آمریکا می‌گویند.', 'How much prices swing. VIX is called the "fear index" of the US stock market.')],
  ['Realized volatility', L('نوسانی که واقعاً اتفاق افتاده، از روی تغییرات روزانه‌ی قیمت در چند هفته‌ی اخیر. در مقابلش Implied volatility (مثل VIX) است که از قیمت Options می‌آید و نشان می‌دهد بازار برای آینده چقدر نوسان انتظار دارد.', 'The volatility that actually happened, measured from daily price changes over the last few weeks. Its counterpart is implied volatility (like VIX), which comes from option prices and shows how much movement the market expects ahead.')],
  ['MOVE', L('شاخص نوسان انتظاری اوراق قرضه‌ی آمریکا؛ «VIX بازار Bonds». داده‌اش رایگان نیست، برای همین اینجا Realized vol بازده ۱۰ ساله را به‌جایش (Proxy) استفاده می‌کنیم.', 'The expected-volatility index for US Treasuries: "the VIX of the bond market". Its data is not free, so here we use the realized vol of the 10-year yield as a proxy.')],
  ['OAS', L('Option-adjusted spread؛ دقیق‌ترین شکل Spread اوراق شرکتی، بر حسب درصد. HY = شرکت‌های پرریسک، IG = شرکت‌های معتبر.', 'Option-adjusted spread: the most precise form of a corporate bond spread, in percent. HY = riskier companies, IG = higher-quality companies.')],
  ['Spread', L('بهره‌ی اضافه‌ای که یک شرکت نسبت به دولت آمریکا می‌دهد. بالا رفتنش یعنی بازار به شرکت‌ها کمتر اعتماد دارد.', 'The extra interest a company pays over the US government. When it rises, the market trusts companies less.')],
  ['Correlation', L('اینکه دو چیز با هم بالا و پایین می‌روند یا نه. +1 یعنی کاملاً با هم، −1 یعنی برعکس هم.', 'Whether two things move up and down together. +1 means fully together, −1 means exact opposites.')],
  ['Divergence', L('وقتی دو چیزی که معمولاً با هم حرکت می‌کنند از هم جدا شوند؛ یک زنگ خطر.', 'When two things that usually move together split apart — a warning bell.')],
  ['Hedge', L('بیمه‌ی معامله؛ چیزی که اگر اتفاق بد بیفتد، ضررت را کم می‌کند.', 'Insurance for a trade: something that cuts your loss if the bad thing happens.')],
  ['Guardrail', L(`ترمز اضطراری مدل. z-score فقط با یک سال گذشته مقایسه می‌کند؛ اگر بحران طولانی شود، کم‌کم «عادی» به نظر می‌رسد. Guardrail سطح مطلق را هم چک می‌کند: VIX بالای ${D.meta.guard.VIX} یا HY OAS بالای ${D.meta.guard.HY}% یعنی استرس واقعی، مهم نیست z چه بگوید.`, `The model's emergency brake. A z-score only compares with the past year, so a long crisis slowly starts to look "normal". The guardrail also checks absolute levels: VIX above ${D.meta.guard.VIX} or HY OAS above ${D.meta.guard.HY}% means real stress, whatever the z-score says.`)],
  ['Tail risk', L('خطرِ اتفاق‌های نادر ولی خیلی بد.', 'The risk of rare but very bad events.')],
  ['Drawdown', L('چقدر قیمت از بالاترین سطحش پایین آمده.', 'How far the price has fallen from its highest level.')],
  ['Yield (10Y, 2Y)', L('سودی که اوراق قرضه‌ی دولت آمریکا می‌دهد. 10Y یعنی ۱۰ ساله، 2Y یعنی ۲ ساله.', 'The return paid by US government bonds. 10Y means 10-year, 2Y means 2-year.')],
  ['Breakeven', L('تورمی که بازار برای سال‌های آینده انتظار دارد.', 'The inflation the market expects over the coming years.')],
  ['Real yield', L('سود اوراق بعد از کم کردن تورم.', 'The bond yield after subtracting inflation.')],
  ['Long / Short', L('Long یعنی خرید به امید بالا رفتن؛ Short یعنی فروش به امید پایین رفتن.', 'Long means buying in the hope it rises; Short means selling in the hope it falls.')],
  ['Invalidation', L('نشانه‌ای که می‌گوید سناریو دیگر درست نیست و باید تجدیدنظر کنی.', 'A sign that the scenario no longer holds and you should rethink.')],
  [L('ECB (برچسب زرد)', 'ECB (yellow tag)'), L('FRED نرخ ارزها را هفته‌ای یک بار منتشر می‌کند. برای روزهای بین، از نرخ‌های بانک مرکزی اروپا (ECB) تخمین می‌زنیم و بعداً عدد رسمی جایش می‌نشیند.', 'FRED publishes FX rates once a week. For the days in between we estimate from European Central Bank (ECB) rates, and the official number replaces it later.')],
];
function renderGuide(el) {
  const k = D.kpi, g = REG[k.regime], thr = D.meta.thr, K = D.meta.k, wx = WX(), cs = CAT_SIMPLE();
  const prim = D.types.find(x => x.code === D.primary), sec = D.types.find(x => x.code === D.secondary);
  const rp = D.regimes.find(r => r.reg === k.regime) || {}, onA = D.alerts.filter(a => a.on);
  const budget = Math.round((rp.budget || 0) * 100), to = L('تا', 'to');
  const range = { SON: `RAI ≥ ${sg(thr.TSON)}`, ON: `${sg(thr.TON)} ${to} ${sg(thr.TSON)}`, NEU: `${sg(thr.TOFF)} ${to} ${sg(thr.TON)}`, OFF: `${sg(thr.TSOFF)} ${to} ${sg(thr.TOFF)}`, SOFF: `RAI ≤ ${sg(thr.TSOFF)}` };
  const step = (n, title, body) => `<div class="g-step"><span class="g-num">${n}</span><div><h4>${title}</h4>${body}</div></div>`;
  const head = (id, title, sub) => `<div class="section-title g-sec" id="g-${id}"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const TOC = [['what', L('در یک نگاه', 'At a glance')], ['today', L('امروز را با هم بخوانیم', "Reading today's data")], ['weather', L('۵ حالت بازار', 'The 5 market states')], ['routine', L('روتین ۲ دقیقه‌ای', '2-minute routine')],
    ['tabs', L('هر بخش سایت', 'Each section')], ['how', L('ماشین چطور فکر می‌کند؟', 'How the machine thinks')], ['mistakes', L('اشتباه‌های رایج', 'Common mistakes')], ['faq', L('سؤال‌های رایج', 'FAQ')], ['words', L('واژه‌نامه', 'Glossary')], ['pro', L('جزئیات فنی', 'Technical details')]];
  el.innerHTML = `
  <div class="page-head fade-in"><div><h1>${L('راهنمای استفاده', 'User guide')}</h1><p>${L('همه‌چیز به زبان ساده؛ لازم نیست چیزی از قبل بدانی.', "Everything in plain language — you don't need to know anything beforehand.")}</p></div></div>
  <div class="g-toc fade-in">${TOC.map(([id, t]) => `<button data-go="g-${id}">${t}</button>`).join('')}</div>

  ${head('what', L('این سایت در یک نگاه', 'This site at a glance'))}
  <div class="grid fade-in">
    <div class="card c7 g-hero">${L(`
      <p class="g-big">این سایت مثل <b>پیش‌بینی هوا</b> است، ولی برای بازارهای مالی.</p>
      <p>هر روز ده‌ها عدد از بازار جهانی جمع می‌کند و به یک سؤال ساده جواب می‌دهد:</p>
      <p class="g-q">«امروز سرمایه‌گذارهای دنیا <b>شجاع‌اند</b> یا <b>ترسیده‌اند</b>؟»</p>
      <p>وقتی شجاع‌اند می‌گوییم <b>Risk-On</b> (هوا آفتابی است ☀️). وقتی ترسیده‌اند می‌گوییم <b>Risk-Off</b> (هوا طوفانی است ⛈️).</p>
      <p>چرا مهم است؟ چون در هوای آفتابی بعضی ارزها (مثل AUD و MXN) بالا می‌روند و در هوای طوفانی ارزهای دیگری (مثل JPY و CHF). اگر بدانی هوا چطور است، می‌دانی کدام طرف بایستی و با چه اندازه‌ای معامله کنی.</p>`, `
      <p class="g-big">This site is like a <b>weather forecast</b>, but for financial markets.</p>
      <p>Every day it collects dozens of numbers from global markets and answers one simple question:</p>
      <p class="g-q">"Are the world's investors <b>feeling brave</b> or <b>scared</b> today?"</p>
      <p>When they are brave we call it <b>Risk-On</b> (sunny weather ☀️). When they are scared we call it <b>Risk-Off</b> (stormy weather ⛈️).</p>
      <p>Why does it matter? In sunny weather some currencies (like AUD and MXN) rise, and in stormy weather others do (like JPY and CHF). If you know the weather, you know which side to stand on and how big to trade.</p>`)}
    </div>
    <div class="card c5">
      <h3 style="font-size:15.5px;margin-bottom:12px">${L('سه چیزی که این سایت به تو می‌گوید', 'Three things this site tells you')}</h3>
      ${step(1, L('هوا چطور است؟', "What's the weather?"), L('<p>رژیم بازار: یکی از ۵ حالت، از Strong Risk-On (خیلی آفتابی) تا Strong Risk-Off (خیلی طوفانی).</p>', '<p>The market regime: one of 5 states, from Strong Risk-On (very sunny) to Strong Risk-Off (very stormy).</p>'))}
      ${step(2, L('چرا این‌طور است؟', 'Why is it like this?'), L('<p>Regime type: مثلاً «ترس از رکود» یا «فشار روی شرکت‌های بدهکار». هر دلیل، درمان خودش را دارد.</p>', '<p>Regime type: for example "recession fear" or "stress on indebted companies". Each cause has its own remedy.</p>'))}
      ${step(3, L('حالا چه کنم؟', 'What do I do now?'), L('<p>Playbook: کدام ارزها را بخری، از کدام دوری کنی و چقدر ریسک کنی.</p>', '<p>Playbook: which currencies to buy, which to avoid, and how much risk to take.</p>'))}
    </div>
  </div>

  ${head('today', L('امروز را با هم بخوانیم', "Let's read today together"), L(`با داده‌های واقعیِ ${N(k.date)}؛ هر روز خودکار عوض می‌شود.`, `Using real data from ${N(k.date)}; it updates automatically every day.`))}
  <div class="card fade-in g-today rc-${g.k}">
    ${step(1, `${L('هوا', 'Weather')}: ${wx[g.k].ic} ${chipReg(k.regime)}`, `<p>${wx[g.k].sky}. ${wx[g.k].plain}</p>`)}
    ${step(2, `${L('دماسنج', 'Thermometer')} (RAI): ${N(f2(k.ema))}`, L(
      `<p>صفر یعنی عادی؛ هرچه منفی‌تر، ترس بیشتر. ${k.d5 < 0 ? `در ۵ روز گذشته <b>بدتر</b> شده (${N(sg(k.d5))}).` : `در ۵ روز گذشته <b>بهتر</b> شده (${N(sg(k.d5))}).`} فقط ${N(Math.round(k.pct * 100) + '%')} روزهای ثبت‌شده این‌قدر یا بیشتر ${k.ema < 0 ? 'ترسناک' : 'پایین'} بوده‌اند.</p>`,
      `<p>Zero means normal; the more negative, the more fear. ${k.d5 < 0 ? `It got <b>worse</b> over the last 5 days (${N(sg(k.d5))}).` : `It got <b>better</b> over the last 5 days (${N(sg(k.d5))}).`} Only ${N(Math.round(k.pct * 100) + '%')} of recorded days were ${k.ema < 0 ? 'this fearful or worse' : 'this low or lower'}.</p>`))}
    ${step(3, L(`چند روز است؟ ${N(k.days)} روز`, `How long? ${N(k.days)} days`), L(
      `<p>این حالت ${N(k.days)} روز است که ادامه دارد. ${N(Math.round(k.breadth * 100) + '%')} شاخص‌ها مثبت‌اند (Breadth)؛ ${k.breadth < 0.4 ? 'یعنی بیشتر نشانه‌ها منفی‌اند.' : k.breadth > 0.6 ? 'یعنی بیشتر نشانه‌ها مثبت‌اند.' : 'یعنی نشانه‌ها نصف‌نصف‌اند.'}</p>`,
      `<p>This state has lasted ${N(k.days)} days. ${N(Math.round(k.breadth * 100) + '%')} of indicators are positive (Breadth), ${k.breadth < 0.4 ? 'so most signals are negative.' : k.breadth > 0.6 ? 'so most signals are positive.' : 'so the signals are split down the middle.'}</p>`))}
    ${step(4, `${L('چرا؟', 'Why?')} <span class="en">${prim.en}</span>`, `<p>${dx(prim, 'sig')} (${L(`${N(prim.met + ' از 5')} نشانه‌ی این الگو دیده می‌شود.`, `${N(prim.met + ' of 5')} signs of this pattern are present.`)})${sec ? ` ${L('الگوی دوم', 'Second pattern')}: <b class="en">${sec.en}</b>.` : ''}</p>`)}
    ${step(5, L('حالا چه کنم؟', 'What do I do now?'), `<p><b>Long:</b> ${dx(prim, 'long')}<br><b>Short / Avoid:</b> ${dx(prim, 'short')}<br><b>Risk budget:</b> ${N(budget + '%')}${L(`؛ یعنی اگر معمولاً با ۱۰ واحد ریسک معامله می‌کنی، الان حدود ${N(String(Math.round(budget / 10)))} واحد.`, ` — if you normally trade with 10 units of risk, use about ${N(String(Math.round(budget / 10)))} units now.`)}</p>`)}
    ${step(6, L(`هشدارها: ${N(onA.length)} مورد فعال`, `Alerts: ${N(onA.length)} active`), onA.length ? `<ul class="g-list">${onA.map(a => `<li>${dx(a, 't')}</li>`).join('')}</ul>` : `<p>${L('هیچ هشدار فعالی نیست.', 'No active alerts.')}</p>`)}
  </div>

  ${head('weather', L('۵ حالت بازار', 'The 5 market states'), L('هر حالت یعنی چه و در آن چه کنیم؟', 'What each state means and what to do in it'))}
  <div class="g-weather fade-in">${['SON', 'ON', 'NEU', 'OFF', 'SOFF'].map(key => {
    const lab = BYN[{ SON: 2, ON: 1, NEU: 0, OFF: -1, SOFF: -2 }[key]], r = D.regimes.find(x => x.reg === lab);
    return `<div class="g-wx rc-${key} ${key === g.k ? 'now' : ''}">
      <div class="g-wx-top"><span class="g-ic">${wx[key].ic}</span>${key === g.k ? `<span class="chip ghost">${L('امروز', 'Today')}</span>` : ''}</div>
      <h3 class="en">${lab}</h3><div class="muted" style="font-size:12.5px">${wx[key].sky} · ${N(range[key])}</div>
      <p>${wx[key].plain}</p><p class="g-todo"><b>${L('چه کنم؟', 'What to do?')}</b> ${wx[key].todo}</p>
      <div class="g-budget"><span>Risk budget</span><div class="budget-bar"><i style="width:${r.budget * 100}%"></i></div><b class="num">${Math.round(r.budget * 100)}%</b></div>
    </div>`;
  }).join('')}</div>

  ${head('routine', L('روتین ۲ دقیقه‌ای هر روز', 'A 2-minute daily routine'), L('هر روز همین ۶ قدم را به ترتیب برو.', 'Go through these 6 steps in order every day.'))}
  <div class="grid fade-in"><div class="card c12 g-steps">
    ${step(1, L('اسم و رنگ رژیم را ببین', "Check the regime's name and colour"), L('<p>بالای صفحه‌ی <a href="#overview">نمای کلی</a>. قرمز یعنی ترس، آبی یعنی شجاعت، خاکستری یعنی نامعلوم.</p>', '<p>At the top of the <a href="#overview">Overview</a> page. Red means fear, blue means courage, grey means unclear.</p>'))}
    ${step(2, L('جهت را ببین: بهتر می‌شود یا بدتر؟', 'Check the direction: getting better or worse?'), L('<p>روی نوار رنگی، دایره‌ی بزرگ امروز است و نقطه‌ی کوچک ۵ روز پیش. اگر دایره به سمت راست (آبی) رفته، اوضاع بهتر شده؛ اگر به سمت چپ (قرمز) رفته، بدتر. عدد Δ5 زیر RAI هم همین را می‌گوید.</p>', '<p>On the colour bar, the big circle is today and the small dot is 5 days ago. If the circle moved right (blue), things improved; if it moved left (red), they got worse. The Δ5 number under RAI says the same.</p>'))}
    ${step(3, L('دلیل را بخوان', 'Read the reason'), L('<p>کارت «چرا …؟» در <a href="#overview">نمای کلی</a>: نوع اصلی رژیم و ۵ نشانه‌اش (✓ یعنی آن نشانه دیده می‌شود).</p>', '<p>The "Why …?" card on the <a href="#overview">Overview</a>: the primary regime type and its 5 signs (✓ means that sign is present).</p>'))}
    ${step(4, L('کارت‌های Long و Short را بخوان', 'Read the Long and Short cards'), L('<p>همان‌جا: کدام ارزها معمولاً در این وضعیت قوی‌اند و کدام ضعیف. کارت Invalidation می‌گوید چه چیزی این داستان را باطل می‌کند.</p>', '<p>Right there: which currencies are usually strong in this situation and which are weak. The Invalidation card tells you what would break the story.</p>'))}
    ${step(5, L('هشدارهای زرد را چک کن', 'Check the yellow alerts'), L('<p>مثلث زرد ⚠ یعنی چیزی غیرعادی است. هشدارها معمولاً زودتر از تغییر رژیم خبر می‌دهند. اگر زیر اسم رژیم کادر <b>Guardrail</b> دیدی، یعنی سطح ترس بازار به‌طور مطلق بالاست؛ اگر قرمز باشد، رژیم احتمالاً اوضاع را خوش‌بینانه‌تر از واقع نشان می‌دهد.</p>', '<p>A yellow triangle ⚠ means something unusual. Alerts often give warning before the regime changes. If you see a <b>Guardrail</b> box under the regime name, market fear is high in absolute terms; if it is red, the regime is probably painting a rosier picture than reality.</p>'))}
    ${step(6, L('ارز خودت را در FX Board پیدا کن', 'Find your currency on the FX Board'), L('<p>در <a href="#fx">FX Board</a> ببین ارزی که می‌خواهی معامله کنی «طبق انتظار» رفتار می‌کند یا ⚠ دارد. بعد اندازه‌ی معامله را با Risk budget تنظیم کن.</p>', '<p>On the <a href="#fx">FX Board</a>, see whether the currency you want to trade is behaving "As expected" or has a ⚠. Then size the trade with the risk budget.</p>'))}
  </div></div>

  ${head('tabs', L('هر بخش سایت به چه کاری می‌آید؟', 'What is each section for?'))}
  <div class="g-tabs fade-in">${[
    ['overview', L('نمای کلی', 'Overview'), L('الان بازار چه حالی دارد؟', "What's the market mood right now?"), L('هر روز', 'Daily'), L('همه‌ی چیزهای مهم در یک صفحه: رژیم، دماسنج RAI، دلیل، هشدارها و نمره‌ی ۵ Category.', 'Everything important on one page: the regime, the RAI thermometer, the reason, alerts and the 5 category scores.')],
    ['history', L('تاریخچه و آمار', 'History & stats'), L('قبلاً چنین وضعی کی بوده و بعدش چه شد؟', 'When did this happen before, and what came next?'), L('هفته‌ای یک بار', 'Weekly'), L('نمودار RAI در کنار S&P 500 و ارزها، همه‌ی دوره‌های رژیم و اینکه بعد از هر رژیم بازار معمولاً چه کرده. دکمه‌ی دانلود CSV هم دارد.', 'RAI charted next to the S&P 500 and currencies, every regime episode, and what markets usually did after each regime. It also has a CSV download button.')],
    ['fx', 'FX Board', L('کدام ارزها قوی‌اند و کدام ضعیف؟', 'Which currencies are strong and which are weak?'), L('قبل از هر معامله', 'Before every trade'), L('عملکرد ۱۵ ارز در برابر USD. ستون «سازگاری با رژیم» می‌گوید هر ارز طبق انتظار رفتار می‌کند یا نه.', 'Performance of 15 currencies vs USD. The "Regime fit" column tells you whether each currency is behaving as expected.')],
    ['indicators', L('شاخص‌ها', 'Indicators'), L('کدام تکه‌ی پازل باعث این وضع شده؟', 'Which piece of the puzzle is driving this?'), L('وقتی کنجکاوی', "When you're curious"), L('هر شاخص یک کارت دارد: عدد امروز، نمودار ۶ ماه و اینکه داده‌اش تازه است یا نه.', "Each indicator has a card: today's number, a 6-month chart, and whether its data is fresh.")],
    ['playbook', L('الگوها و Playbook', 'Types & Playbook'), L('در هر نوع رژیم معمولاً چه کار می‌کنند؟', 'What do traders usually do in each regime type?'), L('برای یادگیری', 'For learning'), L('همه‌ی ۱۱ الگو با نشانه‌ها و راهنمای عملی. الگوی امروز با حاشیه‌ی رنگی مشخص است.', "All 11 patterns with their signs and practical guidance. Today's pattern has a coloured border.")],
    ['lab', 'Model Lab', L('اگر تنظیمات را عوض کنم چه می‌شود؟', 'What happens if I change the settings?'), L('برای حرفه‌ای‌ها', 'For pros'), L('با اسلایدرها بازی کن تا ببینی مدل چطور تغییر می‌کند. چیزی خراب نمی‌شود؛ با دکمه‌ی «بازگشت به پیش‌فرض» یا رفرش صفحه همه‌چیز برمی‌گردد.', 'Play with the sliders to see how the model changes. Nothing breaks — "Reset to defaults" or a page refresh brings everything back.')],
  ].map(([h, t, q, when, d]) => `<a class="g-tab" href="#${h}"><div class="flex" style="justify-content:space-between"><h3>${t}</h3><span class="chip ghost">${when}</span></div>
      <p class="g-tq">${L(`«${q}»`, `"${q}"`)}</p><p>${d}</p></a>`).join('')}</div>

  ${head('how', L('ماشین چطور فکر می‌کند؟', 'How does the machine think?'), L('مثل معدل گرفتن از یک کارنامه.', 'Like averaging the grades on a report card.'))}
  <div class="grid fade-in">
    <div class="card c7 g-steps">
      ${step(1, L('جمع کردن عددها', 'Collecting the numbers'), L(`<p>هر روز ${N(D.inds.length)} عدد از بازار جمع می‌شود؛ مثل VIX، S&P 500، نرخ ارزها و Spreadها.</p>`, `<p>Every day ${N(D.inds.length)} market numbers are collected, such as VIX, the S&P 500, exchange rates and spreads.</p>`))}
      ${step(2, L('مقایسه با یک سال گذشته', 'Comparing with the past year'), L('<p>هر عدد با یک سال گذشته‌ی خودش مقایسه می‌شود (z-score). سؤال این است: «امروز عادی است یا غیرعادی؟» مثلاً VIX = 20 در یک سال آرام زیاد است، ولی در یک سال پرتنش عادی.</p>', '<p>Each number is compared with its own past year (z-score). The question is: "Is today normal or unusual?" For example, VIX = 20 is high after a calm year but normal after a turbulent one.</p>'))}
      ${step(3, L('نمره‌ی هر درس', 'A grade per subject'), L('<p>عددها در ۵ گروه (Category) جمع می‌شوند و هر گروه یک نمره می‌گیرد؛ مثل نمره‌ی ۵ درس.</p>', '<p>The numbers are grouped into 5 categories and each category gets a score — like grades in 5 subjects.</p>'))}
      ${step(4, L('معدل', 'The average'), L('<p>میانگین این ۵ نمره می‌شود <b>RAI</b>. بعد با EMA کمی نرم می‌شود تا یک روز عجیب همه‌چیز را به هم نریزد.</p>', "<p>The average of these 5 scores is the <b>RAI</b>. It is then smoothed a little with an EMA so one odd day doesn't upset everything.</p>"))}
      ${step(5, L('برچسب زدن', 'Labelling'), L(`<p>RAI با خط‌کش مقایسه می‌شود (بخش «۵ حالت بازار» را ببین) و رژیم مشخص می‌شود. ولی رژیم فقط وقتی عوض می‌شود که حالت جدید <b>${N(K)} روز پشت سر هم</b> تکرار شود؛ با یک روز باران نمی‌گوییم زمستان شده.</p>`, `<p>The RAI is compared with a ruler (see "The 5 market states") to set the regime. But the regime only changes when the new state repeats <b>${N(K)} days in a row</b> — one rainy day doesn't make it winter.</p>`))}
      ${step(6, L('پیدا کردن دلیل', 'Finding the reason'), L('<p>۱۱ الگو بررسی می‌شوند. هر الگو ۵ سؤال بله/خیر دارد (مثلاً «آیا JPY قوی شده؟»). الگویی که بیشترین «بله» را بگیرد، نوع اصلی رژیم است.</p>', '<p>11 patterns are checked. Each has 5 yes/no questions (e.g. "Has JPY strengthened?"). The pattern with the most "yes" answers is the primary regime type.</p>'))}
    </div>
    <div class="card c5">
      <h3 style="font-size:15.5px;margin-bottom:12px">${L('۵ درسِ کارنامه', 'The 5 subjects on the report card')}</h3>
      ${D.cats.map(c => `<div class="g-cat"><span class="g-dot" style="background:var(${CATCOL[c.code]})"></span><div><b class="en">${c.en}</b> <span class="muted">· ${cs[c.code][0]} · ${L('وزن', 'weight')} ${N(Math.round(c.w * 100) + '%')}</span><p>${cs[c.code][1]}</p></div></div>`).join('')}
      <p class="note">${L('در همه‌ی سایت، عدد مثبت یعنی «خوب برای ریسک» و عدد منفی یعنی «ترس».', 'Across the whole site, a positive number means "good for risk" and a negative number means "fear".')}</p>
    </div>
  </div>

  ${head('mistakes', L('اشتباه‌های رایج', 'Common mistakes'))}
  <div class="g-mis fade-in">${[
    [L('فکر کنی Strong Risk-Off یعنی «همین الان بفروش».', 'Thinking Strong Risk-Off means "sell right now".'), L('یعنی «هوا طوفانی است؛ کوچک‌تر و محتاط‌تر معامله کن». نقطه‌ی ورود را با تحلیل خودت پیدا کن.', 'It means "the weather is stormy; trade smaller and more carefully". Find your entry with your own analysis.')],
    [L('با یک روز بد تصمیم بگیری.', 'Deciding based on one bad day.'), L('به جهت چند روزه نگاه کن (Δ5 و رنگ‌های نمودار RAI).', 'Look at the multi-day direction (Δ5 and the colours on the RAI chart).')],
    [L('فقط به اسم رژیم نگاه کنی.', 'Looking only at the regime name.'), L('دلیل (Regime type) مهم‌تر است؛ مثلاً در Inflation Shock، JPY دیگر جای امن نیست.', 'The reason (regime type) matters more; in an Inflation Shock, for example, JPY is no longer a safe place.')],
    [L('فکر کنی عددها لحظه‌ای‌اند.', 'Assuming the numbers are real-time.'), L('داده‌ها مربوط به بسته شدن روز قبلِ بازار آمریکا هستند. تاریخ آخرین داده بالای صفحه است.', "The data is from the previous US market close. The latest data date is shown at the top of the page.")],
  ].map(([bad, good]) => `<div class="card"><p class="g-bad">✗ ${bad}</p><p class="g-good">✓ ${good}</p></div>`).join('')}</div>

  ${head('faq', L('سؤال‌های رایج', 'Frequently asked questions'))}
  <div class="card fade-in g-faq">${[
    [L('سایت کی به‌روز می‌شود؟', 'When does the site update?'), L('هر روز کاری، خودکار و دو بار: حدود ساعت ۰۲:۰۰ و ۱۷:۳۰ به وقت تهران. تاریخ آخرین داده بالای صفحه نوشته شده.', 'Automatically, twice every business day: around 22:30 and 14:00 UTC. The latest data date is shown at the top of the page.')],
    [L('RAI از خط رد شد ولی رژیم عوض نشد. چرا؟', "RAI crossed a line but the regime didn't change. Why?"), L(`به‌خاطر قانون صبر (Confirmation): حالت جدید باید ${K} روز پشت سر هم تکرار شود. تا آن موقع، Raw signal را زیر اسم رژیم ببین.`, `Because of the patience rule (Confirmation): the new state must repeat ${K} days in a row. Until then, check the Raw signal under the regime name.`)],
    [L('برچسب زرد ECB یعنی چه؟', 'What does the yellow ECB tag mean?'), L('FRED نرخ ارزها را هفته‌ای یک بار منتشر می‌کند. برای روزهای بین، نرخ را از بانک مرکزی اروپا (ECB) تخمین می‌زنیم. خطای این تخمین معمولاً کمتر از نیم درصد است و بعداً عدد رسمی جایش می‌نشیند.', 'FRED publishes FX rates once a week. For the days in between we estimate the rate from the European Central Bank (ECB). The estimate is usually within half a percent, and the official number replaces it later.')],
    [L('هشدارها با رژیم جور درنمی‌آیند. یعنی چه؟', "The alerts don't match the regime. What does that mean?"), L('یعنی احتمال تغییر وجود دارد. مثلاً رژیم Risk-On است ولی هشدار «Credit رالی Equities را تأیید نمی‌کند» فعال شده؛ پس با احتیاط بیشتر جلو برو.', 'It means a change may be coming. For example, the regime is Risk-On but the "Credit is not confirming the equity rally" alert is active — so proceed with more caution.')],
    [L('چرا Spreadهای HY و IG عدد خام ندارند؟', "Why don't the HY and IG spreads show raw numbers?"), L('طبق شرایط استفاده از داده‌های ICE BofA در FRED، فقط z-score آن‌ها را نشان می‌دهیم.', "Under the terms of use for ICE BofA data on FRED, we only show their z-scores.")],
    [L('کادر Guardrail زیر اسم رژیم یعنی چه؟', 'What is the Guardrail box under the regime name?'), L(`مدل هر عدد را با یک سال گذشته‌اش مقایسه می‌کند. اگر بحران طولانی شود، مدل کم‌کم به آن عادت می‌کند و ترس را کمتر نشان می‌دهد. Guardrail این مشکل را جبران می‌کند: اگر VIX بالای ${D.meta.guard.VIX} یا HY OAS بالای ${D.meta.guard.HY}% برود، کادر ظاهر می‌شود. زرد یعنی رژیم هم ترس را تأیید می‌کند؛ قرمز یعنی رژیم Neutral یا بهتر است ولی سطح واقعی استرس بالاست، پس به رژیم کمتر اعتماد کن.`, `The model compares each number with its own past year. If a crisis drags on, the model slowly gets used to it and shows less fear. The guardrail fixes this: if VIX goes above ${D.meta.guard.VIX} or HY OAS above ${D.meta.guard.HY}%, the box appears. Yellow means the regime agrees there is fear; red means the regime is Neutral or better while real stress is high, so trust the regime less.`)],
    [L('چرا فقط یک سال گذشته؟', 'Why only the past year?'), L('بازارها عوض می‌شوند و چیزی که ۵ سال پیش عادی بود شاید امروز عادی نباشد. یک سال تعادل خوبی بین «به‌روز بودن» و «پایدار بودن» است و نقطه‌ضعف این انتخاب را Guardrail پوشش می‌دهد. Spreadهای ICE هم در FRED فقط برای ۳ سال اخیر در دسترس‌اند.', 'Markets change, and what was normal five years ago may not be normal today. One year balances being up to date with being stable, and the guardrail covers the weak spot of this choice. ICE spreads are also only available on FRED for the last 3 years.')],
    [L('کد و داده‌ها کجاست؟', 'Where are the code and data?'), L(`کل کد مدل و سایت روی <a href="${GH}" target="_blank" rel="noopener">GitHub</a> است. داده‌ها از FRED و ECB گرفته می‌شوند و هر کسی می‌تواند مدل را خودش اجرا کند.`, `All the model and site code is on <a href="${GH}" target="_blank" rel="noopener">GitHub</a>. The data comes from FRED and the ECB, and anyone can run the model themselves.`)],
    [L('این ابزار به من می‌گوید چه بخرم؟', 'Does this tool tell me what to buy?'), L('نه. فقط می‌گوید هوای بازار چطور است و معمولاً در چنین هوایی چه چیزهایی خوب کار می‌کنند. این ابزار آموزشی است و توصیه‌ی سرمایه‌گذاری نیست.', 'No. It only tells you what the market weather is like and what usually works in that weather. It is an educational tool, not investment advice.')],
    [L('سؤال یا پیشنهاد دارم.', 'I have a question or suggestion.'), L(`در Telegram به ${TG} پیام بده.`, `Send a message to ${TG} on Telegram.`)],
  ].map(([q, a]) => `<details><summary><span>${q}</span></summary><p>${a}</p></details>`).join('')}</div>

  ${head('words', L('واژه‌نامه', 'Glossary'), L('همه‌ی کلمه‌های تخصصی سایت، به زبان ساده.', 'All the technical words on the site, in plain language.'))}
  <div class="fade-in"><input class="g-search" id="gSearch" type="search" placeholder="${L('جست‌وجو… (مثلاً Carry یا ترس)', 'Search… (e.g. Carry or fear)')}">
  <div class="g-words" id="gWords">${GLOSSARY().map(([t, d]) => `<div class="g-word"><b class="en">${t}</b><p>${d}</p></div>`).join('')}</div></div>

  ${head('pro', L('برای حرفه‌ای‌ها: جزئیات فنی', 'For pros: technical details'), L('اگر تازه‌کاری، این بخش را لازم نداری.', "If you're new, you can skip this section."))}
  <details class="card fade-in g-pro"><summary>${L('نمایش جزئیات فنی و فهرست داده‌ها', 'Show technical details and the data list')}</summary>
    <div class="grid" style="margin-top:14px"><div class="c8 prose">${L(`
      <p><b>Transformها:</b> LEVEL = خود سطح (Volatility و Spreadها)؛ RET = Log return ${D.meta.nw} روزه؛ DD = Drawdown از سقف ${D.meta.lb} روزه؛ CP10 = میانگین ۱۰ روزه CP – T-bill spread. UST 10Y Realized Vol = انحراف معیار تغییرات روزانه‌ی بازده ۱۰ ساله در ${D.meta.nw} روز، سالانه‌شده و بر حسب bp (Proxy برای MOVE).</p>
      <p><b>Rolling z-score:</b> z = (x − Mean ${D.meta.lb} روز) ÷ Std dev ${D.meta.lb} روز، Capped در ±${D.meta.cap}، ضربدر جهت شاخص (Signed z).</p>
      <p><b>Categoryها و RAI:</b> Score هر Category میانگین Signed z شاخص‌های در دسترس است؛ RAI میانگین وزنی Categoryهاست و اگر داده‌ای نباشد وزن‌ها دوباره نرمال می‌شوند.</p>
      <p><b>Smoothing و Confirmation:</b> EMA ${D.meta.span} روزه؛ رژیم پس از ${K} روز پیاپی برچسب جدید عوض می‌شود. آستانه‌ها: ${N(range.SON)}، ${N(range.ON)}، ${N(range.NEU)}، ${N(range.OFF)}، ${N(range.SOFF)}.</p>
      <p><b>Regime type:</b> 5 شرط روی z-score تغییرات ${D.meta.nw} روزه (Yields، Breakeven، Real yield، WTI، USDJPY، USD)، Category scoreها و Correlationها. هر شرط یک Margin بین −1 و +1 دارد؛ Strength = میانگین Marginها. نوع اصلی از میان الگوهای هم‌خانواده با رژیم فعلی انتخاب می‌شود.</p>
      <p><b>داده:</b> FRED، و برای روزهای بعد از آخرین انتشار هفتگی H.10، ECB reference rates (با زنجیر کردن تغییرات روزانه روی آخرین عدد FRED). FRED فقط ۳ سال اخیر Spreadهای ICE را منتشر می‌کند، پس Category Credit از حدود نوامبر 2024 (پس از ${D.meta.lb} مشاهده) z دارد. StL Fed FSI و Chicago NFCI فقط برای مقایسه نمایش داده می‌شوند و در RAI نیستند.</p>
      <p><b>Guardrail:</b> مستقل از z-score، اگر VIX ≥ ${D.meta.guard.VIX} یا HY OAS ≥ ${D.meta.guard.HY}% باشد Alert فعال می‌شود؛ اگر همزمان رژیم Neutral یا بهتر باشد، Overview هشدار می‌دهد که رژیم ممکن است استرس را کم نشان دهد. منطق رژیم را تغییر نمی‌دهد.</p>
      <p><b>محدودیت‌ها:</b> z-score نسبی است؛ پس از یک سال آرام، افزایش معمولی هم «استرس» دیده می‌شود. Guardrail بخشی از این ضعف را پوشش می‌دهد. Proxy نوسان Bonds از نوع Realized است و کمی دیرتر از MOVE واکنش نشان می‌دهد. شاخص رژیم را نشان می‌دهد نه Entry point؛ آن را با Positioning، Valuation و Catalystها ترکیب کن.</p>
      <p><b>کد منبع:</b> <a href="${GH}" target="_blank" rel="noopener">github.com/SinaFXD/RiskRegimeMonitor</a></p>`, `
      <p><b>Transforms:</b> LEVEL = the level itself (volatility and spreads); RET = ${D.meta.nw}-day log return; DD = drawdown from the ${D.meta.lb}-day high; CP10 = 10-day average of the CP – T-bill spread. UST 10Y Realized Vol = standard deviation of daily 10-year yield changes over ${D.meta.nw} days, annualised, in bp (a MOVE proxy).</p>
      <p><b>Rolling z-score:</b> z = (x − ${D.meta.lb}-day mean) ÷ ${D.meta.lb}-day std dev, capped at ±${D.meta.cap}, multiplied by the indicator's direction (signed z).</p>
      <p><b>Categories and RAI:</b> each category score is the mean signed z of its available indicators; RAI is the weighted mean of the categories, with weights re-normalised when data is missing.</p>
      <p><b>Smoothing and confirmation:</b> ${D.meta.span}-day EMA; the regime changes after ${K} consecutive days with a new label. Thresholds: ${N(range.SON)}, ${N(range.ON)}, ${N(range.NEU)}, ${N(range.OFF)}, ${N(range.SOFF)}.</p>
      <p><b>Regime type:</b> 5 conditions on the z-score of ${D.meta.nw}-day changes (yields, breakeven, real yield, WTI, USDJPY, USD), category scores and correlations. Each condition has a margin between −1 and +1; Strength = mean of the margins. The primary type is chosen among patterns in the same family as the current regime.</p>
      <p><b>Data:</b> FRED, plus ECB reference rates for the days after the latest weekly H.10 release (chaining daily changes onto FRED's last value). FRED only publishes the last 3 years of ICE spreads, so the Credit category has z-scores from about November 2024 (after ${D.meta.lb} observations). The St. Louis Fed FSI and Chicago NFCI are shown for comparison only and are not part of the RAI.</p>
      <p><b>Guardrail:</b> independent of the z-scores, an alert fires when VIX ≥ ${D.meta.guard.VIX} or HY OAS ≥ ${D.meta.guard.HY}%; if the regime is Neutral or better at the same time, the overview warns that the regime may be understating stress. It does not change the regime logic.</p>
      <p><b>Limitations:</b> the z-score is relative — after a calm year, an ordinary rise can register as "stress". The guardrail covers part of this weakness. The bond-volatility proxy is realized, so it reacts a little later than MOVE. The index shows the regime, not an entry point; combine it with positioning, valuation and catalysts.</p>
      <p><b>Source code:</b> <a href="${GH}" target="_blank" rel="noopener">github.com/SinaFXD/RiskRegimeMonitor</a></p>`)}
    </div>
    <div class="c4"><div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>Data dictionary</th><th>FRED</th></tr></thead><tbody>
      ${D.datacols.map(c => `<tr><td style="white-space:normal"><b class="en">${c.h}</b>${c.note ? `<div class="muted" style="font-size:11.5px">${c.note}</div>` : ''}</td><td class="num muted" style="font-size:12px">${c.fred || '—'}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="c12"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${L('شاخص', 'Indicator')}</th><th>Category</th><th>Transform</th><th>${L('جهت', 'Direction')}</th><th>${L('توضیح', 'Description')}</th></tr></thead><tbody>
      ${D.inds.map(i => `<tr><td><b class="en">${i.name}</b></td><td class="en">${(D.cats.find(c => c.code === i.cat) || {}).en || i.cat}</td><td class="en">${i.tr}</td><td>${i.dir > 0 ? L('افزایش یعنی Risk-On', 'rise = Risk-On') : L('افزایش یعنی Risk-Off', 'rise = Risk-Off')}</td><td class="muted en" style="white-space:normal">${i.fa}</td></tr>`).join('')}
    </tbody></table></div></div></div>
  </details>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    const t = document.getElementById(b.dataset.go);
    if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' });
  });
  $('#gSearch', el).addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $$('.g-word', el).forEach(w => { w.hidden = q && !w.textContent.toLowerCase().includes(q); });
  });
}

/* ================= router / boot ================= */
const TABS = { overview: renderOverview, history: renderHistory, fx: renderFX, indicators: renderIndicators, playbook: renderPlaybook, lab: renderLab, guide: renderGuide };
function route() {
  const tab = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'overview';
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  $$('#app > section').forEach(s => s.hidden = s.dataset.tab !== tab);
  let sec = $(`#app > section[data-tab="${tab}"]`);
  if (!sec) { sec = document.createElement('section'); sec.dataset.tab = tab; $('#app').appendChild(sec); TABS[tab](sec); isolateLatin(sec); }
  else charts.forEach(c => c.resize());
  $(`#tabs a[data-tab="${tab}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function rerenderAll() {
  charts.forEach(c => c.dispose()); charts.clear();
  $$('#app > section').forEach(s => s.remove());
  route();
}
function header() {
  const k = D.kpi, g = REG[k.regime];
  $('#status').innerHTML = `
    <span class="pill rc-${g.k}"><span class="dot" style="background:var(--rc);box-shadow:0 0 0 3px color-mix(in srgb,var(--rc) 25%,transparent)"></span>${g.fa}</span>
    <span class="pill hide-sm"><span class="dot"></span>${L('داده تا', 'Data to')} ${N(D.meta.last)}</span>
    ${D.meta.ecb_from ? `<span class="pill est hide-sm" data-tip="${L(`نرخ‌های ارز از ${D.meta.ecb_from} با ECB تخمین زده شده‌اند و با انتشار هفتگی FRED جایگزین می‌شوند`, `FX rates from ${D.meta.ecb_from} are ECB estimates and are replaced by FRED's weekly release`)}"><span class="dot"></span>${L('FX تخمینی', 'FX estimated')}</span>` : ''}`;
}

/* static page text (index.html) in the current language */
const STATIC = {
  tabs: { overview: ['نمای کلی', 'Overview'], history: ['تاریخچه و آمار', 'History & stats'], fx: ['FX Board', 'FX Board'], indicators: ['شاخص‌ها', 'Indicators'],
    playbook: ['الگوها و Playbook', 'Types & Playbook'], lab: ['Model Lab', 'Model Lab'], guide: ['راهنمای استفاده', 'User guide'] },
  '#brandSub': ['مانیتور رژیم ریسک بازار', 'Market risk regime monitor'],
  '#footData': ['منابع داده: <span dir="ltr">FRED (St. Louis Fed), ECB, ICE BofA, CBOE</span> · مدل: <span dir="ltr">Rolling z-score (252d), 5 categories, 11 regime types</span>',
    'Data sources: FRED (St. Louis Fed), ECB, ICE BofA, CBOE · Model: rolling z-score (252d), 5 categories, 11 regime types'],
  '#footNote': ['این ابزار آموزشی و تحلیلی است و توصیه سرمایه‌گذاری نیست.', 'This is an educational and analytical tool, not investment advice.'],
  '#loading .txt': ['در حال بارگذاری داده‌ها…', 'Loading data…'],
};
function applyStatic() {
  const h = document.documentElement, i = EN() ? 1 : 0;
  h.lang = LANG; h.dir = EN() ? 'ltr' : 'rtl';
  document.title = 'Risk Regime Monitor';
  $$('#tabs a').forEach(a => { const v = STATIC.tabs[a.dataset.tab]; if (v) a.textContent = v[i]; });
  $('#tabs').setAttribute('aria-label', L('بخش‌ها', 'Sections'));
  for (const [sel, v] of Object.entries(STATIC)) { if (sel === 'tabs') continue; const el = $(sel); if (el) el.innerHTML = v[i]; }
  $('#themeBtn').setAttribute('aria-label', L('تغییر تم روشن/تیره', 'Toggle light/dark theme'));
  $('#themeBtn').title = L('تم روشن / تیره', 'Light / dark theme');
  $$('#langSw button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
}
function setLang(l, save = true) {
  LANG = l; FONT = EN() ? FONT_EN : FONT_FA;
  if (save) { try { localStorage.setItem('rrm-lang', l); } catch (e) {} }
  applyStatic();
  if (D) { header(); rerenderAll(); }
}
function langSwitch() {
  const sw = $('#langSw');
  sw.innerHTML = `<button type="button" data-lang="fa" title="فارسی" aria-label="فارسی">${flag('fa')}</button><button type="button" data-lang="en" title="English" aria-label="English">${flag('en')}</button>`;
  sw.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.lang !== LANG) setLang(b.dataset.lang); });
}
function langPicker() {
  const ov = document.createElement('div');
  ov.className = 'lang-pick'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'lpT');
  ov.innerHTML = `<div class="lang-card">
    <h2 id="lpT"><span dir="ltr">Choose your language</span><br><span dir="rtl">زبان خود را انتخاب کنید</span></h2>
    <p>Risk Regime Monitor</p>
    <div class="lang-opts">
      <button type="button" data-lang="fa">${flag('fa')}<span>فارسی</span></button>
      <button type="button" data-lang="en">${flag('en')}<span>English</span></button>
    </div></div>`;
  ov.addEventListener('click', e => {
    const b = e.target.closest('button[data-lang]'); if (!b) return;
    ov.remove(); setLang(b.dataset.lang);
  });
  document.body.appendChild(ov);
  $(`button[data-lang="${LANG}"]`, ov).focus();
}

$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = cur;
  try { localStorage.setItem('rrm-theme', cur); } catch (e) {}
  if (D) { header(); rerenderAll(); }
});
langSwitch(); applyStatic();
if (!ASKED) langPicker();
addEventListener('hashchange', route);
fetch('data/latest.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
  D = d; $('#loading').remove(); header(); route();
}).catch(err => { $('#loading').innerHTML = L('خطا در بارگذاری داده‌ها: ', 'Failed to load data: ') + esc(err.message); });
