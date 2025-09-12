// ===== تنظیمات دسته‌ها و فایل‌ها =====
var DATA_FILES = {
  mental:    "data/mental.json",
  nutrition: "data/nutrition.json",
  dental:    "data/dental.json",
  disease:   "data/disease.json",
  family:    "data/family.json"
};
var CAT_TITLES = {
  mental:"سلامت روان", nutrition:"تغذیه", dental:"دهان و دندان", disease:"بیماری‌ها", family:"سلامت خانواده"
};

// ===== وضعیت برنامه =====
var state = {
  tab: "home",
  activeCat: null,
  lists: {},      // هر دسته: آرایه‌ای از {id,title,caption,link}
  explore: [],    // همه باهم (ترکیبی)
  searchPool: [], // برای جستجو
  q: ""
};

var app = document.getElementById("app");

// ===== کمک‌تابع‌ها =====
function xhrGet(url, cb){
  try{
    var x = new XMLHttpRequest();
    // cache bust برای اینکه همیشه آخرین json خوانده شود
    var bust = (url.indexOf("?")>-1 ? "&" : "?") + "v=" + Date.now();
    x.open("GET", url + bust, true);
    x.onreadystatechange = function(){ if(x.readyState===4){ cb(null, x); } };
    x.send();
  }catch(e){ cb(e); }
}
function esc(s){ s=s||""; return String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function cut(s,n){ if(!s) return ""; return s.length>n ? s.slice(0,n)+"…" : s; }

// ===== لود داده =====
function loadCategory(key, cb){
  var file = DATA_FILES[key]; if(!file){ cb&&cb([]); return; }
  xhrGet(file, function(err, x){
    if(err || x.status!==200){ cb&&cb([]); return; }
    try{
      var items = JSON.parse(x.responseText)||[];
      // هر آیتم: {id,title,caption,link}
      state.lists[key] = items;
      cb&&cb(items);
    }catch(e){ cb&&cb([]); }
  });
}

function loadExploreAndSearch(){
  var keys = Object.keys(DATA_FILES), pending = keys.length, all=[];
  for(var i=0;i<keys.length;i++){
    (function(k){
      loadCategory(k, function(items){
        if(items && items.length){
          for(var j=0;j<items.length;j++){
            // کارتِ استاندارد با فیلد دسته
            all.push({
              id: items[j].id || (k+"-"+(j+1)),
              title: items[j].title || "",
              caption: items[j].caption || "",
              link: items[j].link || "#",
              cat: k
            });
          }
        }
        pending--;
        if(pending===0){
          state.explore = all;
          state.searchPool = all;
          if(state.tab==="explore" || state.tab==="search") render();
        }
      });
    })(keys[i]);
  }
}

// ===== رندر =====
function render(){
  var html = "";
  if(state.tab==="home"){
    if(!state.activeCat){
      html += '<section><h2 style="margin:6px 0 12px">دسته‌ها</h2>';
      html += '<div class="catgrid">';
      html += '<button class="catbtn cat-mental" data-gocat="mental"><small>ورود به</small><strong>سلامت روان</strong></button>';
      html += '<button class="catbtn cat-nutrition" data-gocat="nutrition"><small>ورود به</small><strong>تغذیه</strong></button>';
      html += '<button class="catbtn cat-dental" data-gocat="dental"><small>ورود به</small><strong>دهان و دندان</strong></button>';
      html += '<button class="catbtn cat-disease" data-gocat="disease"><small>ورود به</small><strong>بیماری‌ها</strong></button>';
      html += '<button class="catbtn cat-family" data-gocat="family"><small>ورود به</small><strong>سلامت خانواده</strong></button>';
      html += '</div></section>';
      app.innerHTML = html;
    }else{
      var key = state.activeCat;
      var list = state.lists[key] || [];
      html += '<div class="headerrow">'
           +    '<button class="back" data-back="1">← بازگشت</button>'
           +    '<h2 style="margin:0">'+ (CAT_TITLES[key]||key) +'</h2>'
           +  '</div>';
      if(!list.length) html += '<div class="muted">در حال بارگذاری…</div>';
      html += renderCards(list, key);
      app.innerHTML = html;
      if(!list.length){ loadCategory(key, function(){ render(); }); }
    }
  }
  else if(state.tab==="explore"){
    if(!state.explore.length) html += '<div class="muted">در حال بارگذاری…</div>';
    html += renderCards(state.explore, null, true);
    app.innerHTML = html;
    if(!state.explore.length) loadExploreAndSearch();
  }
  else if(state.tab==="search"){
    html += '<input class="search" id="q" placeholder="جستجو در عنوان و کپشن…">';
    var results=[];
    if(state.q){
      var ql = state.q.toLowerCase();
      for(var i=0;i<state.searchPool.length;i++){
        var p = state.searchPool[i];
        var t = (p.title||"") + " " + (p.caption||"");
        if(t.toLowerCase().indexOf(ql)!==-1) results.push(p);
      }
      html += '<div class="muted" style="margin-top:6px">'+results.length+' نتیجه</div>';
    }else{
      html += '<div class="muted" style="margin-top:6px">کلیدواژه بنویسید…</div>';
    }
    html += renderCards(results, null, true);
    app.innerHTML = html;
    var q = document.getElementById("q");
    if(q){ q.value = state.q; q.oninput = function(){ state.q = q.value; render(); }; }
    if(!state.searchPool.length) loadExploreAndSearch();
  }
  else if(state.tab==="about"){
    html += '<div class="card"><div class="body">'
         +  '<h3 class="title">درباره ما</h3>'
         +  '<p class="cap">این نسخه به‌صورت دستی از فایل‌های JSON می‌خواند. '
         +  'برای هر دسته یک فایل در پوشه <code>data/</code> هست. لینک پست‌های ایتا را در آن‌ها اضافه کنید؛ '
         +  'در تب خانه هر دسته جداست و در اکسپلور همه باهم نمایش داده می‌شوند.</p>'
         +  '</div></div>';
    app.innerHTML = html;
  }

  // فعال/غیرفعال کردن تب‌ها
  var btns = document.querySelectorAll(".tabbtn");
  for(var b=0;b<btns.length;b++){
    var t = btns[b].getAttribute("data-tab");
    if(t) btns[b].className = "tabbtn" + (t===state.tab? " active":"");
  }

  // هندل کلیک‌های داخل main
  app.onclick = function(e){
    var k = e.target.getAttribute("data-gocat");
    if(k){ state.activeCat = k; render(); return; }
    if(e.target.getAttribute("data-back")){ state.activeCat=null; render(); }
  };
}

function renderCards(list, key, showCat){
  if(!list || !list.length) return '<div class="muted" style="margin-top:8px">چیزی برای نمایش نیست.</div>';
  var html = '<div class="grid">';
  for(var i=0;i<list.length;i++){
    var p = list[i];
    var title = esc(p.title||("پست "+(p.id||"")));
    var cap   = esc(cut(p.caption||"", 240));
    var link  = p.link || "#";
    var cat   = showCat ? ('<span class="muted">'+(CAT_TITLES[p.cat]||'')+'</span>') : '';
    html += '<article class="card">'
         +    '<div class="body">'
         +      '<h3 class="title">'+ title +'</h3>'
         +      (cap? '<p class="cap">'+ cap +'</p>' : '')
         +      '<div class="row">'
         +        '<span class="muted">#'+esc(p.id||"")+'</span>'
         +        (cat||'')
         +        '<a class="btn" href="'+link+'" target="_blank" rel="noopener">مشاهده</a>'
         +      '</div>'
         +    '</div>'
         +  '</article>';
  }
  html += '</div>';
  return html;
}

// ===== سیم‌کشی تب‌ها =====
(function wireTabs(){
  var tabBtns = document.querySelectorAll(".tabs .tabbtn");
  for(var i=0;i<tabBtns.length;i++){
    tabBtns[i].onclick = function(){
      var t = this.getAttribute("data-tab");
      state.tab = t;
      if(t==="explore" && state.explore.length===0) loadExploreAndSearch();
      if(t==="search"  && state.searchPool.length===0) loadExploreAndSearch();
      render();
    };
  }
})();

// شروع
render();
