import React, { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import RunForm from "./components/RunForm.jsx";
import ProgressPanel from "./components/ProgressPanel.jsx";
import ResultsDashboard from "./components/ResultsDashboard.jsx";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { API_BASE, fetchConfig, fetchFourParts, runSweep } from "./api.js";

const DEFAULT_FORM = {
  fourParts: [],
  talvLow: 72,
  talvHigh: 84,
  lcw: 7,
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [period, setPeriod] = useState(null);
  const [options, setOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState(null);
  const [connError, setConnError] = useState(null);

  // Remembered last selection (defaults for next run).
  const [savedForm, setSavedForm] = useLocalStorage("talv.form", DEFAULT_FORM);
  const [form, setForm] = useState(savedForm);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [groups, setGroups] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [runError, setRunError] = useState(null);

  // Load config + available 4-parts on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchConfig();
        if (cancelled) return;
        setConfig(cfg);
        // Apply config defaults only if the user has no saved bounds.
        setForm((prev) => ({
          ...prev,
          talvLow: prev.talvLow ?? cfg.defaults.talvLow,
          talvHigh: prev.talvHigh ?? cfg.defaults.talvHigh,
          lcw: prev.lcw ?? cfg.defaults.lcw,
        }));
      } catch (e) {
        if (!cancelled) setConnError(e.message);
      }

      try {
        const data = await fetchFourParts();
        if (cancelled) return;
        setPeriod(data.period);
        setOptions(data.items);
        // Drop any remembered selections no longer available this month.
        const valid = new Set(data.items.map((o) => o.fourPart));
        setForm((prev) => ({
          ...prev,
          fourParts: prev.fourParts.filter((fp) => valid.has(fp)),
        }));
      } catch (e) {
        if (!cancelled) setOptionsError(e.message);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lcwOptions = useMemo(
    () => (config ? config.defaults.lcwOptions : [7, 10]),
    [config]
  );

  const optionByFp = useMemo(() => {
    const map = {};
    options.forEach((o) => (map[o.fourPart] = o));
    return map;
  }, [options]);

  const onRun = () => {
    setRunning(true);
    setRunError(null);
    setGroups([]);
    setDownloadUrl(null);
    setProgress(null);

    // Persist selection as the new default.
    setSavedForm(form);

    const groupCount = form.fourParts.length;
    const groupOrder = {};
    form.fourParts.forEach((fp, i) => (groupOrder[fp] = i + 1));

    runSweep(
      {
        fourParts: form.fourParts,
        talvLow: Number(form.talvLow),
        talvHigh: Number(form.talvHigh),
        lcw: Number(form.lcw),
      },
      {
        onEvent: (obj) => {
          if (obj.type === "progress") {
            setProgress({
              fourPart: obj.fourPart,
              talv: obj.talv,
              step: obj.step,
              total: obj.total,
              groupIndex: groupOrder[obj.fourPart],
              groupCount,
            });
          } else if (obj.type === "groupResult") {
            const opt = optionByFp[obj.fourPart];
            setGroups((prev) => [
              ...prev,
              {
                fourPart: obj.fourPart,
                label: opt ? opt.label : obj.fourPart,
                optimalTalv: obj.optimalTalv,
                bestOpenTime: obj.bestOpenTime,
                totalPilots: obj.totalPilots,
                totalCredit: obj.totalCredit,
                summary: obj.summary,
              },
            ]);
          } else if (obj.type === "result") {
            if (obj.downloadUrl) setDownloadUrl(obj.downloadUrl);
          } else if (obj.type === "error") {
            setRunError(obj.message);
          }
        },
        onError: (msg) => {
          setRunError(msg);
          setRunning(false);
          setProgress(null);
        },
        onDone: () => {
          setRunning(false);
          setProgress(null);
        },
      }
    );
  };

  return (
    <div className="app-shell">
      <Header period={period} />
      <div className="container">
        {connError && (
          <div className="banner banner-error">
            Could not reach the local backend at{" "}
            <code>{API_BASE || window.location.origin}</code>. Start it with{" "}
            <code>npm start</code> in <code>backend/node</code>, then reload. ({connError})
          </div>
        )}
        {config && config.mock && (
          <div className="banner banner-warn">
            Backend is running in <strong>mock mode</strong> — results use synthetic
            data, not live Mosaic.
          </div>
        )}

        <div className="grid">
          <div>
            <RunForm
              options={options}
              loadingOptions={loadingOptions}
              optionsError={optionsError}
              form={form}
              setForm={setForm}
              onRun={onRun}
              running={running}
              lcwOptions={lcwOptions}
            />
            <ProgressPanel progress={progress} />
          </div>

          <div>
            {runError && <div className="banner banner-error">{runError}</div>}
            {groups.length > 0 ? (
              <ResultsDashboard
                groups={groups}
                downloadUrl={downloadUrl}
                apiBase={API_BASE}
              />
            ) : (
              !running && (
                <div className="card">
                  <div className="empty-state">
                    <div className="big">📊</div>
                    <div>
                      Select one or more widebody bid positions and run the
                      optimization to see the optimal TALV, interactive charts and a
                      downloadable Excel workbook.
                    </div>
                  </div>
                </div>
              )
            )}
            {running && groups.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <div className="big">
                    <span className="spinner" style={{ borderTopColor: "var(--aa-blue)", borderColor: "var(--aa-gray-200)" }} />
                  </div>
                  <div>Crunching sequences and pilots across the TALV range…</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="app-footer">
        TALV Optimizer · American Airlines · Contract month detected automatically
      </footer>
    </div>
  );
}
