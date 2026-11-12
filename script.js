const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const DAYS=["LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO"];
const MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
let weekOffset=0, mobileDay=(new Date().getDay()+6)%7;

function parseDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function mondayOf(d){const x=new Date(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);x.setHours(12,0,0,0);return x}
function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function fmtTime(t){if(!t)return"";const[h,m]=t.split(":").map(Number);return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"p. m.":"a. m."}`}
function weekRange(m){const e=addDays(m,6);return `${m.getDate()}${m.getMonth()!=e.getMonth()?" de "+MONTHS[m.getMonth()]:""} — ${e.getDate()} de ${MONTHS[e.getMonth()]}`}
function disabledWeek(m){return SEMANAS_SIN_ACTIVIDADES.find(x=>iso(mondayOf(parseDate(x.semanaDe)))===iso(m))}
function occurs(a,d){const dow=((d.getDay()+6)%7)+1,s=iso(d);return a.dias.includes(dow)&&d>=parseDate(a.desde)&&d<=parseDate(a.hasta)&&!(a.canceladas||[]).includes(s)}
function generate(start,end){
 const out=[];
 for(let d=new Date(start);d<=end;d=addDays(d,1)){
   if(!disabledWeek(mondayOf(d))) ACTIVIDADES_RECURRENTES.forEach(a=>{if(occurs(a,d)){const fecha=iso(d),ex=(a.excepciones||{})[fecha]||{};out.push({...a,...ex,fecha})}})
 }
 EVENTOS_ESPECIALES.forEach(e=>{const d=parseDate(e.fecha);if(d>=start&&d<=end)out.push({...e,virtudes:e.virtudes||[]})});
 (typeof EVENTOS_IMPORTANTES!=="undefined"?EVENTOS_IMPORTANTES:[]).forEach(e=>{
   const d=parseDate(e.fecha);
   if(e.activo!==false && d>=start && d<=end) out.push({...e,esImportante:true,virtudes:e.virtudes||[]});
 });
 return out.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||"").localeCompare(b.hora||""))
}
function activityImg(a){
 const foto=a&&a.foto;
 if(!foto)return "";
 if(/^https?:\/\//i.test(foto))return foto;
 return `img/actividades/${foto}`;
}
function activityBg(a){
 const main=activityImg(a);
 const fb=a&&a._fotoRespaldo ? `img/actividades/${a._fotoRespaldo}` : "";
 if(main&&fb&&main!==fb)return `url('${main}'),url('${fb}')`;
 return main?`url('${main}')`:"";
}
function autoCover(a){
 const title=(a.nombre||"Actividad").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 return `<div class="event-img auto-activity-cover"><b>${title}</b><i>FILOSOFÍA · CULTURA · VOLUNTARIADO</i></div>`;
}
function nextDate(id){
 const a=ACTIVIDADES_RECURRENTES.find(x=>x.id===id);if(!a)return"";
 const start=new Date();start.setHours(12,0,0,0);
 for(let i=0;i<220;i++){const d=addDays(start,i);if(occurs(a,d))return iso(d)}
 return a.desde
}
function occurrence(id,date){const a=ACTIVIDADES_RECURRENTES.find(x=>x.id===id);return a?{...a,fecha:date||nextDate(id)}:EVENTOS_ESPECIALES.find(x=>x.id===id)}

function eventHTML(a){
 if(a.esImportante){
   const poster=a.foto?`img/eventos/${a.foto}`:"";
   return `<button class="event-card important-week-card" data-important-week="${poster}">
     ${poster?`<div class="event-img" style="background-image:url('${poster}')"></div>`:""}
     <div class="event-body"><span class="special-badge">${a.tipo||"EVENTO ESPECIAL"}</span>
     <div class="event-time">${fmtTime(a.hora)}</div><div class="event-name">${a.nombre}</div>
     <div class="venue-tag"><span class="dot san-carlos"></span>${a.sede||""} ›</div></div></button>`
 }
 const s=SEDES[a.sede]||{clase:"san-carlos"};
 return `<button class="event-card" data-event="${a.id}" data-date="${a.fecha}">
 ${activityImg(a)?`<div class="event-img" style="background-image:${activityBg(a)}"></div>`:autoCover(a)}
 <div class="event-body"><div class="event-time">${fmtTime(a.hora)}</div><div class="event-name">${a.nombre}</div>
 <div class="venue-tag"><span class="dot ${s.clase}"></span>${a.sede} ›</div></div></button>`
}
function renderWeek(){
 const m=addDays(mondayOf(new Date()),weekOffset*7),e=addDays(m,6),off=disabledWeek(m),ev=generate(m,e);
 $("#heroWeek").textContent=weekRange(m).toUpperCase();$("#weekPill").textContent=weekRange(m);
 $("#weekGrid").innerHTML=DAYS.map((n,i)=>{
   const d=addDays(m,i),items=ev.filter(a=>a.fecha===iso(d)),today=iso(d)===iso(new Date());
   return `<div class="day-column ${i===mobileDay?"mobile-active":""} ${today?"today":""}">
   <div class="day-head">${n}${today?'<b class="today-pill">HOY</b>':""}<small>${d.getDate()} de ${MONTHS[d.getMonth()]}</small></div>
   ${off?`<div class="week-empty">${off.mensaje}</div>`:items.length?items.map(eventHTML).join(""):'<div class="day-empty">Sin actividades programadas</div>'}</div>`
 }).join("");
 $("#mobileDays").innerHTML=DAYS.map((n,i)=>{const d=addDays(m,i);return `<button class="${i===mobileDay?"active":""}" data-mobile-day="${i}">${n.slice(0,3)}<br><small>${d.getDate()}</small></button>`}).join("");
 $$("[data-event]").forEach(b=>b.onclick=()=>openActivity(b.dataset.event,b.dataset.date));
 $$("[data-important-week]").forEach(b=>b.onclick=()=>openPoster(b.dataset.importantWeek));
 $$("[data-mobile-day]").forEach(b=>b.onclick=()=>{mobileDay=+b.dataset.mobileDay;renderWeek()});
 renderUpcoming()
}
function upcoming(){
 const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),end=addDays(start,CONFIG.diasAgendaFutura||180);
 return generate(start,end).filter(a=>a.fecha>=iso(start))
}
function renderUpcoming(){
 const u=upcoming().slice(0,CONFIG.cantidadProximos||6);
 $("#upcomingList").innerHTML=u.map(a=>{const d=parseDate(a.fecha),s=SEDES[a.sede]||{clase:"san-carlos"};return `<button class="upcoming-row" data-u="${a.id}" data-date="${a.fecha}"><div class="upcoming-date">${String(d.getDate()).padStart(2,"0")}<small>${MONTHS[d.getMonth()].slice(0,3).toUpperCase()}</small></div><div><div class="upcoming-name">${a.nombre}</div><div class="venue-tag"><span class="dot ${s.clase}"></span>${a.sede}</div></div></button>`}).join("");
 $$("[data-u]").forEach(b=>b.onclick=()=>openActivity(b.dataset.u,b.dataset.date))
}

function show(content){$("#modalContent").innerHTML=content;$("#detailModal").classList.add("open");$("#detailModal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden"}
function closeModal(){$("#detailModal").classList.remove("open");$("#detailModal").setAttribute("aria-hidden","true");document.body.style.overflow=""}


/* V22 — videos opcionales
   En cualquier taller, área o evento puedes agregar:
   video:"videos/mi-video.mp4"
   o
   video:"https://www.youtube.com/watch?v=XXXXXXXXXXX"
*/
function videoBlock(item){
  const raw=(item&&item.video||"").trim();
  if(!raw)return"";
  const title=item.videoTitulo||"Conoce un poco más";
  let yt="";
  try{
    const u=new URL(raw,window.location.href);
    if(u.hostname.includes("youtu.be")) yt=u.pathname.replace("/","");
    if(u.hostname.includes("youtube.com")){
      if(u.pathname.startsWith("/embed/")) yt=u.pathname.split("/embed/")[1].split(/[?&]/)[0];
      else yt=u.searchParams.get("v")||"";
    }
  }catch(e){}
  if(yt){
    return `<div class="detail-video"><p class="eyebrow">VIDEO</p><h4>${title}</h4>
      <div class="video-frame"><iframe src="https://www.youtube.com/embed/${yt}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>`;
  }
  return `<div class="detail-video"><p class="eyebrow">VIDEO</p><h4>${title}</h4>
    <div class="video-frame"><video controls preload="metadata" playsinline src="${raw}">Tu navegador no puede reproducir este video.</video></div></div>`;
}

