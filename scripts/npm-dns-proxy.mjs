/**
 * Local npm registry proxy for hosts with broken DNS for registry.npmjs.org.
 * Rewrites packument tarball URLs to this proxy so installs do not re-hit DNS.
 */
import http from "node:http";
import https from "node:https";
import { Buffer } from "node:buffer";

const UPSTREAM_IP = process.env.NPM_UPSTREAM_IP ?? "104.16.5.34";
const PORT = Number(process.env.NPM_PROXY_PORT ?? "4873");
const LOCAL = `http://127.0.0.1:${PORT}`;

const agent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
});

function rewriteBody(contentType, body) {
  if (!contentType.includes("json")) {
    return body;
  }
  const text = body
    .toString("utf8")
    .replaceAll("https://registry.npmjs.org", LOCAL)
    .replaceAll("http://registry.npmjs.org", LOCAL);
  return Buffer.from(text, "utf8");
}

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: "registry.npmjs.org" };
  delete headers["accept-encoding"];

  const upstream = https.request(
    {
      host: UPSTREAM_IP,
      servername: "registry.npmjs.org",
      path: req.url,
      method: req.method,
      headers,
      agent,
    },
    (upRes) => {
      const chunks = [];
      upRes.on("data", (c) => chunks.push(c));
      upRes.on("end", () => {
        const raw = Buffer.concat(chunks);
        const contentType = String(upRes.headers["content-type"] ?? "");
        const out = rewriteBody(contentType, raw);
        const outHeaders = { ...upRes.headers };
        delete outHeaders["content-length"];
        outHeaders["content-length"] = String(out.length);
        res.writeHead(upRes.statusCode ?? 502, outHeaders);
        res.end(out);
      });
    },
  );

  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`upstream error: ${err.message}`);
  });

  req.pipe(upstream);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`npm dns proxy on ${LOCAL} -> ${UPSTREAM_IP}`);
});
