// File: update-blog-readme.js
// Description: Fetches the KytheX, The Alz Diary, Tierra de Oz, and Substack
//   RSS feeds through a real headless browser (so any Cloudflare Bot Fight Mode
//   JS challenge resolves the same way it would for a normal visitor — a
//   plain HTTP client from a GitHub Actions runner's datacenter ASN can be
//   challenged even where a residential IP isn't) and refreshes the
//   BLOG-POST-LIST block in README.md with a 4-column table, one column per
//   blog, most recent posts first. A feed that fails to load never aborts the
//   run: that blog's column keeps its previous links from README.md, so the
//   other columns still refresh.
// Author: Jose-Jorge HERNANDEZ
// Company: Parlee Conseiller, Inc.
// Date: 2026-09-11
// Last edit date: 2026-09-29
// Version: 3.0.0

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SUBSTACK_ARCHIVE_URL =
  "https://josejorgehz.substack.com/api/v1/archive?sort=new&limit=5";

const FEEDS = [
  { label: "KytheX", url: "https://blog.kythex.com/feed" },
  { label: "The Alz Diary", url: "https://thealzdiary.com/feed" },
  { label: "Tierra de Oz", url: "https://tierradeoz.com/feed" },
  // Substack publication — read from its JSON archive API rather than the RSS
  // feed, because Substack challenges the RSS URL from GitHub's runner ASN.
  { label: "Substack", url: SUBSTACK_ARCHIVE_URL, kind: "substack-json" },
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

// The table is emitted as raw HTML (not Markdown pipe syntax) so it can
// carry align="center" on <table> — GitHub's Markdown-table renderer gives
// the <table> no attributes, and a table's own shrink-to-fit box isn't
// centered by a text-align on an ancestor, only by align/margin on itself.
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

// Parses Substack's archive API JSON (newest first) into the same
// {title, url} shape as the RSS parser; throws if the body isn't the
// expected JSON array (e.g. a challenge page was served instead).
function parseSubstackJson(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (err) {
    throw new Error("Substack archive response is not JSON (challenge?).");
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Substack archive response has no posts.");
  }
  return data.slice(0, MAX_POSTS_PER_BLOG).map((post) => ({
    title: post.title,
    url: post.canonical_url,
  }));
}

// Reads the blog table already in README.md back into {label: posts[]} so a
// blog whose feed failed today can keep showing its last-known links.
function readExistingBlogs() {
  const readme = fs.readFileSync(README_PATH, "utf8");
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start === -1 || end === -1) return {};
  const table = readme.slice(start, end);
  const rows = table.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  if (rows.length === 0) return {};
  const labels = [...rows[0].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => m[1]);
  const existing = {};
  labels.forEach((l) => (existing[l] = []));
  for (const row of rows.slice(1)) {
    const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    cells.forEach((cell, i) => {
      const a = cell.match(/<a href="([^"]*)">([\s\S]*?)<\/a>/);
      if (a && labels[i]) {
        // Titles are stored HTML-escaped in the table; unescape so
        // buildBlogTable's escapeHtml doesn't double-escape them.
        const title = a[2].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        existing[labels[i]].push({ title, url: a[1] });
      }
    });
  }
  return existing;
}

// Returns the raw body for a feed: RSS via the challenge-tolerant navigation
// path, Substack JSON via one plain navigation (retried once after a pause).
async function fetchFeedBody(page, feed) {
  if (feed.kind !== "substack-json") return fetchFeedXml(page, feed.url);
  let body = await gotoAndRead(page, feed.url);
  if (!body.trim().startsWith("[")) {
    await page.waitForTimeout(8000);
    body = await gotoAndRead(page, feed.url);
  }
  return body;
}

function parsePosts(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, MAX_POSTS_PER_BLOG).map((item) => ({
    title: extractTag(item, "title"),
    url: extractTag(item, "link"),
  }));
}

// Count of feeds that failed this run (their columns kept old links).
let failures = 0;

async function fetchAllBlogs() {
  // One shared browser context is enough for all the feeds — each is a
  // fresh navigation, so there's no session state to keep separate.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const existing = readExistingBlogs();
    const results = [];
    for (const feed of FEEDS) {
      try {
        const body = await fetchFeedBody(page, feed);
        const posts =
          feed.kind === "substack-json" ? parseSubstackJson(body) : parsePosts(body);
        results.push({ label: feed.label, posts });
      } catch (err) {
        // Keep this blog's previous links rather than aborting every column.
        console.warn(`[warn] ${feed.label} failed, keeping previous links: ${err.message}`);
        results.push({ label: feed.label, posts: existing[feed.label] || [] });
        failures++;
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}

// Builds an HTML table (centered via align="center") with one column per
// blog, rows aligned by recency rank (row 1 = each blog's most recent post,
// etc). A blog with fewer posts than others leaves the remaining cells in
// its column blank rather than borrowing another blog's post.
function buildBlogTable(blogs) {
  const header = `<tr>${blogs.map((b) => `<th>${escapeHtml(b.label)}</th>`).join("")}</tr>`;
  const rowCount = Math.max(...blogs.map((b) => b.posts.length), 0);

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const cells = blogs.map((b) => {
      const post = b.posts[i];
      if (!post) return "<td></td>";
      return `<td><a href="${post.url}">${escapeHtml(post.title)}</a></td>`;
    });
    rows.push(`<tr>${cells.join("")}</tr>`);
  }

  return [`<table align="center">`, header, ...rows, `</table>`].join("\n");
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
  // Fail the run only if EVERY feed failed (nothing refreshed); a partial
  // failure is logged as a warning above but the README was still updated.
  if (failures === FEEDS.length) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
