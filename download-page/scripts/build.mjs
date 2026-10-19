import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootDir = dirname(siteDir);
const config = JSON.parse(await readFile(join(siteDir, "campaign-config.json"), "utf8"));
const provider = process.env.APP_STORE_PROVIDER_TOKEN || config.appStoreProviderToken;
if (typeof provider !== "string" || !/^[0-9]+$/.test(provider)) {
  throw new Error("APP_STORE_PROVIDER_TOKEN must be the numeric provider token from App Store Connect.");
}
const css = await readFile(join(siteDir, "site.css"));
const script = (await readFile(join(siteDir, "download.mjs"), "utf8"))
  .replaceAll("__APP_STORE_PROVIDER_TOKEN__", provider);
const hash = (content) => createHash("sha256").update(content).digest("hex").slice(0, 12);
const cssPath = `/assets/site.${hash(css)}.css`;
const scriptPath = `/assets/download.${hash(script)}.mjs`;
const html = (await readFile(join(siteDir, "index.html"), "utf8"))
  .replaceAll("__SITE_CSS__", cssPath)
  .replaceAll("__DOWNLOAD_JS__", scriptPath);

await mkdir(join(rootDir, "assets"), { recursive: true });
await mkdir(join(rootDir, "get"), { recursive: true });
await writeFile(join(rootDir, cssPath), css);
await writeFile(join(rootDir, scriptPath), script);
await writeFile(join(rootDir, "get/index.html"), html);
console.log("Built /get/ and its hashed assets; homepage and existing assets preserved.");
