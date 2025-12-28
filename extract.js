const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('[1] Opening main page');
  await page.goto(
    'https://www.gledaitv.fan/planeta-folk-live-tv.html',
    { waitUntil: 'domcontentloaded' }
  );

  // Extract iframe src
  const iframeSrc = await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    return iframe ? iframe.src : null;
  });

  if (!iframeSrc) {
    console.log('[!] iframe not found');
    process.exit(0);
  }

  console.log('[2] Found iframe:', iframeSrc);

  const found = new Set();

  page.on('request', req => {
    const url = req.url();
    if (url.includes('.m3u8')) {
      console.log('[FOUND]', url);
      found.add(url);
    }
  });

  console.log('[3] Opening player page');
  await page.goto(iframeSrc, { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(20000);
  await browser.close();

  if (found.size === 0) {
    console.log('[!] No m3u8 found');
    process.exit(0);
  }

  const streamUrl = [...found][0];

  const playlist =
`#EXTM3U
#EXTINF:-1,Planeta Folk
${streamUrl}
`;

  fs.writeFileSync('playlist.m3u', playlist);
  console.log('[+] playlist.m3u written');
})();
