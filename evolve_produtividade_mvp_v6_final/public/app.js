let state = { consultant:null, bootstrap:null, stats:null, cancellationPending:[] };
const ACTS = [
  ["matriculas","Matrículas"],
  ["cancelamentos","Cancelamentos"],
  ["inadimplentes","Cobranças de inadimplentes"],
  ["manuais","Cobranças manuais"],
  ["efetivadas","Cobranças efetivadas"],
  ["agendamentos","Agendamentos de treino"],
  ["visitas","Visitas recebidas"]
];

async function api(url, options={}) {
  const r=await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const j=await r.json();
  if(!r.ok) throw new Error(j.error||"Erro");
  return j;
}
function fmtDate(d){return new Intl.DateTimeFormat("pt-BR",{dateStyle:"long"}).format(new Date(d+"T12:00:00"))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function initials(name){return String(name||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "?"}
function avatarHtml(c, cls="avatar"){return c?.photo ? `<img class="${cls}" src="${c.photo}" alt="">` : `<div class="${cls}">${initials(c?.name)}</div>`}
function contrastText(hex){
  let h=String(hex||"#111827").replace("#","");
  if(h.length===3) h=h.split("").map(x=>x+x).join("");
  const n=parseInt(h,16); if(Number.isNaN(n)) return "#ffffff";
  const r=(n>>16)&255,g=(n>>8)&255,b=n&255,lum=(0.2126*r+0.7152*g+0.0722*b)/255;
  return lum > 0.62 ? "#111827" : "#ffffff";
}
function applyPersonalization(c){
  const button=c?.buttonColor || "#111827", bg=c?.backgroundColor || "#f4f6f8";
  document.documentElement.style.setProperty("--user-button",button);
  document.documentElement.style.setProperty("--user-button-text",contrastText(button));
  document.documentElement.style.setProperty("--user-bg",bg);
  document.body.style.background=bg;
}
function previewPhoto(event){
  const file=event.target.files?.[0]; if(!file) return;
  if(file.size>3*1024*1024){alert("A foto deve ter no máximo 3 MB.");event.target.value="";return;}
  const reader=new FileReader();
  reader.onload=()=>document.getElementById("cfgPhotoPreview").outerHTML=`<img id="cfgPhotoPreview" class="avatar profile-avatar" src="${reader.result}" alt="">`;
  reader.readAsDataURL(file);
}
async function loadConsultants(){
  const b=await api("/api/bootstrap"), list=document.getElementById("consultantList"), activeIds=new Set(b.activeShifts||[]);
  list.innerHTML=b.consultants.map(c=>{
    const isActive=activeIds.has(c.id);
    return `<button class="consultant-btn${isActive?" is-active":""}" onclick="login('${c.id}')">
      <div class="consultant-main">${avatarHtml(c,"avatar")}<div><strong>${escapeHtml(c.name)}</strong><span>Início: ${c.startTime} • Meta: ${c.dailyGoal}/dia</span>${isActive?'<span class="session-badge">● Sessão ativa</span>':""}</div></div>
      <span class="start-shift-label">${isActive?"Continuar expediente →":"Iniciar expediente →"}</span>
    </button>`;
  }).join("");
}
async function login(id){
  const b=await api("/api/bootstrap"), c=b.consultants.find(x=>x.id===id);
  state.consultant=c; state.bootstrap=b; applyPersonalization(c);
  await api("/api/shifts/start",{method:"POST",body:JSON.stringify({consultantId:id})});
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("todayLabel").textContent=fmtDate(new Date().toISOString().slice(0,10));
  await refresh();
}
async function loadCancellationPending(){
  if(!state.consultant) return [];
  const p=await api(`/api/cancellations/pending?consultantId=${encodeURIComponent(state.consultant.id)}`);
  state.cancellationPending=p;
  return p;
}
function hasCancellationPending(){return (state.cancellationPending||[]).some(p=>p.items.some(i=>!i.done))}
function renderActivities(){
  const me=state.stats?.rows?.find(x=>x.id===state.consultant.id), counts=me?.activities||{}, pending=hasCancellationPending();
  document.getElementById("activityButtons").innerHTML=ACTS.map(([type,label])=>{
    const warning=type==="cancelamentos"&&pending;
    return `<div class="activity-btn${warning?" has-pending":""}">
      <span><strong>${label}</strong><span class="activity-count">Total de hoje</span></span>
      <span class="activity-plusminus">
        ${warning?`<button class="warning-btn" title="Ver pendências" onclick="openCancellationPending()">⚠</button>`:""}
        <button title="Diminuir" onclick="activity('${type}',-1)">−</button>
        <span class="count">${counts[type]||0}</span>
        <button title="Adicionar" onclick="activity('${type}',1)">+</button>
      </span>
    </div>`;
  }).join("");
}
async function activity(type,delta=1){
  if(type==="matriculas"&&delta===1){openMatriculaChecklist();return;}
  if(type==="cancelamentos"&&delta===1){openCancelamentoChecklist();return;}
  await api("/api/activities/adjust",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,type,delta})});
  await refresh();
}

