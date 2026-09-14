// File: update-blog-readme.js
// Description: Fetches the KytheX, The Alz Diary, and Tierra de Oz blog RSS
//   feeds through a real headless browser (so any Cloudflare Bot Fight Mode
//   JS challenge resolves the same way it would for a normal visitor — a
//   plain HTTP client from a GitHub Actions runner's datacenter ASN can be
//   challenged even where a residential IP isn't) and refreshes the
//   BLOG-POST-LIST block in README.md with a 3-column table, one column per
//   blog, most recent posts first.
// Author: Jose-Jorge HERNANDEZ
// Company: Parlee Conseiller, Inc.
// Date: 2026-09-11
// Last edit date: 2026-09-14
// Version: 2.0.0

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FEEDS = [
  { label: "KytheX", url: "https://blog.kythex.com/feed" },
  { label: "The Alz Diary", url: "https://thealzdiary.com/feed" },
  { label: "Tierra de Oz", url: "https://tierradeoz.com/feed" },
];
const README_PATH = path.join(__dirname, "..", "README.md");
const MAX_POSTS_PER_BLOG = 5;
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

// Markdown table cells break on a literal "|" — escape it rather than strip
// it, so an em-dash-style title still reads correctly.
function escapeForTableCell(str) {
  return str.replace(/\|/g, "\\|");
}

function extractTag(itemXml, tag) {
  const match = itemXml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  const raw = match[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodeEntities(cdata ? cdata[1] : raw).trim();
}

// Navigates to the feed URL and returns the raw response body of that
// navigation (not a secondary fetch()), retrying once after a pause.
// Reading straight off the navigation response avoids a pitfall of the
// in-page fetch() approach: Cloudflare's challenge page can reload itself
// once its JS proof-of-work finishes, and if that reload lands mid-fetch()
// the browser tears down the page's execution context, so any in-flight
// fetch() dies with "Failed to fetch" — a real navigation isn't subject to
// that race, since the response we read back IS the (possibly reloaded) page.
async function gotoAndRead(page, url) {
  const response = await page.goto(url, { waitUntil: "load", timeout: 45000 });
  return response.text();
}

async function fetchFeedXml(page, url) {
  let xml = await gotoAndRead(page, url);

  // First response may be a Cloudflare challenge page instead of the feed
  // (the challenge solves itself client-side after a few seconds). Give it
  // time, then request the feed again with the now-cleared session.
  if (!xml.includes("<item")) {
    await page.waitForTimeout(8000);
    xml = await gotoAndRead(page, url);
  }

  if (!xml.includes("<item")) {
    throw new Error(
      `Fetched content from ${url} does not look like an RSS feed (challenge may not have cleared).`
    );
  }
  return xml;
}

function parsePosts(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, MAX_POSTS_PER_BLOG).map((item) => ({
    title: extractTag(item, "title"),
    url: extractTag(item, "link"),
  }));
}

async function fetchAllBlogs() {
  // One shared browser context is enough for all three feeds — each is a
  // fresh navigation, so there's no session state to keep separate.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const results = [];
    for (const feed of FEEDS) {
      const xml = await fetchFeedXml(page, feed.url);
      results.push({ label: feed.label, posts: parsePosts(xml) });
    }
    return results;
  } finally {
    await browser.close();
  }
}

// Builds a Markdown table with one column per blog, rows aligned by recency
// rank (row 1 = each blog's most recent post, etc). A blog with fewer posts
// than others leaves the remaining cells in its column blank rather than
// borrowing another blog's post.
function buildBlogTable(blogs) {
  const header = `| ${blogs.map((b) => b.label).join(" | ")} |`;
  const divider = `| ${blogs.map(() => "---").join(" | ")} |`;
  const rowCount = Math.max(...blogs.map((b) => b.posts.length), 0);

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const cells = blogs.map((b) => {
      const post = b.posts[i];
      if (!post) return "";
      return `[${escapeForTableCell(post.title)}](${post.url})`;
    });
    rows.push(`| ${cells.join(" | ")} |`);
  }

  return [header, divider, ...rows].join("\n");
}

function updateReadme(blogTable) {
  const readme = fs.readFileSync(README_PATH, "utf8");
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("BLOG-POST-LIST markers not found in README.md");
  }
  const updated =
    readme.slice(0, startIdx + START_MARKER.length) +
    "\n" +
    blogTable +
    "\n" +
    readme.slice(endIdx);
  fs.writeFileSync(README_PATH, updated);
}

(async () => {
  const blogs = await fetchAllBlogs();
  const blogTable = buildBlogTable(blogs);
  updateReadme(blogTable);
  console.log("README.md blog post table updated.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
