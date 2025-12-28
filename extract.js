const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const channels = fs.readFileSync('channels.txt', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [name, url] = l.split('|');
      return { name: name.trim(), url: url.trim() };
    });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let playlist = '#EXTM3U\n\n';

  for (const ch of channels) {
    console.log(`\n[▶] Processing ${ch.name}`);

    const found = new Set();
    page.removeAllListeners('request');
    page.on('request', r => {
      const u = r.url();
      if (u.includes('.m3u8')) {
        found.add(u);
        console.log('[M3U8]', u);
      }
    });

    await page.goto(ch.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);

    // try iframe
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
      console.log('[✗] No stream found');
      continue;
    }

    const urls = [...found];
    const best =
      urls.find(u => u.includes('tracks')) ||
      urls.find(u => u.includes('mono')) ||
      urls[0];

    playlist += `#EXTINF:-1,${ch.name}\n${best}\n\n`;
    console.log('[✓] Added:', best);
  }

  await browser.close();

  fs.writeFileSync('playlist.m3u', playlist, 'utf8');
  console.log('\n[✓] playlist.m3u updated');
})();

