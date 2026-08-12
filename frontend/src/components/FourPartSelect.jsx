import React, { useMemo, useState } from "react";

export default function FourPartSelect({ options, selected, onChange, disabled }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.fourPart.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        o.base.toLowerCase().includes(q) ||
        o.equipment.toLowerCase().includes(q)
    );
  }, [options, search]);

  const toggle = (fp) => {
    if (selected.includes(fp)) onChange(selected.filter((x) => x !== fp));
    else onChange([...selected, fp]);
  };

  const selectAll = () => onChange(filtered.map((o) => o.fourPart));
  const clearAll = () => onChange([]);

  return (
    <div>
      <div className="ms">
        <input
          className="ms-search"
          type="text"
          placeholder="Search base, fleet or 4-part…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
        <div className="ms-toolbar">
          <span className="ms-count">
            {selected.length} of {options.length} selected
          </span>
          <span className="ms-actions">
            <button type="button" onClick={selectAll} disabled={disabled}>
              Select all
            </button>{" "}
            ·{" "}
            <button type="button" onClick={clearAll} disabled={disabled}>
              Clear
            </button>
          </span>
        </div>
        <div className="ms-list">
          {filtered.length === 0 && (
            <div className="ms-empty">No matching positions.</div>
          )}
          {filtered.map((o) => (
            <label className="ms-item" key={o.fourPart}>
              <input
                type="checkbox"
                checked={selected.includes(o.fourPart)}
                onChange={() => toggle(o.fourPart)}
                disabled={disabled}
              />
              <span className="label">
                <strong>{o.label}</strong>
              </span>
              <span className="meta">{o.sequences} seq</span>
            </label>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="chip-row">
          {selected.map((fp) => {
            const opt = options.find((o) => o.fourPart === fp);
            return (
              <span className="chip" key={fp}>
                {opt ? opt.label : fp}
                <button type="button" onClick={() => toggle(fp)} disabled={disabled}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
