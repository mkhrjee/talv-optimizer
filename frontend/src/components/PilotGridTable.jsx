import React from "react";

// Mirrors the "Employee# / PlannedAbsenceCredit / TALV: xx.x…" block from the
// downloadable Excel workbook (see backend/python/talv_core/excel.py). Every
// employee row is shown at once (no vertical scroll needed); the TALV columns
// scroll horizontally since there can be dozens of them.
export default function PilotGridTable({ employees, plannedAbsence, tracker, reserveFlag, talvs, optimalTalv }) {
  if (!employees || employees.length === 0) return null;

  const talvKeys = talvs.map((t) => `TALV: ${t}`);

  return (
    <div className="pilot-grid-wrap">
      <table className="pilot-grid">
        <thead>
          <tr>
            <th>Employee#</th>
            <th>Planned Absence Credit</th>
            {talvs.map((t) => (
              <th
                key={t}
                className={t === optimalTalv ? "optimal-col" : ""}
              >
                {t.toFixed(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => (
            <tr key={emp}>
              <td>{emp}</td>
              <td>{plannedAbsence[i].toFixed(2)}</td>
              {talvKeys.map((key, j) => {
                const isReserve = reserveFlag[key] ? reserveFlag[key][i] : false;
                const talv = talvs[j];
                return (
                  <td
                    key={key}
                    className={
                      (isReserve ? "rsv-cell " : "") +
                      (talv === optimalTalv ? "optimal-col" : "")
                    }
                  >
                    {isReserve ? "RSV" : tracker[key][i].toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
