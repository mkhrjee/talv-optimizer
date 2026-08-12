// API base resolution:
//  - explicit override via VITE_BACKEND_URL (used by `npm run dev`, which proxies
//    /api to localhost:5178 anyway)
//  - otherwise same-origin relative requests, since the app is always served by
//    the local backend at http://localhost:5178
export const API_BASE = (() => {
  const override = import.meta.env.VITE_BACKEND_URL;
  if (override) return override.replace(/\/$/, "");
  return "";
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