function secondaryPhotos(a,type){
 const folder=type==="area"?"espacios":"actividades";
 const fs=(a.fotos||[]).slice(1);
 if(!fs.length)return"";
 return `<div class="more-photos"><p class="eyebrow">MÁS FOTOGRAFÍAS</p><div class="more-photos-grid">${fs.map(f=>`<div class="zoomable-photo" data-full-image="img/${folder}/${f}" style="background-image:url('img/${folder}/${f}')"></div>`).join("")}</div></div>`
}
function openActivity(id,date){
 const a=occurrence(id,date);if(!a)return;
 const d=DETALLES_ACTIVIDAD[id]||{aprende:"Una experiencia para aprender, compartir y participar activamente.",filosofia:a.frase,divertido:"Ven a conocer este espacio y vivirlo por ti mismo."};
 const v=SEDES[a.sede]||{};
 const saludo=a.encargado?`Hola ${a.encargado},`:"Hola,";
 const msg=encodeURIComponent(`${saludo} vi ${a.nombre} en la página de Nueva Acrópolis y me dio curiosidad conocer un poco más. ¿Me brindas información?`);
 show(`<div class="activity-modal">
   <div class="activity-cover zoomable-photo" data-full-image="${activityImg(a)}" style="background-image:${activityBg(a)}"></div>
   <div class="activity-copy">
     <p class="eyebrow">${a.sede} · ${fmtTime(a.hora)}</p>
     <h2>${a.nombre}</h2><p class="lead"><em>${a.frase}</em></p>
     <div class="modal-columns">
       <div><h4>¿Qué encontrarás?</h4><p>${d.aprende}</p></div>
       <div><h4>Virtudes que puedes cultivar</h4><div class="virtue-list">${(a.virtudes||[]).map(x=>`<span title="${SIGNIFICADO_VIRTUDES[x]||""}">${x}</span>`).join("")}</div></div>
     </div>
     <h4>La mirada filosófica</h4><p>${d.filosofia}</p><p class="light-note">${d.divertido}</p>
     ${secondaryPhotos(a,"actividad")}
     ${videoBlock(a)}
     ${v.direccion?`<div class="location-box"><span class="eyebrow">UBICACIÓN</span><h4>Sede ${a.sede}</h4><p>${v.direccion}</p><a href="${v.maps}" target="_blank" rel="noopener">Abrir ubicación en Google Maps →</a></div>`:""}
     <div class="contact-box"><div><span class="eyebrow">¿TE DIO CURIOSIDAD?</span><p>${a.encargado?`Puedes escribir a <b>${a.encargado}</b> para conocer un poco más.`:"Muy pronto publicaremos el contacto para este espacio."}</p></div>${a.whatsapp?`<a class="whatsapp" target="_blank" rel="noopener" href="https://wa.me/${a.whatsapp}?text=${msg}">Quiero conocer más →</a>`:""}</div>
   </div>
 </div>`)
}

