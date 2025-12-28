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

  // Get iframe src
  const iframeSrc = await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    return iframe ? iframe.src : null;
  });

  if (!iframeSrc) {
    console.log('[!] iframe not found');
    process.exit(0);
  }

  console.log('[2] Player page:', iframeSrc);

  const m3u8List = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('.m3u8')) {
      console.log('[M3U8]', url);
      m3u8List.push(url);
    }
  });

  await page.goto(iframeSrc, { waitUntil: 'domcontentloaded' });

  // Allow stream to fully initialize
  await page.waitForTimeout(25000);
  await browser.close();

  if (m3u8List.length === 0) {
    console.log('[!] No m3u8 detected');
    process.exit(0);
  }

  // Prefer variant playlist
  let chosen =
    m3u8List.find(u => u.includes('tracks-') && u.includes('mono.m3u8')) ||
    m3u8List.find(u => u.includes('tracks-')) ||
    m3u8List[m3u8List.length - 1]; // fallback

  console.log('[✓] Selected stream:', chosen);

  const playlist =
`#EXTM3U
#EXTINF:-1,Planeta Folk
${chosen}
`;

  fs.writeFileSync('playlist.m3u');
  console.log('[+] playlist.m3u updated');
})();
