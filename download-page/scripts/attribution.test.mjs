import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { buildStoreClickBody, buildStoreLinks, sendStoreClick } from "../download.mjs";

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

test("click bodies distinguish both pages, all placements, and actual store attribution", () => {
  const search = "?utm_source=verification&utm_campaign=verify_ios_nov&ct=verify_ios_nov&utm_term=reader";
  const links = buildStoreLinks(search, "129068563");
  for (const [page, placement] of [["/", "hero"], ["/", "bottom"], ["/get/", "download"]]) {
    for (const platform of ["android", "ios"]) {
      const body = buildStoreClickBody(search, page, platform, placement,
        platform === "ios" ? links.apple : links.android);
      assert.deepEqual(Object.fromEntries(body), {
        page, platform, placement, attributed: "true",
        utm_source: "verification", utm_campaign: "verify_ios_nov", utm_term: "reader",
        utm_medium: "referral",
        ...(platform === "ios" ? { ct: "verify_ios_nov", pt: "129068563", mt: "8" } : {}),
      });
      assert.ok(Buffer.byteLength(body.toString()) < 2048);
    }
  }
  const generated = buildStoreLinks("utm_source=whatsapp&utm_campaign=launch", "129068563");
  assert.equal(buildStoreClickBody("utm_source=whatsapp&utm_campaign=launch",
    "/", "ios", "hero", generated.apple).get("ct"), "launch_whatsapp");
  const maximum = new URLSearchParams(Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
      .map((field) => [field, "a".repeat(50)]),
  ));
  maximum.set("ct", "a".repeat(30));
  const longestLinks = buildStoreLinks(maximum, "1".repeat(20));
  const longestBody = buildStoreClickBody(maximum, "/get/", "ios", "download", longestLinks.apple);
  assert.equal(longestBody.get("attributed"), "true");
  assert.ok(Buffer.byteLength(longestBody.toString()) < 2048);
});

test("click bodies count untagged downloads and never claim invalid attribution", () => {
  for (const search of ["", "?utm_source=whatsapp", "?utm_source=whatsapp&utm_campaign=launch&ct=Invalid"]) {
    const links = buildStoreLinks(search, "129068563");
    for (const platform of ["android", "ios"]) {
      const body = buildStoreClickBody(search, "/get/", platform, "download",
        platform === "ios" ? links.apple : links.android);
      assert.equal(body.get("attributed"), String(platform === "ios"
        ? links.appleAttributed : links.androidAttributed));
      if (!search) assert.deepEqual(Object.fromEntries(body), {
        page: "/get/", platform, placement: "download", attributed: "false",
      });
    }
  }
});

test("click bodies exclude unknown, duplicate, invalid and oversized labels and raw URLs", () => {
  const search = "?utm_source=instagram&utm_source=facebook&utm_medium=Uppercase" +
    "&utm_campaign=launch&utm_content=person%40example.com&utm_term=" + "a".repeat(51) +
    "&ct=launch&pt=999&mt=8&email=private@example.com&redirect=https://private.example";
  const links = buildStoreLinks(search, "129068563");
  assert.deepEqual(Object.fromEntries(buildStoreClickBody(search, "/", "ios", "hero", links.apple)), {
    page: "/", platform: "ios", placement: "hero", attributed: "false", utm_campaign: "launch",
  });
  const valid = "?utm_source=instagram&utm_medium=paid_social&utm_campaign=launch" +
    "&utm_content=video_01&utm_term=reader&ct=custom";
  const attributed = buildStoreLinks(valid, "129068563");
  const body = buildStoreClickBody(valid, "/", "ios", "bottom", attributed.apple);
  assert.equal(body.get("utm_content"), "video_01");
  assert.equal(body.get("utm_term"), "reader");
  assert.equal(body.get("utm_medium"), "paid_social");
  assert.equal(body.get("ct"), "custom");
  assert.equal(new URL(attributed.android).searchParams.get("referrer"),
    "utm_source=instagram&utm_medium=paid_social&utm_campaign=launch&utm_content=video_01");
  for (const field of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    for (const value of ["", "Uppercase", "person%40example.com", "a".repeat(51)]) {
      assert.equal(buildStoreClickBody(`?${field}=${value}`, "/", "ios", "hero",
        links.apple).has(field), false);
    }
    assert.equal(buildStoreClickBody(`?${field}=one&${field}=two`, "/", "ios", "hero",
      links.apple).has(field), false);
  }
});

test("click metadata accepts only known page slots, platforms, and store origins", () => {
  const apple = buildStoreLinks("").apple;
  for (const args of [
    ["/other/", "ios", "hero", apple], ["/", "ios", "download", apple],
    ["/get/", "ios", "hero", apple], ["/", "other", "hero", apple],
    ["/", "ios", "arbitrary", apple], ["/", "ios", "hero", "https://private.example"],
  ]) {
    assert.throws(() => buildStoreClickBody("", ...args));
  }
});

