import React from "react";

export default function Header({ period }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="logo">
          <svg width="34" height="34" viewBox="0 0 100 100" aria-hidden="true">
            <path
              d="M12 70 L60 20 C64 16 70 16 66 26 L48 70 L40 70 L54 34 L28 62 L20 62 Z"
              fill="#c30019"
            />
            <path
              d="M30 78 L84 22 C88 18 94 18 90 28 L66 78 L58 78 L78 38 L44 74 L34 74 Z"
              fill="#0078d2"
            />
          </svg>
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
