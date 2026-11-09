const fields = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
const labelPattern = /^[a-z0-9][a-z0-9_-]{0,49}$/;
const appleTokenPattern = /^[a-z0-9][a-z0-9_-]{0,29}$/;
const storeClickEndpoint = "https://coralreader-qvugf3wd-api.redgrass-94a370ab.swedencentral.azurecontainerapps.io/api/v1/acquisition/store-clicks";
const placements = { "/": ["hero", "bottom"], "/get/": ["download"] };

function singleLabel(params, name, pattern = labelPattern) {
  const values = params.getAll(name);
  return values.length === 1 && pattern.test(values[0]) ? values[0] : null;
}

export function buildStoreLinks(search, providerToken = "") {
  const params = new URLSearchParams(search);
  if (!params.has("utm_medium")) params.set("utm_medium", "referral");
  const campaign = new URLSearchParams();
  const valid = fields.every((field) => {
    const values = params.getAll(field);
    if (values.length === 0) return field === "utm_content";
    if (values.length !== 1 || !labelPattern.test(values[0])) return false;
    campaign.set(field, values[0]);
    return true;
  });
  const android = new URL("https://play.google.com/store/apps/details");
  android.searchParams.set("id", "dev.hollander.coralreader");
  if (valid) android.searchParams.set("referrer", campaign.toString());

  const apple = new URL("https://apps.apple.com/app/coral-reader/id6782911744");
  const tokens = params.getAll("ct");
  if (tokens.length === 0 && valid) {
    tokens.push(`${campaign.get("utm_campaign")}_${campaign.get("utm_source")}`);
  }
  const appleAttributed = valid && /^[0-9]+$/.test(providerToken) &&
    tokens.length === 1 && appleTokenPattern.test(tokens[0]);
  if (appleAttributed) {
    apple.searchParams.set("pt", providerToken);
    apple.searchParams.set("ct", tokens[0]);
    apple.searchParams.set("mt", "8");
  }
  return {
    android: android.href,
    apple: apple.href,
    androidAttributed: valid,
    appleAttributed,
  };
}

export function buildStoreClickBody(search, page, platform, placement, storeUrl) {
  if (!Object.hasOwn(placements, page) || !placements[page].includes(placement) ||
      !["android", "ios"].includes(platform)) {
    throw new Error("Invalid store-click page, platform, or placement.");
  }
  const store = new URL(storeUrl);
  const apple = platform === "ios";
  if (store.origin !== (apple ? "https://apps.apple.com" : "https://play.google.com")) {
    throw new Error("Invalid store-click destination.");
  }
  const ct = singleLabel(store.searchParams, "ct", appleTokenPattern);
  const pt = singleLabel(store.searchParams, "pt", /^[0-9]{1,20}$/);
  const mt = singleLabel(store.searchParams, "mt", /^8$/);
  const referrers = store.searchParams.getAll("referrer");
  const referrer = new URLSearchParams(referrers[0]);
  const attributed = apple ? Boolean(ct && pt && mt) :
    referrers.length === 1 && fields.every((field) =>
      (field === "utm_content" && !referrer.has(field)) || Boolean(singleLabel(referrer, field)));
  const body = new URLSearchParams({
    page, platform, placement, attributed: String(attributed),
  });
  const landing = new URLSearchParams(search);
  for (const field of [...fields, "utm_term"]) {
    const value = singleLabel(landing, field);
    if (value) body.set(field, value);
  }
  if (attributed && !landing.has("utm_medium")) body.set("utm_medium", "referral");
  if (apple && attributed) {
    body.set("ct", ct);
    body.set("pt", pt);
    body.set("mt", mt);
  }
  return body;
}

export function sendStoreClick(body, fetcher = globalThis.fetch) {
  const warn = () => console.warn("Store-click collection unavailable; store navigation is unaffected.");
  try {
    Promise.resolve(fetcher(storeClickEndpoint, {
      method: "POST",
      body,
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })).then((response) => {
      if (!response.ok) warn();
    }).catch(warn);
  } catch {
    warn();
  }
}

if (typeof document !== "undefined") {
  const links = buildStoreLinks(location.search, "129068563");
  for (const platform of ["android", "ios"]) {
    for (const link of document.querySelectorAll(`[data-store="${platform}"]`)) {
      link.href = platform === "android" ? links.android : links.apple;
      const record = (event) => {
        if (event.type === "auxclick" && event.button !== 1) return;
        if (event.type === "click" && event.button !== 0) return;
        try {
          sendStoreClick(buildStoreClickBody(location.search, location.pathname,
            platform, link.dataset.storePlacement, link.href));
        } catch {
          console.warn("Invalid store-click metadata; store navigation is unaffected.");
        }
      };
      link.addEventListener("click", record);
      link.addEventListener("auxclick", record);
    }
  }
  const hasCampaign = [...new URLSearchParams(location.search).keys()]
    .some((key) => key.startsWith("utm_") || key === "ct");
  if (hasCampaign && (!links.androidAttributed || !links.appleAttributed)) {
    document.getElementById("campaign-notice").hidden = false;
    console.warn("Some campaign attribution is unavailable; store downloads remain available.");
  }
}
