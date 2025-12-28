const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // Read channel URLs from channels.txt
  const urls = fs.readFileSync('channels.txt', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let playlist = '#EXTM3U\n\n';

  for (const url of urls) {
    // Generate a friendly name from the URL
    let name = url.split('/').filter(Boolean).pop(); // last part of URL
    name = name.replace(/[-_]/g, ' ').replace(/online/i, '').trim();
    console.log(`\n[▶] Processing ${name} (${url})`);

    const found = new Set();
    page.removeAllListeners('request');
    page.on('request', r => {
      const u = r.url();
      if (u.includes('.m3u8')) {
        found.add(u);
        console.log('[M3U8]', u);
      }
    });

    // Load page with timeout handling
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
      console.log('[!] Timeout loading page, continuing...');
    }

    await page.waitForTimeout(8000);

    // Try iframe if exists
    try {
      const iframe = await page.waitForSelector('iframe', { timeout: 8000 });
      const src = await iframe.getAttribute('src');
      if (src) {
        console.log('[IFRAME]', src);
        try {
          await page.goto(src, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (e) {
          console.log('[!] Timeout loading iframe, continuing...');
        }
      }
    } catch {}

    await page.waitForTimeout(15000);

    if (found.size === 0) {
      console.log('[✗] No stream found for', name);
      continue;
    }

    const urlsArray = [...found];
    const best =
      urlsArray.find(u => u.includes('tracks')) ||
      urlsArray.find(u => u.includes('mono')) ||
      urlsArray[0];

    playlist += `#EXTINF:-1,${name}\n${best}\n\n`;
    console.log('[✓] Added:', best);
  }

  await browser.close();

  fs.writeFileSync('playlist.m3u', playlist, 'utf8');
  console.log('\n[✓] playlist.m3u updated successfully!');
})();

