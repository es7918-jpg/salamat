// api/eitaa.js  (CommonJS)
const fetchFn = (...args) => fetch(...args);
function stripTags(s='') { return s.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }

module.exports = async function(req, res) {
  try {
    let { channel, perpage } = req.query;
    if (!channel) return res.status(400).json({ error: 'channel required, e.g. /api/eitaa?channel=Eitaa_FAQ' });
    perpage = Math.min(parseInt(perpage || '20',10)||20, 50);

    try {
      const u = new URL(channel);
      channel = u.pathname.replace(/^\/+|\/+$/g,'') || channel;
    } catch {}

    const url = `https://eitaa.com/${encodeURIComponent(channel)}`;
    const r = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' } });
    if (!r.ok) return res.status(502).json({ error: `fetch ${url} -> ${r.status}` });
    const html = await r.text();

    const postRe = new RegExp(`/${channel}/(\\d+)`, 'g');
    const ids = Array.from(new Set(Array.from(html.matchAll(postRe)).map(m => m[1]))).slice(0, perpage);

    const items = ids.map(id => {
      const link = `https://eitaa.com/${channel}/${id}`;
      const idx = html.indexOf(`/${channel}/${id}`);
      const window = idx >= 0 ? html.slice(Math.max(0, idx-1200), Math.min(html.length, idx+1200)) : '';
      const text = stripTags(window.split('</a>').slice(-1)[0] || '');
      const media = [];
      const imgRe = /<img[^>]+src="([^"]+)"/g;
      const vidRe = /<video[^>]+src="([^"]+)"/g;
      const ifrRe = /<iframe[^>]+src="([^"]+)"/g;
      for (const m of window.matchAll(imgRe)) media.push({ type:'image', url: m[1] });
      for (const m of window.matchAll(vidRe)) media.push({ type:'video', url: m[1] });
      for (const m of window.matchAll(ifrRe)) media.push({ type:'iframe', url: m[1] });
      return { id, title:`پست #${id}`, text, media, link };
    });

    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
    res.status(200).json({ mode: 'scrape', channel, pageUrl: url, count: items.length, items });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
};
