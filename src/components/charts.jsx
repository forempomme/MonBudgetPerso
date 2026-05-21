import { useMemo } from "react";
import { MONTHS_MINI, polar, fmt } from "../utils.js";

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
