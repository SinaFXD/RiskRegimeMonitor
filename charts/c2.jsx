export default () => <claude.Visualize data-claude-component='category-scores-6m' sources={{names:{kind:'ref', ref:'input/names', adapter:{kind:'cells'}}, dates:{kind:'ref', ref:'input/dates', adapter:{kind:'cells'}}, cats:{kind:'ref', ref:'input/cats', adapter:{kind:'cells'}}, chartSize:{kind:'data', data:[{width:720, height:300}]}}}>{({names, dates, cats, chartSize}) => {
const {width, height} = chartSize.at(0);
const [off, setOff] = useState([]);
const head = names.at(0);
const wanted = ['Volatility', 'Credit', 'FX', 'Equities', 'Funding & USD'];
const all = wanted.map((nm, k) => ({nm, i: head.findIndex(hh => hh.text === nm), hue: `var(--cds-chart-categorical-${k + 1})`})).filter(s => s.i >= 0);
const num = c => c !== undefined && c !== null && typeof c.value === 'number';
const idx = cats.map((r, j) => j).filter(j => dates.at(j) !== undefined && dates.at(j).at(0).text !== '' && all.some(s => num(cats.at(j).at(s.i))));
const pts = idx.slice(-126);
const W = Math.max(width, 360), H = Math.max(height, 220);
const gray = 'var(--cds-text-secondary)', ink = 'var(--cds-text-primary)';
const n = pts.length;
const title = 'Category scores (signed z)  ·  last 6 months';
if (n < 2 || all.length === 0) { return <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} role='img' aria-label={title}><text x='16' y='28' fontSize='14' fill={ink}>Category scores: not enough data yet</text></svg>; }
const series = all.filter(s => all.length === 1 || !off.includes(s.nm));
const vals = pts.flatMap(j => series.filter(s => num(cats.at(j).at(s.i))).map(s => cats.at(j).at(s.i).value)).concat([0]);
const lo = Math.floor(Math.min(...vals)) - 0.25, hi = Math.ceil(Math.max(...vals)) + 0.25;
const left = 40, right = 24, y0 = 52, bottom = 58;
const w = W - left - right, h = H - y0 - bottom;
const x = i => left + i * w / (n - 1);
const y = v => y0 + h - (v - lo) / (hi - lo) * h;
const ticks = Array.from({length: Math.floor(hi) - Math.ceil(lo) + 1}, (_, k) => Math.ceil(lo) + k);
const xl = pts.reduce((acc, j, i) => { const d = String(dates.at(j).at(0).value); const ym = d.slice(0, 7); const isNew = i === 0 || String(dates.at(pts.at(i - 1)).at(0).value).slice(0, 7) !== ym; if (isNew && (acc.length === 0 || x(i) - acc.at(-1).px >= 60)) { return acc.concat([{px: x(i), lab: ym}]); } return acc; }, []);
const bw = Math.max(1, w / (n - 1));
const room = s => 34 + 7 * s.nm.length;
const lx = k => 16 + all.slice(0, k).reduce((sum, s) => sum + room(s), 0);
const lastJ = pts.at(-1);
return <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} role='img' aria-label={title} fontSize='12'>
<text x='16' y='28' fontSize='14' fontWeight='500' fill={ink}>{title}</text>
{ticks.map(t => <g key={'t' + t}><line x1={left} x2={left + w} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)'} strokeWidth='1'/><text x={left - 8} y={y(t) + 4} textAnchor='end' fill={gray}>{t}</text></g>)}
{series.map(s => <path key={'p' + s.nm} d={pts.reduce((acc, j, i) => { const c = cats.at(j).at(s.i); if (!num(c)) { return {d: acc.d, pen: false}; } return {d: acc.d + (acc.pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(c.value).toFixed(1), pen: true}; }, {d: '', pen: false}).d} fill='none' stroke={s.hue} strokeWidth='2'/>)}
{series.filter(s => num(cats.at(lastJ).at(s.i))).map(s => <circle key={'c' + s.nm} cx={x(n - 1)} cy={y(cats.at(lastJ).at(s.i).value)} r='4' fill={s.hue}/>)}
{xl.map(o => <g key={'x' + o.lab}><line x1={o.px} x2={o.px} y1={y0 + h} y2={y0 + h + 4} stroke='var(--cds-chart-axis)'/><text x={o.px} y={y0 + h + 18} textAnchor='middle' fill={gray}>{o.lab}</text></g>)}
{pts.map((j, i) => <Tooltip key={'tt' + i} content={dates.at(j).at(0).text} detail={all.map(s => s.nm + ' ' + cats.at(j).at(s.i).text).join('   ·   ')}><rect x={x(i) - bw / 2} y={y0} width={bw} height={h} fill='transparent'/></Tooltip>)}
{all.length > 1 && all.map((s, k) => <g key={'l' + s.nm} opacity={off.includes(s.nm) ? 0.4 : 1} onClick={() => setOff(o => o.includes(s.nm) ? o.filter(z => z !== s.nm) : o.concat([s.nm]))}><rect x={lx(k) - 4} y={H - 35} width={room(s) - 8} height='24' fill='transparent'/><rect x={lx(k)} y={H - 28} width='10' height='10' rx='2' fill={s.hue}/><text x={lx(k) + 16} y={H - 19} fill={gray}>{s.nm}</text></g>)}
</svg>;
}}</claude.Visualize>;
