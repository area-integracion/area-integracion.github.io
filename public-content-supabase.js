/* V39 · Carga pública independiente: una consulta lenta no bloquea las demás secciones. */
(async function(){
 const cfg=window.NA_SUPABASE;
 if(!cfg?.url||!cfg?.anonKey)return;
 const headers={apikey:cfg.anonKey};
 const get=async path=>{
  const response=await fetch(`${cfg.url}/rest/v1/${path}`,{headers,cache:'default'});
  if(!response.ok)throw Error('Supabase '+response.status+' · '+path);
  return response.json();
 };
 const safe=(name,promise,handler)=>promise.then(data=>{try{handler(data)}catch(error){console.warn('No se pudo actualizar '+name,error)}}).catch(error=>console.warn('No se pudo cargar '+name,error));
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let donations=null,contacts=null;
 const renderBranchDonations=()=>{
  if(!Array.isArray(donations)||!Array.isArray(contacts))return;
  const draw=(sede,gridId,contactId,key,fallback)=>{
   const contact=contacts.find(x=>x.clave===key)||{nombre:fallback,whatsapp:''};
   const grid=document.getElementById(gridId),contactBox=document.getElementById(contactId);
   if(!grid||!contactBox)return;
   let phone=String(contact.whatsapp||'').replace(/[^0-9]/g,'');if(phone.length===9)phone='51'+phone;
   if(phone){contactBox.hidden=false;contactBox.innerHTML='<p>Contacto para coordinar: <a href="https://wa.me/'+phone+'" target="_blank" rel="noopener">WhatsApp</a></p>';}
   else{contactBox.hidden=true;contactBox.innerHTML='';}
   const items=donations.filter(x=>(x.sede||'Julio Sumar')===sede);
   grid.innerHTML=items.length?items.map(x=>{
    const message=encodeURIComponent('Hola, me gustaría coordinar una donación de '+x.nombre+' para la sede '+sede+'.');
    const inner='<span class="branch-donation-symbol">'+(x.conseguido?'✓':'✧')+'</span><div><strong>'+escapeHtml(x.nombre)+'</strong><small>'+escapeHtml(x.categoria||'Donación')+' · '+(x.conseguido?'Ya fue conseguido':'Necesario')+'</small></div>';
    return phone?'<a class="branch-donation-item donation-whatsapp-item '+(x.conseguido?'done':'')+'" href="https://wa.me/'+phone+'?text='+message+'" target="_blank" rel="noopener" aria-label="Coordinar donación de '+escapeHtml(x.nombre)+' por WhatsApp">'+inner+'</a>':'<article class="branch-donation-item '+(x.conseguido?'done':'')+'">'+inner+'</article>';
   }).join(''):'<p class="branch-donation-empty">Por ahora no hay necesidades publicadas para esta sede. Cuando se requiera algún material, aquí se indicará qué puedes donar.</p>';

  };
  draw('Julio Sumar','donationGridSumar','donationContactSumar','donaciones_sumar','Malu');
  draw('El Tambo','donationGridTambo','donationContactTambo','donaciones_eltambo','Angie');
 };
 // Cada bloque se actualiza apenas termina su propia consulta.
 safe('eventos',get('eventos?select=*&activo=eq.true&order=fecha.asc'),ev=>{
  if(Array.isArray(ev)&&typeof EVENTOS_IMPORTANTES!=='undefined'){
   EVENTOS_IMPORTANTES.splice(0,EVENTOS_IMPORTANTES.length,...ev.map(e=>({...e,id:e.slug||String(e.id),nombre:e.nombre||e.titulo||'Evento'})));
   if(typeof renderImportantEvents==='function')renderImportantEvents();
   if(typeof renderWeek==='function')renderWeek();
  }
 });
 safe('donaciones',get('donaciones?select=*&activo=eq.true&order=sede.asc,orden.asc,id.asc'),data=>{
  if(!Array.isArray(data))return;
  donations=data;
  const general=data.filter(x=>!x.sede||x.sede==='General'||x.sede==='San Carlos');
  if(typeof DONACIONES_FALLBACK!=='undefined')DONACIONES_FALLBACK.splice(0,DONACIONES_FALLBACK.length,...general);
  if(typeof window.NA_RENDER_DONATIONS==='function')window.NA_RENDER_DONATIONS();
  renderBranchDonations();
 });
 safe('lecturas',get('lecturas?select=*&publicado=eq.true&order=orden.asc.nullslast'),data=>{
  if(Array.isArray(data)&&typeof LECTURAS_FALLBACK!=='undefined'){
   LECTURAS_FALLBACK.splice(0,LECTURAS_FALLBACK.length,...data.map(r=>({...r,id:String(r.id),contenido:r.contenido||r.texto||'',pregunta_final:r.pregunta_final||r.reflexion||''})));
   if(typeof window.NA_RENDER_READINGS==='function')window.NA_RENDER_READINGS(LECTURAS_FALLBACK);
  }
 });
 safe('contactos',get('configuracion_contactos?select=*'),data=>{
  contacts=Array.isArray(data)?data:[];
  const dc=contacts.find(x=>x.clave==='donaciones');
  if(dc){window.NA_DONATION_CONTACT={nombre:dc.nombre||'Nataly Carhuamaca',whatsapp:dc.whatsapp||'51938137626'};if(typeof window.NA_RENDER_DONATIONS==='function')window.NA_RENDER_DONATIONS();}
  renderBranchDonations();
 });
 safe('áreas y espacios',get('areas_contacto?select=*'),areas=>{
  if(Array.isArray(areas)&&typeof AREAS_SERVICIO!=='undefined'){
   areas.forEach(c=>{const a=AREAS_SERVICIO.find(x=>x.id===c.area_id);if(a){a.encargado=c.encargado||'';a.whatsapp=c.whatsapp||'';a.fotoPortada=c.foto_portada||a.fotoPortada||'';}});
   if(typeof renderSpaces==='function')renderSpaces();
  }
 });
 window.dispatchEvent(new Event('na-public-content-updated'));
})();
