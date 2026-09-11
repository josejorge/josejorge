// File: update-blog-readme.js
// Description: Fetches the KytheX blog RSS feed through a real headless
//   browser (so Cloudflare's Bot Fight Mode JS challenge resolves the same
//   way it would for a normal visitor) and refreshes the BLOG-POST-LIST
//   block in README.md with the latest posts.
// Author: Jose-Jorge HERNANDEZ
// Company: Parlee Conseiller, Inc.
// Date: 2026-09-11
// Last edit date: 2026-09-11
// Version: 1.0.0

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FEED_URL = "https://blog.kythex.com/feed";
const README_PATH = path.join(__dirname, "..", "README.md");
const MAX_POSTS = 5;
const START_MARKER = "<!-- BLOG-POST-LIST:START -->";
const END_MARKER = "<!-- BLOG-POST-LIST:END -->";

// Decodes the small set of HTML entities WordPress titles can contain when
// they aren't wrapped in a CDATA section.
function decodeEntities(str) {
  return str
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function extractTag(itemXml, tag) {
  const match = itemXml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  const raw = match[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodeEntities(cdata ? cdata[1] : raw).trim();
}

async function fetchFeedXml() {
  // A real browser is required here, not a plain HTTP client: Cloudflare's
  // Bot Fight Mode issues a silent JS "managed challenge" to non-browser
  // clients from datacenter ASNs — exactly what blocked GitHub Actions'
  // hosted runners. Playwright's Chromium executes that challenge like any
  // normal visitor, so the follow-up in-page fetch() succeeds.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    // Load the blog's home page first so any Cloudflare challenge is solved
    // and a cf_clearance cookie is set before touching the feed itself.
    await page.goto("https://blog.kythex.com/", {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    // Fetch the feed from inside the page context so it reuses the same
    // cookies/TLS session that just passed the challenge.
    const xml = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        headers: { Accept: "application/rss+xml" },
      });
      return res.text();
    }, FEED_URL);

    if (!xml.includes("<item")) {
      throw new Error(
        "Fetched content does not look like an RSS feed (challenge may not have cleared)."
      );
    }
    return xml;
  } finally {
    await browser.close();
  }
}

function buildBlogList(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items
    .slice(0, MAX_POSTS)
    .map((item) => {
      const title = extractTag(item, "title");
      const url = extractTag(item, "link");
      return `\n- 📰 [${title}](${url})`;
    })
    .join("");
}

function updateReadme(blogList) {
  const readme = fs.readFileSync(README_PATH, "utf8");
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("BLOG-POST-LIST markers not found in README.md");
  }
  const updated =
    readme.slice(0, startIdx + START_MARKER.length) +
    blogList +
    readme.slice(endIdx);
  fs.writeFileSync(README_PATH, updated);
}

(async () => {
  const xml = await fetchFeedXml();
  const blogList = buildBlogList(xml);
  updateReadme(blogList);
  console.log("README.md blog post list updated.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
