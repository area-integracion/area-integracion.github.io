(function(){
  const cfg=window.NA_SUPABASE||{};
  const msg=document.querySelector('#authMsg');
  const form=document.querySelector('#loginForm');
  const passwordForm=document.querySelector('#passwordForm');
  const panel=document.querySelector('#adminPanel');
  const login=document.querySelector('.admin-login');
  const recoverBtn=document.querySelector('#recoverBtn');
  const title=document.querySelector('#authTitle');
  const intro=document.querySelector('#authIntro');
  const sessionLabel=document.querySelector('#sessionLabel');
  let settingPassword=false;

  function say(text,type){msg.textContent=text||'';msg.className='auth-msg'+(type?' '+type:'');}
  function urlAuthType(){
    const all=(location.search+' '+location.hash).toLowerCase();
    if(all.includes('type=invite')) return 'invite';
    if(all.includes('type=recovery')) return 'recovery';
    return '';
  }
  function showPasswordMode(kind){
    settingPassword=true;
    login.hidden=false; panel.hidden=true; form.hidden=true; recoverBtn.hidden=true; passwordForm.hidden=false;
    title.textContent=kind==='recovery'?'Crea una nueva contraseña':'Completa tu acceso';
    intro.textContent=kind==='recovery'?'Elige una nueva contraseña para volver a ingresar al panel.':'Tu invitación fue aceptada. Solo falta crear tu contraseña personal.';
    say('');
  }
  function showLoginMode(){
    settingPassword=false;
    login.hidden=false; panel.hidden=true; form.hidden=false; recoverBtn.hidden=false; passwordForm.hidden=true;
    title.textContent='Panel de gestión'; intro.textContent='Acceso para personas autorizadas de Integración Huancayo.';
  }
  async function showSession(){
    const {data}=await sb.auth.getSession();
    if(settingPassword) return;
    if(data.session){
      login.hidden=true; panel.hidden=false;
      if(sessionLabel){
         sessionLabel.textContent=data.session.user.email||'';
         const {data:instructor,error:instructorError}=await sb.from('instructores').select('nombre').eq('usuario_id',data.session.user.id).limit(1).maybeSingle();
         if(!instructorError && instructor?.nombre) sessionLabel.textContent='Instructor: '+instructor.nombre;
       }
      await initPrivateModules(data.session.user);
    } else showLoginMode();
  }

  if(!cfg.url||!cfg.anonKey||cfg.anonKey.includes('PEGAR_AQUI')){say('Falta conectar Supabase para activar el acceso.','error');return;}
  const sb=supabase.createClient(cfg.url,cfg.anonKey);
  window.__naAdminSb=sb;

  let loginWithDni=false;
  const byEmail=document.querySelector('#loginByEmail'),byDni=document.querySelector('#loginByDni');
  const emailWrap=document.querySelector('#loginEmailWrap'),dniWrap=document.querySelector('#loginDniWrap'),dniInput=document.querySelector('#loginDni');
  function selectLoginMethod(dni){loginWithDni=dni;emailWrap.hidden=dni;dniWrap.hidden=!dni;loginEmail.required=!dni;dniInput.required=dni;byEmail.setAttribute('aria-pressed',String(!dni));byDni.setAttribute('aria-pressed',String(dni));recoverBtn.hidden=dni;say('');}
  byEmail.onclick=()=>selectLoginMethod(false);
  byDni.onclick=()=>selectLoginMethod(true);
  form.onsubmit=async e=>{
    e.preventDefault(); say('Ingresando…');
    let error;
    if(loginWithDni){
      try{
        const response=await fetch(cfg.url+'/functions/v1/instructor-acceso',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.anonKey},body:JSON.stringify({action:'login',dni:dniInput.value.trim(),password:loginPassword.value})});
        const result=await response.json();
        if(!response.ok||!result.session)throw new Error('DNI o contraseña incorrectos.');
        const authResult=await sb.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
        error=authResult.error;
      }catch(ex){error=ex;}
    }else{
      const result=await sb.auth.signInWithPassword({email:loginEmail.value.trim(),password:loginPassword.value});
      error=result.error;
    }
    if(error){say('No pudimos iniciar sesión. Revisa tu correo y contraseña.','error');return;}
    say(''); await showSession();
  };

  passwordForm.onsubmit=async e=>{
    e.preventDefault();
    const p=newPassword.value, r=repeatPassword.value;
    if(p.length<8){say('La contraseña debe tener al menos 8 caracteres.','error');return;}
    if(p!==r){say('Las contraseñas no coinciden.','error');return;}
    say('Guardando tu contraseña…');
    const {error}=await sb.auth.updateUser({password:p});
    if(error){say('No pudimos guardar la contraseña: '+error.message,'error');return;}
    settingPassword=false;
    history.replaceState({},document.title,location.pathname);
    say('Contraseña guardada correctamente.','success');
    await showSession();
  };

  recoverBtn.onclick=async()=>{
    const email=loginEmail.value.trim();
    if(!email){say('Escribe primero tu correo.','error');return;}
    const redirectTo='https://nuevaacropolis.github.io/Integraci-n-Nueva-Acr-polis/admin.html';
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
    say(error?'No pudimos enviar el correo: '+error.message:'Revisa tu correo para continuar.',error?'error':'success');
  };


  const ROLE_LABELS={
    administrador:'Administrador/a', instructor:'Instructor/a', jefe_taller:'Jefe de taller',
    encargado_lecturas:'Encargado/a de lecturas', encargado_donaciones:'Encargado/a de donaciones',
    responsable_asesorias:'Responsable de asesorías'
  };
  const MODULE_LABELS={talleres:'Talleres',donaciones:'Donaciones',lecturas:'Lecturas',asesorias:'Asesorías',virtudes:'Virtudes',talleres_virtudes:'Talleres de virtudes'};
  const AREA_OPTIONS=[['integracion','Integración'],['tecnica','Técnica'],['difusion','Difusión'],['cafeteria','Cafetería'],['redes','Redes'],['cultura','Promoción de Cultura y Biblioteca'],['escolastica-prob','Escolástica · Probacionismo'],['escolastica-miembros','Escolástica · Miembros']];
  const ROLE_KEYS=Object.keys(ROLE_LABELS);
  const peopleModule=document.querySelector('#peopleModule'), peopleList=document.querySelector('#peopleList');
  const personModal=document.querySelector('#personModal'), personForm=document.querySelector('#personForm');
  const roleGrid=document.querySelector('#roleGrid');
  const moduleGrid=document.querySelector('#moduleGrid'), areaModuleGrid=document.querySelector('#areaModuleGrid');
  let canManagePeople=false, peopleCache=[], respCache=[], moduleRespCache=[];

  function esc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
  function roleInputs(selected=[]){
    roleGrid.innerHTML=ROLE_KEYS.map(k=>`<label class="role-option"><input type="checkbox" name="roles" value="${k}" ${selected.includes(k)?'checked':''}> <span>${ROLE_LABELS[k]}</span></label>`).join('');
  }
  function moduleInputs(personId=null){
    const assigned=moduleRespCache.filter(x=>String(x.persona_id)===String(personId));
    moduleGrid.innerHTML=Object.entries(MODULE_LABELS).map(([k,label])=>`<label class="role-option"><input type="checkbox" name="modules" value="${k}" ${assigned.some(x=>x.modulo===k)?'checked':''}> <span>${label}</span></label>`).join('');
    areaModuleGrid.innerHTML=AREA_OPTIONS.map(([k,label])=>`<label class="role-option"><input type="checkbox" name="areas" value="${k}" ${assigned.some(x=>x.modulo==='area'&&x.area_id===k)?'checked':''}> <span>${label}</span></label>`).join('');
  }
  function openPerson(person=null){
    personForm.reset(); document.querySelector('#personActive').checked=true; document.querySelector('#personMsg').textContent='';
    document.querySelector('#personId').value=person?.id||'';
    document.querySelector('#personTitle').textContent=person?'Editar persona':'Agregar persona';
    document.querySelector('#personName').value=person?.nombre_apellido||'';
    document.querySelector('#personEmail').value=person?.correo||'';
    document.querySelector('#personWhatsapp').value=person?.whatsapp||'';
    document.querySelector('#personDni').value=person?.dni||'';
    document.querySelector('#personPassword').value='';
    document.querySelector('#personActive').checked=person?person.activo!==false:true;
    const selected=person?respCache.filter(r=>r.persona_id===person.id).map(r=>r.responsabilidad):[];
    roleInputs(selected); moduleInputs(person?.id||null); personModal.hidden=false;
  }
  function closePerson(){personModal.hidden=true;}
  function renderPeople(){
    if(!peopleCache.length){peopleList.innerHTML='<div class="empty-people"><strong>Aún no hay personas registradas.</strong><br>Pulsa “+ Agregar persona” para hacer nuestra primera prueba.</div>';return;}
    peopleList.innerHTML=peopleCache.map(p=>{
      const roles=respCache.filter(r=>r.persona_id===p.id).map(r=>r.responsabilidad);
      return `<div class="person-row">
        <div><div class="person-name">${esc(p.nombre_apellido)}</div><span class="status-chip ${p.activo?'':'off'}">${p.activo?'Activa':'Inactiva'}</span></div>
        <div class="person-contact">${p.dni?'DNI: '+esc(p.dni):'<em>Sin DNI</em>'}<br>${p.correo?esc(p.correo):'<em>Sin correo</em>'}<br>${p.whatsapp?'WhatsApp: '+esc(p.whatsapp):''}</div>
        <div class="role-chips">${roles.length?roles.map(r=>`<span class="role-chip">${esc(ROLE_LABELS[r]||r)}</span>`).join(''):'<span class="role-chip">Sin responsabilidades</span>'}</div>
        <div class="person-row-actions"><button class="mini-btn" data-edit="${p.id}">Editar</button><button class="mini-btn" data-invite="${p.id}">Acceso DNI</button><button class="mini-btn danger-btn" data-delete-person="${p.id}">Eliminar</button></div>
      </div>`;
    }).join('');
    peopleList.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openPerson(peopleCache.find(p=>String(p.id)===String(b.dataset.edit))));
    peopleList.querySelectorAll('[data-invite]').forEach(b=>b.onclick=()=>openPerson(peopleCache.find(p=>String(p.id)===String(b.dataset.invite))));
    peopleList.querySelectorAll('[data-delete-person]').forEach(b=>b.onclick=()=>deletePerson(b.dataset.deletePerson));
  }

  async function deletePerson(id){
    const p=peopleCache.find(x=>String(x.id)===String(id)); if(!p)return;
    if(!confirm(`¿Eliminar a ${p.nombre_apellido}?

Se quitarán sus responsabilidades y ya no tendrá acceso a los módulos asignados.`))return;
    try{
      // V38.16: la eliminación se hace mediante RPC segura; el navegador no toca roles_usuario directamente.
      const rr=await sb.rpc('admin_eliminar_persona',{p_persona_id:Number(id)});
      if(rr.error) throw rr.error;
      await loadPeople();
    }catch(e){alert('No se pudo eliminar: '+(e?.message||e));}
  }

  async function invitePerson(id,btn){
    const p=peopleCache.find(x=>String(x.id)===String(id)); if(!p?.correo){alert('Primero agrega un correo a esta persona.');return;}
    const old=btn.textContent; btn.disabled=true; btn.textContent='Enviando…';
    try{
      // Releer la fila directamente de Supabase antes de invitar para no depender del dataset del botón.
      const fresh=await sb.from('personas').select('id,nombre_apellido,correo,activo').eq('id',p.id).maybeSingle();
      if(fresh.error) throw fresh.error;
      const persona=fresh.data||p;
      const correo=String(persona.correo||p.correo||'').trim().toLowerCase();
      if(!correo) throw new Error('Esta persona no tiene correo registrado.');
      const roles=respCache.filter(r=>String(r.persona_id)===String(p.id)).map(r=>r.responsabilidad);
      const {data,error}=await sb.functions.invoke('invitar-persona',{body:{persona_id:persona.id,correo:correo,email:correo,nombre_apellido:persona.nombre_apellido||p.nombre_apellido,roles}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      alert(data?.message||'Invitación enviada.'); await loadPeople();
    }catch(e){
      let detalle=e?.message||String(e);
      try{
        if(e?.context){
          const res=e.context;
          const raw=await res.clone().text();
          if(raw){
            try{
              const j=JSON.parse(raw);
              detalle=j.error||j.message||raw;
            }catch(_){ detalle=raw; }
          }
          if(res.status) detalle=`${detalle} (HTTP ${res.status})`;
        }
      }catch(_){ }
      console.error('invitar-persona:',e);
      alert('No se pudo enviar el acceso: '+detalle);
    }
    finally{btn.disabled=false;btn.textContent=old;}
  }

  async function loadPeople(){
    peopleList.innerHTML='<p class="admin-dev-note">Cargando personas…</p>';
    const [a,b,c]=await Promise.all([
      sb.from('personas').select('id,nombre_apellido,correo,whatsapp,dni,activo,usuario_id,created_at').order('nombre_apellido'),
      sb.from('responsabilidades_persona').select('id,persona_id,responsabilidad'),
      sb.from('responsabilidades_modulo').select('id,persona_id,modulo,area_id')
    ]);
    if(a.error||b.error||c.error){peopleList.innerHTML=`<div class="empty-people">No pudimos cargar Personas y permisos.<br><small>${esc(a.error?.message||b.error?.message||c.error?.message||'')}</small></div>`;return;}
    peopleCache=a.data||[];respCache=b.data||[];moduleRespCache=c.data||[];renderPeople();
  }
  async function initPrivateModules(user){
    // V37L3: comprobación segura del rol sin depender del SELECT/RLS de roles_usuario.
    const adminCheck=await sb.rpc('es_admin_actual');
    const isAdmin=!adminCheck.error && adminCheck.data===true;
    let roles=[];
    if(!isAdmin){
      // Leer los roles de la cuenta actual mediante RPC segura.
      const r=await sb.rpc('mis_roles_actuales');
      if(!r.error) roles=(r.data||[]).map(x=>typeof x==='string'?x:x.rol).filter(Boolean);
    }
    window.__naIsAdmin=isAdmin;
    window.__naRoles=isAdmin?['administrador']:roles;
    canManagePeople=isAdmin;
    const [pTalleres,pDonaciones,pLecturas,pAsesorias,pVirtudes,pTalleresVirtudes,...pAreas]=await Promise.all([
      sb.rpc('puede_gestionar_modulo',{p_modulo:'talleres'}),
      sb.rpc('puede_gestionar_modulo',{p_modulo:'donaciones'}),
      sb.rpc('puede_gestionar_modulo',{p_modulo:'lecturas'}),
      sb.rpc('puede_gestionar_modulo',{p_modulo:'asesorias'}),
      sb.rpc('puede_gestionar_modulo',{p_modulo:'virtudes'}),
      sb.rpc('puede_gestionar_modulo',{p_modulo:'talleres_virtudes'}),
      ...['integracion','tecnica','difusion','cafeteria','redes','cultura','escolastica-prob','escolastica-miembros'].map(area_id=>sb.rpc('puede_gestionar_area',{p_area_id:area_id}))
    ]);
    const canModule=(r)=>!r?.error&&r.data===true;
    const areaIds=['integracion','tecnica','difusion','cafeteria','redes','cultura','escolastica-prob','escolastica-miembros'];
    const canArea=pAreas.some(canModule);
    window.__naModulePerms={talleres:canModule(pTalleres),donaciones:canModule(pDonaciones),lecturas:canModule(pLecturas),asesorias:canModule(pAsesorias),virtudes:canModule(pVirtudes),talleres_virtudes:canModule(pTalleresVirtudes),areas:Object.fromEntries(areaIds.map((id,i)=>[id,canModule(pAreas[i])]))};
    // Un instructor nunca se convierte en gestor por tener acceso al módulo Asesorías. Solo el rol explícito responsable_asesorias (o administrador) habilita la vista global.
    const ownInstructor=await sb.from('instructores').select('id').eq('usuario_id',user.id).eq('activo',true).limit(1);
    const isInstructor=roles.includes('instructor')||(!ownInstructor.error&&(ownInstructor.data||[]).length>0);
    window.__naIsInstructor=isInstructor;
    window.__naInstructorOnly=!isAdmin&&isInstructor&&!roles.includes('responsable_asesorias');
    canManageAgenda=isAdmin||roles.includes('jefe_taller')||canModule(pTalleres)||canModule(pTalleresVirtudes);
    const canManageAdvice=isAdmin||roles.includes('responsable_asesorias')||canModule(pAsesorias);
    // Mostrar SOLO los módulos autorizados.
    const visibility={
      agendaShortcut:canManageAgenda,
      adviceShortcut:isAdmin||roles.includes('instructor')||canManageAdvice,
      instructorsShortcut:isAdmin||roles.includes('instructor')||canManageAdvice,
      eventsShortcut:isAdmin,
      donationsShortcut:isAdmin||roles.includes('encargado_donaciones')||canModule(pDonaciones),
      areasShortcut:isAdmin,
      readingsShortcut:isAdmin||roles.includes('encargado_lecturas')||canModule(pLecturas),
      peopleShortcut:isAdmin,
      virtuesShortcut:isAdmin||canModule(pVirtudes)
    };
    Object.entries(visibility).forEach(([id,ok])=>{const el=document.getElementById(id);if(el)el.hidden=!ok;});

    if(agendaAdminModule) agendaAdminModule.hidden=!canManageAgenda;
    if(canManageAgenda) await loadActivitiesAdmin();
    if(peopleModule) peopleModule.hidden=!canManagePeople;
    if(canManagePeople) await loadPeople();
  }
  document.querySelector('#addPersonBtn').onclick=()=>openPerson();
  document.querySelector('#personClose').onclick=closePerson;
  document.querySelector('#cancelPerson').onclick=closePerson;
  personModal.addEventListener('click',e=>{if(e.target===personModal)closePerson();});
  personForm.onsubmit=async e=>{
    e.preventDefault(); if(!canManagePeople)return;
    const pm=document.querySelector('#personMsg'); pm.textContent='Guardando…'; pm.className='auth-msg';
    const id=document.querySelector('#personId').value.trim()||null;
    const dni=document.querySelector('#personDni').value.trim(), password=document.querySelector('#personPassword').value;
    if(dni && !/^\d{8}$/.test(dni)){pm.textContent='El DNI debe tener exactamente 8 dígitos.';pm.className='auth-msg error';return;}
    if(password && password.length<10){pm.textContent='La contraseña debe tener al menos 10 caracteres.';pm.className='auth-msg error';return;}
    if(password && !dni){pm.textContent='Para crear o restablecer el acceso, primero ingresa el DNI.';pm.className='auth-msg error';return;}
    const payload={nombre_apellido:document.querySelector('#personName').value.trim(),correo:document.querySelector('#personEmail').value.trim()||null,whatsapp:document.querySelector('#personWhatsapp').value.trim()||null,dni:dni||null,activo:document.querySelector('#personActive').checked,updated_at:new Date().toISOString()};
    const selected=[...personForm.querySelectorAll('input[name=roles]:checked')].map(x=>x.value);
    const modules=[...personForm.querySelectorAll('input[name=modules]:checked')].map(x=>({modulo:x.value,area_id:null}));
    const areas=[...personForm.querySelectorAll('input[name=areas]:checked')].map(x=>({modulo:'area',area_id:x.value}));
    let personId=id, res;
    if(id) res=await sb.from('personas').update(payload).eq('id',id).select('id').single();
    else res=await sb.from('personas').insert(payload).select('id').single();
    if(res.error){pm.textContent='No pudimos guardar: '+res.error.message;pm.className='auth-msg error';return;}
    personId=res.data.id;
    const sync=await sb.rpc('admin_guardar_responsabilidades_persona',{p_persona_id:Number(personId),p_roles:selected});
    if(sync.error){pm.textContent='La persona se guardó, pero no pudimos actualizar sus roles: '+sync.error.message;pm.className='auth-msg error';return;}
    const moduleSync=await sb.rpc('admin_guardar_responsabilidades_modulo',{p_persona_id:Number(personId),p_asignaciones:[...modules,...areas]});
    if(moduleSync.error){pm.textContent='La persona se guardó, pero no pudimos guardar sus responsabilidades por módulo: '+moduleSync.error.message;pm.className='auth-msg error';return;}
    if(password){
      try{
        const sessionResult=await sb.auth.getSession(), accessToken=sessionResult.data?.session?.access_token;
        if(!accessToken)throw new Error('La sesión administrativa expiró. Vuelve a ingresar.');
        const response=await fetch(cfg.url+'/functions/v1/instructor-acceso',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.anonKey,'Authorization':'Bearer '+accessToken},body:JSON.stringify({action:'create_person_account',persona_id:Number(personId),dni,password})});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo crear o actualizar la cuenta.');
      }catch(err){pm.textContent='La persona y sus permisos se guardaron, pero el acceso no se pudo crear: '+(err.message||err);pm.className='auth-msg error';return;}
    }
    pm.textContent=password?'Persona, responsabilidades y acceso DNI guardados ✓':'Persona y responsabilidades guardadas ✓';pm.className='auth-msg success';
    await loadPeople();setTimeout(closePerson,900);
  };
  document.querySelector('#peopleShortcut').onclick=()=>{if(canManagePeople)peopleModule.scrollIntoView({behavior:'smooth'});};



  // V37L · Agenda y talleres
  const agendaAdminModule=document.querySelector('#agendaAdminModule'), activityAdminList=document.querySelector('#activityAdminList');
  const activityModal=document.querySelector('#activityModal'), activityForm=document.querySelector('#activityForm');
  const exceptionModal=document.querySelector('#exceptionModal'), exceptionForm=document.querySelector('#exceptionForm');
  const DAY_NAMES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  let canManageAgenda=false, activityCache=[];
  function activityDayInputs(selected=[]){document.querySelector('#activityDays').innerHTML=DAY_NAMES.map((n,i)=>`<label class="day-check"><input type="checkbox" name="activityDays" value="${i+1}" ${selected.includes(i+1)?'checked':''}> ${n}</label>`).join('');}
  function activityPhotoSrc(value){if(!value)return'';return /^(https?:|data:|blob:)/i.test(value)?value:`img/actividades/${value}`;}
  function showActivityPhoto(value){const preview=document.querySelector('#activityPhotoPreview'),img=document.querySelector('#activityPhotoPreviewImg');if(!value){preview.hidden=true;img.removeAttribute('src');return;}img.src=activityPhotoSrc(value);preview.hidden=false;}
  function openActivityAdmin(a=null){activityForm.reset();document.querySelector('#activityId').value=a?.id||'';document.querySelector('#activityTitle').textContent=a?'Editar taller':'Nuevo taller';document.querySelector('#activityName').value=a?.nombre||'';document.querySelector('#activityVenue').value=a?.sede||'San Carlos';document.querySelector('#activityTime').value=(a?.hora||'18:00').slice(0,5);document.querySelector('#activityFrom').value=a?.desde||new Date().toISOString().slice(0,10);document.querySelector('#activityTo').value=a?.hasta||'2027-12-31';document.querySelector('#activityLead').value=a?.encargado||'';document.querySelector('#activityWhatsapp').value=a?.whatsapp||'';document.querySelector('#activityPhrase').value=a?.frase||'';document.querySelector('#activityPhoto').value=a?.foto||'';showActivityPhoto(a?.foto||'');document.querySelector('#activityActive').checked=a?a.activo!==false:true;activityDayInputs(a?.dias||[]);document.querySelector('#activityFormMsg').textContent='';activityModal.hidden=false;}
  async function uploadActivityPhoto(){const input=document.querySelector('#activityPhotoFile'),file=input?.files?.[0];if(!file)return document.querySelector('#activityPhoto').value.trim()||null;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('La fotografía debe ser JPG, PNG o WEBP.');if(file.size>8*1024*1024)throw new Error('La fotografía supera el máximo de 8 MB.');const ext=(file.name.split('.').pop()||'webp').toLowerCase();const path=`agenda/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await sb.storage.from('actividades').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;return sb.storage.from('actividades').getPublicUrl(path).data.publicUrl;}
  function closeActivityAdmin(){activityModal.hidden=true;}
  function slugify(v){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);}
  function renderActivityAdmin(){const q=(document.querySelector('#activitySearch').value||'').toLowerCase(), st=document.querySelector('#activityStatus').value;let rows=activityCache.filter(a=>(!q||a.nombre.toLowerCase().includes(q))&&(st==='all'||(st==='active'?a.activo!==false:a.activo===false)));if(!rows.length){activityAdminList.innerHTML='<div class="empty-people">No hay actividades con este filtro.</div>';return;}activityAdminList.innerHTML=rows.map(a=>`<div class="activity-admin-row"><div><div class="activity-admin-name">${esc(a.nombre)}</div><span class="status-chip ${a.activo?'':'off'}">${a.activo?'Activa':'Finalizada'}</span></div><div class="activity-admin-meta">${(a.dias||[]).map(d=>DAY_NAMES[d-1]).join(', ')||'Sin día'}<br><strong>${esc((a.hora||'').slice(0,5))}</strong></div><div class="activity-admin-meta">${esc(a.sede||'')}<br>${esc(a.desde||'')} → ${esc(a.hasta||'')}</div><div class="activity-admin-actions"><button class="mini-btn" data-aedit="${a.id}">Editar</button><button class="mini-btn" data-aexception="${a.id}">Una fecha</button><button class="mini-btn" data-atoggle="${a.id}">${a.activo?'Finalizar':'Reactivar'}</button></div></div>`).join('');activityAdminList.querySelectorAll('[data-aedit]').forEach(b=>b.onclick=()=>openActivityAdmin(activityCache.find(a=>a.id===Number(b.dataset.aedit))));activityAdminList.querySelectorAll('[data-aexception]').forEach(b=>b.onclick=()=>openException(activityCache.find(a=>a.id===Number(b.dataset.aexception))));activityAdminList.querySelectorAll('[data-atoggle]').forEach(b=>b.onclick=()=>toggleActivity(Number(b.dataset.atoggle)));}
  async function loadActivitiesAdmin(){activityAdminList.innerHTML='<p class="admin-dev-note">Cargando agenda…</p>';const {data,error}=await sb.from('actividades').select('id,slug,nombre,dias,hora,sede,desde,hasta,encargado,whatsapp,foto,frase,activo').order('nombre');if(error){activityAdminList.innerHTML=`<div class="empty-people">No pudimos cargar la agenda.<br><small>${esc(error.message)}</small></div>`;return;}activityCache=data||[];renderActivityAdmin();}
  async function toggleActivity(id){const a=activityCache.find(x=>x.id===id);if(!a)return;const {error}=await sb.from('actividades').update({activo:!a.activo}).eq('id',id);if(error){alert('No se pudo actualizar: '+error.message);return;}await loadActivitiesAdmin();}
  function openException(a){exceptionForm.reset();document.querySelector('#exceptionActivityId').value=a.id;document.querySelector('#exceptionTitle').textContent=a.nombre;document.querySelector('#exceptionDate').value='';document.querySelector('#exceptionType').value='cancelar';document.querySelector('#newTimeWrap').hidden=true;document.querySelector('#exceptionMsg').textContent='';exceptionModal.hidden=false;}
  function closeException(){exceptionModal.hidden=true;}
  document.querySelector('#addActivityBtn').onclick=()=>openActivityAdmin();document.querySelector('#activityClose').onclick=closeActivityAdmin;document.querySelector('#cancelActivityEdit').onclick=closeActivityAdmin;activityModal.addEventListener('click',e=>{if(e.target===activityModal)closeActivityAdmin();});
  document.querySelector('#activityPhotoFile').onchange=e=>{const file=e.target.files?.[0];if(file)showActivityPhoto(URL.createObjectURL(file));};
  document.querySelector('#exceptionClose').onclick=closeException;document.querySelector('#cancelException').onclick=closeException;exceptionModal.addEventListener('click',e=>{if(e.target===exceptionModal)closeException();});document.querySelector('#exceptionType').onchange=e=>document.querySelector('#newTimeWrap').hidden=e.target.value!=='cambiar_hora';document.querySelector('#activitySearch').oninput=renderActivityAdmin;document.querySelector('#activityStatus').onchange=renderActivityAdmin;
  activityForm.onsubmit=async e=>{e.preventDefault();if(!canManageAgenda)return;const m=document.querySelector('#activityFormMsg'),id=Number(document.querySelector('#activityId').value)||null,days=[...activityForm.querySelectorAll('[name=activityDays]:checked')].map(x=>Number(x.value));if(!days.length){m.textContent='Selecciona al menos un día.';m.className='auth-msg error';return;}const name=document.querySelector('#activityName').value.trim();m.textContent=document.querySelector('#activityPhotoFile').files?.[0]?'Subiendo fotografía…':'Guardando…';m.className='auth-msg';try{const photo=await uploadActivityPhoto();const payload={nombre:name,dias:days,hora:document.querySelector('#activityTime').value,sede:document.querySelector('#activityVenue').value,desde:document.querySelector('#activityFrom').value,hasta:document.querySelector('#activityTo').value,encargado:document.querySelector('#activityLead').value.trim()||null,whatsapp:document.querySelector('#activityWhatsapp').value.trim()||null,frase:document.querySelector('#activityPhrase').value.trim()||null,foto:photo,activo:document.querySelector('#activityActive').checked};if(!id)payload.slug=slugify(name)+'-'+Date.now().toString().slice(-5);const r=id?await sb.from('actividades').update(payload).eq('id',id):await sb.from('actividades').insert(payload);if(r.error)throw r.error;m.textContent='Guardado correctamente ✓';m.className='auth-msg success';await loadActivitiesAdmin();setTimeout(closeActivityAdmin,600);}catch(err){m.textContent='No pudimos guardar: '+(err?.message||err);m.className='auth-msg error';}};
  exceptionForm.onsubmit=async e=>{e.preventDefault();if(!canManageAgenda)return;const m=document.querySelector('#exceptionMsg'),activity_id=Number(document.querySelector('#exceptionActivityId').value),fecha=document.querySelector('#exceptionDate').value,type=document.querySelector('#exceptionType').value;if(type==='cancelar'){const r=await sb.from('actividades_canceladas').upsert({actividad_id,fecha},{onConflict:'actividad_id,fecha'});if(r.error){m.textContent='No pudimos cancelar: '+r.error.message;m.className='auth-msg error';return;}}else{const hora=document.querySelector('#exceptionNewTime').value;if(!hora){m.textContent='Indica la nueva hora.';m.className='auth-msg error';return;}const r=await sb.from('actividad_excepciones').upsert({actividad_id,fecha,hora,note:document.querySelector('#exceptionNote').value.trim()||null},{onConflict:'actividad_id,fecha'});if(r.error){m.textContent='Falta activar la tabla de cambios especiales. Ejecuta el SQL incluido en V37L. Detalle: '+r.error.message;m.className='auth-msg error';return;}}m.textContent='Cambio guardado ✓';m.className='auth-msg success';setTimeout(closeException,600);};
  document.querySelector('#agendaShortcut').onclick=async()=>{
    if(!canManageAgenda){ alert('Tu cuenta inició sesión, pero aún no tiene permiso para gestionar la agenda.'); return; }
    agendaAdminModule.hidden=false;
    await loadActivitiesAdmin();
    agendaAdminModule.scrollIntoView({behavior:'smooth',block:'start'});
  };

  document.querySelector('#logoutBtn').onclick=async()=>{await sb.auth.signOut();showLoginMode();say('Sesión cerrada.','success');};

  const initialType=urlAuthType();
  if(initialType) showPasswordMode(initialType);

  sb.auth.onAuthStateChange(async(event)=>{
    if(event==='PASSWORD_RECOVERY') showPasswordMode('recovery');
    else if(event==='SIGNED_IN' && urlAuthType()==='invite') showPasswordMode('invite');
    else if(!settingPassword) await showSession();
  });

  setTimeout(async()=>{
    const t=urlAuthType();
    if(t) showPasswordMode(t); else await showSession();
  },150);
})();

/* V38 · Gestor integral: Asesorías, Eventos, Donaciones y Lecturas */
(function(){
 const db=window.__naAdminSb;
 // Reutiliza EXACTAMENTE la sesión autenticada del panel principal.
 if(!db) return;
 const $=s=>document.querySelector(s), esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const manager=$('#contentManager'), list=$('#cmList'), modal=$('#cmModal'), fields=$('#cmFields'); let mode=null, rows=[], adviceAvailability=[];
 const defs={
  events:{title:'Eventos especiales',intro:'Crea, actualiza, publica u oculta eventos ocasionales.',table:'eventos',label:'evento',fields:[['titulo','Nombre','text',1],['tipo','Tipo','text'],['fecha','Fecha','date',1],['hora','Hora','time'],['sede','Sede','select','San Carlos|El Tambo|Julio Sumar'],['descripcion','Descripción breve','textarea'],['detalle','Información completa','textarea'],['modalidad_pago','Ingreso','select','Gratuito|De pago'],['costo','Costo (S/) · dejar vacío si es gratuito','number'],['solo_miembros','Solo para miembros','checkbox'],['foto','Imagen','file'],['whatsapp','WhatsApp de contacto (opcional)','text'],['activo','Publicado','checkbox']]},
  areas:{title:'Áreas',intro:'Actualiza la fotografía de portada, responsable y WhatsApp de cada área desde este panel.',table:'areas_contacto',label:'área',fields:[['area_id','Área','select','integracion|tecnica|difusion|cafeteria|redes|cultura|escolastica-prob|escolastica-miembros'],['foto_portada','Fotografía de portada','file'],['encargado','Responsable','text',1],['whatsapp','WhatsApp','text',1]]},
  donations:{title:'Donaciones',intro:'Administra necesidades, categorías y lo que ya fue conseguido.',table:'donaciones',label:'donación',fields:[['nombre','Material','text',1],['categoria','Categoría','select','Limpieza|Otros|Materiales'],['prioridad','Prioridad','number'],['conseguido','Conseguido','checkbox'],['activo','Visible','checkbox']]},
  readings:{title:'Pequeñas lecturas',intro:'Publica y edita lecturas filosóficas desde el panel.',table:'lecturas',label:'lectura',fields:[['titulo','Título','text',1],['autor','Autor','text'],['tema','Tema','text'],['contenido','Texto completo','textarea',1],['pregunta_final','Pregunta de reflexión','textarea'],['imagen','Portada / imagen','file'],['orden','Orden','number'],['publicado','Publicado','checkbox']]},
  advice:{title:'Asesorías',intro:'Administra instructores y su configuración de atención.',table:'instructores',label:'instructor',fields:[['nombre','Nombre del instructor','text',1],['correo','Correo','email'],['celular','Celular / WhatsApp','text'],['foto','Foto','file'],['duracion_minutos','Duración por asesoría (min)','select','15|30|45|60|90'],['activo','Instructor activo','checkbox']]},
  virtues:{title:'Virtudes',intro:'Administra las virtudes y su significado filosófico.',table:'virtudes',label:'virtud',fields:[['nombre','Nombre de la virtud','text',1],['significado','Significado filosófico','textarea',1],['activo','Virtud activa','checkbox']]}
 };
 function fhtml(f,r){let [k,l,t,req]=f,val=r?.[k]??''; if(t==='file')return `<label class="cm-field"><span>${l}</span><input data-k="${k}" data-existing="${esc2(val)}" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG o WEBP${val?' · Ya hay una imagen guardada':''}</small></label>`; if(t==='checkbox')return `<label class="cm-field cm-check"><input data-k="${k}" type="checkbox" ${val!==false?'checked':''}> <span>${l}</span></label>`; if(t==='textarea')return `<label class="cm-field"><span>${l}</span><textarea data-k="${k}" rows="${k==='contenido'?10:4}" ${req===1?'required':''}>${esc2(val)}</textarea></label>`; if(t==='select'){let opts=String(req||'').split('|');return `<label class="cm-field"><span>${l}</span><select data-k="${k}">${opts.map(x=>`<option ${String(val)===x?'selected':''}>${x}</option>`).join('')}</select></label>`;} return `<label class="cm-field"><span>${l}</span><input data-k="${k}" type="${t}" value="${esc2(t==='time'?String(val).slice(0,5):val)}" ${req===1?'required':''}></label>`;}
 function allowed(m){const r=window.__naRoles||[],p=window.__naModulePerms||{};if(window.__naIsAdmin)return true;if(m==='virtues')return !!p.virtudes;if(m==='areas')return false;return m==='readings'?r.includes('encargado_lecturas')||!!p.lecturas:m==='donations'?r.includes('encargado_donaciones')||!!p.donaciones:m==='advice'?(r.includes('instructor')||r.includes('responsable_asesorias')||!!p.asesorias):false;}
 async function open(m){if(!allowed(m)){alert('Tu cuenta no tiene permiso para este módulo.');return;}mode=m;const d=defs[m];manager.hidden=false;$('#cmTitle').textContent=d.title;$('#cmIntro').textContent=d.intro;$('#cmAdd').textContent='+ Nuevo '+d.label;$('#cmAdd').hidden=m==='advice'&&!!window.__naInstructorOnly;const search=$('#cmSearch');if(search){search.value='';const searchWrap=search.closest('label')||search;searchWrap.hidden=m==='advice'&&!!window.__naInstructorOnly;}if(m==='advice'){
  await renderAdviceBookings();
  await renderAlternateRequests();
  setupAdviceNavigation();
}else{document.querySelector('#adviceBookings')?.remove();document.querySelector('#alternateRequests')?.remove();document.querySelector('#adviceNavigation')?.remove();}if(m==='donations') await renderDonationContactEditor(); else document.querySelector('#donationContactEditor')?.remove();await load();if(m==='advice')setAdviceView('instructors');manager.scrollIntoView({behavior:'smooth'});}
function setupAdviceNavigation(){
 let nav=document.querySelector('#adviceNavigation');
 if(!nav){nav=document.createElement('nav');nav.id='adviceNavigation';nav.setAttribute('aria-label','Secciones de asesorías');nav.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;padding:10px 0;border-bottom:1px solid #ddd1b9';manager.querySelector('.people-toolbar').after(nav);}
 const instructorOnly=!!window.__naInstructorOnly;
 nav.innerHTML=`<button type="button" class="mini-btn" data-advice-view="instructors">${instructorOnly?'Mi perfil':'Instructores'}</button><button type="button" class="mini-btn" data-advice-view="bookings">${instructorOnly?'Mis reservas':'Reservas'}</button><button type="button" class="mini-btn" data-advice-view="requests">Solicitudes de asesoría</button>`;
 nav.querySelectorAll('[data-advice-view]').forEach(b=>b.onclick=()=>setAdviceView(b.dataset.adviceView));
}
function setAdviceView(view){
 const nav=document.querySelector('#adviceNavigation');
 const bookings=document.querySelector('#adviceBookings'),requests=document.querySelector('#alternateRequests');
 list.hidden=view!=='instructors';if(bookings)bookings.hidden=view!=='bookings';if(requests)requests.hidden=view!=='requests';
 const search=$('#cmSearch');if(search){const wrap=search.closest('label')||search;wrap.hidden=view!=='instructors'||!!window.__naInstructorOnly;}
 const add=$('#cmAdd');if(add)add.hidden=view!=='instructors'||!!window.__naInstructorOnly;
 nav?.querySelectorAll('[data-advice-view]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.adviceView===view));b.classList.toggle('primary-btn',b.dataset.adviceView===view);});
}
async function renderDonationContactEditor(){
  let box=document.querySelector('#donationContactEditor');
  if(!box){box=document.createElement('section');box.id='donationContactEditor';box.style.cssText='margin:18px 0;padding:18px;border:1px solid #d8d2c4;border-radius:14px;background:#fffdf7';list.parentNode.insertBefore(box,list);}
  box.innerHTML='<h3 style="margin:0 0 6px">Responsable de donaciones</h3><p class="admin-dev-note">Cargando responsable…</p>';
  const q=await db.from('configuracion_contactos').select('clave,nombre,whatsapp').eq('clave','donaciones').maybeSingle();
  if(q.error){box.innerHTML='<h3 style="margin:0 0 6px">Responsable de donaciones</h3><p class="admin-dev-note">No se pudo cargar: '+esc2(q.error.message)+'</p>';return;}
  const c=q.data||{nombre:'Nataly Carhuamaca',whatsapp:'51938137626'};
  box.innerHTML=`<h3 style="margin:0 0 6px">Responsable de donaciones</h3><p class="admin-dev-note">Este contacto recibirá los mensajes enviados desde la página pública.</p><div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end"><label class="cm-field"><span>Nombre</span><input id="donationContactName" type="text" value="${esc2(c.nombre||'')}"></label><label class="cm-field"><span>WhatsApp</span><input id="donationContactWhatsapp" type="text" value="${esc2(c.whatsapp||'')}"></label><button type="button" class="mini-btn" id="saveDonationContact">Guardar responsable</button></div><p id="donationContactMsg" class="auth-msg" style="margin:8px 0 0"></p>`;
  box.querySelector('#saveDonationContact').onclick=async()=>{const btn=box.querySelector('#saveDonationContact'),msg=box.querySelector('#donationContactMsg');const nombre=box.querySelector('#donationContactName').value.trim();let whatsapp=box.querySelector('#donationContactWhatsapp').value.replace(/\D/g,'');if(!nombre||!whatsapp){msg.textContent='Completa nombre y WhatsApp.';msg.className='auth-msg error';return;}if(whatsapp.length===9)whatsapp='51'+whatsapp;btn.disabled=true;msg.textContent='Guardando…';msg.className='auth-msg';const r=await db.from('configuracion_contactos').upsert({clave:'donaciones',nombre,whatsapp,updated_at:new Date().toISOString()},{onConflict:'clave'});btn.disabled=false;if(r.error){msg.textContent='No se pudo guardar: '+r.error.message;msg.className='auth-msg error';return;}box.querySelector('#donationContactWhatsapp').value=whatsapp;msg.textContent='Responsable actualizado ✓';msg.className='auth-msg success';};
}
async function renderAlternateRequests(){
  let box=document.querySelector('#alternateRequests');

  if(!box){
    box=document.createElement('section');
    box.id='alternateRequests';
    box.style.cssText='margin:18px 0 18px;padding:18px;border:1px solid #d8d2c4;border-radius:14px;background:#fffdf7';

    const bookings=document.querySelector('#adviceBookings');
    if(bookings) bookings.parentNode.insertBefore(box,bookings);
    else list.parentNode.insertBefore(box,list);
  }

  box.innerHTML='<h3 style="margin:0 0 6px">Solicitudes de otro horario</h3><p class="admin-dev-note">Cargando solicitudes…</p>';

  const q=await db.rpc('listar_solicitudes_horario_panel');

  if(q.error){
    box.innerHTML='<h3>Solicitudes de otro horario</h3><p class="admin-dev-note">No se pudieron cargar: '+esc2(q.error.message)+'</p>';
    return;
  }

  const all=(q.data||[]).filter(r=>String(r.estado||'pendiente').toLowerCase()==='pendiente');

  box.innerHTML=`
    <h3 style="margin:0 0 6px">Solicitudes de otro horario</h3>
    <p class="admin-dev-note">Solicitudes pendientes de revisión.</p>
    <div id="alternateList"></div>
  `;

  const dest=box.querySelector('#alternateList');

  dest.innerHTML=all.length ? all.map(r=>{
    const phone=String(r.whatsapp_persona||'').replace(/\D/g,'');
    const wa=phone.length===9?'51'+phone:phone;

    const fecha=new Date(String(r.fecha_preferida)+'T12:00:00')
      .toLocaleDateString('es-PE',{
        weekday:'short',
        day:'numeric',
        month:'short'
      });

    return `
      <div class="activity-admin-row" style="align-items:center">

        <div class="cm-wide">
          <div class="cm-row-title">${esc2(r.nombre_persona)}</div>

          <div class="cm-row-sub">
            ${esc2(r.instructor_nombre||'')} ·
            ${esc2(fecha)} ·
            ${esc2(String(r.hora_preferida||'').slice(0,5))}
            ${r.whatsapp_persona?' · '+esc2(r.whatsapp_persona):''}
            ${r.correo_persona?' · '+esc2(r.correo_persona):''}
          </div>

          ${r.mensaje ? `
            <div class="cm-row-sub" style="margin-top:5px">
              “${esc2(r.mensaje)}”
            </div>
          `:''}
        </div>

        <div class="activity-admin-actions">

          ${wa ? `
            <a
              class="mini-btn"
              target="_blank"
              rel="noopener"
              href="https://wa.me/${wa}?text=${encodeURIComponent(
                `Hola ${r.nombre_persona}, te escribo de Nueva Acrópolis Huancayo por la solicitud de otro horario que enviaste para tu asesoría filosófica.`
              )}">
              WhatsApp
            </a>
          `:''}

          <button
            class="mini-btn"
            data-alt-state="aceptada"
            data-alt-id="${r.solicitud_id}">
            Aceptar
          </button>

          <button
            class="mini-btn danger"
            data-alt-state="rechazada"
            data-alt-id="${r.solicitud_id}">
            Rechazar
          </button>
          <button
  class="mini-btn danger"
  data-alt-delete="${r.solicitud_id}">
  Eliminar
</button>

        </div>
      </div>
    `;
  }).join('') :
  '<div class="empty-people">No hay solicitudes pendientes.</div>';

  dest.querySelectorAll('[data-alt-state]').forEach(b=>{

  b.onclick=async()=>{

    const solicitud=all.find(
      r=>Number(r.solicitud_id)===Number(b.dataset.altId)
    );

    if(!solicitud) return;

    const estado=b.dataset.altState;

    const x=await db.rpc('actualizar_solicitud_horario',{
      p_solicitud_id:Number(b.dataset.altId),
      p_estado:estado
    });

    if(x.error){
      alert('No se pudo actualizar: '+x.error.message);
      return;
    }

    let numero=String(solicitud.whatsapp_persona||'').replace(/\D/g,'');
    if(numero.length===9) numero='51'+numero;

    const nombre=String(solicitud.nombre_persona||'')
      .trim()
      .split(' ')[0];

    let mensaje='';

    if(estado==='aceptada'){

      const fecha=new Date(
        String(solicitud.fecha_preferida)+'T12:00:00'
      ).toLocaleDateString('es-PE',{
        weekday:'long',
        day:'numeric',
        month:'long'
      });

      const hora=new Date(
        `2000-01-01T${String(solicitud.hora_preferida).slice(0,5)}`
      ).toLocaleTimeString('es-PE',{
        hour:'numeric',
        minute:'2-digit'
      });

      mensaje=
`Hola ${nombre}, recibí tu solicitud de otro horario para la asesoría filosófica. Soy ${solicitud.instructor_nombre} y sí dispondré de tiempo.

${fecha.charAt(0).toUpperCase()+fecha.slice(1)}
${hora}

¡Nos vemos ${nombre}!`;
    }

    if(estado==='rechazada'){
      mensaje=
`Hola ${nombre}, recibí tu solicitud de otro horario para la asesoría filosófica. Soy ${solicitud.instructor_nombre}. Lamentablemente, en el horario que propusiste no tendré disponibilidad.

Puedes ingresar nuevamente a la página y elegir alguno de mis horarios disponibles o enviarme otra propuesta.

¡Espero que podamos coincidir pronto!`;
    }

    if(numero && mensaje){
      window.open(
        'https://wa.me/'+numero+'?text='+encodeURIComponent(mensaje),
        '_blank'
      );
    }

    await renderAlternateRequests();
  };
});


