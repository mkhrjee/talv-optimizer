import React from "react";

export default function SummaryTable({ summary, optimalTalv }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>TALV</th>
            <th>Lineholders</th>
            <th>Reserves</th>
            <th>Open Time (%)</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((d) => (
            <tr key={d.talv} className={d.talv === optimalTalv ? "optimal-row" : ""}>
              <td>{d.talv.toFixed(1)}</td>
              <td>{d.lineholders}</td>
              <td>{d.reserves}</td>
              <td>{d.openTime.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
