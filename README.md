<div align="center">

<img src="assets/icon-512.png" alt="Coral Reader icon" width="160" />

# Coral Reader

### Read what you love. Learn as you go.

**A private, beautifully customizable reader for EPUB, PDF and more, with on-device translation, vocabulary and Read Aloud. Built for Android and iOS.**

🌐 **Website:** https://amih90.github.io/coral-reader/

[![Platform: Android](https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white)](#-download)
[![Platform: iOS](https://img.shields.io/badge/iOS-000000?logo=apple&logoColor=white)](#-download)
[![Formats: EPUB, PDF & more](https://img.shields.io/badge/Formats-EPUB%2C%20PDF%20%26%20more-FF6F61)](#-overview)

</div>

---

## 📖 Overview

**Coral Reader** turns your phone and tablet into a personal library. Import your
own **EPUB, PDF, Markdown, text, HTML, FB2, DOCX, and ODT** documents, and read
them with a clean, paginated, fully customizable experience — then pick up right
where you left off.

Whether you're settling in with a novel, working through a textbook, or reviewing
a PDF report, Coral Reader keeps the focus on the words. No clutter, no noise —
just comfortable, elegant reading.

> **Many formats, one reader.** Coral Reader converts supported documents into a
> consistent, reflowable reading experience, so your library feels at home in one app.

---

## 📸 App Preview

Real screens from Coral Reader 1.10.2 on Android (the library holds original sample books).

<div align="center">

| | | | |
| :---: | :---: | :---: | :---: |
| <img src="assets/screens/library.webp" alt="Library" width="200" /> | <img src="assets/screens/reader-english.webp" alt="Reading view" width="200" /> | <img src="assets/screens/reader-dark.webp" alt="Dark theme, right-to-left" width="200" /> | <img src="assets/screens/display-settings.webp" alt="Display settings" width="200" /> |
| **Your library** | **Page by page, like a book** | **Light, sepia or dark · right-to-left** | **Read exactly your way** |
| <img src="assets/screens/translate.webp" alt="On-device translation" width="200" /> | <img src="assets/screens/vocabulary.webp" alt="Vocabulary with context" width="200" /> | <img src="assets/screens/practice.webp" alt="Practice quiz" width="200" /> | <img src="assets/screens/read-aloud.webp" alt="Read Aloud player" width="200" /> |
| **Long-press. Translate.** | **Every word keeps its sentence** | **Practice offline** | **Or just listen (Coral Pro)** |

</div>

---

## 📱 Available on Android & iOS

Coral Reader is built with **Kotlin Multiplatform** and **Compose Multiplatform**,
delivering a true **native** experience on both platforms from a single shared
codebase. The same polished reading experience, whether you're on an iPhone, iPad,
or any Android phone or tablet.

| Android | iOS |
| :---: | :---: |
| Phones & Tablets | iPhone & iPad |

---

## ✨ Features

- 📚 **Broad Format Support** — Read EPUB, PDF, Markdown, text, HTML, FB2, DOCX, and ODT in one place.
- 🗂️ **Categories & Library Filters** — Create categories, add a book to more than one, and filter alongside All, In Progress, and Finished.
- 🔊 **Read Aloud** — Listen with on-device voices, synchronized highlighting, automatic page follow, background playback, and voice and speed controls.
- 🌐 **Offline Translation** — Translate selected English and Hebrew text in place with downloaded on-device models. Book text never goes to a translation server.
- 📂 **Library Management** — Import, search, organize, and browse your collection in grid or list view with rich cover art.
- 📄 **Flexible Page Turning** — Choose tap, swipe, or both, with paginated reading and direction-aware navigation.
- 🎨 **Reading Customization** — Choose from bundled fonts and fine-tune font size, margins, line height, letter spacing, text alignment, brightness, and color themes.
- ✍️ **Highlights, Notes & Footnotes** — Mark passages, save thoughts, and open footnotes without losing your place.
- 📊 **Progress & Reading Stats** — Track position, chapters, time, pages, finished books, and reading streaks.
- 🌙 **Light, Dark & System Themes** — Read comfortably day or night.
- 🌍 **Localization** — Full English and Hebrew support, including right-to-left (RTL) layout.
- 🔒 **Rotation Lock** — Lock screen orientation while you read.
- 💎 **Coral Pro** — Unlock the full experience with a flexible subscription (monthly, yearly, or lifetime).
- 🔐 **Privacy-First** — Your books stay on your device.

---

## 🎯 Main Highlights

| | |
| --- | --- |
| **One app, many formats** | Read books and documents without switching apps. |
| **Read or listen** | Continue with on-device narration and background playback. |
| **Understand in place** | Translate English and Hebrew selections offline. |
| **Your library, organized** | Create categories that match the way you collect books. |
| **Truly cross-platform** | Native Android & iOS from a shared codebase. |
| **Made for comfort** | Fonts, themes, spacing, and margins tuned to you. |
| **Never lose your place** | Reliable per-book progress tracking. |
| **Reads your language** | English & Hebrew with full RTL support. |

---

## 🚀 Download

Coral Reader is available on the **[App Store](https://apps.apple.com/us/app/coral-reader/id6782911744)** and **[Google Play](https://play.google.com/store/apps/details?id=dev.hollander.coralreader&pcampaignid=web_share)**.

---

## Launch campaign links

Reuse each platform's link across its text, image, or video posts. All four use
the **launch** campaign and measure the platform, not individual posts.

| Platform | Download link |
| --- | --- |
| WhatsApp | https://coral-reader.com/get/?utm_source=whatsapp&utm_medium=referral&utm_campaign=launch&ct=launch_whatsapp |
| Reddit | https://coral-reader.com/get/?utm_source=reddit&utm_medium=organic_social&utm_campaign=launch&ct=launch_reddit |
| Facebook | https://coral-reader.com/get/?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch&ct=launch_facebook |
| Instagram | https://coral-reader.com/get/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch&ct=launch_instagram |

Android results appear in Mixpanel under `install_attribution_resolved`, grouped
by `acquisition_source` and filtered to `acquisition_campaign = launch`.
iOS results appear in App Store Connect > Analytics > Acquisition > Campaigns
under `launch_whatsapp`, `launch_reddit`, `launch_facebook`, or `launch_instagram`.
Apple reports aggregate results only after its minimum qualifying-download
threshold is met; TestFlight installs do not validate these campaigns.
Forwarded links retain their original platform label.

## Website development

GitHub Pages serves this repository's root at https://coral-reader.com.
The campaign download page source, Apple provider configuration, and tests live
in `download-page/`; its images and app logo live in `assets/`.

```sh
npm --prefix download-page ci
npm --prefix download-page run check
npm --prefix download-page run test:browser
```

The browser checks use installed Google Chrome. The build updates
`get/index.html`, its hashed CSS/JavaScript in `assets/`, and only the shared
store-link script reference in the homepage.
Commit those generated files alongside source changes; Pages does not run Node.
Keep old hashed assets available for cached pages.

`download-page/campaign-config.json` contains Apple's public provider token.
A nonempty `APP_STORE_PROVIDER_TOKEN` overrides it for a build.
Campaign labels use `utm_source`, `utm_medium`, `utm_campaign`, optional
`utm_content`, and Apple's `ct`. Download-page tests are standalone and do not
require the private app repository.

The homepage accepts the same campaign parameters as `/get/`. Both its hero and
bottom download buttons forward validated labels to Google Play and the App
Store using the same link builder and configured Apple provider token. For
example: https://coral-reader.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch&ct=launch_instagram
Missing or invalid labels leave downloads available without attribution; no
cookies or cross-visit campaign storage are used.

## 🎨 Branding

Looking for logos, colors, and brand assets? See the **[Branding Guide](BRANDING.md)**.

---

## 📜 Legal

- [Privacy Policy](legal/privacy-policy.html)
- [Terms of Use](legal/terms-of-use.html)
- [Support](legal/support.html)

---

<div align="center">

<img src="assets/icon-512.png" alt="Coral Reader" width="110" />

**Coral Reader** — Read what you love. Learn as you go.

</div>