// ---- Checklist de Matrícula ----
let matricula={step:1,answers:{}};
function openMatriculaChecklist(){matricula={step:1,answers:{}};renderMatriculaStep();document.getElementById("matriculaModal").classList.remove("hidden")}
function cancelMatriculaChecklist(){document.getElementById("matriculaModal").classList.add("hidden")}
function renderMatriculaStep(){
  const el=document.getElementById("matriculaStepContent");
  if(matricula.step===1) el.innerHTML=`<p class="checklist-question">Foi explicado os termos de cancelamento ao aluno?</p><div class="checklist-actions"><button class="secondary" onclick="answerMatricula('termos','sim')">Sim</button><button class="secondary" onclick="answerMatricula('termos','nao')">Não</button></div>`;
  else if(matricula.step===2) el.innerHTML=`<p class="checklist-question">Foi colocado o CRM de Matrícula no cadastro do aluno?</p><div class="checklist-actions"><button class="secondary" onclick="answerMatricula('crm','sim')">Sim</button><button class="secondary" onclick="answerMatricula('crm','nao')">Não</button></div>`;
  else if(matricula.step===3) el.innerHTML=`<p class="checklist-question">Treino agendado?</p><div class="checklist-actions"><button class="secondary" onclick="answerMatricula('treino','sim')">Sim</button><button class="secondary" onclick="answerMatricula('treino','nao')">Não</button></div>`;
}
async function answerMatricula(key,value){
  matricula.answers[key]=value;
  if(key==="termos"){matricula.step=2;return renderMatriculaStep()}
  if(key==="crm"){if(value==="nao"){document.getElementById("matriculaModal").classList.add("hidden");document.getElementById("matriculaLegalModal").classList.remove("hidden");return}matricula.step=3;return renderMatriculaStep()}
  if(key==="treino"){document.getElementById("matriculaModal").classList.add("hidden");await finalizeMatricula()}
}
function closeMatriculaLegal(){document.getElementById("matriculaLegalModal").classList.add("hidden");matricula.step=3;document.getElementById("matriculaModal").classList.remove("hidden");renderMatriculaStep()}
function copyMatriculaLegal(){
  const text=["MATRÍCULA","","No ato da matrícula, foram prestadas todas as orientações ao contratante sobre os seguintes pontos:","- Fidelidade contratual de 12 meses, incluindo a aplicação da multa rescisória correspondente a 20% do valor remanescente do contrato, em caso de cancelamento antecipado.","- Aviso prévio para cancelamento, explicado de forma clara, com exemplos práticos, garantindo o completo entendimento e o esclarecimento de todas as dúvidas.","- Procedimento de cancelamento, informando que deverá ser realizado presencialmente pelo titular do contrato.","- Ativação por prazo indeterminado e renovação contratual, com as devidas explicações sobre seu funcionamento.","- Suspensão do contrato, incluindo as condições e o procedimento para solicitação."].join("\n");
  navigator.clipboard?.writeText(text).catch(()=>{});
}
async function finalizeMatricula(){
  if(matricula.answers.treino==="sim") await api("/api/activities/adjust",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,type:"agendamentos",delta:1})});
  await api("/api/activities/adjust",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,type:"matriculas",delta:1})});
  await refresh();
}

