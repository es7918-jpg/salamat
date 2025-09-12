(function(){
  var out   = document.getElementById('out');
  var btn   = document.getElementById('btn');
  var slugI = document.getElementById('slug');
  var maxI  = document.getElementById('maxid');

  function fetchText(url, ok, err){
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onreadystatechange = function(){
      if(x.readyState===4){
        if(x.status>=200 && x.status<300) ok(x.responseText);
        else err(new Error('fetch '+url+' -> '+x.status));
      }
    };
    x.send();
  }

  function stripTags(s){ return String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }

  function parsePostHtml(html){
    var text = stripTags(html).slice(0,200);
    var cover = '';
    var m1 = html.match(/https?:\/\/[^"'<>\s]+?\.(jpg|jpeg|png|gif)/i);
    if(m1 && m1[0]) cover = m1[0];
    if(!cover){
      var m2 = html.match(/https?:\/\/[^"'<>\s]+\/download\/[^"'<>\s]+/i);
      if(m2 && m2[0]) cover = m2[0];
    }
    return { text:text, cover:cover };
  }

  function render(posts){
    out.innerHTML = '';
    if(!posts.length){
      var d = document.createElement('div');
      d.className='muted';
      d.textContent='هیچ پستی پیدا نشد. عدد «تا شماره» را بیشتر کنید و دوباره امتحان کنید.';
      out.appendChild(d);
      return;
    }
    // گرید
    var grid = document.createElement('div');
    grid.style.display='grid';
    grid.style.gridTemplateColumns='1fr';
    grid.style.gap='12px';
    if(window.matchMedia('(min-width:640px)').matches){
      grid.style.gridTemplateColumns='1fr 1fr';
    }
    out.appendChild(grid);

    posts.sort(function(a,b){ return b.id - a.id; });
    for(var i=0;i<posts.length;i++){
      var p = posts[i];

      var card = document.createElement('article');
      card.style.background='#fff';
      card.style.border='1px solid #e5e7eb';
      card.style.borderRadius='12px';
      card.style.padding='12px';
      card.style.boxShadow='0 1px 2px rgba(0,0,0,.04)';

      if(p.cover){
        var img=document.createElement('img');
        img.src=p.cover; img.alt='';
        img.style.width='100%'; img.style.borderRadius='8px';
        card.appendChild(img);
      }

      var idline=document.createElement('div');
      idline.style.color='#64748b';
      idline.style.fontSize='13px';
      idline.appendChild(document.createTextNode('#'+p.id));
      card.appendChild(idline);

      var para=document.createElement('p');
      para.appendChild(document.createTextNode(p.text));
      card.appendChild(para);

      var a=document.createElement('a');
      a.href='https://eitaa.com/'+p.slug+'/'+p.id;
      a.target='_blank'; a.rel='noopener';
      a.style.color='#0369a1';
      a.appendChild(document.createTextNode('مشاهده در ایتا'));
      card.appendChild(a);

      grid.appendChild(card);
    }
  }

  function load(){
    var slug = slugI.value.trim();
    var max  = parseInt(maxI.value,10)||40;
    if(!slug){ out.innerHTML='<div class="muted">اسلاگ خالی است</div>'; return; }
    out.innerHTML='<p class="muted">در حال اسکن پست‌ها…</p>';

    var found = [];
    var done  = 0;

    for(var id=1; id<=max; id++){
      (function(ID){
        var url = 'https://r.jina.ai/https://eitaa.com/'+encodeURIComponent(slug)+'/'+ID;
        fetchText(url, function(html){
          // پست واقعی معمولاً طولانی‌تر است؛ 404ها کوتاه می‌آیند
          if(html && html.length>400){
            var meta = parsePostHtml(html);
            found.push({ id:ID, slug:slug, text:meta.text, cover:meta.cover });
          }
          done++; if(done===max) render(found);
        }, function(){
          done++; if(done===max) render(found);
        });
      })(id);
    }
  }

  btn.addEventListener('click', load);
})();