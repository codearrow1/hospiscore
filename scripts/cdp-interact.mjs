// Drives headless Edge over raw CDP (Node >= 22 global WebSocket).
// Usage: node scripts/cdp-interact.mjs <port> <url> <exprFile>
// Navigates to <url>, runs the JS read from <exprFile> in the page, prints
// console errors + the expression result after a wait.
import { readFileSync } from "node:fs";

const [portStr, url, exprFile] = process.argv.slice(2);
const port = Number(portStr);
const expr = readFileSync(exprFile, "utf8");

async function connect(port) {
  let wsUrl = null;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await res.json();
      const page = pages.find((p) => p.type === "page");
      if (page?.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!wsUrl) throw new Error("CDP endpoint not reachable");
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      for (const l of listeners) if (l.method === msg.method) l.cb(msg.params);
    }
  };
  return {
    send(method, params = {}) {
      return new Promise((resolve) => {
        const mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    },
    on(method, cb) {
      listeners.push({ method, cb });
    },
    close() {
      ws.close();
    },
  };
}

async function main() {
  const consoleErrors = [];
  const failedRequests = [];
  try {
    const cdp = await connect(port);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Log.enable");
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") {
        const text = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
        consoleErrors.push(text);
      }
    });
    cdp.on("Runtime.exceptionThrown", (p) => {
      consoleErrors.push("EXCEPTION: " + (p.exceptionDetails?.text ?? "") + " " + (p.exceptionDetails?.exception?.description ?? ""));
    });
    cdp.on("Network.loadingFailed", (p) => {
      failedRequests.push(`${p.requestId} ${p.errorText} ${p.canceled ? "(canceled)" : ""}`);
    });

    await cdp.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 3500));
    const res = await cdp.send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("RESULT:", JSON.stringify(res?.result?.result?.value ?? res?.result?.exceptionDetails ?? res?.error ?? null, null, 2));
    console.log("CONSOLE_ERRORS:", consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : "none");
    console.log("FAILED_REQUESTS:", failedRequests.length ? JSON.stringify(failedRequests, null, 2) : "none");
    cdp.close();
  } catch (err) {
    console.error("PROBE_FAILED:", err.message);
  }
}

main();