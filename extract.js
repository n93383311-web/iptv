const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // Read URLs (with optional multiple URLs per channel)
  const lines = fs.readFileSync('channels.txt', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let playlist = '#EXTM3U\n\n';

  for (const line of lines) {
    // Split multiple URLs per line
    const urls = line.split(',').map(u => u.trim()).filter(Boolean);

    // Generate channel name from first URL if not specified
    let name = urls[0].split('/').filter(Boolean).pop();
    name = name.replace(/[-_]/g, ' ').replace(/online/i, '').trim();

    console.log(`\n[▶] Processing ${name} with ${urls.length} source(s)`);

    let workingStream = null;

    // Try each URL in order until a working m3u8 is found
    for (const url of urls) {
      console.log(`[*] Trying: ${url}`);

      const found = new Set();
      page.removeAllListeners('request');
      page.on('request', r => {
        const u = r.url();
        if (u.includes('.m3u8') && !u.includes('jwpltx') && !u.includes('ro.glebul')) {
          found.add(u);
        }
      });

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (e) {
        console.log('[!] Timeout or error, skipping...');
      }

      await page.waitForTimeout(8000);

      // Try iframe if present
      try {
        const iframe = await page.$('iframe');
        if (iframe) {
          const src = await iframe.getAttribute('src');
          if (src) {
            console.log('[IFRAME]', src);
            try {
              await page.goto(src, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch {}
            await page.waitForTimeout(8000);
          }
        }
      } catch {}

      if (found.size > 0) {
        // Pick best stream (CDN preferred)
        const arr = [...found];
        const best = arr.find(u => u.includes('cdn')) || arr[0];
        workingStream = best;
        console.log('[✓] Found working stream:', best);
        break; // Stop at first working stream
      } else {
        console.log('[✗] No working stream at this source');
      }
    }

    if (workingStream) {
      playlist += `#EXTINF:-1,${name}\n${workingStream}\n\n`;
    } else {
      console.log('[✗] No streams worked for channel:', name);
    }
  }

  await browser.close();

  fs.writeFileSync('playlist.m3u', playlist, 'utf8');
  console.log('\n[✓] playlist.m3u updated successfully!');
})();
