import React from "react";
import FourPartSelect from "./FourPartSelect.jsx";

export default function RunForm({
  options,
  loadingOptions,
  optionsError,
  form,
  setForm,
  onRun,
  running,
  lcwOptions,
}) {
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const canRun =
    !running && form.fourParts.length > 0 && Number(form.talvLow) < Number(form.talvHigh);

  return (
    <div className="card run-form-card">
      <h2>Run configuration</h2>

      <div className="field bid-field">
        <label>Bid positions (widebody)</label>
        {loadingOptions ? (
          <div className="hint">Loading available positions…</div>
        ) : optionsError ? (
          <div className="banner banner-error">{optionsError}</div>
        ) : (
          <FourPartSelect
            options={options}
            selected={form.fourParts}
            onChange={(fourParts) => update({ fourParts })}
            disabled={running}
          />
        )}
      </div>

      <div className="row">
        <div className="field">
          <label>TALV lower bound</label>
          <input
            type="number"
            step="0.1"
            value={form.talvLow}
            onChange={(e) => update({ talvLow: e.target.value })}
            disabled={running}
          />
        </div>
        <div className="field">
          <label>TALV upper bound</label>
          <input
            type="number"
            step="0.1"
            value={form.talvHigh}
            onChange={(e) => update({ talvHigh: e.target.value })}
            disabled={running}
          />
        </div>
      </div>

      <div className="field">
        <label>Line Construction Window (LCW)</label>
        <div className="seg">
          {lcwOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={Number(form.lcw) === opt ? "active" : ""}
              onClick={() => update({ lcw: opt })}
              disabled={running}
            >
              ± {opt}
            </button>
          ))}
        </div>
        <div className="hint">
          Lines are built within TALV ± {form.lcw} credit hours.
        </div>
      </div>

      <button className="btn btn-primary" onClick={onRun} disabled={!canRun}>
        {running ? (
          <>
            <span className="spinner" /> Running…
          </>
        ) : (
          "Run optimization"
        )}
      </button>
      {!running && form.fourParts.length === 0 && (
        <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>
          Select at least one bid position to run.
        </div>
      )}
    </div>
  );
}
