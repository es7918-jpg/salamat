// ======== تنظیمات ========
// لینک CSVِ "Publish to web" از Google Sheets را اینجا بگذارید:
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTc7k92da7KUDX60NbFQgsejpE5T7f2YS0My2p_E3RsXn2vM12PPqYTYaEm27mQLiEYLJkliLYMg3vS/pub?gid=1204797401&single=true&output=csv";
// مثال: https://docs.google.com/spreadsheets/d/XXXXX/pub?output=csv

// نگاشت هشتگ‌ها به دسته‌ها (برای صفحه خانه)
const CATEGORY_TITLES = {
  "سلامت_روان": "سلامت روان",
  "تغذیه": "تغذیه",
  "سلامت_خانواده": "سلامت خانواده",
  "ورزش": "ورزش",
  "عمومی": "متفرقه"
};

// ======== ابزارها ========
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const esc = (s) => (s==null?"":String(s)).replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

// CSV → Array of objects
function parseCSV(text){
  const rows = text.replace(/\r/g,"").split("\n").map(r=>r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
  const headers = rows.shift().map(h=>h.trim());
  return rows.filter(r=>r.some(x=>x && x.trim())).map(r=>{
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (r[i]||"").replace(/^"|"$/g,""));
    return obj;
  });
}

// Flexible header finder
function findKey(obj, patterns){
  const keys = Object.keys(obj);
  for(const pat of patterns){
    const re = new RegExp(pat, "i");
    const key = keys.find(k => re.test(k));
    if(key) return key;
  }
  return null;
}

