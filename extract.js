const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('[1] Open main page');
  await page.goto(
    'https://www.gledaitv.fan/planeta-folk-live-tv.html',
    { waitUntil: 'domcontentloaded' }
  );

  const iframeSrc = await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    return iframe ? iframe.src : null;
  });

  if (!iframeSrc) {
    console.log('[!] iframe not found');
    process.exit(0);
  }

  console.log('[2] Player page:', iframeSrc);

  const found = new Set();

  page.on('request', req => {
    const url = req.url();
    if (url.includes('.m3u8')) {
      console.log('[M3U8]', url);
      found.add(url);
    }
  });

  await page.goto(iframeSrc, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(25000);
  await browser.close();

  if (found.size === 0) {
    console.log('[!] No m3u8 found');
    process.exit(0);
  }

  const urls = [...found];

  const chosen =
    urls.find(u => u.includes('tracks-') && u.includes('mono.m3u8')) ||
    urls.find(u => u.includes('tracks-')) ||
    urls[urls.length - 1];

  console.log('[✓] Selected stream:', chosen);

  const playlist =
`#EXTM3U
#EXTINF:-1,Planeta Folk
#EXTVLCOPT:http-referrer=https://www.gledaitv.fan/
#EXTVLCOPT:http-user-agent=Mozilla/5.0
${chosen}
`;

  fs.writeFileSync('playlist.m3u', playlist, 'utf8');
  console.log('[+] playlist.m3u written successfully');
})();
