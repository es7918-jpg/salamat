// api/eitaa.js  (CommonJS, با فالبک پروکسی)
// تست: /api/eitaa?channel=behdasht_ravan  یا  /api/eitaa?channel=bedasht_ravan
// اگر فچ مستقیم به eitaa.com جواب نداد، از r.jina.ai به‌عنوان فالبک استفاده می‌کند.

const UA = 'Mozilla/5.0 (compatible; SalamatApp/1.0)';

async function tryFetch(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return { ok: false, status: r.status, text: '' };
    const text = await r.text();
    return { ok: true, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: String(e) };
  }
}

function stripTags(s = '') {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniq(arr) { return Array.from(new Set(arr)); }

function parseChannelHtml(html, channel, limit) {
  // همه‌ی آیدی‌ها به‌صورت /<channel>/<id>
  const postRe = new RegExp(/${channel}/(\\d+), 'g');
  const ids = uniq(Array.from(html.matchAll(postRe)).map(m => m[1])).slice(0, limit);

  const items = ids.map(id => {
    const link = https://eitaa.com/${channel}/${id};
    const idx = html.indexOf(/${channel}/${id});
    const win = idx >= 0 ? html.slice(Math.max(0, idx - 1500), Math.min(html.length, idx + 1500)) : '';

    // تصاویر (best-effort)
    const imgs = [];
    const imgRe = /https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif)/gi;
    for (const m of win.matchAll(imgRe)) imgs.push(m[0]);

    // ویدئو/آیفریم—اگر آدرسی پیدا شد می‌گذاریم، وگرنه فقط لینک پست را می‌دهیم
    const vids = [];
    const vidRe = /<video[^>]+src="([^"]+)"/gi;
    for (const m of win.matchAll(vidRe)) vids.push(m[1]);
    const ifr = [];
    const ifrRe = /<iframe[^>]+src="([^"]+)"/gi;
    for (const m of win.matchAll(ifrRe)) ifr.push(m[1]);

    const media = [];
    imgs.forEach(u => media.push({ type: 'image', url: u }));
    vids.forEach(u => media.push({ type: 'video', url: u }));
    ifr.forEach(u => media.push({ type: 'iframe', url: u }));

    const text = stripTags(win.split('</a>').slice(-1)[0] || '');

    return {
      id,
      title: پست #${id},
      text,
      media,
      link
    };
  });

  return items;
}

module.exports = async function (req, res) {
  try {
    let { channel, perpage } = req.query;
    if (!channel) return res.status(400).json({ error: 'channel required, e.g. /api/eitaa?channel=behdasht_ravan' });

    perpage = Math.min(parseInt(perpage || '20', 10) || 20, 50);
    channel = String(channel).trim();

    // اگر آدرس کامل دادند، فقط اسلاگ را نگه دار
    try {
      const u = new URL(channel);
      channel = u.pathname.replace(/^\/+|\/+$/g, '') || channel;
    } catch {}

    // 1) تلاش مستقیم
    const directUrl = https://eitaa.com/${encodeURIComponent(channel)};
    let r = await tryFetch(directUrl);
    let mode = 'direct';

    // اگر جواب نگرفتیم، 2) فالبک: r.jina.ai
    if (!r.ok || !r.text) {
      const proxyUrl1 = https://r.jina.ai/http://eitaa.com/${encodeURIComponent(channel)};
      r = await tryFetch(proxyUrl1);
      mode = 'proxy-http';
    }
    if (!r.ok || !r.text) {
      const proxyUrl2 = https://r.jina.ai/https://eitaa.com/${encodeURIComponent(channel)};
      r = await tryFetch(proxyUrl2);
      mode = 'proxy-https';
    }

    if (!r.ok || !r.text) {
      return res.status(502).json({ error: 'unable to fetch channel', channel, tried: mode });
    }

    const html = r.text;

    // استخراج آیتم‌ها
    let items = parseChannelHtml(html, channel, perpage);

    // اگر چیزی پیدا نشد و اسلاگ به‌نظر اشتباه تایپی دارد، یک تلاش ثانویه با حروف کوچک یا حذف h
    if (!items.length) {
      const altCandidates = uniq([
        channel.toLowerCase(),
        channel.replace('behdasht', 'bedasht'),
        channel.replace('bedasht', 'behdasht'),
      ]).filter(x => x !== channel);

      for (const alt of altCandidates) {
        const altHtml = html; // همان خروجی را هم امتحان می‌کنیم
        items = parseChannelHtml(altHtml, alt, perpage);
        if (items.length) {
          channel = alt;
          break;
        }
      }
    }
    return res.status(200).json({
      mode,
      channel,
      count: items.length,
      items: items.map(it => {
        const cover = it.media.find(m => m.type === 'image')?.url || null;
        const embed = it.media.find(m => m.type === 'iframe' || m.type === 'video')?.url || null;
        return {
          id: it.id,
          title: it.title,
          description: it.text,
          link: it.link,
          cover,
          embed
        };
      })
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
};
