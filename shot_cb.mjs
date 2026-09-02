import { chromium } from "playwright";
const b = await chromium.launch();
const shots = [
  { name: "desktop", vp: { width: 1280, height: 800 } },
  { name: "mobile",  vp: { width: 390, height: 740 } },
];
for (const s of shots) {
  const p = await b.newPage({ viewport: s.vp });
  p.on("pageerror", (e) => console.log(`[${s.name}][PAGEERROR]`, e.message));
  await p.goto("http://localhost:8123/index.html", { waitUntil: "networkidle" });
  await p.evaluate(() => localStorage.clear());          // simulasi pengunjung baru
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(4200);                           // tunggu teaser muncul
  await p.screenshot({ path: `cb_${s.name}_notice.png` });
  const teaser = await p.$(".cb-teaser");
  const dot = await p.$("#cb-fab .cb-fab-dot");
  console.log(`${s.name}: teaser=${!!teaser}, dot=${!!dot}`);
  if (teaser) {
    // klik area teaser (bukan tombol ×) -> harus buka panel
    await p.click(".cb-teaser", { position: { x: 100, y: 10 } });
  } else {
    await p.click("#cb-fab");
  }
  await p.waitForTimeout(700);
  await p.screenshot({ path: `cb_${s.name}_open.png` });
  console.log(`${s.name}: panel open=${await p.$("#cb-panel.show") !== null}, dot gone=${await p.$("#cb-fab .cb-fab-dot") === null}, fab hidden=${await p.evaluate(() => document.getElementById("cb-fab").classList.contains("hidden"))}`);
  // cek panel tidak menabrak bottom-nav di mobile
  if (s.name === "mobile") {
    const r = await p.evaluate(() => {
      const pn = document.getElementById("cb-panel").getBoundingClientRect();
      return { bottom: Math.round(pn.bottom), navTop: Math.round(document.querySelector(".mobile-bottom-nav").getBoundingClientRect().top) };
    });
    console.log(`${s.name}: panel.bottom=${r.bottom} vs nav.top=${r.navTop} → aman=${r.bottom <= r.navTop}`);
  }
  // tutup -> FAB kembali, notice tidak muncul lagi
  await p.click("#cb-close");
  await p.waitForTimeout(400);
  await p.screenshot({ path: `cb_${s.name}_closed.png` });
  console.log(`${s.name}: after close → fab visible=${await p.isVisible("#cb-fab")}, teaser gone=${await p.$(".cb-teaser") === null}`);
  await p.close();
}
await b.close();
console.log("done");
