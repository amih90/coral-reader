import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { buildStoreLinks } from "../download.mjs";

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootDir = dirname(siteDir);
const campaignConfig = JSON.parse(await readFile(join(siteDir, "campaign-config.json"), "utf8"));
const fixture = (await readFile(join(
  siteDir, "scripts/campaign-referrer.txt",
), "utf8")).trim();

test("launch links attribute installs by platform without creative labels", () => {
  const links = ["whatsapp", "reddit", "facebook", "instagram"].map((source) =>
    `https://coral-reader.com/get/?utm_source=${source}&utm_medium=${source === "whatsapp" ? "referral" : "organic_social"}&utm_campaign=launch&ct=launch_${source}`);
  const sources = [];
  for (const link of links) {
    const url = new URL(link);
    const source = url.searchParams.get("utm_source");
    sources.push(source);
    assert.equal(url.searchParams.get("utm_campaign"), "launch");
    assert.equal(url.searchParams.has("utm_content"), false);
    const stores = buildStoreLinks(url.search, campaignConfig.appStoreProviderToken);
    assert.equal(stores.androidAttributed, true);
    assert.equal(stores.appleAttributed, true);
    const apple = new URL(stores.apple);
    assert.equal(apple.searchParams.get("pt"), "129068563");
    assert.equal(apple.searchParams.get("ct"), `launch_${source}`);
    assert.equal(apple.searchParams.get("mt"), "8");
  }
  assert.deepEqual(sources.sort(), ["facebook", "instagram", "reddit", "whatsapp"]);
});

test("sample campaign survives the store URL round trip", () => {
  const links = buildStoreLinks(`?${fixture}&ct=ig_oct_video01`, "123456");
  const play = new URL(links.android);
  assert.equal(play.origin, "https://play.google.com");
  assert.equal(play.searchParams.get("id"), "dev.hollander.coralreader");
  assert.equal(play.searchParams.get("referrer"), fixture);
  const apple = new URL(links.apple);
  assert.equal(apple.pathname, "/app/coral-reader/id6782911744");
  assert.equal(apple.searchParams.get("pt"), "123456");
  assert.equal(apple.searchParams.get("ct"), "ig_oct_video01");
  assert.equal(apple.searchParams.get("mt"), "8");
  assert.equal(links.androidAttributed, true);
  assert.equal(links.appleAttributed, true);
});

test("short WhatsApp links produce the same store URLs as fully specified links", () => {
  const short = "utm_source=whatsapp&utm_campaign=launch";
  const full = "utm_source=whatsapp&utm_medium=referral&utm_campaign=launch&ct=launch_whatsapp";
  assert.deepEqual(buildStoreLinks(short, "123"), buildStoreLinks(full, "123"));
  const links = buildStoreLinks(short, "123");
  assert.equal(links.androidAttributed, true);
  assert.equal(links.appleAttributed, true);
  assert.equal(new URL(links.apple).searchParams.get("ct"), "launch_whatsapp");
});

test("omitted defaults are independent and explicit medium and ct values are preserved", () => {
  const links = buildStoreLinks(fixture, "123");
  assert.equal(new URL(links.android).searchParams.get("referrer"), fixture);
  assert.equal(new URL(links.apple).searchParams.get("ct"), "oct_launch_instagram");
  const custom = buildStoreLinks("utm_source=whatsapp&utm_campaign=launch&ct=custom", "123");
  assert.equal(new URL(custom.apple).searchParams.get("ct"), "custom");
  assert.equal(new URL(custom.android).searchParams.get("referrer"),
    "utm_source=whatsapp&utm_medium=referral&utm_campaign=launch");
});

test("defaults never replace invalid explicit fields or missing required labels", () => {
  const short = "utm_source=whatsapp&utm_campaign=launch";
  for (const suffix of ["utm_medium=", "utm_medium=Uppercase", "utm_medium=one&utm_medium=two"]) {
    const links = buildStoreLinks(`${short}&${suffix}`, "123");
    assert.equal(links.androidAttributed, false);
    assert.equal(links.appleAttributed, false);
  }
  for (const suffix of ["ct=", "ct=Uppercase", "ct=one&ct=two"]) {
    const links = buildStoreLinks(`${short}&${suffix}`, "123");
    assert.equal(links.androidAttributed, true);
    assert.equal(links.appleAttributed, false);
  }
  for (const query of ["", "utm_source=whatsapp", "utm_campaign=launch"]) {
    const links = buildStoreLinks(query, "123");
    assert.equal(links.androidAttributed, false);
    assert.equal(links.appleAttributed, false);
  }
});

test("generated Apple labels respect the length limit without truncating or colliding", () => {
  for (const length of [21, 22]) {
    const links = buildStoreLinks(`utm_source=whatsapp&utm_campaign=${"a".repeat(length)}`, "123");
    assert.equal(links.androidAttributed, true);
    assert.equal(links.appleAttributed, length === 21);
  }
});

