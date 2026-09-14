<!--
File: CHANGELOG.md
Description: Change log for the josejorge/josejorge GitHub profile README repo.
Author: Jose-Jorge HERNANDEZ
Company: Parlee Conseiller, Inc.
Date: 2026-09-14
Last edit date: 2026-09-14
Version: 1.0.0
-->

# Changelog

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
