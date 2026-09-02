import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Lacak 404: abaikan tabel galeri (expected sebelum migrasi v2 dijalankan)
  page.on('response', r => {
    if (r.status() === 404 && !/galeri/i.test(r.url())) errors.push('404 -> ' + r.url());
  });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // ---- PUBLIC (desktop) ----
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pub = await page.evaluate(() => ({
    gsap: typeof window.gsap,
    blobs: document.querySelectorAll('.blob').length,
    navbar: !!document.querySelector('.navbar'),
    navLinks: document.querySelectorAll('.nav-link').length,
    menuCards: document.querySelectorAll('.menu-card').length,
    menuCountBadges: document.querySelectorAll('.menu-count').length,
    menuTiles: document.querySelectorAll('.menu-tile').length,
    tintClasses: document.querySelectorAll('.menu-card.tint-1,.menu-card.tint-2,.menu-card.tint-3,.menu-card.tint-4,.menu-card.tint-5,.menu-card.tint-6').length,
    heroChip: !!document.querySelector('.hero-chip'),
    heroName: document.getElementById('hero-name')?.textContent,
    navName: document.getElementById('nav-name')?.textContent,
    heroBg: !!document.getElementById('hero-bg'),
    modalOverlay: !!document.getElementById('modal-overlay'),
    appWidth: (() => { const a = document.querySelector('.app'); return a ? Math.round(a.getBoundingClientRect().width) : 0; })()
  }));
  console.log('[PUBLIC]', JSON.stringify(pub));
  await page.screenshot({ path: 'verify_home.png', fullPage: true });

  // click PROFIL via navbar
  await page.click('.nav-link:nth-child(1)');
  await page.waitForTimeout(1400);
  const profil = await page.evaluate(() => ({
    active: document.getElementById('section-profil')?.classList.contains('active'),
    viewHead: !!document.querySelector('#section-profil .view-head'),
    statCards: document.querySelectorAll('#profil-content .stat-card').length,
    statCounters: document.querySelectorAll('#profil-content .stat-card .v[data-count]').length,
    vmCards: document.querySelectorAll('#profil-content .vm-card').length,
    maps: document.querySelectorAll('#profil-content .map-frame').length
  }));
  console.log('[PUBLIC -> PROFIL]', JSON.stringify(profil));

  // click PERANGKAT via navbar
  await page.click('.nav-link:nth-child(2)');
  await page.waitForTimeout(1200);
  const perangkat = await page.evaluate(() => ({
    active: document.getElementById('section-perangkat')?.classList.contains('active'),
    kades: document.querySelectorAll('#perangkat-content .card-kades').length,
    person: document.querySelectorAll('#perangkat-content .card-person').length
  }));
  console.log('[PUBLIC -> PERANGKAT]', JSON.stringify(perangkat));

  // open perangkat modal (click first card)
  const firstPerson = await page.$('#perangkat-content .card-person');
  if (firstPerson) {
    await firstPerson.click();
    await page.waitForTimeout(500);
    const modalOpen = await page.evaluate(() => document.getElementById('modal-overlay')?.classList.contains('show'));
    console.log('[PERANGKAT modal open]', modalOpen);
    await page.screenshot({ path: 'verify_perangkat_modal.png' });
    // close
    await page.click('#modal-close');
    await page.waitForTimeout(300);
  }

  // click UMKM via navbar
  await page.click('.nav-link:nth-child(3)');
  await page.waitForTimeout(1200);
  const umkm = await page.evaluate(() => ({
    umkmActive: document.getElementById('section-umkm')?.classList.contains('active'),
    cards: document.querySelectorAll('#umkm-cards .card-umkm').length,
    filters: document.querySelectorAll('#umkm-filters .chip-filter').length
  }));
  console.log('[PUBLIC -> UMKM]', JSON.stringify(umkm));
  await page.screenshot({ path: 'verify_umkm.png', fullPage: true });

  // open UMKM modal
  const firstUmkm = await page.$('#umkm-cards .card-umkm');
  if (firstUmkm) {
    await firstUmkm.click();
    await page.waitForTimeout(500);
    const modalOpen = await page.evaluate(() => document.getElementById('modal-overlay')?.classList.contains('show'));
    console.log('[UMKM modal open]', modalOpen);
    await page.click('#modal-close');
    await page.waitForTimeout(300);
  }

  // click BERITA via navbar
  await page.click('.nav-link:nth-child(4)');
  await page.waitForTimeout(1200);
  const berita = await page.evaluate(() => ({
    beritaActive: document.getElementById('section-berita')?.classList.contains('active'),
    featured: document.querySelectorAll('#berita-content .card-featured').length,
    cards: document.querySelectorAll('#berita-content .card-berita').length
  }));
  console.log('[PUBLIC -> BERITA]', JSON.stringify(berita));
  await page.screenshot({ path: 'verify_berita.png', fullPage: true });

  // click GALERI via navbar
  await page.click('.nav-link:nth-child(5)');
  await page.waitForTimeout(1200);
  const galeri = await page.evaluate(() => ({
    galeriActive: document.getElementById('section-galeri')?.classList.contains('active'),
    items: document.querySelectorAll('#galeri-content .galeri-item').length,
    empty: document.querySelector('#galeri-content .empty') ? true : false
  }));
  console.log('[PUBLIC -> GALERI]', JSON.stringify(galeri));

  // click KONTAK via navbar
  await page.click('.nav-link:nth-child(6)');
  await page.waitForTimeout(1200);
  const kontak = await page.evaluate(() => ({
    kontakActive: document.getElementById('section-kontak')?.classList.contains('active'),
    contactBoxes: document.querySelectorAll('#kontak-content .contact-box').length,
    waBtn: document.querySelectorAll('#kontak-content .whatsapp').length,
    maps: document.querySelectorAll('#kontak-content .map-frame').length
  }));
  console.log('[PUBLIC -> KONTAK]', JSON.stringify(kontak));
  await page.screenshot({ path: 'verify_kontak.png', fullPage: true });

  // ---- ADMIN (desktop) ----
  await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const adminLogin = await page.evaluate(() => ({
    authVisible: document.getElementById('auth-screen')?.style.display !== 'none',
    loginBtn: !!document.getElementById('btn-login')
  }));
  console.log('[ADMIN auth]', JSON.stringify(adminLogin));
  await page.screenshot({ path: 'verify_admin_login.png' });

  // simulate showing dashboard (call internal fn if session absent)
  await page.evaluate(() => {
    const d = document.getElementById('dash-screen');
    document.getElementById('auth-screen').style.display = 'none';
    d.style.display = 'grid';
    if (window.bindTabs) bindTabs();
  });
  await page.waitForTimeout(600);
  const adminDash = await page.evaluate(() => ({
    sidebar: !!document.querySelector('.sidebar'),
    navItems: document.querySelectorAll('.nav-item').length,
    panels: document.querySelectorAll('.tab-panel').length,
    title: document.getElementById('dash-title')?.textContent,
    profilFields: !!document.getElementById('p_visi') && !!document.getElementById('p_tahun_berdiri'),
    galeriTab: !!document.getElementById('tab-galeri'),
    gridCols: (() => { const ds = document.querySelector('.dashboard'); return ds ? getComputedStyle(ds).gridTemplateColumns : 'n/a'; })()
  }));
  console.log('[ADMIN dash]', JSON.stringify(adminDash));

  // switch to galeri tab
  await page.click('.nav-item:nth-child(5)');
  await page.waitForTimeout(500);
  const galeriTab = await page.evaluate(() => ({
    title: document.getElementById('dash-title')?.textContent,
    galeriActive: document.getElementById('tab-galeri')?.classList.contains('active'),
    addBtn: !!document.getElementById('btn-add-galeri')
  }));
  console.log('[ADMIN galeri tab]', JSON.stringify(galeriTab));
  await page.screenshot({ path: 'verify_admin_dash.png', fullPage: true });

  console.log('\n[CONSOLE ERRORS]', errors.length ? errors.join('\n') : '(none)');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