// ---- Checklist de Cancelamento ----
let cancelamento={step:1,answers:{}};
function openCancelamentoChecklist(){
  cancelamento={step:1,answers:{}};
  renderCancelamentoStep();
  document.getElementById("cancelamentoModal").classList.remove("hidden");
}
function closeCancelamentoChecklist(){document.getElementById("cancelamentoModal").classList.add("hidden")}
function renderCancelamentoStep(){
  const el=document.getElementById("cancelamentoStepContent");
  if(cancelamento.step===1){
    el.innerHTML=`<p class="checklist-question">CRM de cancelamento feito?</p><div class="checklist-actions"><button class="secondary" onclick="answerCancelamento('crm','sim')">Sim</button><button class="secondary" onclick="answerCancelamento('crm','nao')">Não</button></div>`;
  } else if(cancelamento.step===2){
    el.innerHTML=`<p class="checklist-question">Tinha multa?</p><div class="checklist-actions"><button class="secondary" onclick="answerCancelamento('multa','sim')">Sim</button><button class="secondary" onclick="answerCancelamento('multa','nao')">Não</button></div>`;
  } else if(cancelamento.step===3){
    el.innerHTML=`<p class="checklist-question">A multa foi cobrada?</p><div class="checklist-actions"><button class="secondary" onclick="answerCancelamento('multaCobrada','sim')">Sim</button><button class="secondary" onclick="answerCancelamento('multaCobrada','nao')">Não</button></div>`;
  } else if(cancelamento.step===4){
    el.innerHTML=`<p class="checklist-question">Aviso prévio cobrado?</p><div class="checklist-actions"><button class="secondary" onclick="answerCancelamento('aviso','sim')">Sim</button><button class="secondary" onclick="answerCancelamento('aviso','nao')">Não</button></div>`;
  } else if(cancelamento.step===5){
    el.innerHTML=`<p class="checklist-question">Comprovante enviado no WhatsApp do aluno?</p><div class="checklist-actions"><button class="secondary" onclick="answerCancelamento('comprovante','sim')">Sim</button><button class="secondary" onclick="answerCancelamento('comprovante','nao')">Não</button></div>`;
  }
}
async function answerCancelamento(key,value){
  cancelamento.answers[key]=value;
  if(key==="crm"){cancelamento.step=2;return renderCancelamentoStep()}
  if(key==="multa"){cancelamento.step=value==="sim"?3:4;return renderCancelamentoStep()}
  if(key==="multaCobrada"){cancelamento.step=4;return renderCancelamentoStep()}
  if(key==="aviso"){cancelamento.step=5;return renderCancelamentoStep()}
  if(key==="comprovante"){
    if(value==="nao") alert("Envie o Comprovante para o aluno.");
    await finalizeCancelamento();
  }
}
async function finalizeCancelamento(){
  const a=cancelamento.answers, pending=[];
  if(a.crm==="nao") pending.push({id:"crm",label:"CRM de cancelamento feito?"});
  if(a.multa==="sim"&&a.multaCobrada==="nao") pending.push({id:"multa",label:"Cobrar a multa do cancelamento"});
  if(a.aviso==="nao") pending.push({id:"aviso",label:"Cobrar o aviso prévio"});
  if(a.comprovante==="nao") pending.push({id:"comprovante",label:"Enviar comprovante no WhatsApp do aluno"});
  document.getElementById("cancelamentoModal").classList.add("hidden");
  if(!pending.length){
    await api("/api/activities/adjust",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,type:"cancelamentos",delta:1})});
    await refresh();
    return;
  }
  await api("/api/cancellations",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,items:pending})});
  await loadCancellationPending();
  await refresh();
  openCancellationPending();
}
async function openCancellationPending(){
  await loadCancellationPending();
  const list=document.getElementById("cancellationPendingList");
  if(!state.cancellationPending.length){alert("Não há pendências de cancelamento em aberto.");return}
  list.innerHTML=state.cancellationPending.map(p=>`<div class="pending-case"><strong>Cancelamento — ${new Date(p.date+"T12:00:00").toLocaleDateString("pt-BR")}</strong>${p.items.map(i=>`<label class="pending-item"><input type="checkbox" ${i.done?"checked":""} onchange="resolveCancellationItem('${p.id}','${i.id}',this.checked)" ${i.done?"disabled":""}><span>${escapeHtml(i.label)}</span></label>`).join("")}</div>`).join("");
  document.getElementById("cancellationPendingModal").classList.remove("hidden");
}
function closeCancellationPending(){document.getElementById("cancellationPendingModal").classList.add("hidden")}
async function resolveCancellationItem(id,itemId,done){
  const r=await api("/api/cancellations/resolve",{method:"POST",body:JSON.stringify({id,itemId,done})});
  if(r.completed) alert("Pendências concluídas. Cancelamento registrado com +1.");
  await loadCancellationPending();
  await refresh();
  if(!hasCancellationPending()) closeCancellationPending(); else openCancellationPending();
}

