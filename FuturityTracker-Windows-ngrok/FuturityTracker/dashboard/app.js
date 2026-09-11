'use strict';
const $=id=>document.getElementById(id);
let token='',map,markers=new Map(),selected=null,devices=[],records=[],route,playMarker;
let polling=false,historyVersion=0,historyAbort=null,timer=null,frame=0,playing=false,authenticated=false;
const validCoordinates=d=>Number.isFinite(d.last_latitude)&&Number.isFinite(d.last_longitude);
const displayName=d=>d.display_name||d.device_model||d.device_id;
let profileDevice=null;
const date=t=>t?new Date(t).toLocaleString():'Sin datos';
const text=(tag,value,className)=>{const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;};
function color(id){let n=0;for(const c of id)n=((n<<5)-n+c.charCodeAt(0))|0;return ['#185b91','#15803d','#9333ea','#c2410c'][Math.abs(n)%4];}
async function api(path,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    const external=options.signal;
    const abort=()=>controller.abort();external?.addEventListener('abort',abort,{once:true});
    if(external?.aborted)controller.abort();
    try{
        const res=await fetch('../api/v1/'+path,{...options,signal:controller.signal,headers:{'Authorization':'Bearer '+token,...options.headers},cache:'no-store'});
        if(res.status===401){logout();throw Error('Credencial inválida o revocada');}
        if(!res.ok)throw Error('Error del servidor: '+res.status);
        return await res.json();
    }finally{clearTimeout(timeout);external?.removeEventListener('abort',abort);}
}
function initMap(){if(map)return;map=L.map('map').setView([-2.9001,-79.0059],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);}
function clearHistory(){historyVersion++;historyAbort?.abort();records=[];stop();frame=0;$('export').disabled=true;$('playback').hidden=true;$('historyStatus').textContent='';
    if(route){map.removeLayer(route);route=null;}if(playMarker){map.removeLayer(playMarker);playMarker=null;}}
function logout(){profileDevice=null;$('profileForm').reset();$('profileStatus').textContent='';$('search').value='';$('areaFilter').value='';token='';authenticated=false;selected=null;devices=[];clearHistory();$('workspace').hidden=true;$('loginPanel').hidden=false;$('logout').hidden=true;
    $('adminToken').value='';$('generatedToken').value='';$('generatedToken').hidden=true;$('connection').textContent='Inicie sesión';
    if(map){for(const m of markers.values())map.removeLayer(m);markers.clear();}}
async function refresh(){if(polling||!token)return;polling=true;
    try{const result=await api('devices');if(!token)return;devices=result;renderDevices();$('connection').textContent='Servidor conectado · '+new Date().toLocaleTimeString();
        if(selected){const d=devices.find(d=>d.device_id===selected);if(d)detail(d);}}
    catch(e){if(token)$('connection').textContent='Sin conexión al servidor · datos mostrados desactualizados';throw e;}
    finally{polling=false;}}
function renderDevices(){updateAreaOptions();const visible=visibleDevices();updateCounts(visible);const list=$('deviceList');list.replaceChildren();const seen=new Set();
    for(const d of visible){seen.add(d.device_id);const b=text('button',displayName(d),'device'+(selected===d.device_id?' selected':''));
        b.append(text('span',d.technician||'Sin técnico asignado'),text('span',[d.area,d.vehicle_plate].filter(Boolean).join(' · ')),text('span',d.device_id),text('span',d.is_online?'Conectado':'Sin contacto reciente',d.is_online?'online':'offline'));b.onclick=()=>select(d);list.append(b);
        if(validCoordinates(d)){let marker=markers.get(d.device_id);if(!marker){marker=L.circleMarker([d.last_latitude,d.last_longitude],{radius:9,color:color(d.device_id),fillOpacity:.8}).addTo(map);markers.set(d.device_id,marker);}
            marker.setLatLng([d.last_latitude,d.last_longitude]);marker.setStyle({opacity:d.is_online?1:.5});
            const popup=document.createElement('div');popup.append(text('strong',displayName(d)),text('p',d.device_id),text('p','Captura: '+date(d.last_location_timestamp)),text('p','Contacto: '+date(d.last_seen)));marker.bindPopup(popup);}}
    for(const [id,m] of markers)if(!seen.has(id)){map.removeLayer(m);markers.delete(id);}
    if(!visible.length)list.append(text('p',devices.length?'No hay equipos que coincidan con la búsqueda.':'No hay equipos registrados. Genere una credencial y configúrela en la app.'));}
