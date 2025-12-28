const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // Read URLs only
  const urls = fs.readFileSync('channels.txt', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let playlist = '#EXTM3U\n\n';

  for (const url of urls) {
    // Automatically create a channel name from URL
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

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);

    // Try iframe if exists
    try {
      const iframe = await page.waitForSelector('iframe', { timeout: 8000 });
      const src = await iframe.getAttribute('src');
      if (src) {
        console.log('[IFRAME]', src);
        await page.goto(src, { waitUntil: 'networkidle' });
      }
    } catch {}

    await page.waitForTimeout(20000);

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