function loadSettingsFields(){
  document.getElementById("cfgName").value=state.consultant.name;
  document.getElementById("cfgStart").value=state.consultant.startTime;
  document.getElementById("cfgGoal").value=state.consultant.dailyGoal;
  document.getElementById("cfgButtonColor").value=state.consultant.buttonColor||"#111827";
  document.getElementById("cfgBackgroundColor").value=state.consultant.backgroundColor||"#f4f6f8";
  const preview=document.getElementById("cfgPhotoPreview"), photoMarkup=avatarHtml(state.consultant,"avatar profile-avatar");
  preview.outerHTML=photoMarkup.replace('class="avatar profile-avatar"','id="cfgPhotoPreview" class="avatar profile-avatar"');
  document.getElementById("manualType").innerHTML=ACTS.map(([type,label])=>`<option value="${type}">${label}</option>`).join("");
}
function openSettings(){loadSettingsFields();document.getElementById("settingsModal").classList.remove("hidden")}
function closeSettings(){document.getElementById("settingsModal").classList.add("hidden")}
async function saveSettings(){
  const preview=document.getElementById("cfgPhotoPreview"), photo=preview?.tagName==="IMG"?preview.src:(state.consultant.photo||"");
  const updated=await api("/api/consultants/"+state.consultant.id,{method:"PATCH",body:JSON.stringify({name:document.getElementById("cfgName").value,startTime:document.getElementById("cfgStart").value,dailyGoal:Number(document.getElementById("cfgGoal").value),buttonColor:document.getElementById("cfgButtonColor").value,backgroundColor:document.getElementById("cfgBackgroundColor").value,photo})});
  state.consultant=updated;applyPersonalization(updated);closeSettings();await loadConsultants();await refresh();alert("Dados salvos com sucesso.");
}
async function manualAdjust(direction){
  const type=document.getElementById("manualType").value,amount=Math.max(1,Number(document.getElementById("manualAmount").value)||1);
  for(let i=0;i<amount;i++) await api("/api/activities/adjust",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,type,delta:direction})});
  await refresh();
}
async function deleteMyDay(){
  if(!confirm("Apagar TODOS os registros de produtividade, mensagens e expediente deste consultor no dia de hoje?")) return;
  await api("/api/consultants/"+state.consultant.id+"/delete-day",{method:"POST",body:JSON.stringify({date:new Date().toISOString().slice(0,10)})});
  await refresh();alert("Dados do dia apagados.");
}
async function deleteMyAll(){
  const answer=prompt("Esta ação apagará TODO o histórico deste consultor, mas manterá o cadastro. Digite APAGAR para confirmar.");
  if(answer!=="APAGAR") return;
  await api("/api/consultants/"+state.consultant.id+"/delete-all",{method:"POST"});await refresh();alert("Histórico deste consultor apagado.");
}
async function addMessage(){await api("/api/messages",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id,source:"manual"})});await refresh()}
async function refresh(){
  const b=await api("/api/bootstrap"),s=await api("/api/stats");
  state.bootstrap=b;state.stats=s;
  document.getElementById("todayMessages").textContent=s.totalMessages;
  document.getElementById("allMessages").textContent=s.allMessages;
  const active=state.consultant;
  document.getElementById("activeName").textContent=active?.name||"—";
  const activePhoto=document.getElementById("activePhoto");
  if(activePhoto) activePhoto.outerHTML=avatarHtml(active,"avatar large").replace('class="avatar large"','id="activePhoto" class="avatar large"');
  document.getElementById("activeHours").textContent=active?`Expediente iniciado às ${active.startTime}`:"";
  document.getElementById("loggedProfile").innerHTML=`${avatarHtml(active,"avatar small-avatar")}<span>${escapeHtml(active.name)}</span>`;
  applyPersonalization(active);
  const me=s.rows.find(x=>x.id===state.consultant.id),pct=me?.goal?Math.min(100,Math.round(me.messages/me.goal*100)):0;
  document.getElementById("myMessages").textContent=me?.messages||0;
  document.getElementById("myGoal").textContent=me?.goal||0;
  document.getElementById("myAverage").textContent=me?.average||0;
  document.getElementById("myPercent").textContent=`${pct}%`;
  document.getElementById("progressBar").style.width=pct+"%";
  const start=state.consultant.startTime.split(":").map(Number), nowD=new Date(), startMinutes=start[0]*60+start[1], nowMinutes=nowD.getHours()*60+nowD.getMinutes();
  const hours=Math.max(1,(nowMinutes-startMinutes)/60);
  document.getElementById("myRate").textContent=`${Math.round((me?.messages||0)/hours)}/h`;
  await loadCancellationPending();
  renderActivities();
  document.getElementById("teamTable").innerHTML=s.rows.map(r=>{const p=r.goal?Math.min(100,Math.round(r.messages/r.goal*100)):0;return `<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${r.startTime}</td><td>${r.messages}</td><td>${r.average}</td><td>${r.goal}</td><td>${r.messages}</td><td><div class="bar-mini"><div style="width:${p}%"></div></div><span class="percent">${p}%</span></td></tr>`}).join("");
}
function goHome(){
  document.getElementById("app").classList.add("hidden");document.getElementById("login").classList.remove("hidden");
  state.consultant=null;state.stats=null;state.cancellationPending=[];document.body.style.background="#f4f6f8";loadConsultants();
}
async function finishShift(){
  if(!confirm("Tem certeza que deseja FINALIZAR seu expediente?\n\nSeu expediente será encerrado e o relatório diário será gerado.")) return;
  const r=await api("/api/shifts/end",{method:"POST",body:JSON.stringify({consultantId:state.consultant.id})}),a=r.stats.activities||{};
  const lines=[`Relatório diário: ${r.consultant.name} — ${new Date(r.shift.date+"T12:00:00").toLocaleDateString("pt-BR")}`,"",`Mensagens enviadas: ${r.stats.messages}`,`Matrículas realizadas: ${a.matriculas||0}`,`Cancelamentos: ${a.cancelamentos||0}`,`Cobranças de inadimplentes: ${a.inadimplentes||0}`,`Cobranças manuais: ${a.manuais||0}`,`Cobranças efetivadas: ${a.efetivadas||0}`,`Agendamentos: ${a.agendamentos||0}`,`Visitas recebidas: ${a.visitas||0}`].join("\n");
  alert(lines);navigator.clipboard?.writeText(lines).catch(()=>{});location.reload();
}
async function openHistory(){
  const h=await api("/api/history");
  document.getElementById("history").innerHTML=h.length?h.map(x=>`<div class="history-item"><strong>${escapeHtml(x.consultantName)} — ${new Date(x.date+"T12:00:00").toLocaleDateString("pt-BR")}</strong><div class="muted">${x.endedAt?`Finalizado: ${new Date(x.endedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:"Expediente em aberto"}</div><div class="history-stats"><span>Mensagens: ${x.stats.messages}</span><span>Matrículas: ${x.stats.activities.matriculas||0}</span><span>Cancelamentos: ${x.stats.activities.cancelamentos||0}</span><span>Inadimplentes: ${x.stats.activities.inadimplentes||0}</span><span>Manuais: ${x.stats.activities.manuais||0}</span><span>Efetivadas: ${x.stats.activities.efetivadas||0}</span><span>Agendamentos: ${x.stats.activities.agendamentos||0}</span><span>Visitas: ${x.stats.activities.visitas||0}</span></div></div>`).join(""):"<p class='muted'>Nenhum expediente finalizado ainda.</p>";
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
loadConsultants().catch(err=>{console.error(err);document.getElementById("consultantList").innerHTML=`<div class="load-error">Não foi possível carregar os consultores.<br><small>${escapeHtml(err.message)}</small><br><button class="secondary" onclick="location.reload()">Tentar novamente</button></div>`});
setInterval(()=>{if(!document.getElementById("app").classList.contains("hidden")) refresh().catch(console.error)},5000);
