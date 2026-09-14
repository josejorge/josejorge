<!--
File: CHANGELOG.md
Description: Change log for the josejorge/josejorge GitHub profile README repo.
Author: Jose-Jorge HERNANDEZ
Company: Parlee Conseiller, Inc.
Date: 2026-09-14
Last edit date: 2026-09-14
Version: 1.2.0
-->

# Changelog

## 2026-09-14 (3)

- **Moved:** "Featured Work" relocated from right after About Me to just after "Final
  Transmission", near the end of the profile — the top of the page stays the
  KytheX/gaming hook, the engineering proof is now a scroll-down reward.
- **Enriched:** added **Beacon** (public, ParleeConseiller) as a 4th headline project —
  a tiling, Wave-Terminal-style cockpit for web communication apps.
- **Added:** 8 anonymized private-repo case studies (payroll, ERP/CRM, multi-channel
  campaigns, cross-brand notifications, payment portal, contact routing, SSO,
  home-lab/security), grouped into 3 collapsible `<details>` categories — same
  expand/collapse pattern as the Tech Stack section — so the section stays scannable
  instead of turning into a wall of text. Surveyed every git repo under `H:\DEV`
  (~80), checked owner + public/private status via the GitHub API for each, and
  anonymized only the private ones per instruction.

## 2026-09-14 (2)

- **Fixed:** every `<table>` in the README (Featured Work, Current Projects, Latest
  Blog Posts) now carries `align="center"`, so the table box itself is centered on the
  page — a table's shrink-to-fit width isn't affected by `text-align`/`align` on an
  ancestor, only by `align`/`margin` on the table element itself. Current Projects and
  the blog-posts table were converted from Markdown pipe-table syntax to raw HTML tables
  since Markdown-table syntax gives GitHub's renderer no way to attach that attribute.
- **Enriched:** "Featured Work" now includes 4 projects instead of 2 — added
  **Browser Picker Pro** (own Windows app, C#/.NET, rules engine + security API
  integrations) and the **Cloudflare D1 Plugin for Tabularis** (own Rust plugin for an
  open-source DB client). Two other local repos (`tabularis`, `waveterm`) were
  deliberately excluded from consideration — they're personal forks of existing
  open-source projects, not original work, so featuring them would misrepresent
  authorship.

## 2026-09-14

- **Fixed:** "Activity Graph" section — the live `github-readme-activity-graph.vercel.app`
  embed had been permanently discontinued (HTTP 402 `DEPLOYMENT_DISABLED`). It's now
  cached in-repo as `assets/activity-graph.svg`, fetched from `ghchart.rshah.org` every
  6 hours by `.github/workflows/stats.yml`, matching the existing `top-langs.svg` pattern.
- **Changed:** "Latest Blog Posts" now merges 3 feeds — KytheX, The Alz Diary, and
  Tierra de Oz — into a 3-column Markdown table instead of a single KytheX-only list.
  `scripts/update-blog-readme.js` fetches all 3 through the same headless-browser
  path (Cloudflare Bot Fight Mode can challenge a GitHub Actions runner even on a feed
  that passes fine from a residential IP).
- **Added:** "Featured Work" section near the top of the profile, above the metrics
  dashboard, highlighting `calendar-appointments` (public repo) and an anonymized
  payroll/notification-platform case study, for recruiter visibility ahead of the
  KytheX/gaming persona content.