function select(d){selected=d.device_id;clearHistory();$('details').hidden=false;detail(d);renderDevices();if(validCoordinates(d))map.flyTo([d.last_latitude,d.last_longitude],16);loadHistory();}
function detail(d){$('deviceTitle').textContent=displayName(d);fillProfile(d);$('deviceId').textContent=d.device_id;
    const alerts=[];if(!d.is_online)alerts.push('Sin contacto reciente');if(d.telemetry_stale)alerts.push('Telemetría antigua');
    if(d.tracking_enabled===false)alerts.push('Seguimiento detenido');if(d.gps_enabled===false)alerts.push('GPS deshabilitado');
    if(Number.isFinite(d.battery_level)&&d.battery_level>=0&&d.battery_level<=15)alerts.push('Batería baja');$('alerts').textContent=alerts.join(' · ');
    $('telemetry').replaceChildren();for(const [label,value] of [['Técnico',d.technician||'Sin asignar'],['Área',d.area||'Sin asignar'],['Vehículo',d.vehicle_plate||'Sin asignar'],['Batería',d.battery_level==null||d.battery_level<0?'Sin datos':d.battery_level+'%'+(d.is_charging?' (cargando)':'')],['Red',d.network_type||'Sin datos'],['Último contacto',date(d.last_seen)],['Última captura',date(d.last_location_timestamp)]])
        $('telemetry').append(text('dt',label),text('dd',value));}
async function loadHistory(){if(!selected)return;clearHistory();const version=historyVersion,id=selected;historyAbort=new AbortController();const signal=historyAbort.signal;
    $('historyStatus').textContent='Cargando historial…';let from=0;const end=Date.now();
    if($('period').value==='24')from=end-86400000;else if($('period').value==='today'){const d=new Date();d.setHours(0,0,0,0);from=d.getTime();}
    let cursor=null,snapshot=0,loaded=[];
    try{do{const params=new URLSearchParams({from_time:from,to_time:end,limit:2000,snapshot_id:snapshot,...cursor});
        const page=await api('devices/'+encodeURIComponent(id)+'/history?'+params,{signal});if(version!==historyVersion)return;
        loaded.push(...page.records);cursor=page.next_cursor;snapshot=page.snapshot_id;$('historyStatus').textContent=loaded.length+' posiciones cargadas…';
        if(loaded.length>=100000&&cursor)throw Error('Intervalo demasiado grande. Seleccione un período menor; no se exportaron datos parciales.');
    }while(cursor);
    if(version!==historyVersion)return;records=loaded;$('historyStatus').textContent=records.length+' posiciones · historial completo del período';
    $('export').disabled=!records.length;if(!records.length)return;
    route=L.polyline(records.map(r=>[r.latitude,r.longitude]),{color:color(id),weight:4}).addTo(map);map.fitBounds(route.getBounds(),{padding:[30,30]});
    $('slider').max=records.length-1;$('slider').value=0;$('playback').hidden=false;showFrame(0);
    }catch(e){if(version===historyVersion&&e.name!=='AbortError')$('historyStatus').textContent='No se cargó el recorrido: '+e.message;}}
function showFrame(index){frame=index;const r=records[index];if(!r)return;if(!playMarker)playMarker=L.circleMarker([r.latitude,r.longitude],{radius:7,color:'#dc2626'}).addTo(map);else playMarker.setLatLng([r.latitude,r.longitude]);
    $('slider').value=index;$('playTime').textContent=date(r.timestamp)+' · '+(r.speed*3.6).toFixed(1)+' km/h · ±'+r.accuracy.toFixed(0)+' m';}
function stop(){playing=false;clearTimeout(timer);$('play').textContent='Reproducir';}
function step(){if(!playing||frame>=records.length-1){stop();return;}const elapsed=Math.max(0,records[frame+1].timestamp-records[frame].timestamp);
    timer=setTimeout(()=>{showFrame(frame+1);step();},Math.max(20,elapsed/Number($('speed').value)));}
