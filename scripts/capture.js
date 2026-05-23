const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    viewport: {
      width: 1600,
      height: 900
    }
  });

  // YOUR PUBLIC DASHBOARD URL
  await page.goto(
    'https://josejorgehz.grafana.net/public-dashboards/1846f6b4c2c6454d90a3683f26d3414d',
    {
      waitUntil: 'networkidle',
      timeout: 120000
    }
  );

  // Wait a bit for panels to fully render
  await page.waitForTimeout(10000);

  await page.screenshot({
    path: path.join(__dirname, '../assets/dashboard.png'),
    fullPage: true
  });

  await browser.close();
})();
