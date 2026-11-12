(()=>{'use strict';
const $=id=>document.getElementById(id),cfg=window.NA_SUPABASE;
const say=(t,kind='')=>{$('notice').textContent=t;$('notice').className=kind};
if(!cfg||!window.supabase){say('No se pudo cargar el sistema.');return}
const sb=window.supabase.createClient(cfg.url,cfg.anonKey);
let own=null,blocks=[];
const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
function show(logged){$('auth').hidden=logged;$('dashboard').hidden=!logged}
function tab(name){
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-selected',String(b.dataset.tab===name))});
 document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function findOwn(user){
 let q=await sb.from('instructores').select('*').eq('usuario_id',user.id).eq('activo',true).maybeSingle();
 if(!q.error&&q.data)return q.data;
 const p=await sb.from('personas').select('id').eq('usuario_id',user.id).maybeSingle();
 if(p.error||!p.data)return null;
 q=await sb.from('instructores').select('*').eq('persona_id',p.data.id).eq('activo',true).maybeSingle();
 return q.error?null:q.data;
}
function paintBlocks(){
 const box=$('scheduleRows');
 box.innerHTML=blocks.map((b,i)=>'<div class="schedule-row"><select data-day="'+i+'">'+days.map((d,n)=>'<option value="'+(n+1)+'" '+(Number(b.dia)===n+1?'selected':'')+'>'+d+'</option>').join('')+'</select><input type="time" data-start="'+i+'" value="'+esc(String(b.hora_inicio||'').slice(0,5))+'"><input type="time" data-end="'+i+'" value="'+esc(String(b.hora_fin||'').slice(0,5))+'"><button type="button" class="remove" data-remove="'+i+'">Quitar</button></div>').join('')||'<p class="muted">Aún no registras horarios de atención.</p>';
 box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{blocks.splice(Number(b.dataset.remove),1);paintBlocks()});
}
function renderPhoto(src){const box=$('photoPreview');box.innerHTML=src?'<img src="'+esc(src)+'" alt="Tu fotografía de perfil">':'<span>'+esc((own?.nombre||'I').split(/\s+/).slice(0,2).map(x=>x[0]).join('')||'I')+'</span>'}
async function loadProfile(){
 renderPhoto(own.foto||'');
 $('profileName').value=own.nombre||'';
 $('profileEmail').value=own.correo||'';
 $('profilePhone').value=own.celular||own.whatsapp||'';
 $('profileDuration').value=String(own.duracion_minutos||60);
 const q=await sb.from('disponibilidad_instructores').select('dia,hora_inicio,hora_fin').eq('instructor_id',own.id).eq('activo',true).order('dia');
 if(q.error){$('profileMsg').textContent='No se pudieron cargar tus horarios: '+q.error.message;return}
 blocks=(q.data||[]).map(x=>({...x}));paintBlocks();
}
async function loadBookings(){
 const box=$('bookingList');box.innerHTML='<p class="muted">Cargando asesorías…</p>';
 const q=await sb.rpc('listar_reservas_asesoria_panel');
 if(q.error){box.textContent='No se pudieron cargar tus asesorías: '+q.error.message;return}
 const rows=(q.data||[]).filter(r=>Number(r.instructor_id)===Number(own.id));
 box.innerHTML=rows.length?rows.map(r=>'<article class="item"><strong>'+esc(r.fecha)+' · '+esc(String(r.hora||'').slice(0,5))+'</strong><p>'+esc(r.nombre_persona||'')+'</p><p>Estado: '+esc(r.estado||'confirmada')+'</p>'+(r.whatsapp_persona?'<p>'+esc(r.whatsapp_persona)+'</p>':'')+'</article>').join(''):'<p class="muted">Aún no tienes asesorías registradas.</p>';
}
async function loadRequests(){
 const box=$('requestList');box.innerHTML='<p class="muted">Cargando solicitudes…</p>';
 const q=await sb.rpc('listar_solicitudes_horario_panel');
 if(q.error){box.textContent='No se pudieron cargar las solicitudes: '+q.error.message;return}
 const rows=(q.data||[]).filter(r=>Number(r.instructor_id)===Number(own.id)&&String(r.estado||'pendiente').toLowerCase()==='pendiente');
 box.innerHTML=rows.length?rows.map(r=>{const phone=String(r.whatsapp_persona||'').replace(/\D/g,'');const wa=phone.length===9?'51'+phone:phone;return '<article class="item"><strong>'+esc(r.nombre_persona||'Solicitud')+'</strong><p>'+esc(r.fecha_preferida)+' · '+esc(String(r.hora_preferida||'').slice(0,5))+'</p>'+(r.mensaje?'<p>'+esc(r.mensaje)+'</p>':'')+(wa?'<a target="_blank" rel="noopener" href="https://wa.me/'+wa+'">WhatsApp</a> ':'')+'<button data-request-state="aceptada" data-id="'+r.solicitud_id+'">Aceptar</button> <button class="remove" data-request-state="rechazada" data-id="'+r.solicitud_id+'">Rechazar</button></article>'}).join(''):'<p class="muted">No tienes solicitudes pendientes.</p>';
 box.querySelectorAll('[data-request-state]').forEach(b=>b.onclick=async()=>{const state=b.dataset.requestState;if(!confirm(state==='aceptada'?'¿Aceptar esta solicitud?':'¿Rechazar esta solicitud?'))return;b.disabled=true;const x=await sb.rpc('actualizar_solicitud_horario',{p_solicitud_id:Number(b.dataset.id),p_estado:state});if(x.error){say('No se pudo actualizar la solicitud: '+x.error.message,'error');b.disabled=false;return}say('Solicitud actualizada.','success');await loadRequests()});
}
async function refresh(){
 const {data:{user},error}=await sb.auth.getUser();if(error||!user){show(false);return}
 own=await findOwn(user);
 if(!own){show(false);say('Tu cuenta aún no está vinculada a una ficha de instructor activa. Solicita al responsable que revise tu acceso.','error');return}
 show(true);$('greeting').textContent='Hola, '+own.nombre;
 await Promise.all([loadProfile(),loadBookings(),loadRequests()]);
}
$('login').onsubmit=async e=>{e.preventDefault();say('Ingresando…');try{const response=await fetch(cfg.url+'/functions/v1/instructor-acceso',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.anonKey},body:JSON.stringify({action:'login',dni:$('dni').value.trim(),password:$('password').value})});const result=await response.json();if(!response.ok||!result.session)throw new Error('DNI o clave incorrectos.');const x=await sb.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});if(x.error)throw x.error;say('');await refresh()}catch(e){say(e.message||'No se pudo ingresar.','error')}};

