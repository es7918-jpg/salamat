const itemsFromScrape = hashes.map(hash => ({
      title: ویدئو ${hash},
      link: https://www.aparat.com/v/${hash},
      pubDate: '',
      description: '',
      hash,
      embed: https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame,
      cover: null
    }));

    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
    return res.status(200).json({ mode: 'scrape', pageUrl, count: itemsFromScrape.length, items: itemsFromScrape });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
// api/aparat.js  (CommonJS) — پایدار روی Vercel
// تست سریع: /api/aparat?test=1
// نمونه واقعی: /api/aparat?channel=zoomit  یا  /api/aparat?channel=https://www.aparat.com/zoomit

module.exports = async function (req, res) {
  try {
    // حالت تست برای اینکه UI را بدون وابستگی به آپارات چک کنیم
    if (req.query.test === '1') {
      const items = Array.from({ length: 6 }).map((_, i) => {
        const hash = TEST${i + 1};
        return {
          title: نمونه ویدئو ${i + 1},
          link: https://www.aparat.com/v/${hash},
          pubDate: '',
          description: 'داده نمونه برای تست UI',
          hash,
          embed: https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame,
          cover: null
        };
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ mode: 'test', count: items.length, items });
    }

    let { channel, perpage } = req.query;
    if (!channel) {
      return res.status(400).json({ error: 'channel required, e.g. /api/aparat?channel=zoomit' });
    }

    // اگر آدرس کامل داده شده، فقط اسلاگش را نگه دار
    try {
      const u = new URL(channel);
      channel = u.pathname.replace(/^\/+|\/+$/g, '') || channel;
    } catch {}

    const n = Math.min(parseInt(perpage || '20', 10) || 20, 50);

    // 1) تلاش با API غیررسمی آپارات
    const apiUrl = https://www.aparat.com/etc/api/videoByUser/username/${encodeURIComponent(channel)}/perpage/${n};
    try {
      const r = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' }
      });

      if (r.ok) {
        const j = await r.json();
        // تلاش برای پیدا کردن آرایه‌ی ویدئوها در شکل‌های مختلف پاسخ
        const raw =
          (Array.isArray(j?.videoByUser) && j.videoByUser) ||
          (Array.isArray(j?.videobyuser) && j.videobyuser) ||
          (Array.isArray(j?.videos) && j.videos) ||
          (Array.isArray(j?.video) && j.video) ||
          (Array.isArray(j?.list) && j.list) ||
          (Array.isArray(j?.data) && j.data) ||
          [];

        const itemsFromApi = raw.map(v => {
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

        if (itemsFromApi.length) {
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
          return res.status(200).json({ mode: 'api', apiUrl, count: itemsFromApi.length, items: itemsFromApi });
        }
      }
      // اگر r.ok نبود، میریم سراغ فالبک
    } catch (_) {
      // ignore و فالبک اجرا می‌شود
    }

    // 2) فالبک: اسکرپ صفحه‌ی کانال
    const pageUrl = https://www.aparat.com/${encodeURIComponent(channel)};
    const pr = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SalamatApp/1.0)' } });
    if (!pr.ok) {
      return res.status(502).json({ error: fetch ${pageUrl} -> ${pr.status} });
    }
    const html = await pr.text();

    // استخراج همه‌ی هش‌ها به شکل /v/<hash>
    const re = /\/v\/([A-Za-z0-9]+)/g;
    const hashes = Array.from(new Set(Array.from(html.matchAll(re)).map(m => m[1]))).slice(0, n);

