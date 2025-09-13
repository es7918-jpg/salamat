const API_URL = "https://script.google.com/macros/s/AKfycbwL163LePEwdXHl0_jwfgirHgn9biiXNwxAF9keLodHmlePXNnVhSFqFzXez5uHjFAIMg/exec";

const state = { tab:"explore", all:[], q:"" };
const app = document.getElementById("app");

function esc(s){ return String(s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function cut(s,n){ return s && s.length>n ? s.slice(0,n)+"…" : (s||""); }

function normalize(items){
  return (items||[]).map((p,i)=>({
    id: p.id || i+1,
    date: p.date || new Date().toISOString(),
    title: p.title || "",
    caption: p.caption || "",
    tags: Array.isArray(p.tags) ? p.tags : (String(p.tags||"").match(/#\S+/g)||[]),
    link: p.link || "#"
  }));
}

function card(p){
  return `<div class="card">
    <div class="title">${esc(p.title||"بدون عنوان")}</div>
    <div class="cap">${cut(esc(p.caption),150)}</div>
    <div class="tags">${(p.tags||[]).map(t=>`<span>${esc(t)}</span>`).join("")}</div>
    <div class="footer">
      <span>${new Date(p.date).toLocaleDateString("fa-IR")}</span>
      <a href="${p.link}" target="_blank">مشاهده</a>
    </div>
  </div>`;
}

function render(){
  document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.tab));
  if(state.tab==="explore"){
    app.innerHTML = `<h2>اکسپلور</h2><div class="grid">${state.all.map(card).join("")}</div>`;
  } else if(state.tab==="search"){
    app.innerHTML = `<h2>جستجو</h2><input placeholder="جستجو..." id="searchBox" value="${esc(state.q)}"><div class="grid">${
      state.all.filter(p=> (p.title+p.caption+p.tags.join(" ")).includes(state.q)).map(card).join("")
    }</div>`;
    document.getElementById("searchBox").oninput = e=>{ state.q=e.target.value; render(); };
  } else if(state.tab==="about"){
    app.innerHTML = `<h2>درباره ما</h2><p>این نسخه آزمایشی شبکه سلامت متصل به تلگرام است.</p>`;
  } else {
    app.innerHTML = `<h2>خانه</h2><div class="grid">${state.all.slice(0,6).map(card).join("")}</div>`;
  }
}

document.querySelectorAll(".tabbtn").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();});

async function start(){
  render();
  const r = await fetch(API_URL);
  const j = await r.json();
  state.all = normalize(j.items||[]);
  render();
}
start();