function activityCard(x){
 return `<button class="space-card" data-act="${x.id}"><div class="space-photo" style="background-image:${activityBg(x)}"></div><div class="space-card-body"><span class="eyebrow">TALLER · CÍRCULO</span><h3>${x.nombre}</h3><p>${x.frase}</p><span class="discover">Conocer →</span></div></button>`
}
function areaCover(x){const f=x.fotoPortada||(x.fotos&&x.fotos[0])||x.foto||x.id+"-1.jpg";return /^(https?:|data:|blob:)/i.test(f)?f:`img/espacios/${f}`;}
function areaCard(x){
 const cover=areaCover(x);
 return `<button class="space-card area-card" data-area="${x.id}"><div class="space-photo" style="background-image:url('${cover}')"></div><div class="space-card-body"><span class="eyebrow">EQUIPO DE LA ESCUELA</span><h3>${x.nombre}</h3><p>${x.frase}</p><div class="mini-virtues">${x.virtudes.slice(0,4).map(v=>`<span>${v}</span>`).join("")}</div><span class="discover">Conocer el área →</span></div></button>`
}
function renderSpaces(){
 const activityGrid=$("#activitySpacesGrid"); if(activityGrid) activityGrid.innerHTML=ACTIVIDADES_RECURRENTES.map(activityCard).join("");
 $("#serviceSpacesGrid").innerHTML=AREAS_SERVICIO.map(areaCard).join("");
 $$("[data-act]").forEach(b=>b.onclick=()=>openActivity(b.dataset.act,nextDate(b.dataset.act)));
 $$("[data-area]").forEach(b=>b.onclick=()=>openService(b.dataset.area))
}
function openService(id){
 const x=AREAS_SERVICIO.find(a=>a.id===id);if(!x)return;
 const f=areaCover(x);
 const saludo=x.encargado?`Hola ${x.encargado},`:"Hola,";
 const msg=encodeURIComponent(`${saludo} vi el área de ${x.nombre} en la página de Nueva Acrópolis y me dio curiosidad conocer un poco más. ¿Me brindas información?`);
 const contact=x.whatsapp?`<div class="contact-box"><div><span class="eyebrow">¿TE DIO CURIOSIDAD?</span><p>${x.encargado?`Puedes escribir a <b>${x.encargado}</b> para conocer cómo participar en esta área.`:"Puedes escribirnos para conocer cómo participar en esta área."}</p></div><a class="whatsapp" target="_blank" rel="noopener" href="https://wa.me/${x.whatsapp}?text=${msg}">Quiero conocer más →</a></div>`:`<div class="contact-box pending-contact"><div><span class="eyebrow">¿TE DIO CURIOSIDAD?</span><p>Muy pronto podrás contactar directamente a este equipo desde aquí.</p></div></div>`;
 show(`<div class="activity-modal area-modal">
   <div class="activity-cover zoomable-photo" data-full-image="${f}" style="background-image:url('${f}')"></div>
   <div class="activity-copy">
     <p class="eyebrow">EQUIPO DE LA ESCUELA</p><h2>${x.nombre}</h2><p class="lead"><em>${x.frase}</em></p>
     <div class="modal-columns"><div><h4>¿Qué hacemos?</h4><p>${x.aprende}</p></div><div><h4>Virtudes que puedes cultivar</h4><div class="virtue-list">${x.virtudes.map(v=>`<span title="${SIGNIFICADO_VIRTUDES[v]||""}">${v}</span>`).join("")}</div></div></div>
     <h4>¿Por qué existe este equipo?</h4><p>${x.filosofia}</p>
     ${secondaryPhotos(x,"area")}
     ${videoBlock(x)}
     ${contact}
   </div>
 </div>`)
}

