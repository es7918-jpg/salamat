(function () {
  // --------- تنظیم کانال هر دسته (فعلاً همه یکسان) ------------
  var CHANNELS = {
    mental:   'bedasht_ravan', // سلامت روان
    nutrition:'bedasht_ravan', // تغذیه
    dental:   'bedasht_ravan', // دهان و دندان
    diseases: 'bedasht_ravan', // بیماری‌ها
    family:   'bedasht_ravan'  // سلامت خانواده
  };
  var CATEGORIES = [
    { key:'mental',    title:'سلامت روان',    pill:'sky'   },
    { key:'nutrition', title:'تغذیه',         pill:'green' },
    { key:'dental',    title:'دهان و دندان',  pill:'indigo'},
    { key:'diseases',  title:'بیماری‌ها',     pill:'rose'  },
    { key:'family',    title:'سلامت خانواده', pill:'pink'  },
  ];

  // --------- util ها ------------
  function qs(s){ return document.querySelector(s); }
  function el(tag, props){ var d=document.createElement(tag); if(props){Object.assign(d, props);} return d; }
  function fetchText(url){
    return new Promise(function(resolve,reject){
      var x=new XMLHttpRequest(); x.open('GET',url,true);
      x.onreadystatechange=function(){ if(x.readyState===4){ if(x.status>=200&&x.status<300) resolve(x.responseText); else reject(new Error('GET '+url+' -> '+x.status)); } };
      x.send();
    });
  }
  function stripTags(s){ return String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
  function uniq(a){ var m={},o=[]; for(var i=0;i<a.length;i++){var k=a[i]; if(!m[k]){m[k]=1;o.push(k);} } return o; }
  function byDesc(a,b){ return b-a; }
  function byDescId(a,b){ return b.id-a.id; }

  // HTML پست را به {text, cover} تبدیل می‌کنیم
  function parsePostHtml(html){
    var cover='';
    var m1=html.match(/https?:\/\/[^\s"'()<>]+?\.(?:jpg|jpeg|png|gif)/i); if(m1) cover=m1[0];
    if(!cover){ var m2=html.match(/https?:\/\/[^\s"'()<>]+\/download\/[^\s"'()<>]+/i); if(m2) cover=m2[0]; }

    var text='';
    var mMd=html.match(/Markdown Content:\s*([\s\S]+?)\n(?:URL Source|Title|$)/i);
    if(mMd && mMd[1]) text=mMd[1]; else text=stripTags(html);

    text=text.replace(/!\[[^\]]*]\([^)]+\)/g,'')
             .replace(/\[[^\]]*]\([^)]+\)/g,'')
             .replace(/[*_`>#]/g,' ')
             .replace(/\s+/g,' ').trim();
    // حذف خطوط آماری بی‌ربط
    text=text.replace(/دنبال‌کننده.*|عکس \d+ ویدیو \d+ فایل \d+/g,' ').trim();

    if(text.length>220) text=text.slice(0,220)+'…';
    return {text:text, cover:cover};
  }

  function extractIdsFromHtml(html, slug){
    var ids=[]; var re=new RegExp('/'+slug.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+'/(\\d+)', 'gi'); var m;
    while((m=re.exec(html))!==null){ ids.push(parseInt(m[1],10)); }
    return uniq(ids).sort(byDesc);
  }

  function mapLimit(list, limit, worker){
    return new Promise(function(resolve){
      var i=0,run=0,res=[]; function next(){
        if(i>=list.length && run===0) return resolve(res);
        while(run<limit && i<list.length){
          (function(idx){ run++; worker(list[idx]).then(function(r){res[idx]=r; run--; next();}).catch(function(){res[idx]=null; run--; next();}); })(i++);
        }
      } next();
    });
  }

  // گرفتن آخرین پست‌های یک کانال
  async function fetchChannelLatest(slug, count){
    // HTML صفحه‌های /s و /
    var [h1,h2] = await Promise.allSettled([
      fetchText('https://r.jina.ai/https://eitaa.com/s/'+encodeURIComponent(slug)),
      fetchText('https://r.jina.ai/https://eitaa.com/'+encodeURIComponent(slug))
    ]);
    var html1 = h1.status==='fulfilled' ? h1.value : '';
    var html2 = h2.status==='fulfilled' ? h2.value : '';
    var ids = uniq( extractIdsFromHtml(html1, slug).concat( extractIdsFromHtml(html2, slug) ) )
               .sort(byDesc)
               .slice(0, count || 16);
    if(!ids.length) return [];
    // جزئیات هر پست
    var posts = await mapLimit(ids, 6, function(ID){
      var url='https://r.jina.ai/https://eitaa.com/'+encodeURIComponent(slug)+'/'+ID;
      var body=el('div'); body.className='card-body';
          var id=el('div',{className:'muted'}); id.textContent='#'+p.id;
          var btn=el('a'); btn.href='javascript:void(0)'; btn.textContent='نمایش کپشن و لینک'; btn.style.color='#0369a1';
          btn.onclick=function(){ openModal(p); };
          body.appendChild(id); body.appendChild(btn);
          card.appendChild(body); grid.appendChild(card);
        });
      }
    }
    else if(state.tab==='explore'){
      var h=el('h2'); h.textContent='اکسپلور – همهٔ دسته‌ها'; app.appendChild(h);
      if(!state.cacheExplore.length){
        var tip=el('p',{className:'muted'}); tip.textContent='در حال گردآوری پست‌ها…'; app.appendChild(tip);
        // همه‌ی دسته‌ها را موازی می‌گیریم، هر کدام 8 پست
        Promise.all(CATEGORIES.map(function(cat){ return fetchChannelLatest(CHANNELS[cat.key], 8).then(function(arr){ return (arr||[]).map(function(p){ p.category=cat.key; return p; }); }); }))
          .then(function(all){
            var flat=[].concat.apply([], all).sort(byDescId).slice(0,24);
            state.cacheExplore = flat;
            if(state.tab==='explore') render();
          })
          .catch(function(){ tip.textContent='خطا در دریافت.'; });
        return;
      }
      var grid=el('div'); grid.className='grid'; app.appendChild(grid);
      state.cacheExplore.forEach(function(p){
        var card=el('article'); card.className='card';
        if(p.cover){ var img=el('img',{className:'thumb',src:p.cover,alt:''}); card.appendChild(img); }
        var body=el('div'); body.className='card-body';
        var line=el('div',{className:'muted'}); 
        var cat = CATEGORIES.find(function(c){return c.key===p.category;});
        line.textContent=(cat?cat.title+' · ':'')+'#'+p.id;
        var btn=el('a'); btn.href='javascript:void(0)'; btn.textContent='نمایش کپشن و لینک'; btn.style.color='#0369a1';
        btn.onclick=function(){ openModal(p); };
        body.appendChild(line); body.appendChild(btn);
        card.appendChild(body); grid.appendChild(card);
      });
    }
    else { // about
      var h=el('h2'); h.textContent='درباره'; app.appendChild(h);
      var p=el('p',{className:'muted'});
      p.textContent='این نسخهٔ سبک، پست‌های کانال‌های ایتا را بدون بک‌اند جمع می‌کند. در «خانه»، هر دسته به یک کانال وصل است؛ در «اکسپلور»، همهٔ پست‌ها قاطی نمایش داده می‌شوند. روی هر پست بزنید تا کپشن کامل و لینک باز شود.';
      app.appendChild(p);
    }
  }

  // راه‌اندازی تب‌ها
  qs('#tab-home').addEventListener('click', function(){ setTab('home'); });
  qs('#tab-explore').addEventListener('click', function(){ setTab('explore'); });
  qs('#tab-about').addEventListener('click', function(){ setTab('about'); });

  // شروع
  setTab('home');
})();
return fetchText(url).then(function(html){
        if(!html || html.length<200) return null;
        var meta=parsePostHtml(html);
        return { id:ID, slug:slug, title:'پست #'+ID, text:meta.text, cover:meta.cover, link:'https://eitaa.com/'+slug+'/'+ID };
      });
    });
    return posts.filter(Boolean).sort(byDescId);
  }

  // ---------- UI: رندر تب‌ها و صفحات ----------
  var app = qs('#app');
  var tabHome=qs('#tab-home'), tabExplore=qs('#tab-explore'), tabAbout=qs('#tab-about');
  var modal = qs('#modal'), modalMedia=qs('#modalMedia'), modalTitle=qs('#modalTitle'), modalCaption=qs('#modalCaption'), modalLink=qs('#modalLink');

  var state = {
    tab: 'home',
    activeCat: null,
    cacheCat: {},   // {key: posts[]}
    cacheExplore: []// posts[]
  };

  function setTab(t){
    state.tab=t;
    tabHome.classList.toggle('active', t==='home');
    tabExplore.classList.toggle('active', t==='explore');
    tabAbout.classList.toggle('active', t==='about');
    render();
  }

  function openModal(post){
    modalMedia.innerHTML='';
    if(post.cover){
      var img=el('img',{src:post.cover,alt:'',style:'width:100%;display:block;max-height:60vh;object-fit:contain'});
      modalMedia.appendChild(img);
    }else{
      var ph=el('div'); ph.style.padding='60px 0'; ph.style.color='#94a3b8'; ph.style.textAlign='center'; ph.textContent='(بدون تصویر)';
      modalMedia.appendChild(ph);
    }
    modalTitle.textContent = post.title || ('پست #'+post.id);
    modalCaption.textContent = post.text || '—';
    modalLink.href = post.link;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    modal.addEventListener('click', function onClose(e){
      if(e.target===modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); modal.removeEventListener('click', onClose); }
    });
  }

  function render(){
    app.innerHTML='';
    if(state.tab==='home'){
      // اگر دسته انتخاب نشده، لیست دسته‌ها
      if(!state.activeCat){
        var h=el('h2'); h.textContent='دسته‌ها'; app.appendChild(h);
        var g=el('div'); g.className='catgrid'; app.appendChild(g);
        CATEGORIES.forEach(function(cat){
          var b=el('button'); b.className='catbtn pill '+cat.pill; b.textContent=cat.title;
          b.onclick=function(){ state.activeCat=cat.key; render(); };
          g.appendChild(b);
        });
        var tip=el('p'); tip.className='muted'; tip.textContent='روی هر دسته بزنید تا پست‌های مربوط نمایش داده شود.'; app.appendChild(tip);
      }else{
        var cat = CATEGORIES.find(function(c){return c.key===state.activeCat;});
        var back = el('button',{className:'btn'}); back.textContent='بازگشت'; back.onclick=function(){ state.activeCat=null; render(); };
        var ttl = el('h2'); ttl.textContent = cat.title;
        var bar = el('div'); bar.style.display='flex'; bar.style.gap='10px'; bar.style.alignItems='center';
        bar.appendChild(back); bar.appendChild(ttl); app.appendChild(bar);

        var posts = state.cacheCat[cat.key];
        if(!posts){
          var hint=el('p',{className:'muted'}); hint.textContent='در حال بارگذاری…'; app.appendChild(hint);
          fetchChannelLatest(CHANNELS[cat.key], 16).then(function(res){
            state.cacheCat[cat.key]=res||[];
            if(state.tab==='home' && state.activeCat===cat.key) render();
          }).catch(function(){ hint.textContent='خطا در دریافت پست‌ها.'; });
          return;
        }
        if(!posts.length){ var empty=el('p',{className:'muted'}); empty.textContent='پستی یافت نشد.'; app.appendChild(empty); return; }

        var grid=el('div'); grid.className='grid'; app.appendChild(grid);
        posts.forEach(function(p){
          var card=el('article'); card.className='card';
          if(p.cover){ var img=el('img',{className:'thumb',src:p.cover,alt:''}); card.appendChild(img); }
