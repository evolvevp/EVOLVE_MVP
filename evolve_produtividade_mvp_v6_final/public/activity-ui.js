(function(){
  const CHARGE_TYPES=[
    ["inadimplentes","Cobrança inadimplente"],
    ["manuais","Cobranças manuais"],
    ["efetivadas","Cobranças efetivadas"]
  ];

  function activityCount(type,me){
    return type==="mensagens"?(me?.messages||0):(me?.activities?.[type]||0);
  }

  function compactCounter(type,count){
    return `<div class="compact-counter" role="group" aria-label="Controles de ${type}">
      <button class="counter-btn counter-minus" title="Diminuir" aria-label="Diminuir" onclick="activity('${type}',-1)">−</button>
      <span class="counter-value">${count}</span>
      <button class="counter-btn counter-plus" title="Adicionar" aria-label="Adicionar" onclick="activity('${type}',1)">+</button>
    </div>`;
  }

  function regularCard(type,label,me,pending){
    const count=activityCount(type,me);
    const warning=type==="cancelamentos"&&pending;
    const highlight=type==="mensagens";
    return `<div class="activity-btn activity-btn-round${warning?" has-pending":""}${highlight?" message-highlight":""}">
      ${warning?`<button class="warning-btn" title="Ver pendências" onclick="openCancellationPending()">⚠</button>`:""}
      <div class="activity-top">
        <div class="activity-icon ${ICON_CLASS[type]}">${ICONS[type]}</div>
        <div class="activity-info"><strong>${DESCRIPTIONS[type]?label:""}</strong><small>${DESCRIPTIONS[type]}</small></div>
      </div>
      <div class="activity-control-row">${compactCounter(type,count)}</div>
    </div>`;
  }

  function renderChargeCard(me){
    const rows=CHARGE_TYPES.map(([type,label])=>{
      const count=activityCount(type,me);
      return `<div class="charge-row">
        <span class="charge-label">${label}</span>
        ${compactCounter(type,count)}
      </div>`;
    }).join("");
    return `<div class="activity-btn charge-group-card">
      <div class="activity-top">
        <div class="activity-icon cobrancas">$</div>
        <div class="activity-info"><strong>Cobranças</strong><small>Registre cada cobrança realizada.</small></div>
      </div>
      <div class="charge-list">${rows}</div>
    </div>`;
  }

  window.renderActivities=function(){
    const me=state.stats?.rows?.find(x=>x.id===state.consultant.id);
    const pending=hasCancellationPending();
    const html=[
      regularCard("mensagens","Mensagens",me,pending),
      regularCard("matriculas","Matrículas",me,pending),
      regularCard("cancelamentos","Cancelamentos",me,pending),
      renderChargeCard(me),
      regularCard("agendamentos","Agendamentos de treino",me,pending),
      regularCard("visitas","Visitas recebidas",me,pending),
      regularCard("nps","NPS",me,pending)
    ].join("");
    document.getElementById("activityButtons").innerHTML=html;
  };
})();