function normalize(s){return(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function allVirtues(){return[...new Set([...ACTIVIDADES_RECURRENTES.flatMap(a=>a.virtudes||[]),...AREAS_SERVICIO.flatMap(a=>a.virtudes||[])])].sort()}
function renderVirtues(){
 $("#virtueChips").innerHTML=allVirtues().map(v=>`<button class="virtue-chip" data-v="${v}">${v}</button>`).join("");
 $$("[data-v]").forEach(b=>b.onclick=()=>{$("#virtueInput").value=b.dataset.v;searchVirtue(b.dataset.v)})
}
function score(x,q){const nq=normalize(q);let s=0;(x.virtudes||[]).forEach((v,i)=>{const nv=normalize(v);if(nv===nq)s+=100-i;if(nv.includes(nq)||nq.includes(nv))s+=35});if(normalize(x.nombre).includes(nq))s+=15;return s}
function searchVirtue(q){
 q=(q||$("#virtueInput").value).trim();if(!q){$("#virtueResults").innerHTML="";return}
 const all=[...ACTIVIDADES_RECURRENTES.map(x=>({...x,kind:"act"})),...AREAS_SERVICIO.map(x=>({...x,kind:"area"}))]
 .map(x=>({...x,_s:score(x,q)})).filter(x=>x._s>0).sort((a,b)=>b._s-a._s).slice(0,6);
 $("#virtueResults").innerHTML=all.length?`<div class="virtue-related-head"><span class="eyebrow">ESPACIOS MÁS RELACIONADOS CON ${q.toUpperCase()}</span></div><div class="result-grid">${all.map((x,i)=>`<button class="result-card virtue-result" data-r="${x.id}" data-kind="${x.kind}"><span class="relation">${i<2?"MUY RELACIONADO":"RELACIONADO"}</span><h3>${x.nombre}</h3><p>${x.frase}</p><p class="why-virtue">${SIGNIFICADO_VIRTUDES[(x.virtudes||[]).find(v=>normalize(v)===normalize(q))]||"Este espacio permite ejercitar esta virtud mediante la práctica y la convivencia."}</p></button>`).join("")}</div>`:`<p class="no-results">No encontré una relación directa. Prueba con otra virtud.</p>`;
 $$("[data-r]").forEach(b=>b.onclick=()=>b.dataset.kind==="act"?openActivity(b.dataset.r,nextDate(b.dataset.r)):openService(b.dataset.r))
}
function renderVenues(){
 const grid=$("#venueGrid");if(!grid)return;
 grid.innerHTML=Object.entries(SEDES).map(([name,s])=>`<article class="venue-card"><div class="venue-photo zoomable-photo" data-full-image="img/sedes/${s.clase}.jpg" style="background-image:url('img/sedes/${s.clase}.jpg')" title="Ver foto completa"></div><div class="venue-info"><span class="eyebrow">SEDE</span><h3>${name}</h3><p>${s.direccion}</p><a href="${s.maps}" target="_blank" rel="noopener">Ver ubicación en Google Maps →</a></div></article>`).join("")
}

$("#prevWeek").onclick=()=>{weekOffset--;renderWeek()};
$("#nextWeek").onclick=()=>{weekOffset++;renderWeek()};
$$("[data-view]").forEach(b=>b.onclick=()=>setAgendaView(b.dataset.view,b));
$("#virtueBtn").onclick=()=>searchVirtue();
$("#virtueInput").addEventListener("input",e=>searchVirtue(e.target.value));
$$("[data-close]").forEach(x=>x.onclick=closeModal);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
$("#menuBtn").onclick=()=>$("#nav").classList.toggle("open");
$("#downloadAgenda").onclick=()=>alert("La agenda se actualiza automáticamente.");


/* V16 — controlador único de la agenda */
function setActiveView(btn){
  $$("[data-view]").forEach(x=>x.classList.remove("active"));
  if(btn) btn.classList.add("active");
}
function recurringSummaryCard(a){
  const labels={1:"lunes",2:"martes",3:"miércoles",4:"jueves",5:"viernes",6:"sábados",7:"domingos"};
  const days=(a.dias||[]).map(d=>labels[d]).join(" y ");
  return `<button class="summary-event-card" data-summary="${a.id}">
    <div class="summary-event-img" style="background-image:${activityBg(a)}"></div>
    <div class="summary-event-copy">
      <span class="eyebrow">TALLER · CÍRCULO · ACTIVIDAD</span>
      <h3>${a.nombre}</h3>
      <p><b>Todos los ${days}</b>${a.hora?` · ${fmtTime(a.hora)}`:""}${a.sede?` · ${a.sede}`:""}</p>
    </div>
  </button>`;
}
function importantMiniCard(e){
  const d=parseDate(e.fecha);
  return `<button class="summary-event-card special-summary" data-important-poster="${e.foto||""}">
    <div class="summary-event-img" style="background-image:url('${eventImageSrc(e.foto)}')"></div>
    <div class="summary-event-copy">
      <span class="eyebrow">${e.tipo||"EVENTO IMPORTANTE"}</span>
      <h3>${e.nombre}</h3>
      <p><b>${d.getDate()} de ${MONTHS[d.getMonth()]}</b>${e.hora?` · ${fmtTime(e.hora)}`:""}${e.sede?` · ${e.sede}`:""}</p>
    </div>
  </button>`;
}
function renderSummaryView(mode){
  const now=new Date(), today=iso(now);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1,12);
  const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0,12);
  const ms=iso(monthStart), me=iso(monthEnd);

  const recurring=ACTIVIDADES_RECURRENTES.filter(a=>{
    if(mode==="month") return a.desde<=me && a.hasta>=ms;
    return a.hasta>=today;
  });

  const important=(typeof EVENTOS_IMPORTANTES!=="undefined"?EVENTOS_IMPORTANTES:[])
    .filter(e=>e.activo!==false)
    .filter(e=>mode==="month" ? e.fecha>=ms && e.fecha<=me : e.fecha>=today)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));

  const title=mode==="month"
    ? `Actividades de ${MONTHS[now.getMonth()]}`
    : "Talleres, círculos y actividades";
  const subtitle=mode==="month"
    ? "Una sola tarjeta por actividad habitual, más los eventos especiales de este mes."
    : "Resumen de las actividades permanentes y de los próximos eventos especiales.";

  $("#weekGrid").classList.add("range-view");
  $("#weekGrid").innerHTML=`
    <div class="range-heading"><span>${title}</span><strong>${recurring.length+important.length} propuestas</strong></div>
    <p class="range-intro">${subtitle}</p>
    <div class="summary-events-grid">
      ${recurring.map(recurringSummaryCard).join("")}
      ${important.map(importantMiniCard).join("")}
    </div>`;

  $$("[data-summary]").forEach(b=>b.onclick=()=>openActivity(b.dataset.summary,nextDate(b.dataset.summary)));
  $$("[data-important-poster]").forEach(b=>b.onclick=()=>openPoster(`img/eventos/${b.dataset.importantPoster}`));
}
function setAgendaView(view,btn){
  setActiveView(btn);
  if(view==="week"){weekOffset=0;$("#weekGrid").classList.remove("range-view");renderWeek();return}
  if(view==="next"){weekOffset=1;$("#weekGrid").classList.remove("range-view");renderWeek();return}
  if(view==="month"){renderSummaryView("month");return}
  if(view==="all"){renderSummaryView("all");return}
}
function openPoster(src){
  if(!src)return;
  const box=document.createElement("div");
  box.className="poster-lightbox";
  box.innerHTML=`<button class="poster-close" aria-label="Cerrar">×</button><img src="${src}" alt="Invitación completa">`;
  document.body.appendChild(box);
  document.body.classList.add("poster-open");
  box.onclick=e=>{if(e.target===box||e.target.closest(".poster-close"))closePoster()};
}
function closePoster(){
  $(".poster-lightbox")?.remove();
  document.body.classList.remove("poster-open");
}