function play(){if(playing){stop();return;}if(!records.length)return;if(frame===records.length-1)showFrame(0);playing=true;$('play').textContent='Pausar';step();}
function csvCell(value){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function exportCsv(){if(!records.length)return;const header=['UUID','DeviceID','Latitude','Longitude','Accuracy','SpeedKmh','Battery','Charging','Network','Provider','Timestamp','DateTimeUTC'];
    const rows=records.map(r=>[r.uuid,r.device_id,r.latitude,r.longitude,r.accuracy,r.speed*3.6,r.battery_level,r.is_charging,r.network_type,r.provider,r.timestamp,new Date(r.timestamp).toISOString()]);
    const csv='\ufeff'+[header,...rows].map(row=>row.map((v,i)=>typeof v==='number'?String(v):csvCell(v)).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='futurity_'+selected+'_'+Date.now()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('loginForm').onsubmit=async e=>{e.preventDefault();token=$('adminToken').value.trim();$('loginError').textContent='';
    try{devices=await api('devices');authenticated=true;$('adminToken').value='';$('loginPanel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;initMap();map.invalidateSize();renderDevices();$('connection').textContent='Servidor conectado';}
    catch(err){$('loginError').textContent=err.message;token='';}};
$('credentialForm').onsubmit=async e=>{e.preventDefault();const id=$('credentialDevice').value.trim();
    if(!confirm('Generar una credencial para '+id+'? Se invalidará la credencial anterior de ese ID.'))return;
    try{const result=await api('admin/device-tokens',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:id})});
        $('generatedToken').hidden=false;$('generatedToken').value=result.token;$('credentialStatus').textContent='Copie esta credencial en la app. No se podrá consultar después.';
    }catch(err){$('credentialStatus').textContent=err.message;}};
$('logout').onclick=logout;$('refresh').onclick=()=>refresh().catch(()=>{});$('loadHistory').onclick=loadHistory;$('period').onchange=loadHistory;$('export').onclick=exportCsv;
$('play').onclick=play;$('slider').oninput=()=>{stop();showFrame(Number($('slider').value));};$('speed').onchange=()=>{if(playing){stop();play();}};
setInterval(()=>{if(authenticated)refresh().catch(()=>{});},10000);

function visibleDevices(){const query=$('search').value.trim().toLocaleLowerCase();const area=$('areaFilter').value;
    return devices.filter(d=>(!area||d.area===area)&&(!query||[displayName(d),d.technician,d.vehicle_plate,d.device_id].join(' ').toLocaleLowerCase().includes(query)));}
function updateCounts(list){$('countTotal').textContent=list.length;$('countOnline').textContent=list.filter(d=>d.is_online).length;$('countOffline').textContent=list.filter(d=>!d.is_online).length;}
function updateAreaOptions(){const current=$('areaFilter').value;const areas=[...new Set(devices.map(d=>d.area).filter(Boolean))].sort();
    $('areaFilter').replaceChildren(new Option('Todas las áreas',''),...areas.map(a=>new Option(a,a)));if(areas.includes(current))$('areaFilter').value=current;}
function resetSelectionForFilter(){selected=null;profileDevice=null;clearHistory();$('details').hidden=true;renderDevices();}
function fillProfile(d){if(profileDevice===d.device_id)return;profileDevice=d.device_id;
    for(const [id,field] of [['profileName','display_name'],['profileTechnician','technician'],['profileArea','area'],['profilePlate','vehicle_plate'],['profileAtlasId','atlas_technician_id']])$(id).value=d[field]??'';
    $('profileStatus').textContent='';}
$('search').oninput=resetSelectionForFilter;$('areaFilter').onchange=resetSelectionForFilter;
$('profileForm').onsubmit=async e=>{e.preventDefault();if(!selected)return;const id=selected;$('profileSave').disabled=true;
    const payload={display_name:$('profileName').value,technician:$('profileTechnician').value,area:$('profileArea').value,vehicle_plate:$('profilePlate').value,atlas_technician_id:$('profileAtlasId').value?Number($('profileAtlasId').value):null};
    try{await api('admin/device-profiles/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(selected===id)profileDevice=null;await refresh();if(selected===id)$('profileStatus').textContent='Asignación guardada';
    }catch(err){$('profileStatus').textContent='No se guardó la asignación: '+err.message;}finally{$('profileSave').disabled=false;}};
