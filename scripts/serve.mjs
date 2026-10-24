import path from "node:path";
import { parseArgs } from "node:util";
import { startDevServer, startStaticServer } from "./browser-server.mjs";
import { repoRoot } from "./site-config.mjs";

const { values } = parseArgs({
  options: {
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string" },
    strictPort: { type: "boolean", default: false },
    open: { type: "boolean", default: false },
    preview: { type: "boolean", default: false },
    base: { type: "string", default: "/" },
  },
});
let port = Number(values.port ?? (values.preview ? 4173 : 5173));
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid port");
if (!values.base.startsWith("/") || !values.base.endsWith("/")) throw new Error("Base must start and end with /");

let server;
while (!server) {
  try {
    const options = { hostname: values.host, port };
    server = values.preview
      ? startStaticServer({ ...options, directory: path.join(repoRoot, "dist"), basePath: values.base })
      : await startDevServer(options);
  } catch (error) {
    if (error.code !== "EADDRINUSE" || values.strictPort || port === 0 || port === 65535) throw error;
    console.log(`Port ${port} is in use, trying another one...`);
    port++;
  }
}
const url = new URL(values.preview ? values.base : "/", server.url).href;
console.log(`Bun ${values.preview ? "preview" : "dev server"}: ${url}`);
if (values.open) {
  const command = process.platform === "darwin" ? ["open", url]
    : process.platform === "win32" ? ["cmd", "/c", "start", "", url] : ["xdg-open", url];
  Bun.spawn(command);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  server.stop(true);
  process.exit(0);
});
