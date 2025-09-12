// api/aparat.js  (ESM) — برای package.json با "type": "module"
export default async function handler(req, res) {
  try {
    let { channel, perpage } = req.query;
    if (!channel) {
      res.status(400).json({ error: 'channel required, e.g. /api/aparat?channel=zoomit' });
      return;
    }

    // اگر URL کامل دادند، فقط اسلاگ را بردار
    try {
      const u = new URL(channel);
      channel = u.pathname.replace(/^\/+|\/+$/g, '') || channel;
    } catch {}

    const n = Math.min(parseInt(perpage || '20', 10) || 20, 50);
    const apiUrl = https://www.aparat.com/etc/api/videoByUser/username/${encodeURIComponent(channel)}/perpage/${n};

    const r = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' }
    });

    if (!r.ok) {
      res.status(502).json({ error: aparat api ${r.status}, apiUrl });
      return;
    }

    const j = await r.json();
    const raw =
      (Array.isArray(j?.videoByUser) && j.videoByUser) ||
      (Array.isArray(j?.videobyuser) && j.videobyuser) ||
      (Array.isArray(j?.videos) && j.videos) ||
      (Array.isArray(j?.video) && j.video) ||
      (Array.isArray(j?.list) && j.list) ||
      (Array.isArray(j?.data) && j.data) || [];

    const items = raw.map(v => {
      const link = v?.url || v?.link || v?.uid || '';
      const m = String(link).match(/\/v\/([A-Za-z0-9]+)/);
      const hash = m ? m[1] : (v?.uid || v?.uid_hash || null);
      const title = v?.title || v?.s_title || v?.name || 'ویدئو';
      const desc = v?.description || v?.caption || '';
      const cover = v?.big_poster || v?.small_poster || v?.poster || null;
      const embed = hash ? https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame : null;
      return {
        title,
        link: link || (hash ? https://www.aparat.com/v/${hash} : ''),
        pubDate: v?.create_date || v?.published || '',
        description: desc,
        hash,
        embed,
        cover
      };
    }).filter(x => x.embed);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ mode: 'api', apiUrl, count: items.length, items });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