// Convert Google Drive "view" link to direct image link
function driveDirect(link){
  if(!link) return null;
  try{
    const m = link.match(/\/file\/d\/([^/]+)\//);
    if(m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    const u = new URL(link);
    if(u.hostname.includes("drive.google.com") && u.searchParams.get("id")){
      return `https://drive.google.com/uc?export=view&id=${u.searchParams.get("id")}`;
    }
  }catch(e){}
  return link && link.startsWith("http") ? link : null;
}

function isImage(url){
  if(!url) return false;
  const u = url.toLowerCase();
  return u.endsWith(".jpg")||u.endsWith(".jpeg")||u.endsWith(".png")||u.endsWith(".webp");
}

function toTags(s){
  const raw = (s||"").trim();
  const capTags = raw.match(/#[^\s#]+/g) || [];
  const tags = (raw + " " + capTags.join(" ")).split(/\s+/).map(t=>t.replace(/^#+/,"")).filter(Boolean);
  return Array.from(new Set(tags));
}

function firstTagToCat(tags){
  for (const t of tags){
    if (CATEGORY_TITLES[t]) return t;
  }
  return "عمومی";
}

// ======== مدل داده ========
let STATE = { all:[], view:"home", activeCat:null };

async function loadData(){
  if(!SHEET_CSV_URL || SHEET_CSV_URL.startsWith("PASTE_")){
    console.warn("لطفاً لینک CSV شیت را در app.js جایگزین کنید.");
    render();
    return;
  }
  const res = await fetch(SHEET_CSV_URL, {cache:"no-store"});
  const text = await res.text();
  const rows = parseCSV(text);

  STATE.all = rows.map((r,i)=>{
    const keyTime    = findKey(r, ["timestamp","زمان","تاریخ"]);
    const keyTitle   = findKey(r, ["title","عنوان","پست"]);
    const keyCap     = findKey(r, ["caption","کپشن","توضیح"]);
    const keyTags    = findKey(r, ["tags","هشتگ","برچسب"]);
    const keyLink    = findKey(r, ["link","لینک","پیوند"]);
    const keyMedia   = findKey(r, ["media","مدیا","تصویر","ویدیو","آپلود","image","video"]);

    const title  = (r[keyTitle]||"").trim();
    const cap    = (r[keyCap]||"").trim();
    const tags   = toTags((r[keyTags]||"") + " " + cap);
    const media0 = (r[keyMedia]||"").trim();
    const link0  = (r[keyLink]||"").trim();

    // Resolve media for display (prefer direct image)
    let media = driveDirect(media0) || driveDirect(link0);
    const catKey = firstTagToCat(tags);

    return {
      id: i+1,
      date: r[keyTime] || "",
      title: title || (cap ? cap.slice(0,40)+"…" : "بدون عنوان"),
      caption: cap,
      link: link0 || media0,
      media,
      tags, catKey
    };
  }).reverse();

  render();
}

// ======== رندر نماها ========
const $tpl = (id)=> document.querySelector(`#${id}`).content.cloneNode(true);

function show(view){ STATE.view = view; render(); }
function setActiveTab(){
  $$(".tab").forEach(b=> b.classList.toggle("active", b.dataset.view===STATE.view));
}

function render(){
  const container = $("#view-container");
  container.innerHTML = "";

  if(STATE.view==="home"){
    const tpl = $tpl("home-tpl");
    const chips = tpl.querySelector("#catChips");
    Object.entries(CATEGORY_TITLES).forEach(([key, title])=>{
      const chip = document.createElement("button");
      chip.className = "chip" + (STATE.activeCat===key? " active": "");
      chip.textContent = title;
      chip.onclick = ()=>{ STATE.activeCat = key; render(); };
      chips.appendChild(chip);
    });
    tpl.querySelector("#homeCatTitle").textContent =
      STATE.activeCat ? ("آخرین پست‌ها — " + CATEGORY_TITLES[STATE.activeCat]) : "آخرین پست‌ها";

    const listEl = tpl.querySelector("#homeList");
    const items = STATE.activeCat ? STATE.all.filter(p=>p.catKey===STATE.activeCat) : STATE.all.slice(0,20);
    renderCards(listEl, items);
    container.appendChild(tpl);
  }

  if(STATE.view==="explore"){
    const tpl = $tpl("explore-tpl");
    const grid = tpl.querySelector("#grid");
    STATE.all.forEach(p=>{
      const tile = document.createElement("a");
      tile.className = "tile";
      tile.href = p.link || p.media || "#";
      tile.target = "_blank";
      if (p.media && isImage(p.media)){
        const img = document.createElement("img");
        img.loading="lazy";
        img.src = p.media;
        tile.appendChild(img);
      }else{
        const ph = document.createElement("div");
        ph.style.display="grid"; ph.style.placeItems="center"; ph.style.height="100%";
        ph.style.color="#93c5fd"; ph.textContent = p.title || "پست";
        tile.appendChild(ph);
      }
      const cap = document.createElement("div"); cap.className="cap"; cap.textContent = p.title || "";
      tile.appendChild(cap);
      grid.appendChild(tile);
    });
    container.appendChild(tpl);
  }

  if(STATE.view==="search"){
    const tpl = $tpl("search-tpl");
    const q = tpl.querySelector("#q");
    const list = tpl.querySelector("#searchList");
    const doSearch = ()=>{
      const s = q.value.trim().toLowerCase();
      const res = !s ? [] : STATE.all.filter(p=>(p.title+p.caption+p.tags.join(" ")).toLowerCase().includes(s));
      list.innerHTML=""; renderCards(list, res);
    };
    tpl.querySelector("#btnGo").onclick = doSearch;
    q.onkeydown = (e)=>{ if(e.key==="Enter") doSearch(); };
    container.appendChild(tpl);
  }

  if(STATE.view==="about"){
    container.appendChild($tpl("about-tpl"));
  }

  setActiveTab();
}

function renderCards(container, items){
  if(!items || !items.length){
    const empty = document.createElement("div");
    empty.className="note";
    empty.textContent = "چیزی برای نمایش نیست.";
    container.appendChild(empty);
    return;
  }

  const tpl = $("#card-tpl");
  items.forEach(p=>{
    const node = tpl.content.cloneNode(true);
    const mediaWrap = node.querySelector(".media-wrap");

    if (p.media && isImage(p.media)){
      const img = document.createElement("img");
      img.loading="lazy"; img.src = p.media; img.alt = "";
      mediaWrap.appendChild(img);
    }else{
      mediaWrap.innerHTML = '<div style="padding:20px;color:#93c5fd">پیش‌نمایش در دسترس نیست</div>';
    }

    node.querySelector(".meta .cat").textContent = CATEGORY_TITLES[p.catKey] || "متفرقه";
    node.querySelector(".meta time").textContent = p.date ? new Date(p.date).toLocaleString("fa-IR") : "";
    node.querySelector(".title").textContent = p.title || "";
    node.querySelector(".caption").textContent = p.caption || "";

    const tagsWrap = node.querySelector(".tags");
    p.tags.forEach(t=>{
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = "#" + t;
      tagsWrap.appendChild(span);
    });

    const viewBtn = node.querySelector(".view");
    viewBtn.href = p.link || p.media || "#";

    node.querySelector(".more").onclick = (e)=>{
      const c = e.target.closest(".card").querySelector(".caption");
      c.classList.toggle("line-clamp");
      e.target.textContent = c.classList.contains("line-clamp") ? "نمایش کپشن" : "بستن کپشن";
    };

    container.appendChild(node);
  });
}

// ======== راه‌اندازی ========
function init(){
  $$(".tab").forEach(b=> b.onclick = ()=> show(b.dataset.view));
  $("#refreshBtn").onclick = loadData;
  render();      // first paint
  loadData();    // fetch data
}
document.addEventListener("DOMContentLoaded", init);
