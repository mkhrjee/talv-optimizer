// API base resolution:
//  - explicit override via VITE_BACKEND_URL
//  - when the app is opened directly from the local backend (localhost),
//    use same-origin relative requests
//  - otherwise (e.g. served from GitHub Pages) call the local backend
export const API_BASE = (() => {
  const override = import.meta.env.VITE_BACKEND_URL;
  if (override) return override.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "";
  }
  return "http://localhost:5178";
})();

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch (e) {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export function fetchConfig() {
  return getJson("/api/config");
}

export function fetchFourParts() {
  return getJson("/api/fourparts");
}

export function checkHealth() {
  return getJson("/api/health");
}

// Runs the sweep via SSE. Returns a cancel function.
export function runSweep(params, handlers) {
  const qs = new URLSearchParams({
    fourparts: params.fourParts.join(","),
    talvLow: String(params.talvLow),
    talvHigh: String(params.talvHigh),
    lcw: String(params.lcw),
  });
  const es = new EventSource(`${API_BASE}/api/run?${qs.toString()}`);

  es.onmessage = (ev) => {
    let obj;
    try {
      obj = JSON.parse(ev.data);
    } catch (e) {
      return;
    }
    if (obj.type === "done") {
      es.close();
      handlers.onDone && handlers.onDone();
      return;
    }
    handlers.onEvent && handlers.onEvent(obj);
  };

  es.onerror = () => {
    es.close();
    handlers.onError &&
      handlers.onError(
        "Lost connection to the local backend. Make sure it is running (npm start in backend/node)."
      );
  };

  return () => es.close();
}
