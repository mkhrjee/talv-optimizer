import React from "react";

export default function Header({ period }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="logo">
          <img src="/aa-icon.png" alt="American Airlines" width="34" height="34" />
          <div>
            <h1>TALV Optimizer</h1>
            <p className="subtitle">
              Optimal Target Average Line Value for each PBS run
            </p>
          </div>
        </div>
        <div className="header-meta">
          {period ? (
            <>
              <div>
                <span className="pill">{period.contractMonth} {period.contractYear}</span>
              </div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>PBS {period.pbs}</div>
            </>
          ) : (
            <div style={{ opacity: 0.85 }}>Detecting contract month…</div>
          )}
        </div>
      </div>
    </header>
  );
}
