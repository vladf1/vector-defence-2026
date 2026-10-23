import path from "node:path";
import { stat } from "node:fs/promises";
import { htmlPages, repoRoot } from "./site-config.mjs";

export async function startDevServer({ hostname, port }) {
  const routes = {};
  for (const page of htmlPages) {
    const html = (await import(path.join(repoRoot, page))).default;
    routes[`/${page}`] = html;
    if (page.endsWith("index.html")) {
      const directoryRoute = `/${page.slice(0, -10)}`;
      routes[directoryRoute] = html;
      if (directoryRoute !== "/") {
        routes[directoryRoute.slice(0, -1)] = request => Response.redirect(new URL(directoryRoute, request.url));
      }
    }
  }
  return Bun.serve({ hostname, port, routes, development: { hmr: true, console: false } });
}

export function startStaticServer({ directory, hostname, port, basePath }) {
  return Bun.serve({
    hostname,
    port,
    development: false,
    async fetch(request) {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }
      if (!pathname.startsWith(basePath)) return new Response("Not found", { status: 404 });
      const relativePath = pathname.slice(basePath.length);
      const filename = path.resolve(directory, relativePath + (pathname.endsWith("/") ? "index.html" : ""));
      if (!filename.startsWith(`${path.resolve(directory)}${path.sep}`)) return new Response("Not found", { status: 404 });
      const info = await stat(filename).catch(() => undefined);
      if (info?.isDirectory()) return Response.redirect(new URL(`${pathname}/`, request.url));
      return info?.isFile() ? new Response(Bun.file(filename)) : new Response("Not found", { status: 404 });
    },
  });
}