test("collection is a credential-free, referrer-free keepalive form POST without waiting", () => {
  let request;
  const body = new URLSearchParams({ page: "/", platform: "ios", placement: "hero", attributed: "false" });
  const result = sendStoreClick(body, (url, options) => {
    request = { url, options };
    return new Promise(() => {});
  });
  assert.equal(result, undefined);
  assert.equal(request.url,
    "https://coralreader-qvugf3wd-api.redgrass-94a370ab.swedencentral.azurecontainerapps.io/api/v1/acquisition/store-clicks");
  assert.deepEqual(request.options, {
    method: "POST", body, keepalive: true, credentials: "omit", referrerPolicy: "no-referrer",
  });
  assert.ok(request.options.body instanceof URLSearchParams);
});

test("collection failures warn once without throwing, retrying or leaking request data", async () => {
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    let calls = 0;
    for (const fail of [
      () => { throw new Error("private.example"); },
      () => Promise.reject(new Error("private.example")),
      () => Promise.resolve({ ok: false }),
    ]) {
      sendStoreClick(new URLSearchParams(), () => { calls++; return fail(); });
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 3);
    assert.equal(warnings.length, 3);
    for (const warning of warnings) {
      assert.deepEqual(warning, ["Store-click collection unavailable; store navigation is unaffected."]);
    }
  } finally {
    console.warn = warn;
  }
});

test("built module contains the configured provider token and runs the real page wiring", async () => {
  const html = await readFile(join(rootDir, "get/index.html"), "utf8");
  const asset = html.match(/src="\/assets\/(download\.[a-f0-9]+\.mjs)"/)?.[1];
  assert.ok(asset);
  const script = await readFile(join(rootDir, "assets", asset), "utf8");
  assert.ok(!script.includes("__APP_STORE_PROVIDER_TOKEN__"));
  const nodes = {
    "download-android": { dataset: { storePlacement: "download" }, listeners: {} },
    "download-ios": { dataset: { storePlacement: "download" }, listeners: {} },
    "campaign-notice": { hidden: true },
  };
  for (const id of ["download-android", "download-ios"]) {
    nodes[id].addEventListener = (name, handler) => { nodes[id].listeners[name] = handler; };
  }
  globalThis.document = {
    getElementById: (id) => nodes[id],
    querySelectorAll: (selector) =>
      [nodes[selector === '[data-store="android"]' ? "download-android" : "download-ios"]],
  };
  globalThis.location = { pathname: "/get/", search: `?${fixture}&ct=ig_oct_video01` };
  const fetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = (url, options) => {
    requests.push({ url, options });
    return Promise.resolve({ ok: true });
  };
  try {
    await import(pathToFileURL(join(rootDir, "assets", asset)).href);
    assert.equal(new URL(nodes["download-android"].href).searchParams.get("referrer"), fixture);
    const provider = process.env.APP_STORE_PROVIDER_TOKEN || campaignConfig.appStoreProviderToken;
    assert.equal(nodes["download-ios"].href, buildStoreLinks(location.search, provider).apple);
    assert.equal(nodes["campaign-notice"].hidden, Boolean(provider));
    assert.equal(requests.length, 0);
    for (const platform of ["android", "ios"]) {
      const node = nodes[`download-${platform}`];
      node.listeners.click({ type: "click", button: 0 });
      node.listeners.auxclick({ type: "auxclick", button: 1 });
      node.listeners.auxclick({ type: "auxclick", button: 2 });
      const body = requests.at(-1).options.body;
      assert.equal(body.get("platform"), platform);
      assert.equal(body.get("placement"), "download");
      assert.equal(body.get("page"), "/get/");
    }
    assert.equal(requests.length, 4);
  } finally {
    delete globalThis.document;
    delete globalThis.location;
    globalThis.fetch = fetch;
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
    .map((match) => new URL(match[1], "https://coral-reader.com").pathname)
    .filter((path) => path !== "/");
  const before = await Promise.all(references.map((path) => readFile(join(rootDir, path))));
  execFileSync(process.execPath, [join(siteDir, "scripts/build.mjs")]);
  assert.deepEqual(await readFile(join(rootDir, "index.html")), homepage);
  assert.equal(await readFile(join(rootDir, "get/index.html"), "utf8"), html);
  assert.ok(!html.includes("__SITE_CSS__") && !html.includes("__DOWNLOAD_JS__"));
  for (let index = 0; index < references.length; index++) {
    assert.deepEqual(await readFile(join(rootDir, references[index])), before[index]);
  }
});