document.addEventListener("click",e=>{
  const z=e.target.closest("[data-full-image]");
  if(z){e.preventDefault();e.stopPropagation();openPoster(z.dataset.fullImage)}
});


/* Eventos importantes de la portada */
function eventImageSrc(foto){
  if(!foto)return "";
  return /^(https?:|data:|blob:)/i.test(foto)?foto:`img/eventos/${foto}`;
}
function openEventDetails(id){
  const e=(typeof EVENTOS_IMPORTANTES!=="undefined"?EVENTOS_IMPORTANTES:[]).find(x=>String(x.id)===String(id));
  if(!e)return;
  const d=parseDate(e.fecha), img=eventImageSrc(e.foto);
  const pago=e.modalidad_pago==='De pago'||Number(e.costo)>0;
  const acceso=e.solo_miembros?'Solo para miembros':'Abierto';
  const costo=pago?(e.costo?`S/ ${Number(e.costo).toFixed(2).replace('.00','')}`:'De pago'):'Gratuito';
  const rawWa=String(e.whatsapp||'').replace(/\D/g,''); const waNum=rawWa.length===9?'51'+rawWa:rawWa; const wa=waNum?`<a class="event-detail-cta" target="_blank" rel="noopener" href="https://wa.me/${waNum}?text=${encodeURIComponent('Hola, vi el evento '+(e.titulo||e.nombre||'')+' en la página de Nueva Acrópolis y quisiera más información.')}">Consultar por WhatsApp</a>`:'';
  const modal=document.createElement('div'); modal.className='event-detail-modal';
  modal.innerHTML=`<div class="event-detail-card"><button class="event-detail-close" aria-label="Cerrar">×</button>${img?`<button class="event-detail-image" data-full-image="${img}" style="background-image:url('${img}')" aria-label="Ver imagen completa"></button>`:''}<div class="event-detail-copy"><span class="eyebrow">${e.tipo||'EVENTO ESPECIAL'}</span><h2>${e.nombre||e.titulo||''}</h2><p class="important-date">${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}${e.hora?` · ${fmtTime(e.hora)}`:''}</p><div class="event-detail-badges"><span>${acceso}</span><span>${costo}</span></div><p>${e.descripcion||''}</p>${e.detalle?`<div class="event-detail-full">${e.detalle}</div>`:''}<p class="important-place">${e.sede||''}</p>${wa}</div></div>`;
  document.body.appendChild(modal);document.body.classList.add('poster-open');
  modal.querySelector('.event-detail-close').onclick=()=>{modal.remove();document.body.classList.remove('poster-open')};
  modal.onclick=x=>{if(x.target===modal){modal.remove();document.body.classList.remove('poster-open')}};
}
function renderImportantEvents(){
  const grid=$("#importantEventsGrid"); if(!grid)return;
  const today=iso(new Date());
  const arr=(typeof EVENTOS_IMPORTANTES!=="undefined"?EVENTOS_IMPORTANTES:[])
    .filter(e=>e.activo!==false && e.fecha>=today)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  grid.innerHTML=arr.length?arr.map(e=>{
    const d=parseDate(e.fecha);
    const img=eventImageSrc(e.foto);
    const pago=e.modalidad_pago==='De pago'||Number(e.costo)>0;
    return `<article class="important-event">
      <button class="important-poster" data-poster="${img}" style="background-image:url('${img}')" aria-label="Ver invitación completa"></button>
      <div class="important-body"><span class="eyebrow">${e.tipo||"EVENTO ESPECIAL"}</span>
      <h3>${e.nombre}</h3>
      <p class="important-date">${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}${e.hora?` · ${fmtTime(e.hora)}`:""}</p>
      <div class="event-mini-badges">${e.solo_miembros?'<span>Solo miembros</span>':'<span>Abierto</span>'}<span>${pago?(e.costo?`S/ ${Number(e.costo).toFixed(2).replace('.00','')}`:'De pago'):'Gratuito'}</span></div>
      <p>${e.descripcion||""}</p>
      <button class="event-more-btn" data-event-details="${e.id}">Ver información completa →</button>
      <p class="important-place">${e.sede||""}</p></div>
    </article>`;
  }).join(""):`<div class="important-empty">Los próximos eventos especiales aparecerán aquí.</div>`;
  $$("[data-poster]").forEach(b=>b.onclick=()=>{if(b.dataset.poster)openPoster(b.dataset.poster)});
  $$("[data-event-details]").forEach(b=>b.onclick=()=>openEventDetails(b.dataset.eventDetails));
}
renderImportantEvents();
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePoster()});

