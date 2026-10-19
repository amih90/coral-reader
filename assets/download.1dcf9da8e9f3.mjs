const fields = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
const labelPattern = /^[a-z0-9][a-z0-9_-]{0,49}$/;
const appleTokenPattern = /^[a-z0-9][a-z0-9_-]{0,29}$/;

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

if (typeof document !== "undefined") {
  const links = buildStoreLinks(location.search, "129068563");
  for (const link of document.querySelectorAll('[data-store="android"]')) {
    link.href = links.android;
  }
  for (const link of document.querySelectorAll('[data-store="ios"]')) {
    link.href = links.apple;
  }
  const hasCampaign = [...new URLSearchParams(location.search).keys()]
    .some((key) => key.startsWith("utm_") || key === "ct");
  if (hasCampaign && (!links.androidAttributed || !links.appleAttributed)) {
    document.getElementById("campaign-notice").hidden = false;
    console.warn("Some campaign attribution is unavailable; store downloads remain available.");
  }
}
