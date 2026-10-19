import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = dirname(siteDir);
const campaignConfig = JSON.parse(await readFile(join(siteDir, "campaign-config.json"), "utf8"));
const fixture = (await readFile(join(
  siteDir, "scripts/campaign-referrer.txt",
), "utf8")).trim();
const mimeTypes = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".mjs": "text/javascript" };

// GitHub Pages serves the checked-in /get/ page and root assets directly.
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    let file = resolve(distDir, `.${path}`);
    if (!file.startsWith(`${distDir}${sep}`) && file !== distDir) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    response.writeHead(200, {
      "content-type": mimeTypes[extname(file)] || "application/octet-stream",
    });
    response.end(await readFile(file));
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  // Reuse installed Chrome; Playwright creates its own isolated, temporary profile.
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === base) return route.continue();
    if (route.request().resourceType() === "stylesheet") {
      return route.fulfill({ contentType: "text/css", body: "" });
    }
    return route.fulfill({ contentType: "text/html", body: "<h1>Intercepted store navigation</h1>" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const campaign = `?${fixture}&ct=ig_oct_video01`;
  await page.goto(`${base}/get/${campaign}`);
  const android = page.getByRole("link", { name: "Get it on Google Play" });
  const ios = page.getByRole("link", { name: "Download on the App Store" });
  const logo = page.locator(".site-header .download-logo");
  await logo.evaluate((image) => image.decode());
  assert.equal(await logo.getAttribute("src"), "/assets/icon-512.webp");
  assert.ok(await logo.evaluate((image) => image.naturalWidth > 0));
  const mockup = page.getByRole("img", { name: "Coral Reader library shown in an AI-generated iPhone mockup" });
  assert.equal(await mockup.isVisible(), true);
  await mockup.evaluate((image) => image.decode());
  assert.deepEqual(await mockup.evaluate((image) => [image.naturalWidth, image.naturalHeight]), [488, 970]);
  assert.deepEqual(await mockup.evaluate((image) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return [context.getImageData(0, 0, 1, 1).data[3], context.getImageData(244, 485, 1, 1).data[3]];
  }), [0, 255]);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.waitForFunction(() =>
    new URL(document.getElementById("download-android").href).searchParams.has("referrer"),
  );
  assert.equal(new URL(await android.getAttribute("href")).searchParams.get("referrer"), fixture);
  const androidUrl = await android.getAttribute("href");
  const provider = process.env.APP_STORE_PROVIDER_TOKEN || campaignConfig.appStoreProviderToken;
  const appleUrl = new URL(await ios.getAttribute("href"));
  assert.equal(appleUrl.searchParams.get("pt"), provider || null);
  assert.equal(appleUrl.searchParams.get("ct"), provider ? "ig_oct_video01" : null);
  assert.equal(await page.locator("#campaign-notice").isVisible(), !provider);
  await android.click();
  await page.waitForURL("https://play.google.com/**");
  assert.equal(new URL(page.url()).searchParams.get("referrer"), fixture);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/get${campaign}`);
  await page.waitForFunction(() =>
    new URL(document.getElementById("download-android").href).searchParams.has("referrer"),
  );
  assert.equal(await android.isVisible(), true);
  assert.equal(await ios.isVisible(), true);
  assert.equal(await mockup.isVisible(), true);
  await mockup.evaluate((image) => image.decode());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await ios.click();
  await page.waitForURL("https://apps.apple.com/**");
  assert.equal(page.url(), appleUrl.href);

  await page.goto(`${base}/get/?${fixture}&utm_source=facebook&ct=ig_oct_video01`);
  await page.waitForFunction(() => !document.getElementById("campaign-notice").hidden);
  assert.equal(new URL(await android.getAttribute("href")).searchParams.has("referrer"), false);
  assert.equal(new URL(await ios.getAttribute("href")).search, "");

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const store of ["android", "ios"]) {
      for (const index of [0, 1]) {
        await page.goto(`${base}/${campaign}#download`);
        const buttons = page.locator(`[data-store="${store}"]`);
        assert.equal(await buttons.count(), 2);
        const expected = store === "android" ? androidUrl : appleUrl.href;
        for (const button of await buttons.all()) {
          assert.equal(await button.getAttribute("href"), expected);
        }
        assert.equal(await page.locator("#campaign-notice").isVisible(), !provider);
        await buttons.nth(index).click();
        await page.waitForURL(store === "android"
          ? "https://play.google.com/**" : "https://apps.apple.com/**");
        assert.equal(page.url(), expected);
      }
    }
  }
  for (const query of ["", `?${fixture}&utm_source=facebook&ct=ig_oct_video01`]) {
    await page.goto(`${base}/${query}`);
    for (const button of await page.locator('[data-store="android"]').all()) {
      assert.equal(new URL(await button.getAttribute("href")).searchParams.has("referrer"), false);
    }
    for (const button of await page.locator('[data-store="ios"]').all()) {
      assert.equal(new URL(await button.getAttribute("href")).search, "");
    }
    assert.equal(await page.locator("#campaign-notice").isVisible(), query !== "");
  }

  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noScript.newPage();
  await fallback.goto(`${base}/get/`);
  assert.equal(await fallback.getByRole("link", { name: "Get it on Google Play" }).isVisible(), true);
  assert.equal(await fallback.getByRole("link", { name: "Download on the App Store" }).isVisible(), true);
  const fallbackPlay = await fallback.getByRole("link", { name: "Get it on Google Play" }).getAttribute("href");
  assert.equal(new URL(fallbackPlay).searchParams.has("referrer"), false);
  await fallback.goto(`${base}/${campaign}`);
  assert.equal(await fallback.locator("[data-store]").count(), 4);
  for (const button of await fallback.locator("[data-store]").all()) {
    assert.equal(await button.isVisible(), true);
    const url = new URL(await button.getAttribute("href"));
    assert.ok(["https://play.google.com", "https://apps.apple.com"].includes(url.origin));
    assert.equal(url.searchParams.has("referrer"), false);
    assert.equal(url.searchParams.has("ct"), false);
  }
  assert.deepEqual(errors, []);
  console.log("Browser verified: homepage and /get/ desktop/mobile store navigation, exact campaign URLs, invalid-input fallback, and no-JavaScript downloads.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