renderWeek();
renderSpaces();
renderVirtues();
renderVenues();




/* V32 — Momentos compartidos: collage editorial paginado y deslizable */
let galleryIndex=0;
function gallerySrc(name){ return name.startsWith("http") ? name : `img/galeria/${name}`; }
function galleryPhotos(){ return (typeof GALERIA!=="undefined"?GALERIA:[]).filter(Boolean); }
function galleryLikeKey(i){return `na-gallery-like-${galleryPhotos()[i]||i}`;}
function isGalleryLiked(i){return localStorage.getItem(galleryLikeKey(i))==="1";}
function toggleGalleryLike(i,button){
  const liked=!isGalleryLiked(i); localStorage.setItem(galleryLikeKey(i),liked?'1':'0');
  button.classList.toggle('liked',liked); button.querySelector('.gallery-heart').textContent=liked?'♥':'♡';
  button.querySelector('.gallery-like-count').textContent=liked?'1':'0';
}
function renderSchoolGallery(){
  const box=$("#schoolGallery"), photos=galleryPhotos(); if(!box)return;
  if(!photos.length){box.innerHTML=`<div class="gallery-empty"><span>GALERÍA</span><p>Aquí aparecerán nuestros momentos compartidos.</p></div>`;return;}
  const pages=Math.ceil(photos.length/10);
  box.innerHTML=`<div class="gallery-editorial-shell">
    <button class="gallery-collage-nav gallery-collage-prev" aria-label="Ver anteriores">‹</button>
    <div class="gallery-collage-viewport"><div class="gallery-collage-track">${photos.map((f,i)=>`<article class="gallery-collage-item">
      <button class="gallery-collage-photo" data-open-gallery="${i}" aria-label="Abrir fotografía ${i+1}"><img data-gallery-src="${gallerySrc(f)}" alt="Momento compartido ${i+1}" loading="lazy" decoding="async" width="480" height="480"></button>
      <button class="gallery-item-like ${isGalleryLiked(i)?'liked':''}" data-like-gallery="${i}" aria-label="Dar corazón a fotografía ${i+1}"><span class="gallery-heart">${isGalleryLiked(i)?'♥':'♡'}</span><span class="gallery-like-count">${isGalleryLiked(i)?'1':'0'}</span></button>
    </article>`).join("")}</div></div>
    <button class="gallery-collage-nav gallery-collage-next" aria-label="Ver siguientes">›</button>
  </div>
  <div class="gallery-page-dots">${Array.from({length:Math.min(pages,5)},(_,i)=>`<button class="gallery-page-dot ${i===0?'active':''}" data-gallery-page="${i}" aria-label="Página ${i+1}"></button>`).join('')}</div>
  <div class="gallery-swipe-hint"><span class="gallery-swipe-icon">↔</span> Desliza para ver más momentos</div>
  <button class="gallery-all-button" type="button">VER TODAS LAS FOTOGRAFÍAS <span>›</span></button>`;
  const viewport=box.querySelector('.gallery-collage-viewport');
  const pageWidth=()=>viewport.clientWidth;
  function loadGalleryPage(page){
    // Cargar solo la página visible; evitar 20-30 descargas simultáneas.
    const imgs=box.querySelectorAll('.gallery-collage-item img');
    for(let i=page*10;i<Math.min((page+1)*10,imgs.length);i++){
      const img=imgs[i];
      if(img.dataset.gallerySrc){
        img.onerror=()=>{
          // Respaldo directo del repositorio si GitHub Pages aún no entrega la imagen.
          if(!img.dataset.galleryFallback){
            img.dataset.galleryFallback='1';
            const filename=img.src.split('/').pop().split('?')[0];
            img.src='https://raw.githubusercontent.com/area-integracion/area-integracion.github.io/main/img/galeria/'+encodeURIComponent(filename);
          }else{
            img.onerror=null;
            img.classList.add('gallery-image-unavailable');
            img.alt='Fotografía no disponible';
          }
        };
        img.loading='lazy';
        img.fetchPriority=i<page*10+3?'high':'low';
        img.src=img.dataset.gallerySrc;
        delete img.dataset.gallerySrc;
      }
    }
  }
  box.querySelector('.gallery-collage-prev').onclick=()=>viewport.scrollBy({left:-pageWidth(),behavior:'smooth'});
  box.querySelector('.gallery-collage-next').onclick=()=>viewport.scrollBy({left:pageWidth(),behavior:'smooth'});
  box.querySelectorAll('[data-open-gallery]').forEach(b=>b.onclick=()=>openGallery(Number(b.dataset.openGallery)));
  box.querySelectorAll('[data-like-gallery]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleGalleryLike(Number(b.dataset.likeGallery),b)});
  box.querySelectorAll('[data-gallery-page]').forEach(b=>b.onclick=()=>viewport.scrollTo({left:Number(b.dataset.galleryPage)*pageWidth(),behavior:'smooth'}));
  box.querySelector('.gallery-all-button').onclick=()=>openGallery(0);
  let raf=0; viewport.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    const page=Math.max(0,Math.min(pages-1,Math.round(viewport.scrollLeft/pageWidth())));
    loadGalleryPage(page);
    box.querySelectorAll('.gallery-page-dot').forEach((d,i)=>d.classList.toggle('active',i===Math.min(page,4)));
  })},{passive:true});
}
function openGallery(index){
  const photos=galleryPhotos(); if(!photos.length)return; galleryIndex=(index+photos.length)%photos.length;
  let box=$(".gallery-lightbox");
  if(!box){box=document.createElement("div");box.className="gallery-lightbox";box.innerHTML=`<button class="gallery-close" aria-label="Cerrar">×</button><button class="gallery-nav gallery-prev" aria-label="Anterior">‹</button><img alt="Fotografía ampliada"><button class="gallery-nav gallery-next" aria-label="Siguiente">›</button><div class="gallery-counter"></div>`;document.body.appendChild(box);box.querySelector(".gallery-close").onclick=closeGallery;box.querySelector(".gallery-prev").onclick=e=>{e.stopPropagation();openGallery(galleryIndex-1)};box.querySelector(".gallery-next").onclick=e=>{e.stopPropagation();openGallery(galleryIndex+1)};box.onclick=e=>{if(e.target===box)closeGallery()};}
  box.querySelector("img").src=gallerySrc(photos[galleryIndex]); box.querySelector(".gallery-counter").textContent=`${galleryIndex+1} / ${photos.length}`; document.body.classList.add("gallery-open");
}
function closeGallery(){ $(".gallery-lightbox")?.remove(); document.body.classList.remove("gallery-open"); }
document.addEventListener("keydown",e=>{if($(".gallery-lightbox")){if(e.key==="Escape")closeGallery();if(e.key==="ArrowLeft")openGallery(galleryIndex-1);if(e.key==="ArrowRight")openGallery(galleryIndex+1);}});
renderSchoolGallery();