dest.querySelectorAll('[data-alt-delete]').forEach(b=>{
  b.onclick=async()=>{

    if(!confirm('¿Eliminar definitivamente esta solicitud?')) return;

    const x=await db.rpc('eliminar_solicitud_horario',{
      p_solicitud_id:Number(b.dataset.altDelete)
    });

    if(x.error){
      alert('No se pudo eliminar: '+x.error.message);
      return;
    }

    await renderAlternateRequests();
  };
});

}
 async function renderAdviceBookings(){
  let box=document.querySelector('#adviceBookings');
  if(!box){box=document.createElement('section');box.id='adviceBookings';box.style.cssText='margin:18px 0 26px;padding:18px;border:1px solid #d8d2c4;border-radius:14px;background:#fffdf7';list.parentNode.insertBefore(box,list);}
  box.innerHTML='<h3 style="margin:0 0 6px">Asesorías confirmadas</h3><p class="admin-dev-note">Cargando reservas…</p>';
  const q=await db.rpc('listar_reservas_asesoria_panel');
  if(q.error){box.innerHTML='<h3 style="margin:0 0 6px">Asesorías confirmadas</h3><p class="admin-dev-note">No se pudieron cargar las reservas: '+esc2(q.error.message)+'</p>';return;}
  const all=(Array.isArray(q.data)?q.data:[]).map(r=>({...r,id:r.id??r.reserva_id}));
  const now=new Date();
  const tabs=['proximas','realizadas','canceladas'];
  box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h3 style="margin:0">Asesorías confirmadas</h3><p class="admin-dev-note" style="margin:4px 0 0">${window.__naIsAdmin||(window.__naRoles||[]).includes('responsable_asesorias')?'Todas las reservas':'Tus próximas reservas'}</p></div><div id="bookingTabs" style="display:flex;gap:6px;flex-wrap:wrap">${tabs.map((t,i)=>`<button type="button" class="mini-btn" data-book-tab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div></div><div id="bookingList" style="margin-top:12px"></div>`;
  let current='proximas';
  const paint=()=>{const dest=box.querySelector('#bookingList');let arr=all.filter(r=>{const e=String(r.estado||'confirmada').toLowerCase();if(current==='realizadas')return e==='realizada';if(current==='canceladas')return e==='cancelada';return e!=='realizada'&&e!=='cancelada'&&new Date(String(r.fecha)+'T'+String(r.hora||'00:00'))>=new Date(now.getTime()-86400000);});arr.sort((a,b)=>String(a.fecha+' '+a.hora).localeCompare(String(b.fecha+' '+b.hora)));dest.innerHTML=arr.length?arr.map(r=>{const phone=String(r.whatsapp_persona||r.celular||'').replace(/\D/g,'');const wa=phone.length===9?'51'+phone:phone;const date=new Date(String(r.fecha)+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short',day:'numeric',month:'short'});return `<div class="activity-admin-row" style="align-items:center"><div class="cm-wide"><div class="cm-row-title">${esc2(r.nombre_persona||r.nombre_apellido||'Reserva')}</div><div class="cm-row-sub">${esc2(r.instructor_nombre||'')} · ${esc2(date)} · ${esc2(String(r.hora||'').slice(0,5))}${(r.whatsapp_persona||r.celular)?' · '+esc2(r.whatsapp_persona||r.celular):''}${r.correo_persona?' · '+esc2(r.correo_persona):''}</div></div><div class="activity-admin-actions">${wa?`<a class="mini-btn" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>`:''}${current==='proximas'?`<button class="mini-btn" data-book-state="realizada" data-book-id="${r.id}">Realizada</button><button class="mini-btn danger" data-book-state="cancelada" data-book-id="${r.id}">Cancelar</button>`:current==='canceladas'?`<button class="mini-btn danger" data-book-delete="${r.id}">Eliminar</button>`:''}</div></div>`}).join(''):'<div class="empty-people">No hay asesorías en esta sección.</div>';dest.querySelectorAll('[data-book-state]').forEach(b=>b.onclick=async()=>{const x=await db.rpc('actualizar_estado_reserva_asesoria',{p_reserva_id:Number(b.dataset.bookId),p_estado:b.dataset.bookState});if(x.error){alert('No se pudo actualizar: '+x.error.message);return;}await renderAdviceBookings();});dest.querySelectorAll('[data-book-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar definitivamente esta asesoría cancelada? Esta acción no se puede deshacer.'))return;const x=await db.rpc('eliminar_reserva_cancelada',{p_reserva_id:Number(b.dataset.bookDelete)});if(x.error){alert('No se pudo eliminar: '+x.error.message);return;}await renderAdviceBookings();});};
  box.querySelectorAll('[data-book-tab]').forEach(b=>b.onclick=()=>{current=b.dataset.bookTab;paint();});paint();
 }

 async function load(){const d=defs[mode];list.innerHTML='<p class="admin-dev-note">Cargando…</p>';let base=db.from(d.table).select('*'); if(mode==='advice'&&window.__naInstructorOnly){base=base.eq('activo',true);const {data:{user},error:userError}=await db.auth.getUser();if(userError||!user){list.innerHTML='<div class="empty-people">No pudimos verificar tu sesión. Vuelve a ingresar.</div>';return;}let own=await base.eq('usuario_id',user.id).order('id',{ascending:true});if(own.error){list.innerHTML='<div class="empty-people">No se pudo cargar tu perfil: '+esc2(own.error.message)+'</div>';return;}rows=own.data||[];if(!rows.length){const person=await db.from('personas').select('id').eq('usuario_id',user.id).maybeSingle();if(person.error){list.innerHTML='<div class="empty-people">No se pudo verificar el vínculo de tu perfil.</div>';return;}if(person.data?.id){const linked=await db.from('instructores').select('*').eq('persona_id',person.data.id).eq('activo',true).order('id',{ascending:true});if(linked.error){list.innerHTML='<div class="empty-people">No se pudo cargar tu perfil: '+esc2(linked.error.message)+'</div>';return;}rows=linked.data||[];}}if(!rows.length){list.innerHTML='<div class="empty-people">Tu cuenta todavía no está vinculada a una ficha de instructor. Comunícate con el administrador para que la vincule.</div>';return;}render();return;}let q=await base.order('id',{ascending:true});if(q.error){list.innerHTML='<div class="empty-people">No se pudo cargar.<br><small>'+esc2(q.error.message)+'</small></div>';return;}rows=q.data||[];render();}
 function render(){let q=($('#cmSearch').value||'').toLowerCase();let arr=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));list.innerHTML=arr.length?arr.map(r=>{let name=(mode==='areas'?({integracion:'Integración',tecnica:'Técnica',difusion:'Difusión',cafeteria:'Cafetería',redes:'Redes',cultura:'Promoción de Cultura y Biblioteca','escolastica-prob':'Escolástica · Probacionismo','escolastica-miembros':'Escolástica · Miembros'}[r.area_id]||r.area_id):null)||r.titulo||r.nombre||r.nombre_apellido||('Registro '+r.id),sub=mode==='events'?`${r.fecha||''} · ${r.hora?.slice?.(0,5)||''} · ${r.sede||''}`:mode==='donations'?`${r.categoria||''} · ${r.conseguido?'Conseguido':'Pendiente'}`:mode==='readings'?`${r.autor||''} · ${r.tema||''}`:mode==='virtues'?`${r.significado||''} · ${r.activo===false?'Inactiva':'Activa'}`:mode==='areas'?`${r.encargado||'Sin responsable'} · ${r.whatsapp||'Sin WhatsApp'}`:`${r.duracion_minutos||''} min · ${r.activo===false?'Inactivo':'Activo'}`;return `<div class="activity-admin-row"><div class="cm-wide"><div class="cm-row-title">${esc2(name)}</div><div class="cm-row-sub">${esc2(sub)}</div></div><div class="activity-admin-actions"><button class="mini-btn" data-cm-edit="${r.id}">Editar</button>${(mode==='events'||mode==='readings'||(mode==='advice'&&window.__naIsAdmin))?`<button class="mini-btn danger" data-cm-delete="${r.id}">Eliminar</button>`:''}</div></div>`}).join(''):'<div class="empty-people">No hay registros.</div>';list.querySelectorAll('[data-cm-edit]').forEach(b=>b.onclick=()=>edit(rows.find(r=>String(r.id)===b.dataset.cmEdit))); list.querySelectorAll('[data-cm-delete]').forEach(b=>b.onclick=()=>removeRecord(rows.find(r=>String(r.id)===b.dataset.cmDelete)));}
 async function edit(r=null){let d=defs[mode];$('#cmId').value=r?.id||'';$('#cmModalTitle').textContent=r?'Editar '+d.label:'Nueva '+d.label;fields.innerHTML=d.fields.filter(f=>!r||Object.prototype.hasOwnProperty.call(r,f[0])).map(f=>fhtml(f,r)).join('');
  if(mode==='advice'){
    if(window.__naInstructorOnly){fields.querySelectorAll('[data-k]').forEach(el=>{if(!['foto','duracion_minutos'].includes(el.dataset.k)){el.disabled=true;el.title='Este dato solo puede modificarlo el administrador.';}});const photoHelp=fields.querySelector('[data-k="foto"]')?.closest('label')?.querySelector('small');if(photoHelp)photoHelp.textContent='Puedes cambiar tu fotografía cuando quieras. JPG, PNG o WEBP · máximo 10 MB.';}
    adviceAvailability=[];
    if(r?.id){const av=await db.from('disponibilidad_instructores').select('id,dia,hora_inicio,hora_fin,activo').eq('instructor_id',r.id).eq('activo',true).order('dia').order('hora_inicio'); adviceAvailability=av.data||[];}
    fields.insertAdjacentHTML('beforeend',`<div class="cm-field cm-availability"><span><strong>Disponibilidad semanal</strong></span><small>Agrega uno o varios bloques. Los horarios usan intervalos de 15 minutos.</small><div id="availabilityRows"></div><button type="button" class="mini-btn" id="addAvailability">+ Añadir horario</button></div>`);
    const renderAv=()=>{const box=$('#availabilityRows'); box.innerHTML=adviceAvailability.map((a,i)=>`<div class="availability-row"><select data-av-day="${i}">${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((x,di)=>`<option value="${di+1}" ${Number(a.dia)===di+1?'selected':''}>${x}</option>`).join('')}</select><input type="time" step="900" data-av-start="${i}" value="${String(a.hora_inicio||'').slice(0,5)}"><span>a</span><input type="time" step="900" data-av-end="${i}" value="${String(a.hora_fin||'').slice(0,5)}"><button type="button" class="mini-btn" data-av-del="${i}">Quitar</button></div>`).join('')||'<p class="admin-dev-note">Aún no hay horarios. Pulsa “+ Añadir horario”.</p>'; box.querySelectorAll('[data-av-del]').forEach(b=>b.onclick=()=>{adviceAvailability.splice(Number(b.dataset.avDel),1);renderAv();});};
    $('#addAvailability').onclick=()=>{adviceAvailability.push({dia:1,hora_inicio:'18:00',hora_fin:'19:00',activo:true});renderAv();}; renderAv();
    if(r?.id){
      const calendarSection=document.createElement('section');
      calendarSection.style.cssText='border-top:1px solid #ddd1b9;padding-top:18px;margin-top:16px';
      const googleBox=document.createElement('div');
      googleBox.style.cssText='margin-top:0;padding-top:0';
      googleBox.innerHTML='<strong>Sincronización directa con Google Calendar</strong><p class="admin-dev-note">Conecta tu cuenta para crear las asesorías en Google Calendar. Solo el instructor puede autorizar su propia cuenta.</p><button type="button" class="mini-btn" data-google-connect>Conectar Google Calendar</button> <button type="button" class="mini-btn" data-google-sync>Sincronizar reservas</button><p class="admin-dev-note" data-google-message role="status"></p>';
      const googleMessage=googleBox.querySelector('[data-google-message]');
      const googleCall=async(action)=>{const {data:{session}}=await db.auth.getSession();if(!session)throw new Error('Inicia sesión de nuevo.');const response=await fetch(window.NA_SUPABASE.url+'/functions/v1/google-calendar-connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.NA_SUPABASE.anonKey},body:JSON.stringify({action,instructor_id:r.id})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'No se pudo conectar');return data;};
      googleBox.querySelector('[data-google-connect]').onclick=async()=>{googleMessage.textContent='Preparando autorización…';try{const result=await googleCall('start');location.href=result.url;}catch(e){googleMessage.textContent=e.message;}};
      googleBox.querySelector('[data-google-sync]').onclick=async()=>{googleMessage.textContent='Sincronizando…';try{const result=await googleCall('sync');googleMessage.textContent='Sincronizadas '+result.synced+' reservas.';}catch(e){googleMessage.textContent=e.message;}};
      calendarSection.append(googleBox);
      fields.append(calendarSection);
    }

    if(r?.id && (window.__naIsAdmin || (window.__naRoles||[]).includes('responsable_asesorias'))){
      const access=document.createElement('section');
      access.className='cm-field';
      access.style.cssText='border-top:1px solid #ddd1b9;padding-top:18px;margin-top:16px';
      access.innerHTML='<strong>Acceso personal del instructor</strong><p class="admin-dev-note">Crea o restablece su acceso privado. No modifica los horarios ni las reservas.</p><label>DNI (8 dígitos)<input id="instructorAccessDni" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" autocomplete="off" placeholder="DNI del instructor"></label><label>Clave personal (mínimo 10 caracteres)<input id="instructorAccessPassword" type="password" minlength="10" autocomplete="new-password" placeholder="Clave temporal segura"></label><button type="button" class="mini-btn" id="instructorAccessAction">Crear acceso</button><p id="instructorAccessMessage" role="status" aria-live="polite"></p><small>Entrega la clave al instructor por un canal privado. No uses el DNI como clave.</small>';
      fields.append(access);
      const action=access.querySelector('#instructorAccessAction');
      const linked=Boolean(r.usuario_id);
      action.textContent=linked?'Restablecer clave':'Crear acceso';
      action.onclick=async()=>{
        const dni=access.querySelector('#instructorAccessDni').value.trim();
        const password=access.querySelector('#instructorAccessPassword').value;
        const output=access.querySelector('#instructorAccessMessage');
        if(!(dni.length===8 && [...dni].every(c=>c>='0'&&c<='9'))||password.length<10){output.textContent='Ingresa un DNI de 8 dígitos y una clave de 10 caracteres como mínimo.';return;}
        if(linked&&!confirm('¿Restablecer la clave de este instructor?'))return;
        action.disabled=true;output.textContent='Procesando acceso…';
        try{
          const {data:{session}}=await db.auth.getSession();
          if(!session)throw new Error('Inicia sesión nuevamente.');
          const response=await fetch(window.NA_SUPABASE.url+'/functions/v1/instructor-acceso',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.NA_SUPABASE.anonKey},body:JSON.stringify({action:linked?'reset':'create',instructor_id:r.id,dni,password})});
          const result=await response.json();
          if(!response.ok||!result.ok)throw new Error(result.error||'No se pudo crear el acceso.');
          access.querySelector('#instructorAccessPassword').value='';
          output.textContent='Acceso '+(linked?'actualizado':'creado')+' correctamente. El instructor puede entrar en instructor.html.';
        }catch(error){output.textContent=error.message||'No se pudo guardar el acceso.'}
        finally{action.disabled=false;}
      };
    }
  }
  $('#cmFormMsg').textContent='';modal.hidden=false;}
 async function uploadCmImage(el,bucket,prefix){if(!el||!el.files||!el.files[0])return el?.dataset?.existing||null;const f=el.files[0];if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw new Error('La fotografía debe ser JPG, PNG o WEBP.');if(f.size>10*1024*1024)throw new Error('La fotografía supera el máximo de 10 MB.');const ext=(f.name.split('.').pop()||'webp').toLowerCase();const folder=bucket==='instructores'&&$('#cmId')?.value?String($('#cmId').value):prefix;const path=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await db.storage.from(bucket).upload(path,f,{upsert:false,contentType:f.type});if(up.error)throw up.error;return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;}
 async function save(e){e.preventDefault();let d=defs[mode],id=$('#cmId').value,p={},m=$('#cmFormMsg');m.textContent='Guardando…';m.className='auth-msg';try{for(const el of fields.querySelectorAll('[data-k]')){let k=el.dataset.k;if(el.type==='file'){const bucket=mode==='advice'?'instructores':mode==='events'?'eventos':mode==='readings'?'lecturas':mode==='areas'?'areas':'actividades';p[k]=await uploadCmImage(el,bucket,mode);continue;}let v=el.type==='checkbox'?el.checked:el.value;if(el.type==='number'&&v!=='')v=Number(v);p[k]=v===''?null:v;}
  if(mode==='readings' && (p.orden===null || p.orden===undefined)){ const mx=rows.reduce((m,r)=>Math.max(m,Number(r.orden)||0),0); p.orden=mx+1; }
  if(mode==='events'){ p.titulo=(p.titulo||'').trim(); if(!p.titulo) throw new Error('El nombre del evento es obligatorio.'); }
  if(mode==='areas')p.updated_at=new Date().toISOString();
  if(mode==='advice'){
    document.querySelectorAll('[data-av-day]').forEach(el=>{const i=Number(el.dataset.avDay); adviceAvailability[i].dia=el.value;});
    document.querySelectorAll('[data-av-start]').forEach(el=>{const i=Number(el.dataset.avStart); adviceAvailability[i].hora_inicio=el.value;});
    document.querySelectorAll('[data-av-end]').forEach(el=>{const i=Number(el.dataset.avEnd); adviceAvailability[i].hora_fin=el.value;});
    for(const a of adviceAvailability){if(!a.hora_inicio||!a.hora_fin||a.hora_inicio>=a.hora_fin)throw new Error('Revisa los horarios: la hora final debe ser posterior a la inicial.');}
    const rr=await db.rpc('admin_guardar_instructor',{p_id:id?Number(id):null,p_nombre:p.nombre,p_correo:p.correo||null,p_celular:p.celular||null,p_foto:p.foto||null,p_duracion_minutos:Number(p.duracion_minutos||60),p_activo:p.activo!==false}); if(rr.error)throw rr.error; const instructorId=Number(rr.data);
    const ra=await db.rpc('admin_reemplazar_disponibilidad_instructor',{p_instructor_id:instructorId,p_bloques:adviceAvailability.map(a=>({dia:Number(a.dia),hora_inicio:a.hora_inicio,hora_fin:a.hora_fin}))}); if(ra.error)throw ra.error;
  } else {let r=id?await db.from(d.table).update(p).eq('id',id):await db.from(d.table).insert(p);if(r.error)throw r.error;}
  m.textContent='Guardado ✓';m.className='auth-msg success';await load();setTimeout(()=>modal.hidden=true,450);}catch(err){m.textContent='No se pudo guardar: '+(err?.message||err);m.className='auth-msg error';}}
 async function removeRecord(r){ if(!r||!confirm(`¿Eliminar ${mode==='advice'?'este instructor':mode==='readings'?'esta lectura':'este evento'}?`))return; try{ if(mode==='advice'){const x=await db.rpc('admin_eliminar_instructor',{p_instructor_id:Number(r.id)}); if(x.error)throw x.error;} else if(mode==='events'){const x=await db.from('eventos').delete().eq('id',r.id); if(x.error)throw x.error;} else if(mode==='readings'){await db.from('lecturas_virtudes').delete().eq('lectura_id',r.id); const x=await db.from('lecturas').delete().eq('id',r.id); if(x.error)throw x.error;} await load(); }catch(err){alert('No se pudo eliminar: '+(err?.message||err));} }
 $('#areasShortcut')?.addEventListener('click',()=>open('areas'));$('#virtuesShortcut')?.addEventListener('click',()=>open('virtues'));$('#eventsShortcut')?.addEventListener('click',()=>open('events'));$('#donationsShortcut')?.addEventListener('click',()=>open('donations'));$('#readingsShortcut')?.addEventListener('click',()=>open('readings'));$('#instructorsShortcut')?.addEventListener('click',async()=>{await open('advice');setAdviceView('instructors');});$('#adviceShortcut')?.addEventListener('click',()=>open('advice'));$('#cmAdd').onclick=()=>edit();$('#cmSearch').oninput=render;$('#cmClose').onclick=$('#cmCancel').onclick=()=>modal.hidden=true;modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});$('#cmForm').onsubmit=save;
})();
