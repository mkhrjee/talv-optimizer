import React from "react";

export default function ProgressPanel({ progress }) {
  if (!progress || !progress.total) return null;
  const pct = Math.round((progress.step / progress.total) * 100);
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="progress-label">
        <span>
          Optimizing <strong>{progress.fourPart}</strong>
          {progress.groupIndex && progress.groupCount
            ? ` (position ${progress.groupIndex} of ${progress.groupCount})`
            : ""}
        </span>
        <span>
          TALV {Number(progress.talv).toFixed(1)} · {pct}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
