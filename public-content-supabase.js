/* V38 · Contenido público dinámico. Mantiene fallback local si Supabase no responde. */
(async function(){
 const cfg=window.NA_SUPABASE;if(!cfg?.url||!cfg?.anonKey)return;const h={apikey:cfg.anonKey};
 const get=async p=>{let r=await fetch(`${cfg.url}/rest/v1/${p}`,{headers:h,cache:'no-store'});if(!r.ok)throw Error(String(r.status));return r.json()};
 try{
  const [ev,don,lec,contactos,areas]=await Promise.all([
   get('eventos?select=*&activo=eq.true&order=fecha.asc'),
   get('donaciones?select=*&activo=eq.true&order=id.asc'),
   get('lecturas?select=*&publicado=eq.true&order=orden.asc.nullslast'),
   get('configuracion_contactos?select=*'),
   get('areas_contacto?select=*')
  ]);
  if(Array.isArray(ev)&&ev.length&&typeof EVENTOS_IMPORTANTES!=='undefined'){EVENTOS_IMPORTANTES.splice(0,EVENTOS_IMPORTANTES.length,...ev.map(e=>({...e,id:e.slug||String(e.id),nombre:e.nombre||e.titulo||'Evento'})));}
  if(Array.isArray(don)&&don.length&&typeof DONACIONES_FALLBACK!=='undefined'){DONACIONES_FALLBACK.splice(0,DONACIONES_FALLBACK.length,...don);}
  if(Array.isArray(lec)&&typeof LECTURAS_FALLBACK!=='undefined'){LECTURAS_FALLBACK.splice(0,LECTURAS_FALLBACK.length,...lec.map(r=>({...r,id:String(r.id),contenido:r.contenido||r.texto||'',pregunta_final:r.pregunta_final||r.reflexion||''})));}

  if(Array.isArray(areas)&&typeof AREAS_SERVICIO!=='undefined'){areas.forEach(c=>{const a=AREAS_SERVICIO.find(x=>x.id===c.area_id);if(a){a.encargado=c.encargado||'';a.whatsapp=c.whatsapp||'';a.fotoPortada=c.foto_portada||a.fotoPortada||'';}});if(typeof renderSpaces==='function')renderSpaces();}
  const dc=Array.isArray(contactos)?contactos.find(x=>x.clave==='donaciones'):null;
  if(dc){window.NA_DONATION_CONTACT={nombre:dc.nombre||'Nataly Carhuamaca',whatsapp:dc.whatsapp||'51938137626'};if(typeof window.NA_RENDER_DONATIONS==='function')window.NA_RENDER_DONATIONS();}
  // Los renderizadores existentes se reconstruyen con los datos nuevos.
  if(typeof renderImportantEvents==='function')renderImportantEvents();
  if(typeof window.NA_RENDER_READINGS==='function')window.NA_RENDER_READINGS(typeof LECTURAS_FALLBACK!=='undefined'?LECTURAS_FALLBACK:[]);
  window.dispatchEvent(new Event('na-public-content-updated'));
 }catch(e){console.warn('Contenido dinámico: usando respaldo local.',e)}
})();
