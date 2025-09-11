import Parser from 'rss-parser';

async function fetchRSS(channel){
  const parser = new Parser({
    requestOptions: {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' },
      timeout: 10000
    }
  });
  const feedUrl = `https://www.aparat.com/rss/${encodeURIComponent(channel)}`;
  const feed = await parser.parseURL(feedUrl);
  const items = (feed.items || []).map(it => {
    const m = (it.link || '').match(/\/v\/([^\/?#]+)/);
    const hash = m ? m[1] : null;
    const embed = hash ? `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame` : null;
    const coverMatch = (it.content || '').match(/src=\"([^\"]+)\"/);
    const cover = coverMatch ? coverMatch[1] : null;
    return { title: it.title || '', link: it.link || '', pubDate: it.pubDate || '', description: it.contentSnippet || '', hash, embed, cover };
  }).filter(x => x.embed);
  return { items, feedUrl };
}

async function scrapeChannelPage(channel){
  const target = `https://www.aparat.com/${encodeURIComponent(channel)}`;
  const res = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' } });
  if (!res.ok) throw new Error(`fetch ${target} -> ${res.status}`);
  const html = await res.text();
  const re = /\/v\/([A-Za-z0-9]+)/g;
  const hashes = Array.from(new Set(Array.from(html.matchAll(re)).map(m => m[1]))).slice(0, 20);
  const items = hashes.map(hash => ({
    title: `ویدئو ${hash}`,
    link: `https://www.aparat.com/v/${hash}`,
    pubDate: '',
    description: '',
    hash,
    embed: `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`,
    cover: null
  }));
  return { items, pageUrl: target };
}

export default async (req, res) => {
  try {
    let { channel } = req.query;
    if (!channel) return res.status(400).json({ error: 'channel required' });

    try {
      const u = new URL(channel);
      channel = u.pathname.replace(/^\/+|\/+$/g, '') || channel;
    } catch {}

    try {
      const rss = await fetchRSS(channel);
      if (rss.items.length) {
        res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json({ mode: 'rss', feedUrl: rss.feedUrl, count: rss.items.length, items: rss.items });
      }
    } catch {}

    const sc = await scrapeChannelPage(channel);
    res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=600');
    return res.status(200).json({ mode: 'scrape', pageUrl: sc.pageUrl, count: sc.items.length, items: sc.items });

  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
};
