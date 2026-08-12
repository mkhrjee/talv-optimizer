/**
 * TALV Optimizer — local backend.
 *
 * Zero-dependency Node HTTP server (built-in modules only) that:
 *   - serves the built React app from ./public (this is the sole way the app is
 *     hosted — everything runs locally on the analyst's machine)
 *   - exposes a small JSON/SSE API that shells out to the Python core
 *   - streams run progress to the browser via Server-Sent Events
 *
 * Mosaic access happens inside the Python process (pyodbc DSN=Mosaic2), so this
 * server only needs to run on a machine that has the Mosaic DSN configured.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { URL } = require("url");

const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, "..", "..");
const PY_DIR = path.resolve(REPO_ROOT, "backend", "python");
const PUBLIC_DIR = path.join(ROOT, "public");
const SHARED_CONFIG = path.join(REPO_ROOT, "shared", "config.json");

const config = JSON.parse(fs.readFileSync(SHARED_CONFIG, "utf-8"));
const PORT = process.env.PORT || (config.backend && config.backend.port) || 5178;
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const MOCK_ENV = process.env.TALV_MOCK === "1";

const OUT_DIR = path.join(os.tmpdir(), "talv-optimizer");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Maps download id -> generated .xlsx path.
const downloads = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Private Network Access preflight (Chrome) for HTTPS page -> localhost.
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": MIME[".json"] });
  res.end(body);
}

/**
 * Run the python CLI and collect NDJSON lines. onLine is called per parsed
 * object; resolves when the process exits.
 */
function runPython(args, onLine, onSpawn) {
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BIN, ["cli.py", ...args], {
      cwd: PY_DIR,
      env: process.env,
    });
    if (onSpawn) onSpawn(child);
    let buf = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          onLine(JSON.parse(line));
        } catch (e) {
          onLine({ type: "log", message: line });
        }
      }
    });
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", (err) =>
      onLine({ type: "error", message: `Failed to start Python: ${err.message}` })
    );
    child.on("close", (code) => {
      if (buf.trim()) {
        try {
          onLine(JSON.parse(buf.trim()));
        } catch (e) {
          /* ignore trailing partial */
        }
      }
      resolve({ code, stderr });
    });
  });
}

function mockFlag(url) {
  return MOCK_ENV || url.searchParams.get("mock") === "1";
}

// --------------------------------------------------------------------------- //
// Route handlers
// --------------------------------------------------------------------------- //
function handleConfig(res) {
  sendJson(res, 200, {
    defaults: config.defaults,
    widebodyFleets: config.widebodyFleets,
    app: config.app,
    mock: MOCK_ENV,
  });
}

async function handlePeriod(res, url) {
  const args = [];
  if (mockFlag(url)) args.push("--mock");
  args.push("period");
  let period = null;
  const { stderr } = await runPython(args, (obj) => {
    if (obj.type === "period") period = obj;
  });
  if (!period) return sendJson(res, 500, { error: "Could not detect period", stderr });
  sendJson(res, 200, period);
}

async function handleFourparts(res, url) {
  const args = [];
  if (mockFlag(url)) args.push("--mock");
  args.push("list-fourparts");
  let period = null;
  let items = null;
  let error = null;
  const { stderr } = await runPython(args, (obj) => {
    if (obj.type === "period") period = obj;
    else if (obj.type === "fourparts") items = obj.items;
    else if (obj.type === "error") error = obj.message;
  });
  if (error) return sendJson(res, 500, { error, stderr });
  if (!items) return sendJson(res, 500, { error: "No 4-parts returned", stderr });
  sendJson(res, 200, { period, items });
}

async function handleRun(req, res, url) {
  const fourparts = url.searchParams.get("fourparts") || "";
  if (!fourparts.trim()) return sendJson(res, 400, { error: "fourparts required" });

  const talvLow = url.searchParams.get("talvLow");
  const talvHigh = url.searchParams.get("talvHigh");
  const lcw = url.searchParams.get("lcw");

  // SSE stream.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let child = null;
  let closed = false;
  const cleanup = () => {
    closed = true;
    if (child && !child.killed) child.kill();
  };
  // If the browser cancels (es.close), refreshes or closes the tab, stop the
  // Python child instead of leaving it orphaned, and stop writing to the socket.
  req.on("close", cleanup);
  res.on("error", () => {
    closed = true;
  });

  const sse = (obj) => {
    if (closed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const downloadId = crypto.randomBytes(8).toString("hex");
  const outPath = path.join(OUT_DIR, `talv-${downloadId}.xlsx`);

  const args = [];
  if (mockFlag(url)) args.push("--mock");
  args.push("run", "--fourparts", fourparts, "--out", outPath);
  if (talvLow) args.push("--talv-low", talvLow);
  if (talvHigh) args.push("--talv-high", talvHigh);
  if (lcw) args.push("--lcw", lcw);

  const { code, stderr } = await runPython(
    args,
    (obj) => {
      if (obj.type === "result") {
        if (obj.excelPath && fs.existsSync(obj.excelPath)) {
          downloads.set(downloadId, obj.excelPath);
          obj.downloadUrl = `/api/download/${downloadId}`;
        }
      }
      sse(obj);
    },
    (c) => {
      child = c;
    }
  );

  if (code !== 0 && stderr) sse({ type: "error", message: stderr });
  sse({ type: "done" });
  if (!closed && !res.writableEnded) res.end();
}

function handleDownload(res, id) {
  const file = downloads.get(id);
  if (!file || !fs.existsSync(file)) {
    return sendJson(res, 404, { error: "Not found" });
  }
  res.writeHead(200, {
    "Content-Type": MIME[".xlsx"],
    "Content-Disposition": `attachment; filename="TALVs.xlsx"`,
  });
  fs.createReadStream(file).pipe(res);
}

// --------------------------------------------------------------------------- //
// Static file serving (SPA fallback)
// --------------------------------------------------------------------------- //
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  let filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback to index.html.
      const index = path.join(PUBLIC_DIR, "index.html");
      if (fs.existsSync(index)) {
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        return fs.createReadStream(index).pipe(res);
      }
      return sendJson(res, 404, {
        error:
          "Frontend not built. Run scripts\\setup.ps1 (or `npm run build` in ../../frontend and copy dist to ./public).",
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

// --------------------------------------------------------------------------- //
const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  try {
    if (p === "/api/config") return handleConfig(res);
    if (p === "/api/period") return await handlePeriod(res, url);
    if (p === "/api/fourparts") return await handleFourparts(res, url);
    if (p === "/api/run") return await handleRun(req, res, url);
    if (p.startsWith("/api/download/")) return handleDownload(res, p.split("/").pop());
    if (p === "/api/health") return sendJson(res, 200, { ok: true });
    if (p.startsWith("/api/")) return sendJson(res, 404, { error: "Unknown endpoint" });
    return serveStatic(req, res, p);
  } catch (err) {
    if (res.headersSent || res.writableEnded) {
      if (!res.writableEnded) res.end();
      return;
    }
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`TALV Optimizer backend listening on http://localhost:${PORT}`);
  console.log(`  Python:  ${PYTHON_BIN}  (cwd ${PY_DIR})`);
  console.log(`  Mock:    ${MOCK_ENV ? "ON (synthetic data)" : "OFF (live Mosaic)"}`);
  console.log(`  Static:  ${PUBLIC_DIR}`);
});
