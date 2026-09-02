import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // ---- PUBLIC SITE ----
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const gsapType = await page.evaluate(() => typeof window.gsap);
  const blobCount = await page.evaluate(() => document.querySelectorAll('.blob').length);
  const heroName = await page.evaluate(() => document.getElementById('hero-name')?.textContent);
  const menuCount = await page.evaluate(() => document.querySelectorAll('.menu-card').length);
  const menuOpacity = await page.evaluate(() => {
    const c = document.querySelector('.menu-card'); return c ? getComputedStyle(c).opacity : 'n/a';
  });
  console.log('[PUBLIC]');
  console.log('  gsap typeof    =', gsapType);
  console.log('  blob count     =', blobCount);
  console.log('  hero name      =', JSON.stringify(heroName));
  console.log('  menu cards     =', menuCount);
  console.log('  menu opacity   =', menuOpacity, '(harus ~1 setelah animasi)');

  if (menuCount > 0) {
    await page.click('.menu-card:nth-child(3)'); // UMKM
    await page.waitForTimeout(1500);
    const umkmActive = await page.evaluate(() => document.getElementById('section-umkm')?.classList.contains('active'));
    const umkmCards = await page.evaluate(() => document.querySelectorAll('#umkm-content .card').length);
    console.log('  after UMKM    -> active =', umkmActive, '| cards =', umkmCards);
  }

  // ---- ADMIN ----
  await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const authVisible = await page.evaluate(() => document.getElementById('auth-screen')?.style.display !== 'none');
  const loginBound = await page.evaluate(() => !!document.getElementById('btn-login'));
  console.log('[ADMIN]');
  console.log('  auth screen    =', authVisible, '| login bound =', loginBound);

  console.log('\n[CONSOLE ERRORS]');
  console.log(errors.length ? errors.join('\n') : '  (none)');

  await browser.close();
  // exit code 1 jika ada error kritis
  process.exit(errors.length ? 1 : 0);
})();
