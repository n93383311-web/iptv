const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const found = new Set();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  });

  const page = await context.newPage();

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('.m3u8')) {
      console.log('[FOUND]', url);
      found.add(url);
    }
  });

  console.log('[*] Opening page...');
  await page.goto(
    'https://www.gledaitv.fan/planeta-folk-live-tv.html',
    { waitUntil: 'domcontentloaded' }
  );

  // Give time for redirect + JS player
  await page.waitForTimeout(20000);

  await browser.close();

  if (found.size === 0) {
    console.log('[!] No m3u8 found');
    process.exit(0);
  }

  // Create playlist file
  let output = '#EXTM3U\n';
  for (const url of found) {
    output += `#EXTINF:-1,Auto-detected stream\n${url}\n`;
  }

  fs.writeFileSync('playlist.m3u8', output);
  console.log('[+] playlist.m3u8 created');
})();
