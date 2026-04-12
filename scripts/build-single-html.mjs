import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const tempDir = resolve(rootDir, "dist-single-temp");
const outDir = resolve(rootDir, "dist-single");
const viteBin = resolve(rootDir, "node_modules", "vite", "bin", "vite.js");

rmSync(tempDir, { recursive: true, force: true });
rmSync(outDir, { recursive: true, force: true });

const buildResult = spawnSync(
  process.execPath,
  [viteBin, "build", "--outDir", tempDir],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const indexPath = resolve(tempDir, "index.html");
let html = readFileSync(indexPath, "utf8");

const resolveBuiltAsset = (assetPath) => {
  const cleanedPath = assetPath.replace(/[?#].*$/, "").replace(/^\//, "");
  return resolve(tempDir, cleanedPath);
};

const toDataUri = (filePath) => {
  const content = readFileSync(filePath);
  const extension = extname(filePath).toLowerCase();

  if (extension === ".svg") {
    return `data:image/svg+xml,${encodeURIComponent(content.toString("utf8"))}`;
  }

  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : extension === ".gif"
          ? "image/gif"
          : extension === ".webp"
            ? "image/webp"
            : extension === ".woff"
              ? "font/woff"
              : extension === ".woff2"
                ? "font/woff2"
                : extension === ".ttf"
                  ? "font/ttf"
                  : extension === ".otf"
                    ? "font/otf"
                    : "application/octet-stream";

  return `data:${mimeType};base64,${content.toString("base64")}`;
};

const inlineCssUrls = (cssText) =>
  cssText.replace(/url\((['"]?)([^)"']+)\1\)/g, (match, quote, assetPath) => {
    if (
      assetPath.startsWith("data:") ||
      assetPath.startsWith("http://") ||
      assetPath.startsWith("https://") ||
      assetPath.startsWith("#")
    ) {
      return match;
    }

    return `url(${quote}${toDataUri(resolveBuiltAsset(assetPath))}${quote})`;
  });

html = html.replace(
  /<link\b([^>]*?)rel=["']stylesheet["']([^>]*?)href=["']([^"']+)["']([^>]*?)>/g,
  (_match, _beforeRel, _betweenRelAndHref, href, _afterHref) => {
    const cssPath = resolveBuiltAsset(href);
    const cssText = inlineCssUrls(readFileSync(cssPath, "utf8"));
    return `<style>\n${cssText}\n</style>`;
  },
);

html = html.replace(
  /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/g,
  (_match, beforeSrc, src, afterSrc) => {
    const jsPath = resolveBuiltAsset(src);
    const jsText = readFileSync(jsPath, "utf8");
    const inlineAttrs = `${beforeSrc} ${afterSrc}`
      .replace(/\s*crossorigin(?:=(?:"[^"]*"|'[^']*'))?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return `<script${inlineAttrs ? ` ${inlineAttrs}` : ""}>\n${jsText}\n</script>`;
  },
);

html = html.replace(
  /(<link\b[^>]*?\bhref=["'])([^"']+)(["'][^>]*?\brel=["'][^"']*icon[^"']*["'][^>]*?>|["'][^>]*?>)/g,
  (match, prefix, href, suffix) => {
    try {
      return `${prefix}${toDataUri(resolveBuiltAsset(href))}${suffix}`;
    } catch {
      return match;
    }
  },
);

mkdirSync(dirname(resolve(outDir, "index.html")), { recursive: true });
writeFileSync(resolve(outDir, "index.html"), html);

rmSync(tempDir, { recursive: true, force: true });

console.log(`Standalone HTML written to ${resolve(outDir, "index.html")}`);
