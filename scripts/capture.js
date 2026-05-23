const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    console.log('Launching browser...');

    const browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1600,
        height: 900
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

      // safer for Grafana dashboards
      fullPage: false
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
