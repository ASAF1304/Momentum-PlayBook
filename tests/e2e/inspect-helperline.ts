import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to production URL with TSLA...');
  await page.goto('https://momentum-playbook.vercel.app', { waitUntil: 'networkidle' });

  // Try to load TSLA — look for a ticker input
  const tickerInput = page.locator('input[placeholder*="ticker" i], input[placeholder*="symbol" i], input[type="text"]').first();
  if (await tickerInput.isVisible()) {
    await tickerInput.fill('TSLA');
    await tickerInput.press('Enter');
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: 'tests/e2e/screenshots/tsla-prod-before.png', fullPage: true });
  console.log('Screenshot saved: tsla-prod-before.png');

  // Find all helperLine spans — look for elements that contain the text about AVWAP, 52W high/low
  const helperLineTexts = await page.evaluate(() => {
    // Gather all small text elements that might be helper lines
    const results: Array<{
      text: string;
      color: string;
      fontWeight: string;
      fontSize: string;
      tagName: string;
      className: string;
      parentClass: string;
    }> = [];

    // Search for elements containing the relevant text
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      if (
        (text.includes('AVWAP') || text.includes('52W') || text.includes('52w')) &&
        text.length < 200
      ) {
        const style = window.getComputedStyle(el);
        results.push({
          text: text.substring(0, 120),
          color: style.color,
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          tagName: el.tagName,
          className: el.className?.toString()?.substring(0, 150) || '',
          parentClass: (el.parentElement?.className?.toString() || '').substring(0, 100),
        });
      }
    }
    return results;
  });

  console.log('\n=== HELPER LINE COMPUTED STYLES ===');
  for (const item of helperLineTexts) {
    console.log(`\nTag: ${item.tagName}`);
    console.log(`Text: "${item.text}"`);
    console.log(`color: ${item.color}`);
    console.log(`font-weight: ${item.fontWeight}`);
    console.log(`font-size: ${item.fontSize}`);
    console.log(`className: ${item.className}`);
    console.log(`parentClass: ${item.parentClass}`);
  }

  // Also look for percentage spans specifically
  const pctStyles = await page.evaluate(() => {
    const results: Array<{
      text: string;
      color: string;
      fontWeight: string;
      tagName: string;
      className: string;
    }> = [];

    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      if (
        (text.includes('-7.7%') || text.includes('-24.6%') || text.includes('+51.0%') ||
         text.includes('7.7%') || text.includes('24.6%') || text.includes('51.0%')) &&
        text.length < 50
      ) {
        const style = window.getComputedStyle(el);
        results.push({
          text: text.substring(0, 80),
          color: style.color,
          fontWeight: style.fontWeight,
          tagName: el.tagName,
          className: el.className?.toString()?.substring(0, 150) || '',
        });
      }
    }
    return results;
  });

  console.log('\n=== PERCENTAGE SPAN COMPUTED STYLES ===');
  for (const item of pctStyles) {
    console.log(`\nTag: ${item.tagName}`);
    console.log(`Text: "${item.text}"`);
    console.log(`color: ${item.color}`);
    console.log(`font-weight: ${item.fontWeight}`);
    console.log(`className: ${item.className}`);
  }

  await browser.close();
})();
