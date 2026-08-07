import React, { useMemo, useState } from "react";

const COLORS = {
  lineholders: "#0078d2",
  reserves: "#c30019",
  openTime: "#1c2b36",
  optimal: "#13afeb",
};

export default function TalvChart({ summary, optimalTalv }) {
  const [hover, setHover] = useState(null);

  const W = 760;
  const H = 360;
  const M = { top: 20, right: 64, bottom: 46, left: 52 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const model = useMemo(() => {
    if (!summary || summary.length === 0) return null;
    const talvs = summary.map((d) => d.talv);
    const minT = Math.min(...talvs);
    const maxT = Math.max(...talvs);
    const pilots = summary.flatMap((d) => [d.lineholders, d.reserves]);
    const maxPilots = Math.max(1, ...pilots);
    const maxOpen = Math.max(0.5, ...summary.map((d) => d.openTime));

    const x = (t) => M.left + ((t - minT) / (maxT - minT || 1)) * iw;
    const yL = (v) => M.top + ih - (v / maxPilots) * ih;
    const yR = (v) => M.top + ih - (v / maxOpen) * ih;

    const line = (key, y) =>
      summary.map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.talv)} ${y(d[key])}`).join(" ");

    return {
      minT,
      maxT,
      maxPilots,
      maxOpen,
      x,
      yL,
      yR,
      paths: {
        lineholders: line("lineholders", yL),
        reserves: line("reserves", yL),
        openTime: line("openTime", yR),
      },
    };
  }, [summary]);

  if (!model) return null;

  const xTicks = [];
  const step = Math.ceil((model.maxT - model.minT) / 12) || 1;
  for (let t = Math.ceil(model.minT); t <= model.maxT; t += step) xTicks.push(t);

  const yTicks = 5;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    // nearest data point
    let best = null;
    let bestDist = Infinity;
    summary.forEach((d) => {
      const dist = Math.abs(model.x(d.talv) - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    });
    setHover(best);
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* gridlines + left axis ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = (model.maxPilots / yTicks) * i;
          const y = model.yL(v);
          return (
            <g key={`gl-${i}`}>
              <line x1={M.left} y1={y} x2={W - M.right} y2={y} stroke="#e6eaee" />
              <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#45596a">
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        {/* right axis ticks (open time %) */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = (model.maxOpen / yTicks) * i;
          const y = model.yR(v);
          return (
            <text
              key={`rt-${i}`}
              x={W - M.right + 8}
              y={y + 4}
              textAnchor="start"
              fontSize="11"
              fill="#45596a"
            >
              {v.toFixed(1)}
            </text>
          );
        })}

        {/* x ticks */}
        {xTicks.map((t) => (
          <text
            key={`xt-${t}`}
            x={model.x(t)}
            y={H - M.bottom + 18}
            textAnchor="middle"
            fontSize="11"
            fill="#45596a"
          >
            {t.toFixed(0)}
          </text>
        ))}
        <text x={M.left + iw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#1c2b36">
          TALV
        </text>
        <text
          x={-(M.top + ih / 2)}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="12"
          fill="#1c2b36"
        >
          Pilots
        </text>
        <text
          x={M.top + ih / 2}
          y={-(W - 16)}
          transform="rotate(90)"
          textAnchor="middle"
          fontSize="12"
          fill="#1c2b36"
        >
          Open Time (%)
        </text>

        {/* optimal marker */}
        {optimalTalv != null && (
          <line
            x1={model.x(optimalTalv)}
            y1={M.top}
            x2={model.x(optimalTalv)}
            y2={M.top + ih}
            stroke={COLORS.optimal}
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}

        {/* series */}
        <path d={model.paths.openTime} fill="none" stroke={COLORS.openTime} strokeWidth="1.6" strokeDasharray="4 3" />
        <path d={model.paths.reserves} fill="none" stroke={COLORS.reserves} strokeWidth="2" />
        <path d={model.paths.lineholders} fill="none" stroke={COLORS.lineholders} strokeWidth="2" />

        {/* hover */}
        {hover && (
          <g>
            <line
              x1={model.x(hover.talv)}
              y1={M.top}
              x2={model.x(hover.talv)}
              y2={M.top + ih}
              stroke="#a5b5be"
            />
            <circle cx={model.x(hover.talv)} cy={model.yL(hover.lineholders)} r="4" fill={COLORS.lineholders} />
            <circle cx={model.x(hover.talv)} cy={model.yL(hover.reserves)} r="4" fill={COLORS.reserves} />
            <circle cx={model.x(hover.talv)} cy={model.yR(hover.openTime)} r="4" fill={COLORS.openTime} />
          </g>
        )}
      </svg>

      {hover && (
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--aa-ink)" }}>
          <strong>TALV {hover.talv.toFixed(1)}</strong> — Lineholders {hover.lineholders} ·
          Reserves {hover.reserves} · Open Time {hover.openTime}%
        </div>
      )}

      <div className="chart-legend">
        <span>
          <i style={{ background: COLORS.lineholders }} /> Lineholders
        </span>
        <span>
          <i style={{ background: COLORS.reserves }} /> Reserves
        </span>
        <span>
          <i style={{ background: COLORS.openTime }} /> Open Time (%)
        </span>
        <span>
          <i style={{ background: COLORS.optimal }} /> Optimal TALV
        </span>
      </div>
    </div>
  );
}
