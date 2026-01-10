const { chromium } = require('playwright');
const fs = require('fs');

const MAX_PARALLEL = 4;          // number of channels processed in parallel
const PAGE_TIMEOUT = 15000;     // page navigation timeout
const DETECT_TIMEOUT = 3000;    // how long to wait for m3u8 detection

(async () => {
  const lines = fs.readFileSync('channels.txt', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });

  let playlist = '#EXTM3U\n\n';

  async function processChannel(line) {
    const urls = line.split(',').map(u => u.trim()).filter(Boolean);
    let name = urls[0].split('/').filter(Boolean).pop();
    name = name.replace(/[-_]/g, ' ').replace(/online/i, '').trim();

    console.log(`\n[▶] ${name}`);

    const page = await browser.newPage();
    let workingStream = null;

    for (const url of urls) {
      console.log(`  [*] Trying ${url}`);
      const found = new Set();

      const onRequest = r => {
        const u = r.url();
        if (
          u.includes('.m3u8') &&
          !u.includes('jwpltx') &&
          !u.includes('ro.glebul')
        ) {
          found.add(u);
        }
      };

      page.on('request', onRequest);

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT
        });
      } catch {
        page.off('request', onRequest);
        continue;
      }

      await Promise.race([
        page.waitForTimeout(DETECT_TIMEOUT),
        new Promise(resolve => {
          const handler = r => {
            if (r.url().includes('.m3u8')) {
              page.off('request', handler);
              resolve();
            }
          };
          page.on('request', handler);
        })
      ]);

      // iframe check
      try {
        const iframe = await page.$('iframe');
        if (iframe) {
          const src = await iframe.getAttribute('src');
          if (src) {
            await page.goto(src, {
              waitUntil: 'domcontentloaded',
              timeout: PAGE_TIMEOUT
            });

            await Promise.race([
              page.waitForTimeout(DETECT_TIMEOUT),
              new Promise(resolve => {
                const handler = r => {
                  if (r.url().includes('.m3u8')) {
                    page.off('request', handler);
                    resolve();
                  }
                };
                page.on('request', handler);
              })
            ]);
          }
        }
      } catch {}

      page.off('request', onRequest);

      if (found.size > 0) {
        const arr = [...found];
        workingStream = arr.find(u => u.includes('cdn')) || arr[0];
        console.log(`  [✓] Found ${workingStream}`);
        break;
      } else {
        console.log('  [✗] No stream');
      }
    }

    await page.close();

    if (workingStream) {
      return `#EXTINF:-1,${name}\n${workingStream}\n\n`;
    }
    return '';
  }

  // ---- Parallel execution ----
  const chunks = [];
  for (let i = 0; i < lines.length; i += MAX_PARALLEL) {
    chunks.push(lines.slice(i, i + MAX_PARALLEL));
  }

  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(processChannel));
    playlist += results.join('');
  }

  await browser.close();

  fs.writeFileSync('playlist.m3u', playlist, 'utf8');
  console.log('\n[✓] playlist.m3u updated');
})();
