import { useMemo } from "react";
import { MONTHS_MINI, PALETTE, polar, fmt, isIncome } from "../utils.js";

// ─────────────────────────────────────────────────────────────────
//  Monthly bar + trend line chart
// ─────────────────────────────────────────────────────────────────
/**
 * @param {{
 *   months: Array<{ inc:number, exp:number, net:number, mini:string }>,
 *   chartFilter: 'all'|'income'|'expense',
 *   onMonthClick: (idx: number) => void,
 * }}
 */
export function ChartSVG({ months, chartFilter, onMonthClick }) {
  const W = 360, H = 110;
  const GW = W / 12, BW = 12, GAP = 3;
  const maxV = Math.max(...months.map(m => Math.max(m.inc, m.exp)), 1);

  const activePts = useMemo(() =>
    months
      .map((m, i) => ({
        cx: i * GW + GW / 2,
        cy: H / 2 - (m.net / maxV) * (H / 2 - 4),
        has: m.inc > 0 || m.exp > 0,
      }))
      .filter(p => p.has),
    [months, maxV, GW]
  );

  const trendD = activePts.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`
  ).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%"
      preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>

      {/* Zero line */}
      <line x1="0" y1={H / 2} x2={W} y2={H / 2}
        stroke="rgba(58,74,104,.4)" strokeWidth=".5" strokeDasharray="3,3" />

      {months.map((m, i) => {
        const gx       = i * GW + (GW - BW * 2 - GAP) / 2;
        const isGood   = m.inc >= m.exp;
        const hasData  = m.inc > 0 || m.exp > 0;
        const incColor = chartFilter === "expense" ? "rgba(52,211,153,.2)" : "#34d399";
        const expColor = chartFilter === "income"  ? "rgba(248,113,113,.2)" : "#f87171";
        const incH     = Math.max(2, (m.inc / maxV) * (H - 6));
        const expH     = Math.max(2, (m.exp / maxV) * (H - 6));

        return (
          <g key={i}>
            {hasData && (
              <rect x={i * GW} y={0} width={GW} height={H} rx={2}
                fill={isGood ? "rgba(52,211,153,.04)" : "rgba(248,113,113,.04)"} />
            )}
            {/* Clickable zone */}
            <rect x={i * GW} y={0} width={GW} height={H + 20} fill="transparent"
              style={{ cursor: "pointer" }} onClick={() => onMonthClick(i)} />

            {m.inc > 0 && (
              <rect x={gx} y={H - incH} width={BW} height={incH}
                fill={incColor} rx={2} opacity=".9" />
            )}
            {m.exp > 0 && (
              <rect x={gx + BW + GAP} y={H - expH} width={BW} height={expH}
                fill={expColor} rx={2} opacity=".9" />
            )}
            <text x={i * GW + GW / 2} y={H + 14} textAnchor="middle"
              fill="#3a4a68" fontSize={8} fontFamily="DM Sans" fontWeight="600">
              {MONTHS_MINI[i]}
            </text>
          </g>
        );
      })}

      {/* Trend line */}
      {trendD && (
        <>
          <path d={trendD} fill="none" stroke="#4d9fff" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity=".75" />
          {activePts.map((p, i) => (
            <circle key={i} cx={p.cx.toFixed(1)} cy={p.cy.toFixed(1)}
              r="2.5" fill="#4d9fff" opacity=".9" />
          ))}
        </>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Donut chart
// ─────────────────────────────────────────────────────────────────
/**
 * @param {{
 *   transactions: import('../store.js').Transaction[],
 *   categories: import('../store.js').Category[],
 *   fixedExpenses: import('../store.js').FixedExpense[],
 *   year: number,
 *   filter: 'expense'|'income',
 * }}
 */
export function DonutSVG({ transactions, categories, fixedExpenses, year, filter }) {
  const { entries, total } = useMemo(() => {
    const yStr  = year.toString();
    const tf    = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    const isCur = year === new Date().getFullYear();
    const map   = {};

    if (filter === "expense" && tf > 0 && isCur) map["__fixes__"] = tf;

    transactions.filter(t => t.date.startsWith(yStr)).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      const k = t.categoryId || "__other__";
      if (filter === "expense" && t.type === "expense")
        map[k] = (map[k] || 0) + a;
      if (filter === "income" && isIncome(t.type))
        map[k] = (map[k] || 0) + a;
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total   = entries.reduce((s, [, v]) => s + v, 0);
    return { entries, total };
  }, [transactions, fixedExpenses, categories, year, filter]);

  const cx = 65, cy = 65, outerR = 56, innerR = 36;

  if (total === 0) return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg viewBox="0 0 130 130" width="130" height="130">
        <text x="65" y="70" textAnchor="middle" fill="#3a4a68" fontSize={10} fontFamily="DM Sans">
          Aucune donnée
        </text>
      </svg>
    </div>
  );

  let angle = -90;
  const slices = [], legend = [];

  entries.forEach(([catId, val], i) => {
    const pct   = val / total;
    if (pct < 0.005) return;
    const color = PALETTE[i % PALETTE.length];
    const sweep = pct * 360;
    const p1 = polar(cx, cy, outerR, angle);
    const p2 = polar(cx, cy, outerR, angle + sweep);
    const p3 = polar(cx, cy, innerR, angle + sweep);
    const p4 = polar(cx, cy, innerR, angle);
    const lg  = sweep > 180 ? 1 : 0;
    const d   = [
      `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `A${outerR} ${outerR} 0 ${lg} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      `L${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
      `A${innerR} ${innerR} 0 ${lg} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`,
    ].join(" ");

    slices.push(
      <path key={catId} d={d} fill={color} opacity=".88"
        style={{ transition: "opacity .2s", cursor: "pointer" }}
        onMouseOver={e => (e.target.style.opacity = 1)}
        onMouseOut={e  => (e.target.style.opacity = .88)} />
    );
    angle += sweep;

    const cat  = categories.find(c => c.id === catId);
    const name = catId === "__fixes__"  ? "🔄 Frais fixes"
               : catId === "__other__"  ? "❓ Sans catégorie"
               : `${cat?.icon ?? ""} ${cat?.name ?? catId}`;
    legend.push({ color, name, pct });
  });

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 130 130" width="130" height="130"
        style={{ flexShrink: 0, overflow: "visible" }}>
        {slices}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#7a8aaa" fontSize={8} fontFamily="DM Sans">Total</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#e8eef8" fontSize={9.5} fontWeight="700" fontFamily="DM Sans">
          {fmt(total).replace(" €", "")}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="#7a8aaa" fontSize={7.5} fontFamily="DM Sans">€</text>
      </svg>

      <div style={{ flex: 1, minWidth: 120, maxHeight: 130, overflowY: "auto" }}>
        {legend.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, fontSize: ".73rem" }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--text2)", fontSize: ".7rem" }}>
              {(l.pct * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Cumulative net (patrimoine) line chart
// ─────────────────────────────────────────────────────────────────
/** @param {{ months: Array<{ inc: number, exp: number, net: number }> }} */
export function PatrimoineSVG({ months }) {
  const W = 360, H = 90, pad = 10;

  const pts = useMemo(() => {
    let cumul = 0;
    return months.map(m => {
      if (m.inc > 0 || m.exp > 0) cumul += m.net;
      return { y: cumul, has: m.inc > 0 || m.exp > 0 };
    });
  }, [months]);

  const minV = Math.min(0, ...pts.map(p => p.y));
  const maxV = Math.max(0, ...pts.map(p => p.y));
  const range = maxV - minV || 1;
  const toY  = v  => H - pad - ((v - minV) / range) * (H - 2 * pad);
  const toX  = i  => i * (W / 11);
  const zeroY = toY(0);
  const lastVal = pts[pts.length - 1].y;
  const lineColor = lastVal >= 0 ? "#34d399" : "#f87171";
  const fillColor = lastVal >= 0 ? "rgba(52,211,153,.12)" : "rgba(248,113,113,.1)";

  const lineCoords = pts.map((p, i) => `${toX(i).toFixed(1)},${toY(p.y).toFixed(1)}`).join(" ");
  const areaCoords = `${toX(0).toFixed(1)},${zeroY} ${lineCoords} ${toX(11).toFixed(1)},${zeroY}`;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H + 12}`} width="100%"
        preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <line x1="0" y1={zeroY.toFixed(1)} x2={W} y2={zeroY.toFixed(1)}
          stroke="rgba(58,74,104,.4)" strokeWidth=".5" strokeDasharray="3,3" />
        <polygon points={areaCoords} fill={fillColor} />
        <polyline points={lineCoords} fill="none" stroke={lineColor}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
        {pts.map((p, i) => (
          <g key={i}>
            <text x={toX(i).toFixed(1)} y={H + 10} textAnchor="middle"
              fill="#3a4a68" fontSize={7.5} fontFamily="DM Sans" fontWeight="600">
              {MONTHS_MINI[i]}
            </text>
            {p.has && (
              <circle cx={toX(i).toFixed(1)} cy={toY(p.y).toFixed(1)}
                r="2.5" fill={lineColor} opacity=".9" />
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".95rem",
          fontVariantNumeric: "tabular-nums",
          color: lastVal >= 0 ? "var(--success)" : "var(--danger)" }}>
          {lastVal >= 0 ? "+" : ""}{fmt(lastVal)}
        </div>
      </div>
    </>
  );
}
