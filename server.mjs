import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const port = Number(process.env.PORT || 3000);
const publicRoot = resolve(process.cwd(), "dist");
const indexPath = resolve(publicRoot, "index.html");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function cachePolicy(filePath) {
  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);
  if (fileName === "index.html" || fileName === "version.json") {
    return "no-cache, no-store, must-revalidate";
  }
  if (/\.[a-f0-9]{12}\.(?:css|js)$/.test(fileName)) {
    return "public, max-age=31536000, immutable";
  }
  if (fileName.endsWith(".html") || fileName.endsWith(".css") || fileName.endsWith(".js")) {
    return "no-cache, must-revalidate";
  }
  return "public, max-age=86400";
}

function sendFile(request, response, filePath) {
  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    response.writeHead(404, {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
    return;
  }

  if (!stats.isFile()) {
    response.writeHead(404, { "Cache-Control": "no-store" });
    response.end("Not found");
    return;
  }

  const cacheControl = cachePolicy(filePath);
  const headers = {
    "Cache-Control": cacheControl,
    "Content-Length": stats.size,
    "Content-Type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Vary": "Accept-Encoding",
    "X-Content-Type-Options": "nosniff"
  };

  if (cacheControl.includes("no-store")) {
    headers["CDN-Cache-Control"] = "no-store";
    headers.Expires = "0";
    headers.Pragma = "no-cache";
    headers["Surrogate-Control"] = "no-store";
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Cache-Control": "no-store" });
    response.end("Method not allowed");
    return;
  }

  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/" || url.pathname === "/index.html") {
    sendFile(request, response, indexPath);
    return;
  }

  if (url.pathname === "/en" || url.pathname === "/fr") {
    response.writeHead(308, { Location: `${url.pathname}/${url.search}`, "Cache-Control": "no-cache" });
    response.end();
    return;
  }

  if (url.pathname === "/en/" || url.pathname === "/fr/") {
    sendFile(request, response, resolve(publicRoot, url.pathname.slice(1), "index.html"));
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    response.writeHead(400, { "Cache-Control": "no-store" });
    response.end("Bad request");
    return;
  }

  const filePath = resolve(publicRoot, pathname);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
    response.writeHead(403, { "Cache-Control": "no-store" });
    response.end("Forbidden");
    return;
  }

  sendFile(request, response, filePath);
}).listen(port, "0.0.0.0", () => {
  console.log(`wangmixiaopiano listening on ${port}`);
});
