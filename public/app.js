(function () {
  var out   = document.getElementById("out");
  var btn   = document.getElementById("btn");
  var slugI = document.getElementById("slug");
  var maxI  = document.getElementById("maxid"); // دیگه استفاده نمی‌کنیم ولی می‌گذاریم بمونه

  // ---- utils ---------------------------------------------------------------
  function fetchText(url) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open("GET", url, true);
      x.onreadystatechange = function () {
        if (x.readyState === 4) {
          if (x.status >= 200 && x.status < 300) resolve(x.responseText);
          else reject(new Error("fetch " + url + " -> " + x.status));
        }
      };
      x.send();
    });
  }
  function stripTags(s) {
    return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  function uniq(arr) {
    var m = {}, out = [];
    for (var i = 0; i < arr.length; i++) { var k = arr[i]; if (!m[k]) { m[k] = 1; out.push(k); } }
    return out;
  }
  function byDesc(a, b) { return b - a; }
  function byDescId(a, b) { return b.id - a.id; }

  // از HTML پست، کپشن و عکس
  function parsePostHtml(html) {
    // عکس
    var cover = "";
    var m1 = html.match(/https?:\/\/[^\s"'()<>]+?\.(?:jpg|jpeg|png|gif)/i);
    if (m1) cover = m1[0];
    if (!cover) {
      var m2 = html.match(/https?:\/\/[^\s"'()<>]+\/download\/[^\s"'()<>]+/i);
      if (m2) cover = m2[0];
    }

    // متن – ترجیحاً بخش Markdown Content
    var text = "";
    var mMd = html.match(/Markdown Content:\s*([\s\S]+?)\n(?:URL Source|Title|$)/i);
    if (mMd && mMd[1]) text = mMd[1]; else text = stripTags(html);

    // تمیزکاری
    text = text
      .replace(/!\[[^\]]*]\([^)]+\)/g, "") // تصویر مارک‌داون
      .replace(/\[[^\]]*]\([^)]+\)/g, "")  // لینک مارک‌داون
      .replace(/[*_`>#]/g, " ")            // نشانه‌گذاری
      .replace(/\s+/g, " ")
      .trim();

    // خط‌های آماری بی‌ربط (دنبال‌کننده/عکس/ویدیو…)
    text = text.replace(/دنبال‌کننده.*|عکس \d+ ویدیو \d+ فایل \d+/g, " ").trim();

    if (text.length > 160) text = text.slice(0, 160) + "…";
    return { text: text, cover: cover };
  }

  // محدودکنندهٔ همزمانی ساده
  function mapLimit(list, limit, worker) {
    return new Promise(function (resolve, reject) {
      var i = 0, running = 0, results = [];
      function next() {
        if (i >= list.length && running === 0) return resolve(results);
        while (running < limit && i < list.length) {
          (function (idx) {
            running++;
            worker(list[idx]).then(function (r) {
              results[idx] = r; running--; next();
            }).catch(function (e) {
              results[idx] = null; running--; next();
            });
          })(i++);
        }
      }
      next();
    });
  }

  // آی‌دی‌ها را از صفحات /s/ و / استخراج می‌کنیم
  function extractIdsFromHtml(html, slug) {
    var ids = [];
    var re = new RegExp("/" + slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "/(\\d+)", "gi");
    var m;
    while ((m = re.exec(html)) !== null) { ids.push(parseInt(m[1], 10)); }
    return uniq(ids).sort(byDesc);
  }

  // --------------------------------------------------

  async function load() {
    var slug = slugI.value.trim();
    if (!slug) { out.innerHTML = '<div class="muted">اسلاگ خالی است</div>'; return; }
    out.innerHTML = '<p class="muted">در حال دریافت فهرست پست‌ها…</p>';

    try {
      // 1) HTML تایم‌لاین و پروفایل
      var [h1, h2] = await Promise.all([
        fetchText("https://r.jina.ai/https://eitaa.com/s/" + encodeURIComponent(slug)),
        fetchText("https://r.jina.ai/https://eitaa.com/"   + encodeURIComponent(slug))
      ]);

      // 2) استخراج آی‌دی‌ها
      var ids = uniq( extractIdsFromHtml(h1, slug).concat( extractIdsFromHtml(h2, slug) ) )
                .sort(byDesc)
                .slice(0, 20); // فقط ۲۰ تای آخر
    if (!ids.length) {
        out.innerHTML = '<div class="muted">هیچ ID پستی در /s/ یا / پیدا نشد. شاید کانال تازه است یا پروکسی لینک‌ها را پنهان می‌کند. یک‌بار لینک یک پست را مستقیم بده (مثلاً /' + slug + '/4).</div>';
        return;
      }

      out.innerHTML = '<p class="muted">در حال گرفتن جزئیات ' + ids.length + ' پست…</p>';

      // 3) فقط برای همین IDها صفحهٔ پست را می‌گیریم (همزمانی 6 تا)
      var posts = await mapLimit(ids, 6, function (ID) {
        var url = "https://r.jina.ai/https://eitaa.com/" + encodeURIComponent(slug) + "/" + ID;
        return fetchText(url).then(function (html) {
          if (!html || html.length < 200) return null;
          var meta = parsePostHtml(html);
          return { id: ID, slug: slug, text: meta.text, cover: meta.cover };
        });
      });

      posts = posts.filter(Boolean).sort(byDescId);

      // 4) رندر
      render(posts);

    } catch (e) {
      out.innerHTML = '<div class="muted">خطا: ' + e.message + '</div>';
    }
  }

  // ساده و تمیز
  function render(items) {
    out.innerHTML = '';
    if (!items.length) { out.innerHTML = '<div class="muted">پستی پیدا نشد.</div>'; return; }

    var grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr';
    grid.style.gap = '12px';
    if (window.matchMedia('(min-width:640px)').matches) grid.style.gridTemplateColumns = '1fr 1fr';
    out.appendChild(grid);

    items.forEach(function (p) {
      var card = document.createElement('article');
      card.style.background = '#fff';
      card.style.border = '1px solid #e5e7eb';
      card.style.borderRadius = '12px';
      card.style.padding = '12px';
      card.style.boxShadow = '0 1px 2px rgba(0,0,0,.04)';

      if (p.cover) {
        var img = document.createElement('img');
        img.src = p.cover; img.alt = '';
        img.style.width = '100%'; img.style.borderRadius = '8px';
        card.appendChild(img);
      }

      var idline = document.createElement('div');
      idline.style.color = '#64748b';
      idline.style.fontSize = '13px';
      idline.textContent = '#' + p.id;
      card.appendChild(idline);

      var para = document.createElement('p');
      para.textContent = p.text || '—';
      card.appendChild(para);

      var a = document.createElement('a');
      a.href = 'https://eitaa.com/' + p.slug + '/' + p.id;
      a.target = '_blank'; a.rel = 'noopener';
      a.style.color = '#0369a1';
      a.textContent = 'مشاهده در ایتا';
      card.appendChild(a);

      grid.appendChild(card);
    });
  }

  btn.addEventListener("click", load);
})();
