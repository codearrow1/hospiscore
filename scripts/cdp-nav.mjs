// Drives headless Edge over raw CDP (Node >= 22 global WebSocket).
// Usage: node scripts/cdp-nav.mjs <port> <profileDir> <cookieJar> <url1> <url2> ...
// Navigates to each URL sequentially and prints snapshot + console errors per page.
import { readFileSync } from "node:fs";

const [portStr, , cookieJar, ...urls] = process.argv.slice(2);
const port = Number(portStr);

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
    cdp.on("Log.entryAdded", (p) => {
      if (p.entry.level === "error") consoleErrors.push("LOG: " + p.entry.text);
    });

    if (cookieJar) {
      const jar = readFileSync(cookieJar, "utf8");
      const HTTPONLY_PREFIX = "#HttpOnly_";
      for (const line of jar.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith(HTTPONLY_PREFIX)) {
          const parts = line.slice(HTTPONLY_PREFIX.length).split("\t");
          if (parts.length >= 7) {
            const host = parts[0].replace(/\r$/, "").replace(/^\./, "");
            await cdp.send("Network.setCookie", {
              name: parts[5].replace(/\r$/, ""),
              value: parts[6].replace(/\r$/, ""),
              domain: host,
              path: parts[2].replace(/\r$/, ""),
              secure: parts[1].toUpperCase() === "TRUE",
              httpOnly: true,
            });
          }
        }
      }
    }

    for (const url of urls) {
      consoleErrors.length = 0;
      failedRequests.length = 0;
      await cdp.send("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, 4000));
      const snap = await cdp.send("Runtime.evaluate", {
        expression: `JSON.stringify({ title: document.title, h1: document.querySelector("h1")?.innerText ?? null, url: location.href })`,
        returnByValue: true,
      });
      console.log("PAGE:", url);
      console.log("  SNAP:", snap?.result?.result?.value ?? "(none)");
      console.log("  ERRORS:", consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : "none");
      console.log("  FAILED:", failedRequests.length ? JSON.stringify(failedRequests, null, 2) : "none");
    }
    cdp.close();
  } catch (err) {
    console.error("PROBE_FAILED:", err.message);
  }
}

main();