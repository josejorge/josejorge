// File: capture.js
// Description: Screenshots the public Grafana HomeLAB dashboard into assets/dashboard.png (run by update-dashboard.yml).
// Author: Jose-Jorge HERNANDEZ
// Company: Parlee Conseiller, Inc.
// Date: 2026-07-27
// Last edit date: 2026-10-09
// Version: 1.1.1

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Viewport size in pixels. The height is tall on purpose so every panel row
// (CPU, memory, disk, network...) is rendered at once instead of being cut off.
const VIEWPORT_WIDTH = 1600;
const VIEWPORT_HEIGHT = 1800;

(async () => {
  try {
    console.log('Launching browser...');

    const browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT
      }
    });

    const dashboardUrl =
      'https://josejorgehz.grafana.net/public-dashboards/1846f6b4c2c6454d90a3683f26d3414d';

    console.log('Opening dashboard...');
    console.log(dashboardUrl);

    await page.goto(dashboardUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    console.log('Dashboard page opened.');

    // IMPORTANT:
    // Give Grafana enough time to fully render panels.
    console.log('Waiting for panels to load...');

    await page.waitForTimeout(30000);

    const outputPath = path.join(
      __dirname,
      '../assets/dashboard.png'
    );

    console.log('Taking screenshot...');

    await page.screenshot({
      path: outputPath,

      // capture the whole page so lower panel rows are included
      fullPage: true
    });

    console.log('Screenshot saved!');
    console.log('Output:', outputPath);

    console.log(
      'File exists:',
      fs.existsSync(outputPath)
    );

    await browser.close();

    console.log('Done!');
  } catch (error) {
    console.error('Capture failed!');
    console.error(error);

    process.exit(1);
  }
})();
