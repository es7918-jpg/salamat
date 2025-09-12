// api/aparat.js
// منبع اصلی: API غیررسمی آپارات (videoByUser) + فallback اسکرپ صفحه
// نمونه تست: /api/aparat?channel=zoomit  یا  /api/aparat?channel=https://www.aparat.com/zoomit

export default async function handler(req, res) {
  try {
    let { channel, perpage } = req.query;
    if (!channel) return res.status(400).json({ error: 'channel required' });
    perpage = Math.min(parseInt(perpage || '20', 10) || 20, 50);

    // اگر آدرس کامل دادند، فقط اسلاگ رو دربیار
    try {
      const u = new URL(channel);
      channel = u.pathname.replace(/^\/+|\/+$/g, '') || channel;
    } catch {}

    // 1) تلاش با API غیررسمی آپارات
    const apiUrl = `https://www.aparat.com/etc/api/videoByUser/username/${encodeURIComponent(channel)}/perpage/${perpage}`;
    try {
      const r = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' } });
      if (r.ok) {
        const j = await r.json();
        const arr = (j?.videoByUser || j?.videobyuser || j?.video || j?.videos || []);
        const items = (Array.isArray(arr) ? arr : (arr?.list || arr?.data || [])).map(v => {
          const link = v?.url ?? v?.link ?? v?.uid ?? '';
          // استخراج هش از لینک
          const m = String(link).match(/\/v\/([A-Za-z0-9]+)/);
          const hash = m ? m[1] : (v?.uid || v?.uid_hash || null);
          const title = v?.title || v?.s_title || v?.name || 'ویدئو';
          const desc = v?.description || v?.caption || '';
          const cover = v?.big_poster ?? v?.small_poster ?? v?.poster ?? null;
          const embed = hash ? `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame` : null;
          return { title, link: link || (hash ? `https://www.aparat.com/v/${hash}` : ''), pubDate: v?.create_date ?? v?.published ?? '', description: desc, hash, embed, cover };
        }).filter(x => x.embed);
        if (items.length) {
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
          return res.status(200).json({ mode: 'api', apiUrl, count: items.length, items });
        }
      }
    } catch (_) {
      // ادامه می‌دهیم به فallback
    }

    // 2) فallback: اسکرپ صفحه‌ی کانال
    const pageUrl = `https://www.aparat.com/${encodeURIComponent(channel)}`;
    const pr = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' } });
    if (!pr.ok) throw new Error(`fetch ${pageUrl} -> ${pr.status}`);
    const html = await pr.text();
    const re = /\/v\/([A-Za-z0-9]+)/g;
    const hashes = Array.from(new Set(Array.from(html.matchAll(re)).map(m => m[1]))).slice(0, perpage);
    const items = hashes.map(hash => ({
      title: `ویدئو ${hash}`,
      link: `https://www.aparat.com/v/${hash}`,
      pubDate: '',
      description: '',
      hash,
      embed: `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`,
      cover: null
    }));
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
    return res.status(200).json({ mode: 'scrape', pageUrl, count: items.length, items });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
