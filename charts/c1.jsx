export default () => <claude.Visualize data-claude-component='rai-history' sources={{rows:{kind:'ref', ref:'input/rows', adapter:{kind:'cells'}}, thr:{kind:'ref', ref:'input/thr', adapter:{kind:'cells'}}, reg:{kind:'ref', ref:'input/reg', adapter:{kind:'cells'}}, chartSize:{kind:'data', data:[{width:720, height:320}]}}}>{({rows, thr, reg, chartSize}) => {
const {width, height} = chartSize.at(0);
const [off, setOff] = useState([]);
const [head, ...below] = rows;
const iD = head.findIndex(hh => hh.text === 'Date'), iR = head.findIndex(hh => hh.text === 'RAI'), iE = head.findIndex(hh => hh.text === 'RAI EMA');
const num = c => c !== undefined && c !== null && typeof c.value === 'number';
const pts = (iD < 0 || iE < 0) ? [] : below.filter(r => num(r.at(iE)));
const th = thr.map(r => r.at(0)).filter(c => num(c)).map(c => c.value);
const regText = reg.length > 0 ? reg.at(0).at(0).text : '';
const W = Math.max(width, 360), H = Math.max(height, 220);
const gray = 'var(--cds-text-secondary)', ink = 'var(--cds-text-primary)', good = 'var(--cds-chart-status-good)', crit = 'var(--cds-chart-status-critical)', hue = 'var(--cds-chart-categorical-1)', muted = 'var(--cds-chart-muted)';
const n = pts.length;
if (n < 2) { return <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} role='img' aria-label='RAI history'><text x='16' y='28' fontSize='14' fill={ink}>RAI history: not enough data yet</text></svg>; }
const showRaw = iR >= 0 && !off.includes('raw'), showEma = !off.includes('ema');
const vals = pts.flatMap(r => [r.at(iE).value].concat((showRaw && num(r.at(iR))) ? [r.at(iR).value] : [])).concat(th);
const lo = Math.floor(Math.min(...vals)) - 0.25, hi = Math.ceil(Math.max(...vals)) + 0.25;
const left = 40, right = 82, y0 = 52, bottom = 58;
const w = W - left - right, h = H - y0 - bottom;
const x = i => left + i * w / (n - 1);
const y = v => y0 + h - (v - lo) / (hi - lo) * h;
const cy = v => y(Math.max(lo, Math.min(hi, v)));
const ticks = Array.from({length: Math.floor(hi) - Math.ceil(lo) + 1}, (_, k) => Math.ceil(lo) + k);
const hasTh = th.length === 4;
const thv = hasTh ? th : [];
const thLabels = ['Strong On', 'On', 'Off', 'Strong Off'];
const emaPath = pts.reduce((acc, r, i) => acc + (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(r.at(iE).value).toFixed(1), '');
const rawPath = iR < 0 ? '' : pts.reduce((acc, r, i) => { const c = r.at(iR); if (!num(c)) { return {d: acc.d, pen: false}; } return {d: acc.d + (acc.pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(c.value).toFixed(1), pen: true}; }, {d: '', pen: false}).d;
const xl = pts.reduce((acc, r, i) => { const d = String(r.at(iD).value); const ym = d.slice(0, 7); const mo = Number(d.slice(5, 7)); const isNew = i === 0 || String(pts.at(i - 1).at(iD).value).slice(0, 7) !== ym; if (isNew && [1, 4, 7, 10].includes(mo) && (acc.length === 0 || x(i) - acc.at(-1).px >= 64)) { return acc.concat([{px: x(i), lab: ym}]); } return acc; }, []);
const last = pts.at(-1);
const bw = Math.max(1, w / (n - 1));
const legend = [{k: 'ema', nm: 'RAI (EMA)', c: hue, sw: 3}, {k: 'raw', nm: 'RAI raw', c: muted, sw: 2}];
const room = it => 40 + 7 * it.nm.length;
const lx = k => 16 + legend.slice(0, k).reduce((s, it) => s + room(it), 0);
const title = 'Risk Appetite Index (RAI)  ·  latest ' + last.at(iE).text + '  ·  ' + regText;
return <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} role='img' aria-label={title} fontSize='12'>
<text x='16' y='28' fontSize='14' fontWeight='500' fill={ink}>{title}</text>
{hasTh && <rect x={left} y={cy(thv.at(3))} width={w} height={Math.max(0, cy(lo) - cy(thv.at(3)))} fill={crit} fillOpacity='0.16'/>}
{hasTh && <rect x={left} y={cy(thv.at(2))} width={w} height={Math.max(0, cy(thv.at(3)) - cy(thv.at(2)))} fill={crit} fillOpacity='0.07'/>}
{hasTh && <rect x={left} y={cy(thv.at(0))} width={w} height={Math.max(0, cy(thv.at(1)) - cy(thv.at(0)))} fill={good} fillOpacity='0.07'/>}
{hasTh && <rect x={left} y={cy(hi)} width={w} height={Math.max(0, cy(thv.at(0)) - cy(hi))} fill={good} fillOpacity='0.16'/>}
{ticks.map(t => <g key={'t' + t}><line x1={left} x2={left + w} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)'} strokeWidth='1'/><text x={left - 8} y={y(t) + 4} textAnchor='end' fill={gray}>{t}</text></g>)}
{thv.map((v, k) => <g key={'th' + k}><line x1={left} x2={left + w} y1={y(v)} y2={y(v)} stroke='var(--cds-chart-reference)' strokeWidth='1' opacity='0.7'/><text x={left + w + 6} y={y(v) + 4} fontSize='11' fill={gray}>{thLabels.at(k)}</text></g>)}
{showRaw && <path d={rawPath} fill='none' stroke={muted} strokeWidth='1' opacity='0.8'/>}
{showEma && <path d={emaPath} fill='none' stroke={hue} strokeWidth='2'/>}
{showEma && <circle cx={x(n - 1)} cy={y(last.at(iE).value)} r='4' fill={hue}/>}
{xl.map(o => <g key={'x' + o.lab}><line x1={o.px} x2={o.px} y1={y0 + h} y2={y0 + h + 4} stroke='var(--cds-chart-axis)'/><text x={o.px} y={y0 + h + 18} textAnchor='middle' fill={gray}>{o.lab}</text></g>)}
{pts.map((r, i) => <Tooltip key={'tt' + i} content={r.at(iD).text} detail={'EMA ' + r.at(iE).text + '   ·   raw ' + (iR >= 0 ? r.at(iR).text : '')}><rect x={x(i) - bw / 2} y={y0} width={bw} height={h} fill='transparent'/></Tooltip>)}
{legend.map((it, k) => <g key={it.k} opacity={off.includes(it.k) ? 0.4 : 1} onClick={() => setOff(o => o.includes(it.k) ? o.filter(z => z !== it.k) : o.concat([it.k]))}><rect x={lx(k) - 4} y={H - 33} width={room(it) - 8} height='24' fill='transparent'/><line x1={lx(k)} x2={lx(k) + 14} y1={H - 21} y2={H - 21} stroke={it.c} strokeWidth={it.sw}/><text x={lx(k) + 20} y={H - 17} fill={gray}>{it.nm}</text></g>)}
</svg>;
}}</claude.Visualize>;
