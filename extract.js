const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture any .m3u8 URLs
  const found = new Set();
  page.on('request', request => {
    const url = request.url();
    if (url.includes('.m3u8')) {
      found.add(url);
      console.log('[M3U8 DETECTED]', url);
    }
  });

  console.log('[*] Loading page...');
  // Load main page and wait for dynamic content
  await page.goto('https://www.seirsanduk.com/bnt-1-online.html', {
    waitUntil: 'networkidle',
  });

  // Sometimes the player appears after some delay
  await page.waitForTimeout(10000);

  // If an iframe appears, open it
  try {
    const iframeHandle = await page.waitForSelector('iframe', { timeout: 8000 });
    const frameUrl = await iframeHandle.getAttribute('src');
    if (frameUrl) {
      console.log('[*] Detected iframe, opening it:', frameUrl);
      await page.goto(frameUrl, { waitUntil: 'networkidle' });
    }
  } catch (e) {
    console.log('[!] No iframe found (it might be inline)');
  }

  // Wait longer for player requests
  await page.waitForTimeout(30000);

  await browser.close();

  // If we found m3u8, write it
  const urls = Array.from(found);
  if (urls.length === 0) {
    console.log('No m3u8 URLs found.');
    return;
  }

  // Choose HLS variant
  const chosen = urls.find(u => u.includes('tracks')) || urls[0];

  const playlist =
`#EXTM3U
#EXTINF:-1,BNT 1
${chosen}
`;

  fs.writeFileSync('playlist.m3u', playlist, 'utf8');
  console.log('[+] playlist.m3u writtten with URL:', chosen);
})();

