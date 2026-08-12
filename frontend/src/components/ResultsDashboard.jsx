import React, { useState } from "react";
import TalvChart from "./TalvChart.jsx";
import SummaryTable from "./SummaryTable.jsx";
import PilotGridTable from "./PilotGridTable.jsx";

function OptimalCards({ groups, active, onSelect }) {
  return (
    <div className="optimal-cards">
      {groups.map((g, i) => (
        <button
          type="button"
          className={"optimal-card" + (i === active ? " optimal-card-active" : "")}
          key={g.fourPart}
          onClick={() => onSelect(i)}
        >
          <div className="fp">{g.label || g.fourPart}</div>
          <div className="talv">{g.optimalTalv.toFixed(1)}</div>
          <div className="fp">optimal TALV</div>
          <div className="stats">
            <span>
              Open time <b>{g.bestOpenTime}%</b>
            </span>
            <span>
              Pilots <b>{g.totalPilots}</b>
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function ResultsDashboard({ groups, downloadUrl, apiBase }) {
  const [active, setActive] = useState(0);
  if (!groups || groups.length === 0) return null;

  const activeIdx = active < groups.length ? active : 0;
  const g = groups[activeIdx];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, color: "var(--aa-slate)" }}>Results</h2>
        {downloadUrl && (
          <a className="btn btn-secondary" href={`${apiBase}${downloadUrl}`}>
            ⬇ Download Excel (TALVs.xlsx)
          </a>
        )}
      </div>

      <OptimalCards groups={groups} active={activeIdx} onSelect={setActive} />


      <div className="results-split">
        <div className="card chart-card">
          <h3>
            {g.label || g.fourPart} — optimal TALV {g.optimalTalv.toFixed(1)} (open time{" "}
            {g.bestOpenTime}%)
          </h3>
          <div className="chart-card-body">
            <TalvChart summary={g.summary} optimalTalv={g.optimalTalv} />
          </div>
        </div>

        <div className="card chart-card">
          <h3>Summary table — {g.label || g.fourPart}</h3>
          <SummaryTable summary={g.summary} optimalTalv={g.optimalTalv} />
        </div>
      </div>

      {g.employees && g.employees.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>
            Pilot credit by TALV — {g.label || g.fourPart}{" "}
            <span className="hint" style={{ display: "inline" }}>
              (scroll right for more TALVs)
            </span>
          </h3>
          <PilotGridTable
            employees={g.employees}
            plannedAbsence={g.plannedAbsence}
            tracker={g.tracker}
            reserveFlag={g.reserveFlag}
            talvs={g.summary.map((d) => d.talv)}
            optimalTalv={g.optimalTalv}
          />
        </div>
      )}
    </div>
  );
}