test("unknown parameters and user-supplied destinations or provider tokens are never forwarded", () => {
  const links = buildStoreLinks(
    `${fixture}&email=private@example.com&redirect=https://evil.example&pt=999&ct=ig_oct_video01`,
    "123456",
  );
  assert.equal(new URL(links.android).searchParams.get("referrer"), fixture);
  assert.equal(new URL(links.apple).searchParams.get("pt"), "123456");
  assert.ok(!JSON.stringify(links).includes("private"));
  assert.ok(!JSON.stringify(links).includes("evil"));
});

test("missing, invalid, duplicate, or oversized campaign labels fall back to untagged stores", () => {
  for (const query of [
    "", "utm_source=instagram", `${fixture}&utm_source=facebook`,
    fixture.replace("instagram", "%"), fixture.replace("instagram", "Uppercase"),
    fixture.replace("instagram", "person%40example.com"),
    fixture.replace("instagram", "x".repeat(51)),
    fixture.replace("instagram", "%3Cscript%3E"),
  ]) {
    const links = buildStoreLinks(`${query}&ct=ig_oct_video01`, "123456");
    assert.equal(links.androidAttributed, false, query);
    assert.equal(links.appleAttributed, false, query);
    assert.equal(new URL(links.android).searchParams.has("referrer"), false);
    assert.equal(new URL(links.apple).search, "");
  }
});

test("content is optional; campaign tokens obey Apple's 30-character limit", () => {
  assert.equal(buildStoreLinks(fixture.replace("&utm_content=video_01", "")).androidAttributed, true);
  assert.equal(buildStoreLinks(`${fixture}&ct=${"a".repeat(30)}`, "123").appleAttributed, true);
  assert.equal(buildStoreLinks(`${fixture}&ct=${"a".repeat(31)}`, "123").appleAttributed, false);
  assert.equal(buildStoreLinks(`${fixture}&ct=one&ct=two`, "123").appleAttributed, false);
});

test("without a configured Apple provider token no attribution is falsely claimed", () => {
  for (const provider of ["", "not-a-token", "123&ct=evil"]) {
    const links = buildStoreLinks(`${fixture}&ct=ig_oct_video01`, provider);
    assert.equal(links.androidAttributed, true);
    assert.equal(links.appleAttributed, false);
    assert.equal(new URL(links.apple).search, "");
  }
});

test("built module contains the configured provider token and runs the real page wiring", async () => {
  const html = await readFile(join(rootDir, "get/index.html"), "utf8");
  const asset = html.match(/src="\/assets\/(download\.[a-f0-9]+\.mjs)"/)?.[1];
  assert.ok(asset);
  const script = await readFile(join(rootDir, "assets", asset), "utf8");
  assert.ok(!script.includes("__APP_STORE_PROVIDER_TOKEN__"));
  const nodes = {
    "download-android": {},
    "download-ios": {},
    "campaign-notice": { hidden: true },
  };
  globalThis.document = {
    getElementById: (id) => nodes[id],
    querySelectorAll: (selector) =>
      [nodes[selector === '[data-store="android"]' ? "download-android" : "download-ios"]],
  };
  globalThis.location = { search: `?${fixture}&ct=ig_oct_video01` };
  try {
    await import(pathToFileURL(join(rootDir, "assets", asset)).href);
    assert.equal(new URL(nodes["download-android"].href).searchParams.get("referrer"), fixture);
    const provider = process.env.APP_STORE_PROVIDER_TOKEN || campaignConfig.appStoreProviderToken;
    assert.equal(nodes["download-ios"].href, buildStoreLinks(location.search, provider).apple);
    assert.equal(nodes["campaign-notice"].hidden, Boolean(provider));
  } finally {
    delete globalThis.document;
    delete globalThis.location;
  }
});

test("build is deterministic, preserves homepage content, and shares its module with /get/", async () => {
  const homepage = await readFile(join(rootDir, "index.html"));
  const html = await readFile(join(rootDir, "get/index.html"), "utf8");
  const modulePath = html.match(/<script type="module" src="([^"]+)"/)?.[1];
  assert.ok(modulePath);
  assert.ok(homepage.toString().includes(
    `<script type="module" src="${modulePath}" data-store-links></script>`,
  ));
  const references = [...html.matchAll(/\b(?:href|src)="(\/[^"]+)"/g)]
    .map((match) => match[1]).filter((path) => path !== "/");
  const before = await Promise.all(references.map((path) => readFile(join(rootDir, path))));
  execFileSync(process.execPath, [join(siteDir, "scripts/build.mjs")]);
  assert.deepEqual(await readFile(join(rootDir, "index.html")), homepage);
  assert.equal(await readFile(join(rootDir, "get/index.html"), "utf8"), html);
  assert.ok(!html.includes("__SITE_CSS__") && !html.includes("__DOWNLOAD_JS__"));
  for (let index = 0; index < references.length; index++) {
    assert.deepEqual(await readFile(join(rootDir, references[index])), before[index]);
  }
});
