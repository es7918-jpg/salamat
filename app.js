// ======== تنظیمات ========
// 1) فایل Google Sheet خود را Publish to web کنید (CSV) و لینک را اینجا قرار دهید:
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTc7k92da7KUDX60NbFQgsejpE5T7f2YS0My2p_E3RsXn2vM12PPqYTYaEm27mQLiEYLJkliLYMg3vS/pub?gid=1204797401&single=true&output=csv";
// مثال لینک CSV: https://docs.google.com/spreadsheets/d/XXXXX/pub?output=csv

// نگاشت هشتگ‌ها به دسته‌ها (برای صفحه خانه)
const CATEGORY_TITLES = {
  "سلامت_روان": "سلامت روان",
  "تغذیه": "تغذیه",
  "سلامت_خانواده": "سلامت خانواده",
  "ورزش": "ورزش",
  "عمومی": "متفرقه"
};

// نام ستون‌ها در شیت (هدرها باید دقیقاً یکی از این‌ها باشند)
const HEADERS = {
  timestamp: "Timestamp",
  category: "دسته بندی",
  title: "عنوان پست",
  caption: "کپشن/توضیحات",
  tags: "برچسب‌ها",
  link: "لینک",
  media: "آپلود/تصویر/ویدیو"
};

// ======== ابزارها ========
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const esc = (s) => (s==null?"":String(s)).replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

// تبدیل CSV به آرایه‌ای از ابجکت‌ها
function parseCSV(text){
  const rows = text.replace(/\r/g,"").split("\n").map(r=>r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
  const headers = rows.shift().map(h=>h.trim());
  return rows.filter(r=>r.some(x=>x && x.trim())).map(r=>{
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (r[i]||"").replace(/^"|"$/g,""));
    return obj;
  });
}

function toTags(s){
  const raw = (s||"").trim();
  const tags = raw.split(/\s+/).map(t=>t.replace(/^#+/,"")).filter(Boolean);
  return Array.from(new Set(tags)); // unique
}

function firstTagToCat(tags){
  for (const t of tags){
    if (CATEGORY_TITLES[t]) return t;
  }
  return "عمومی";
}

function mediaElement(url){
  if(!url) return null;
  const u = url.toLowerCase();
  if(u.endsWith(".jpg")||u.endsWith(".jpeg")||u.endsWith(".png")||u.endsWith(".webp")){
    const img = document.createElement("img");
    img.loading = "lazy"; img.src = url; img.alt = "";
    return img;
  }
  if(u.endsWith(".mp4")||u.includes("youtube.com")||u.includes("youtu.be")){
    const v = document.createElement("video");
    v.src = url; v.controls = true; v.preload="metadata";
    return v;
  }
  return null;
}

// ======== مدل داده ========
let STATE = {
  all: [],    // همه پست‌ها
  view: "home",
  activeCat: null
};

async function loadData(){
  if(!SHEET_CSV_URL || SHEET_CSV_URL.startsWith("PASTE_")){
    console.warn("لطفاً لینک CSV شیت را در app.js جایگزین کنید.");
    render();
    return;
  }
  const res = await fetch(SHEET_CSV_URL, {cache:"no-store"});
  const text = await res.text();
  const rows = parseCSV(text);

  // نقشه‌برداری بر اساس هدرها
  STATE.all = rows.map((r,i)=>{
    const tags = toTags(r[HEADERS.tags]);
    const catKey = firstTagToCat(tags);

    return {
      id: i+1,
      date: r[HEADERS.timestamp] || "",
      title: r[HEADERS.title] || "",
      caption: r[HEADERS.caption] || "",
      link: r[HEADERS.link] || "",
      media: r[HEADERS.media] || "",
      tags, catKey
    };
  }).reverse();

  render();
}

// ======== رندر نماها ========
function show(view){ STATE.view = view; render(); }
function setActiveTab(){
  $$(".tab").forEach(b=> b.classList.toggle("active", b.dataset.view===STATE.view));
}

function render(){
  const container = $("#view-container");
  container.innerHTML = "";

  if(STATE.view==="home"){
    const tpl = $("#home-tpl").content.cloneNode(true);
    const chips = tpl.querySelector("#catChips");
    Object.entries(CATEGORY_TITLES).forEach(([key, title])=>{
      const chip = document.createElement("button");
      chip.className = "chip" + (STATE.activeCat===key? " active": "");
      chip.textContent = title;
      chip.onclick = ()=>{ STATE.activeCat = key; render(); };
      chips.appendChild(chip);
    });

    const listEl = tpl.querySelector("#homeList");
    tpl.querySelector("#homeCatTitle").textContent = STATE.activeCat ? ("آخرین پست‌ها — " + CATEGORY_TITLES[STATE.activeCat]) : "آخرین پست‌ها";
    renderCards(listEl, STATE.activeCat ? STATE.all.filter(p=>p.catKey===STATE.activeCat) : STATE.all.slice(0,20));
    container.appendChild(tpl);
  }

  if(STATE.view==="explore"){
    const tpl = $("#explore-tpl").content.cloneNode(true);
    const grid = tpl.querySelector("#grid");
    STATE.all.forEach(p=>{
      const tile = document.createElement("a");
      tile.className = "tile";
      tile.href = p.link || p.media || "#";
      tile.target = "_blank";
      const m = mediaElement(p.media);
      if(m && m.tagName==="IMG"){ tile.appendChild(m); }
      else{
        const ph = document.createElement("div");
        ph.style.display="grid"; ph.style.placeItems="center"; ph.style.height="100%";
        ph.textContent = p.title || "پست";
        tile.appendChild(ph);
      }
      const cap = document.createElement("div"); cap.className="cap"; cap.textContent = p.title || "";
      tile.appendChild(cap);
      grid.appendChild(tile);
    });
    container.appendChild(tpl);
  }

  if(STATE.view==="search"){
    const tpl = $("#search-tpl").content.cloneNode(true);
    const q = tpl.querySelector("#q");
    const list = tpl.querySelector("#searchList");
    const doSearch = ()=>{
      const s = q.value.trim().toLowerCase();
      const res = !s ? [] : STATE.all.filter(p=>(p.title+p.caption+p.tags.join(" ")).toLowerCase().includes(s));
      list.innerHTML="";
      renderCards(list, res);
    };
    tpl.querySelector("#btnGo").onclick = doSearch;
    q.onkeydown = (e)=>{ if(e.key==="Enter") doSearch(); };
    container.appendChild(tpl);
  }

  if(STATE.view==="about"){
    const tpl = $("#about-tpl").content.cloneNode(true);
    container.appendChild(tpl);
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
    const m = mediaElement(p.media);
    if(m){ mediaWrap.appendChild(m); }
    else{
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
  // تب‌ها
  $$(".tab").forEach(b=> b.onclick = ()=> show(b.dataset.view));
  $("#refreshBtn").onclick = loadData;

  render();      // first paint
  loadData();    // fetch data
}

document.addEventListener("DOMContentLoaded", init);