$('profilePhoto').onchange=()=>{const file=$('profilePhoto').files?.[0];$('uploadPhoto').disabled=!file;$('photoMsg').textContent='';if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){$('photoMsg').textContent='Elige una imagen JPG, PNG o WEBP de máximo 5 MB.';$('uploadPhoto').disabled=true;return}renderPhoto(URL.createObjectURL(file))}else renderPhoto(own?.foto||'')};
$('uploadPhoto').onclick=async()=>{const file=$('profilePhoto').files?.[0];if(!file||!own)return;const btn=$('uploadPhoto'),msg=$('photoMsg');btn.disabled=true;msg.textContent='Subiendo fotografía…';let newPath=null;try{const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];newPath=own.id+'/perfil-'+Date.now()+'.'+ext;const up=await sb.storage.from('instructores').upload(newPath,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(up.error)throw up.error;const publicUrl=sb.storage.from('instructores').getPublicUrl(newPath).data.publicUrl;const saved=await sb.rpc('admin_guardar_instructor',{p_id:Number(own.id),p_nombre:own.nombre,p_correo:own.correo||null,p_celular:own.celular||null,p_foto:publicUrl,p_duracion_minutos:Number(own.duracion_minutos||60),p_activo:true});if(saved.error)throw saved.error;const old=own.foto;own.foto=publicUrl;$('profilePhoto').value='';renderPhoto(publicUrl);msg.textContent='Tu fotografía se actualizó correctamente.';say('Fotografía actualizada.','success');if(old){try{const marker='/storage/v1/object/public/instructores/';const pos=old.indexOf(marker);if(pos>=0){const oldPath=decodeURIComponent(old.slice(pos+marker.length).split('?')[0]);if(oldPath&&oldPath!==newPath)await sb.storage.from('instructores').remove([oldPath])}}catch(cleanErr){console.warn('No se pudo retirar la foto anterior:',cleanErr)}}}catch(err){if(newPath)await sb.storage.from('instructores').remove([newPath]);msg.textContent='No se pudo actualizar la fotografía: '+(err.message||err);say('No se pudo actualizar la fotografía.','error');btn.disabled=false}};
$('addSchedule').onclick=()=>{blocks.push({dia:1,hora_inicio:'09:00',hora_fin:'10:00'});paintBlocks()};
$('profileForm').onsubmit=async e=>{e.preventDefault();const msg=$('profileMsg');msg.textContent='Guardando…';try{const name=$('profileName').value.trim(),email=$('profileEmail').value.trim()||null,phone=$('profilePhone').value.trim()||null,duration=Number($('profileDuration').value);if(!name)throw new Error('Escribe tu nombre.');const rr=await sb.rpc('admin_guardar_instructor',{p_id:Number(own.id),p_nombre:name,p_correo:email,p_celular:phone,p_foto:own.foto||null,p_duracion_minutos:duration,p_activo:true});if(rr.error)throw rr.error;const prepared=blocks.map((b,i)=>({dia:Number(document.querySelector('[data-day="'+i+'"]')?.value??b.dia),hora_inicio:document.querySelector('[data-start="'+i+'"]')?.value??String(b.hora_inicio).slice(0,5),hora_fin:document.querySelector('[data-end="'+i+'"]')?.value??String(b.hora_fin).slice(0,5)}));for(const b of prepared){if(!b.hora_inicio||!b.hora_fin||b.hora_inicio>=b.hora_fin)throw new Error('Revisa los horarios: la hora final debe ser posterior a la inicial.')}const ra=await sb.rpc('admin_reemplazar_disponibilidad_instructor',{p_instructor_id:Number(own.id),p_bloques:prepared});if(ra.error)throw ra.error;own.nombre=name;own.correo=email;own.celular=phone;own.duracion_minutos=duration;blocks=prepared;paintBlocks();msg.textContent='Perfil y horarios guardados correctamente.';say('Cambios guardados.','success');$('greeting').textContent='Hola, '+own.nombre}catch(err){msg.textContent='No se pudo guardar: '+(err.message||err);say('No se pudieron guardar tus cambios.','error')}};
$('logout').onclick=async()=>{await sb.auth.signOut();show(false);say('Sesión cerrada.')};
refresh().catch(()=>say('No se pudo verificar el acceso.','error'));
})();