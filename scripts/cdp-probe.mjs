// Drives headless Edge over raw CDP (Node >= 22 global WebSocket).
// Usage: node scripts/cdp-probe.mjs <port> <url> <profileDir> [cookieJar]
// Attaches to an already-running Edge instance exposing CDP on <port>.
// Prints page title, body snapshot, DOM size, console errors, failed requests.
import { readFileSync } from "node:fs";

const [portStr, url, , cookieJar] = process.argv.slice(2);
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
  console.log("MARKER: script start " + new Date().toISOString());
  console.log("ARGV:", JSON.stringify(process.argv.slice(2)));
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
      console.log("COOKIE_BLOCK_ENTER");
      const jar = readFileSync(cookieJar, "utf8");
      const HTTPONLY_PREFIX = "#HttpOnly_";
      let cookieCount = 0;
      for (const line of jar.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith(HTTPONLY_PREFIX)) {
          const rest = line.slice(HTTPONLY_PREFIX.length);
          const parts = rest.split("\t");
          if (parts.length >= 7) {
            let host = parts[0].replace(/\r$/, "");
            if (host.startsWith(".")) host = host.slice(1);
            const res = await cdp.send("Network.setCookie", {
              name: parts[5].replace(/\r$/, ""),
              value: parts[6].replace(/\r$/, ""),
              domain: host,
              path: parts[2].replace(/\r$/, ""),
              secure: parts[1].toUpperCase() === "TRUE",
              httpOnly: true,
            });
            console.log("SETCOOKIE:", JSON.stringify(res.result ?? res.error ?? res));
            cookieCount++;
          } else {
            console.log("HTTPONLY_SKIP fields=" + parts.length + " line=" + JSON.stringify(rest));
          }
          continue;
        }
        if (trimmed.startsWith("#")) continue;
        const parts = trimmed.split("\t");
        if (parts.length >= 7) {
          let host = parts[0].replace(/\r$/, "");
          if (host.startsWith(".")) host = host.slice(1);
          const res = await cdp.send("Network.setCookie", {
            name: parts[5].replace(/\r$/, ""),
            value: parts[6].replace(/\r$/, ""),
            domain: host,
            path: parts[2].replace(/\r$/, ""),
            secure: parts[1].toUpperCase() === "TRUE",
            httpOnly: parts[3].toUpperCase() === "TRUE",
          });
          console.log("SETCOOKIE:", JSON.stringify(res.result ?? res.error ?? res));
          cookieCount++;
        } else {
          console.log("NORMAL_SKIP fields=" + parts.length + " line=" + JSON.stringify(trimmed));
        }
      }
      console.log("COOKIE_COUNT=" + cookieCount);
    }
    console.log("POST_COOKIE_BLOCK");

    await cdp.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 9000));

    const snap = await cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify({ title: document.title, h1: document.querySelector("h1")?.innerText ?? null, url: location.href, bodyText: document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 400) ?? null })`,
      returnByValue: true,
    });
    const dom = await cdp.send("Runtime.evaluate", {
      expression: `document.documentElement.outerHTML.length`,
      returnByValue: true,
    });
    console.log("SNAPSHOT:", snap?.result?.result?.value ?? "(none)");
    console.log("DOM_BYTES:", dom?.result?.result?.value ?? 0);
    console.log("CONSOLE_ERRORS:", consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : "none");
    console.log("FAILED_REQUESTS:", failedRequests.length ? JSON.stringify(failedRequests, null, 2) : "none");
    cdp.close();
  } catch (err) {
    console.error("PROBE_FAILED:", err.message);
  }
}

main();
