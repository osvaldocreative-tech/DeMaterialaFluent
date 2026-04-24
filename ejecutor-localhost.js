#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

function parsePort(argv) {
  const arg = argv.find((item) => item.startsWith("--port=")) ?? argv[0];
  const raw = arg?.startsWith("--port=") ? arg.slice("--port=".length) : arg;
  const port = Number(raw || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Puerto invalido. Usa un valor entre 1 y 65535.");
    process.exit(1);
  }

  return port;
}

function parseRoot(argv) {
  const arg = argv.find((item) => item.startsWith("--root="));
  if (!arg) return process.cwd();
  return path.resolve(arg.slice("--root=".length));
}

function openUrl(url) {
  const platform = process.platform;
  let cmd = "xdg-open";
  let args = [url];

  if (platform === "darwin") {
    cmd = "open";
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  }

  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", (err) => {
    console.error(`No pude abrir el navegador automaticamente: ${err.message}`);
    console.log(`Abre manualmente: ${url}`);
    process.exit(1);
  });
  child.unref();
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const table = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
  };
  return table[ext] || "application/octet-stream";
}

function resolveSafePath(root, requestPath) {
  const rawPath = decodeURIComponent(requestPath.split("?")[0]);
  const normalized = rawPath === "/" ? "/" : rawPath;
  const absolute = path.resolve(root, `.${normalized}`);
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    const target = resolveSafePath(root, req.url || "/");
    if (!target) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let filePath = target;
    if (req.url === "/" || req.url === "") {
      const rootIndex = path.join(root, "index.html");
      const bowlIndex = path.join(root, "bowl-semantic-lab", "index.html");
      const viewerFile = path.join(root, "viewer-localhost.html");

      if (fs.existsSync(rootIndex)) {
        filePath = rootIndex;
      } else if (fs.existsSync(bowlIndex)) {
        filePath = bowlIndex;
      } else if (fs.existsSync(viewerFile)) {
        filePath = viewerFile;
      }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>404</h1><p>No encontre el archivo solicitado.</p><p>Tip: crea un index.html en la raiz del proyecto.</p>"
        );
        return;
      }
      res.writeHead(200, { "Content-Type": getContentType(filePath) });
      res.end(data);
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Servidor estatico activo en http://localhost:${port}`);
  });
}

function probeLocalhost(port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: "/", timeout: timeoutMs },
      () => {
        resolve(true);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitUntilReady(port, retries = 10) {
  for (let i = 0; i < retries; i += 1) {
    if (await probeLocalhost(port, 800)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function startDetachedServer(port, root) {
  const child = spawn(
    process.execPath,
    [__filename, "--serve", `--port=${port}`, `--root=${root}`],
    { stdio: "ignore", detached: true }
  );
  child.unref();
}

async function run() {
  const args = process.argv.slice(2);
  const port = parsePort(args);
  const root = parseRoot(args);
  const url = `http://localhost:${port}`;

  if (args.includes("--serve")) {
    startStaticServer(root, port);
    return;
  }

  const alreadyUp = await probeLocalhost(port);
  if (!alreadyUp) {
    console.log(`No habia servidor en ${url}. Levantando servidor estatico...`);
    startDetachedServer(port, root);
    const ready = await waitUntilReady(port);
    if (!ready) {
      console.error("No pude iniciar el servidor automaticamente.");
      console.log(`Prueba manualmente: node ejecutor-localhost.js --serve --port=${port}`);
      process.exit(1);
    }
  }

  console.log(`Abriendo localhost en: ${url}`);
  openUrl(url);
}

run();
