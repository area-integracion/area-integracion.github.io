// V33 · módulos de integración
(function(){
 const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
 function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

 // Definición visible de la virtud seleccionada
 const oldSearch=window.searchVirtue;
 if(typeof oldSearch==="function"){
   window.searchVirtue=function(q){
     oldSearch(q);
     q=(q||$("#virtueInput")?.value||"").trim(); if(!q)return;
     const key=Object.keys(SIGNIFICADO_VIRTUDES||{}).find(v=>normalize(v)===normalize(q));
     const meaning=key?SIGNIFICADO_VIRTUDES[key]:"Una cualidad que podemos cultivar conscientemente a través de nuestras elecciones y acciones.";
     const box=$("#virtueResults"); if(!box)return;
     box.insertAdjacentHTML("afterbegin",`<div class="virtue-definition"><span class="eyebrow">VIRTUD PARA CULTIVAR</span><h3>${esc(key||q)}</h3><p>${esc(meaning)}</p><small>Espacios donde puedes cultivarla ↓</small></div>`);
   };
   $$("[data-v]").forEach(b=>b.onclick=()=>{$("#virtueInput").value=b.dataset.v;window.searchVirtue(b.dataset.v)});
   $("#virtueBtn").onclick=()=>window.searchVirtue();
   $("#virtueInput").oninput=e=>window.searchVirtue(e.target.value);
 }

 // Agenda descargable como PNG — generador propio, funciona también desde file://
 const download=$("#downloadAgenda");
 function wrapCanvas(ctx,text,maxWidth){const words=String(text||"").split(/\s+/),lines=[];let line="";for(const w of words){const test=line?line+" "+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);return lines}
 function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke()}
 function loadDataImage(src){return new Promise(resolve=>{if(!src)return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src})}
 if(download) download.onclick=async()=>{
   const original=download.textContent;download.disabled=true;download.textContent="Preparando imagen…";
   try{
     const monday=mondayOf(addDays(new Date(),weekOffset*7)), sunday=addDays(monday,6), days=Array.from({length:7},(_,i)=>addDays(monday,i));
     const occ=generate(monday,sunday); const W=1600, pad=54, gap=14, col=(W-pad*2-gap*6)/7;
     const perDay=days.map(d=>occ.filter(a=>a.fecha===iso(d))); const maxN=Math.max(1,...perDay.map(x=>x.length));
     const cardH=136, cardGap=12, headerH=230, legendH=110, H=headerH+maxN*(cardH+cardGap)+legendH;
     const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
     ctx.fillStyle='#f7f3eb';ctx.fillRect(0,0,W,H);
     ctx.fillStyle='#173f34';ctx.font='700 20px Inter, Arial';ctx.fillText('NUEVA ACRÓPOLIS · HUANCAYO',pad,48);
     ctx.font='500 52px Georgia, serif';ctx.fillText('Agenda semanal',pad,108);
     ctx.font='400 21px Inter, Arial';ctx.fillStyle='#6f685d';ctx.fillText(`${monday.getDate()} – ${sunday.getDate()} de ${MONTHS[sunday.getMonth()]} de ${sunday.getFullYear()}`,pad,146);
     ctx.strokeStyle='#cdbb92';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(pad,168);ctx.lineTo(W-pad,168);ctx.stroke();

     const sedeStyle=sede=>{
       const n=normalize(sede||'');
       if(n.includes('tambo')) return {bg:'#e8b657',border:'#d39a31',text:'#173f34',label:'EL TAMBO'};
       if(n.includes('sumar')) return {bg:'#adc9b0',border:'#8eaf92',text:'#173f34',label:'JULIO SUMAR'};
       return {bg:'#ebe9e4',border:'#d4d0c7',text:'#173f34',label:'SAN CARLOS'};
     };
     const fitLines=(text,maxWidth,maxLines=3)=>{
       let size=22, lines=[];
       while(size>=16){ctx.font=`700 ${size}px Georgia, serif`;lines=wrapCanvas(ctx,text,maxWidth);if(lines.length<=maxLines)break;size-=1}
       if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(last.length>2&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last+'…'}
       return {size,lines};
     };

     for(let di=0;di<7;di++){
       const d=days[di], x=pad+di*(col+gap), items=perDay[di];
       // Encabezado institucional del día
       ctx.fillStyle='#173f34';ctx.strokeStyle='#173f34';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,184,col,42,9);ctx.fill();
       ctx.fillStyle='#fffdf8';ctx.font='700 20px Georgia, serif';ctx.textAlign='center';ctx.fillText(['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'][di],x+col/2,211);ctx.textAlign='left';
       // Fecha más visible debajo del día
       ctx.fillStyle='#514b42';ctx.font='600 16px Inter, Arial';ctx.fillText(`${d.getDate()} de ${MONTHS[d.getMonth()]}`,x,248);
       for(let j=0;j<items.length;j++){
         const a=items[j], y=264+j*(cardH+cardGap), st=sedeStyle(a.sede);
         ctx.fillStyle=st.bg;ctx.strokeStyle=st.border;ctx.lineWidth=1.3;rounded(ctx,x,y,col,cardH,12);
         ctx.fillStyle=st.text;ctx.font='700 16px Inter, Arial';ctx.fillText(fmtTime(a.hora),x+13,y+25);
         const fitted=fitLines(a.nombre,col-26,3);ctx.font=`700 ${fitted.size}px Georgia, serif`;
         fitted.lines.forEach((ln,k)=>ctx.fillText(ln,x+13,y+53+k*(fitted.size+2)));
         ctx.font='700 12px Inter, Arial';ctx.globalAlpha=.82;ctx.fillText(st.label,x+13,y+cardH-13);ctx.globalAlpha=1;
       }
       if(!items.length){ctx.fillStyle='#aaa095';ctx.font='italic 15px Georgia, serif';ctx.fillText('Sin actividades',x,292)}
     }

     const ly=H-66;ctx.strokeStyle='#d8ccb5';ctx.beginPath();ctx.moveTo(pad,ly-22);ctx.lineTo(W-pad,ly-22);ctx.stroke();
     const legend=[['#ebe9e4','#d4d0c7','SAN CARLOS'],['#e8b657','#d39a31','EL TAMBO'],['#adc9b0','#8eaf92','JULIO SUMAR']];
     let lx=pad;ctx.font='700 13px Inter, Arial';
     legend.forEach(([bg,border,label])=>{ctx.fillStyle=bg;ctx.strokeStyle=border;ctx.beginPath();ctx.roundRect(lx,ly,22,22,5);ctx.fill();ctx.stroke();ctx.fillStyle='#173f34';ctx.fillText(label,lx+31,ly+16);lx+=150;});
     ctx.fillStyle='#9a742b';ctx.font='600 12px Inter, Arial';ctx.textAlign='right';ctx.fillText('FILOSOFÍA · CULTURA · VOLUNTARIADO',W-pad,ly+16);ctx.textAlign='left';
     const a=document.createElement('a');a.download=`agenda-nueva-acropolis-${iso(monday)}.png`;a.href=canvas.toDataURL('image/png');document.body.appendChild(a);a.click();a.remove();
   }catch(err){alert('No pude generar la imagen. Inténtalo nuevamente.');console.error('Agenda PNG:',err)}
   finally{download.disabled=false;download.textContent=original}
 };

 // Lecturas tipo pequeño libro — preparado para textos largos
 const readings=Array.isArray(window.LECTURAS_FALLBACK)?window.LECTURAS_FALLBACK:(typeof LECTURAS_FALLBACK!=="undefined"?LECTURAS_FALLBACK:[]);
 function renderReadings(list=readings){const g=$("#readingGrid");if(!g)return;g.innerHTML=list.map(r=>`<button class="reading-card ${r.imagen?'has-cover':''}" data-reading="${esc(r.id)}">${r.imagen?`<img class="reading-cover" src="${esc(r.imagen)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}<span class="book-spine"></span><span class="eyebrow">${esc(r.virtud||r.tema||"LECTURA")}</span><h3>${esc(r.titulo)}</h3><p>${esc(r.autor||"Nueva Acrópolis")}</p><small>Leer · ${Math.max(1,Math.ceil((r.contenido||"").split(/\s+/).length/180))} min →</small></button>`).join(""); $$('[data-reading]').forEach(b=>b.onclick=()=>openReading(b.dataset.reading))}
 window.NA_RENDER_READINGS=renderReadings;
 function paginateReading(text,targetWords=300){
   const paras=String(text||"").split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean), pages=[]; let current=[], count=0;
   paras.forEach(par=>{
     const words=par.split(/\s+/);
     if(words.length>targetWords){
       if(current.length){pages.push(current);current=[];count=0}
       for(let i=0;i<words.length;i+=targetWords) pages.push([words.slice(i,i+targetWords).join(" ")]);
     } else {
       if(count && count+words.length>targetWords){pages.push(current);current=[];count=0}
       current.push(par);count+=words.length;
     }
   });
   if(current.length)pages.push(current); return pages.length?pages:[[""]];
 }
 function openReading(id){const r=readings.find(x=>String(x.id)===String(id));if(!r)return;const pages=paginateReading(r.contenido,300);let page=0;
   show(`<div class="mini-book"><div class="book-cover"><span>PEQUEÑA LECTURA</span><h2>${esc(r.titulo)}</h2><p>${esc(r.autor||"")}</p><div class="book-meta">${esc(r.tema||r.virtud||"Filosofía para la vida")}</div></div><div class="book-progress"><i id="bookProgress"></i></div><div class="book-page" id="bookPage"></div><div class="book-controls"><button id="bookPrev" aria-label="Página anterior">‹</button><span id="bookCount"></span><button id="bookNext" aria-label="Página siguiente">›</button></div></div>`);
   const paint=()=>{const el=$("#bookPage");el.innerHTML=pages[page].map(p=>`<p>${esc(p)}</p>`).join("")+(page===pages.length-1&&r.pregunta_final?`<div class="reflection"><span>PARA LLEVAR CONTIGO</span><p>${esc(r.pregunta_final)}</p></div>`:"");$("#bookCount").textContent=`${page+1} / ${pages.length}`;$("#bookPrev").disabled=page===0;$("#bookNext").disabled=page===pages.length-1;$("#bookProgress").style.width=`${((page+1)/pages.length)*100}%`;el.scrollTop=0};
   $("#bookPrev").onclick=()=>{if(page>0){page--;paint()}};$("#bookNext").onclick=()=>{if(page<pages.length-1){page++;paint()}};paint();
 }
 renderReadings();
 const rs=$("#readingSearch");if(rs)rs.oninput=e=>{const q=normalize(e.target.value);renderReadings(readings.filter(r=>normalize([r.titulo,r.autor,r.tema,r.virtud,r.contenido].join(" ")).includes(q)))};

 // Donaciones — tarjetas visuales e interactivas; luego se alimentarán desde Supabase
 const donations=typeof DONACIONES_FALLBACK!=="undefined"?DONACIONES_FALLBACK:[];
 const donationIcon=name=>{const n=normalize(name);if(/jabon|desinfect|lejia|deterg|lavavaj|cera|limpia/.test(n))return "✦";if(/escoba|recogedor|trapeador|franela|secador/.test(n))return "⌁";if(/papel|hojas/.test(n))return "▤";if(/cinta/.test(n))return "◇";if(/bolsa/.test(n))return "◌";return "✧"};
 const dg=$("#donationGrid");
 const renderDonations=()=>{if(!dg)return;const c=window.NA_DONATION_CONTACT||{nombre:"Nataly Carhuamaca",whatsapp:"51938137626"};const groups=[...new Set(donations.map(x=>x.categoria))];dg.innerHTML=groups.map(cat=>`<article class="donation-card"><div class="donation-card-head"><span class="eyebrow">${esc(cat)}</span><small>${donations.filter(x=>x.categoria===cat&&!x.conseguido).length} por conseguir</small></div><div class="donation-items">${donations.filter(x=>x.categoria===cat).map(x=>{const msg=encodeURIComponent(`Hola ${c.nombre}, vi en la página de Nueva Acrópolis que necesitan ${x.nombre} y me gustaría colaborar con esta donación. ¿Cómo podemos coordinar la entrega?`);return `<a target="_blank" rel="noopener" href="https://wa.me/${c.whatsapp}?text=${msg}" class="donation-item ${x.conseguido?'done':''}"><span class="donation-icon">${donationIcon(x.nombre)}</span><span class="donation-copy"><b>${esc(x.nombre)}</b><small>${x.conseguido?'Gracias, ya fue conseguido':'Toca para colaborar'}</small></span><span class="donation-status">${x.conseguido?'✓':'→'}</span></a>`}).join("")}</div></article>`).join("");const info=$("#donationContactInfo");if(info){info.innerHTML=`Responsable: <strong>${esc(c.nombre||"Nataly")}</strong> · WhatsApp: <strong>${esc(c.whatsapp||"938 137 626")}</strong>`;}const btn=$("#donationContactBtn");if(btn){const msg=encodeURIComponent(`Hola ${c.nombre}, vi la sección de Donaciones – Sede San Carlos en la página de Nueva Acrópolis y me gustaría colaborar. ¿Qué materiales necesitan con mayor prioridad?`);btn.href=`https://wa.me/${c.whatsapp}?text=${msg}`;}};window.NA_RENDER_DONATIONS=renderDonations;renderDonations();
})();
