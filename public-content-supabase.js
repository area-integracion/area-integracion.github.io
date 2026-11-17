/* V38 · Contenido público dinámico. Mantiene fallback local si Supabase no responde. */
(async function(){
 const cfg=window.NA_SUPABASE;if(!cfg?.url||!cfg?.anonKey)return;const h={apikey:cfg.anonKey};
 const get=async p=>{let r=await fetch(`${cfg.url}/rest/v1/${p}`,{headers:h,cache:'no-store'});if(!r.ok)throw Error(String(r.status));return r.json()};
 try{
  const [ev,don,lec,contactos,areas]=await Promise.all([
   get('eventos?select=*&activo=eq.true&order=fecha.asc'),
   get('donaciones?select=*&activo=eq.true&order=sede.asc,orden.asc,id.asc'),
   get('lecturas?select=*&publicado=eq.true&order=orden.asc.nullslast'),
   get('configuracion_contactos?select=*'),
   get('areas_contacto?select=*')
  ]);
  if(Array.isArray(ev)&&ev.length&&typeof EVENTOS_IMPORTANTES!=='undefined'){EVENTOS_IMPORTANTES.splice(0,EVENTOS_IMPORTANTES.length,...ev.map(e=>({...e,id:e.slug||String(e.id),nombre:e.nombre||e.titulo||'Evento'})));}
  if(Array.isArray(don)&&don.length&&typeof DONACIONES_FALLBACK!=='undefined'){DONACIONES_FALLBACK.splice(0,DONACIONES_FALLBACK.length,...don);}
  if(Array.isArray(lec)&&typeof LECTURAS_FALLBACK!=='undefined'){LECTURAS_FALLBACK.splice(0,LECTURAS_FALLBACK.length,...lec.map(r=>({...r,id:String(r.id),contenido:r.contenido||r.texto||'',pregunta_final:r.pregunta_final||r.reflexion||''})));}

  if(Array.isArray(areas)&&typeof AREAS_SERVICIO!=='undefined'){areas.forEach(c=>{const a=AREAS_SERVICIO.find(x=>x.id===c.area_id);if(a){a.encargado=c.encargado||'';a.whatsapp=c.whatsapp||'';a.fotoPortada=c.foto_portada||a.fotoPortada||'';}});if(typeof renderSpaces==='function')renderSpaces();}
  const branchContacts=Array.isArray(contactos)?contactos:[];
  const branchDonations=Array.isArray(don)?don:[];
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const drawBranchDonations=(sede,gridId,contactId,key,fallback)=>{
   const contact=branchContacts.find(x=>x.clave===key)||{nombre:fallback,whatsapp:''};
   const grid=document.getElementById(gridId),contactBox=document.getElementById(contactId);
   if(!grid||!contactBox)return;
   const items=branchDonations.filter(x=>(x.sede||'Julio Sumar')===sede);
   let phone=String(contact.whatsapp||'').replace(/[^0-9]/g,'');if(phone.length===9)phone='51'+phone;
   const name=contact.nombre||fallback;
   contactBox.innerHTML='<div class="branch-donation-responsible"><span>Responsable</span><strong>'+escapeHtml(name)+'</strong>'+(phone?'<a class="primary-btn" target="_blank" rel="noopener" href="https://wa.me/'+phone+'?text='+encodeURIComponent('Hola '+name+', me gustaría coordinar una donación para la sede '+sede+'.')+'">Coordinar por WhatsApp →</a>':'<small>Contacto pendiente de actualización</small>')+'</div>';
   grid.innerHTML=items.length?items.map(x=>'<article class="branch-donation-item '+(x.conseguido?'done':'')+'"><span class="branch-donation-symbol">'+(x.conseguido?'✓':'✧')+'</span><div><strong>'+escapeHtml(x.nombre)+'</strong><small>'+escapeHtml(x.categoria||'Donación')+' · '+(x.conseguido?'Ya fue conseguido':'Necesario')+'</small></div></article>').join(''):'<p class="branch-donation-empty">Por ahora no hay necesidades publicadas para esta sede. Cuando se requiera algún material, aquí se indicará qué puedes donar.</p>';
  };
  drawBranchDonations('Julio Sumar','donationGridSumar','donationContactSumar','donaciones_sumar','Malu');
  drawBranchDonations('El Tambo','donationGridTambo','donationContactTambo','donaciones_eltambo','Angie');
  const dc=Array.isArray(contactos)?contactos.find(x=>x.clave==='donaciones'):null;
  if(dc){window.NA_DONATION_CONTACT={nombre:dc.nombre||'Nataly Carhuamaca',whatsapp:dc.whatsapp||'51938137626'};if(typeof window.NA_RENDER_DONATIONS==='function')window.NA_RENDER_DONATIONS();}
  // Los renderizadores existentes se reconstruyen con los datos nuevos.
  if(typeof renderImportantEvents==='function')renderImportantEvents();
  if(typeof window.NA_RENDER_READINGS==='function')window.NA_RENDER_READINGS(typeof LECTURAS_FALLBACK!=='undefined'?LECTURAS_FALLBACK:[]);
  window.dispatchEvent(new Event('na-public-content-updated'));
 }catch(e){console.warn('Contenido dinámico: usando respaldo local.',e)}
})();
