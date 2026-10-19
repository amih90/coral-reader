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
const homepagePath = join(rootDir, "index.html");
const homepage = await readFile(homepagePath, "utf8");
const homepageScript = /<script type="module" src="[^"]+" data-store-links><\/script>/g;
if ([...homepage.matchAll(homepageScript)].length !== 1) {
  throw new Error("Homepage must contain exactly one data-store-links module script.");
}
const updatedHomepage = homepage.replace(homepageScript,
  `<script type="module" src="${scriptPath}" data-store-links></script>`);

await mkdir(join(rootDir, "assets"), { recursive: true });
await mkdir(join(rootDir, "get"), { recursive: true });
await writeFile(join(rootDir, cssPath), css);
await writeFile(join(rootDir, scriptPath), script);
await writeFile(join(rootDir, "get/index.html"), html);
if (updatedHomepage !== homepage) await writeFile(homepagePath, updatedHomepage);
console.log("Built /get/ and shared store-link assets; updated homepage script reference only.");
