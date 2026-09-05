// api/news.js — Vercel Serverless Function
// Fetch RSS berita dari server (tidak ada CORS karena same-origin)

const FEEDS = [
  "https://feeds.bbci.co.uk/indonesian/rss.xml",  // BBC Indonesia
  "https://www.cnnindonesia.com/rss",              // CNN Indonesia
  "https://www.voaindonesia.com/rss/",             // VOA Indonesia
];

export default async function handler(req, res) {
  // Allow all origins (called from same domain)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  for (const url of FEEDS) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebDesaBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;

      const xml = await response.text();
      if (!xml.includes("<item")) continue; // pastikan ada artikel

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("X-Feed-Source", url);
      return res.status(200).send(xml);
    } catch (_) {
      continue;
    }
  }

  return res.status(503).json({ error: "Semua sumber berita tidak tersedia." });
}
