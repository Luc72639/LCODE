const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const adminState = {
  user: null,
  doctors: [],
  appointments: [],
  patients: [],
  payments: [],
  agendaDate: new Date(),
  agendaView: 'month'
};

const escape = v => window.appEscape ? window.appEscape(v) : String(v ?? '');
const toast = (m, t = 'success', d = '') => window.appToast?.(m, t, d);
const confirmAction = opts => window.appConfirm ? window.appConfirm(opts) : Promise.resolve(false);

function formatMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
}

function dateOnly(v) {
  if (!v) return '';
  return String(v).slice(0, 10);
}

function formatDate(v) {
  const raw = dateOnly(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '—';
  const [y,m,d] = raw.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('pt-BR');
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatTime(v) { return v ? String(v).slice(0,5) : '—'; }
function statusLabel(s) { return ({ agendada:'Agendada', confirmada:'Confirmada', realizada:'Realizada', cancelada:'Cancelada' })[s] || s || '—'; }
function statusClass(s) { return s === 'realizada' || s === 'confirmada' ? 'success' : s === 'cancelada' ? 'danger' : 'warning'; }
function paymentBadge(s) { return `<span class="badge ${s === 'pago' ? 'success' : 'warning'}">${s === 'pago' ? 'Pago' : 'Pendente'}</span>`; }
function statusBadge(s) { return `<span class="badge ${statusClass(s)}">${statusLabel(s)}</span>`; }
function initial(name) { return String(name || 'A').trim().charAt(0).toUpperCase(); }

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a operação.');
  return data;
}

async function ensureAdmin() {
  try {
    const data = await api('/api/sessao');
    if (!data.logado || data.usuario.tipo !== 'admin') throw new Error('Acesso negado');
    adminState.user = data.usuario;
    $('#admin-name').textContent = data.usuario.nome || 'Administrador';
    $('#admin-avatar').textContent = initial(data.usuario.nome);
    return true;
  } catch (_) {
    location.href = 'login.html';
    return false;
  }
}

function setSection(name) {
  $$('.menu-item').forEach(b => b.classList.toggle('ativo', b.dataset.section === name));
  $$('.admin-section').forEach(s => s.classList.toggle('ativo', s.id === `section-${name}`));
  const titles = {
    dashboard:['Visão geral','Acompanhe o funcionamento da clínica.'], agenda:['Agenda','Consultas por dia, semana ou mês.'],
    agendamentos:['Agendamentos','Busque e gerencie consultas.'], pacientes:['Pacientes','Cadastros e histórico.'], medicos:['Médicos','Equipe e disponibilidade.'],
    pagamentos:['Pagamentos','Confirmações presenciais.'], relatorios:['Relatórios','Indicadores simples da operação.'], logs:['Logs','Ações importantes do sistema.'], configuracoes:['Configurações','Informações gerais da clínica.']
  };
  const [title, sub] = titles[name] || [name,''];
  $('#page-title').textContent = title; $('#page-subtitle').textContent = sub;
  if (name === 'agenda') loadAgenda();
  if (name === 'agendamentos') loadAppointments();
  if (name === 'pacientes') loadPatients();
  if (name === 'medicos') loadDoctors();
  if (name === 'pagamentos') loadPayments();
  if (name === 'relatorios') loadReports();
  if (name === 'logs') loadLogs();
  if (name === 'configuracoes') loadSettings();
}

$$('.menu-item').forEach(b => b.addEventListener('click', () => setSection(b.dataset.section)));
$$('[data-go]').forEach(b => b.addEventListener('click', () => setSection(b.dataset.go)));

function openModal(id) { $(`#${id}`)?.classList.add('open'); window.refreshIcons?.(); }
function closeModal(id) { $(`#${id}`)?.classList.remove('open'); }
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
$$('.app-modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

async function loadDashboard() {
  try {
    const [stats, appts, logs] = await Promise.all([
      api('/api/admin/estatisticas'), api('/api/admin/agendamentos'), api('/api/admin/logs?limite=6')
    ]);
    $('#dash-hoje').textContent = stats.consultasHoje ?? 0;
    $('#dash-realizadas').textContent = stats.consultasRealizadas ?? 0;
    $('#dash-pendentes').textContent = stats.consultasPendentes ?? 0;
    $('#dash-recebido').textContent = formatMoney(stats.valorRecebidoMes);
    $('#dash-mes').textContent = stats.consultasMes ?? 0;
    $('#dash-canceladas').textContent = stats.consultasCanceladas ?? 0;
    $('#dash-pacientes').textContent = stats.totalPacientes ?? 0;
    $('#dash-medicos').textContent = stats.totalMedicos ?? 0;
    $('#dashboard-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
    const today = localDate(new Date());
    const todayList = appts.filter(a => dateOnly(a.data) === today).sort(compareAppointments);
    $('#dashboard-agenda').innerHTML = todayList.length ? todayList.map(a => agendaItem(a)).join('') : empty('calendar-x','Nenhuma consulta hoje','A agenda de hoje está livre.');
    $('#dashboard-logs').innerHTML = logs.length ? logs.map(l => `<div style="padding:10px 0;border-bottom:1px solid var(--border)"><strong style="font-size:12px">${escape(l.acao)}</strong><span class="cell-secondary">${escape(l.usuario_nome || 'Sistema')} • ${formatDateTime(l.criado_em)}</span></div>`).join('') : empty('history','Nenhuma atividade','As ações importantes aparecerão aqui.');
    window.refreshIcons?.();
  } catch (err) { toast(err.message,'error'); }
}

function empty(icon,title,text) {
  return `<div class="empty-state"><i data-lucide="${icon}"></i><strong>${escape(title)}</strong><span>${escape(text)}</span></div>`;
}

async function loadDoctors() {
  const search = $('#doctors-search')?.value.trim() || '';
  const status = $('#doctors-status')?.value || '';
  try {
    adminState.doctors = await api(`/api/admin/medicos?busca=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
    renderDoctors(); fillDoctorSelects(adminState.doctors);
  } catch (err) { toast(err.message,'error'); }
}

function renderDoctors() {
  const body = $('#doctors-table');
  body.innerHTML = adminState.doctors.length ? adminState.doctors.map(d => `
    <tr class="clickable" data-doctor-id="${d.id}">
      <td><span class="cell-primary">${escape(d.nome)}</span><span class="cell-secondary">${escape(d.email)}</span></td>
      <td>${escape(prettySpecialty(d.especialidade))}<span class="cell-secondary">${escape(d.crm || 'CRM não informado')}</span></td>
      <td>${formatMoney(d.valor_consulta)}</td><td>${Number(d.consultas_hoje)||0}</td><td>${Number(d.realizadas_count)||0}</td>
      <td><span class="badge ${Number(d.ativo) ? 'success':'danger'}">${Number(d.ativo) ? 'Ativo':'Inativo'}</span></td>
      <td><button class="icon-button" type="button" title="Abrir"><i data-lucide="chevron-right"></i></button></td>
    </tr>`).join('') : `<tr><td colspan="7">${empty('stethoscope','Nenhum médico encontrado','Ajuste os filtros ou cadastre um novo profissional.')}</td></tr>`;
  $$('[data-doctor-id]',body).forEach(r => r.addEventListener('click', () => openDoctor(r.dataset.doctorId)));
  window.refreshIcons?.();
}

function fillDoctorSelects(doctors) {
  const options = `<option value="">Todos os médicos</option>` + doctors.map(d => `<option value="${d.id}">${escape(d.nome)}</option>`).join('');
  ['#appointments-doctor','#report-doctor'].forEach(s => { const el=$(s); if(el){ const old=el.value; el.innerHTML=options; el.value=old; } });
}

async function openDoctor(id) {
  try {
    const d = await api(`/api/admin/medicos/${id}`);
    $('#doctor-id').value=d.id; $('#doctor-name').value=d.nome||''; $('#doctor-cpf').value=d.cpf||''; $('#doctor-crm').value=d.crm||''; $('#doctor-phone').value=d.telefone||''; $('#doctor-email').value=d.email||''; $('#doctor-specialty').value=d.especialidade||''; $('#doctor-price').value=Number(d.valor_consulta||0).toFixed(2);
    $('#doctor-modal-title').textContent=d.nome;
    $('#doctor-profile-summary').innerHTML=`<div class="profile-hero"><div class="profile-photo">${d.foto ? `<img src="${d.foto}" alt="Foto de ${escape(d.nome)}">` : escape(initial(d.nome))}</div><div><h2>${escape(d.nome)}</h2><p>${escape(prettySpecialty(d.especialidade))} • ${escape(d.crm||'CRM não informado')}</p><div style="display:flex;gap:8px;margin-top:10px"><span class="badge ${Number(d.ativo)?'success':'danger'}">${Number(d.ativo)?'Ativo':'Inativo'}</span><span class="badge">${Number(d.consultas_hoje)||0} hoje</span><span class="badge">${Number(d.realizadas_count)||0} realizadas</span></div></div></div>`;
    const statusBtn=$('#doctor-status-action'); statusBtn.textContent=Number(d.ativo)?'Desativar médico':'Reativar médico'; statusBtn.dataset.ativo=Number(d.ativo)?'1':'0'; statusBtn.dataset.name=d.nome;
    openModal('doctor-modal');
  } catch(err){toast(err.message,'error');}
}

$('#doctor-form').addEventListener('submit', async e => {
  e.preventDefault(); const id=$('#doctor-id').value;
  try { await api(`/api/admin/medicos/${id}`,{method:'PUT',body:JSON.stringify({nome:$('#doctor-name').value,email:$('#doctor-email').value,cpf:$('#doctor-cpf').value,crm:$('#doctor-crm').value,telefone:$('#doctor-phone').value,especialidade:$('#doctor-specialty').value,valor_consulta:Number($('#doctor-price').value)})}); toast('Médico atualizado'); closeModal('doctor-modal'); await Promise.all([loadDoctors(),loadDashboard()]); } catch(err){toast(err.message,'error');}
});

$('#doctor-status-action').addEventListener('click', async () => {
  const id=$('#doctor-id').value, btn=$('#doctor-status-action'), active=btn.dataset.ativo==='1', name=btn.dataset.name;
  const ok=await confirmAction({title:active?'Desativar médico?':'Reativar médico?',message:active?`${name} não ficará disponível para novos agendamentos.\nO histórico será preservado.`:`${name} voltará a aparecer para novos agendamentos.`,confirmText:active?'Desativar médico':'Reativar médico',danger:active});
  if(!ok)return;
  try { const r=await api(`/api/admin/medicos/${id}/status`,{method:'PUT',body:JSON.stringify({ativo:!active})}); toast(r.mensagem); closeModal('doctor-modal'); await Promise.all([loadDoctors(),loadDashboard()]); } catch(err){toast(err.message,'error');}
});

$('#new-doctor').addEventListener('click',()=>openModal('new-doctor-modal'));
$('#new-doctor-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const body={nome:$('#new-doctor-name').value,email:$('#new-doctor-email').value,senha:$('#new-doctor-password').value,especialidade:$('#new-doctor-specialty').value,valor_consulta:Number($('#new-doctor-price').value),cpf:$('#new-doctor-cpf').value,crm:$('#new-doctor-crm').value,telefone:$('#new-doctor-phone').value};
  try{const r=await api('/api/admin/medicos',{method:'POST',body:JSON.stringify(body)});toast(r.mensagem);e.target.reset();closeModal('new-doctor-modal');await Promise.all([loadDoctors(),loadDashboard()]);}catch(err){toast(err.message,'error');}
});

let patientSearchTimer;
async function loadPatients(){
  try{adminState.patients=await api(`/api/admin/pacientes?busca=${encodeURIComponent($('#patients-search')?.value.trim()||'')}`);renderPatients();}catch(err){toast(err.message,'error');}
}
function renderPatients(){const b=$('#patients-table');b.innerHTML=adminState.patients.length?adminState.patients.map(p=>`<tr class="clickable" data-patient-id="${p.id}"><td><span class="cell-primary">${escape(p.nome)}</span><span class="cell-secondary">${escape(p.email)}</span></td><td>${escape(p.telefone||'—')}<span class="cell-secondary">${escape(p.cpf||'CPF não informado')}</span></td><td>${p.ultima_consulta?formatDate(p.ultima_consulta):'—'}</td><td>${p.proxima_consulta?formatDate(p.proxima_consulta):'—'}</td><td><span class="badge ${Number(p.ativo)?'success':'danger'}">${Number(p.ativo)?'Ativo':'Inativo'}</span></td><td><button class="icon-button" type="button"><i data-lucide="chevron-right"></i></button></td></tr>`).join(''):`<tr><td colspan="6">${empty('users','Nenhum paciente encontrado','Pacientes cadastrados aparecerão aqui.')}</td></tr>`;$$('[data-patient-id]',b).forEach(r=>r.addEventListener('click',()=>openPatient(r.dataset.patientId)));window.refreshIcons?.();}
async function openPatient(id){try{const data=await api(`/api/admin/pacientes/${id}`),p=data.paciente;$('#patient-id').value=p.id;$('#patient-name').value=p.nome||'';$('#patient-cpf').value=p.cpf||'';$('#patient-birth').value=dateOnly(p.data_nascimento);$('#patient-phone').value=p.telefone||'';$('#patient-email').value=p.email||'';$('#patient-address').value=p.endereco||'';$('#patient-active').value=Number(p.ativo)?'1':'0';$('#patient-modal-title').textContent=p.nome;$('#patient-consultations').innerHTML=data.consultas.length?data.consultas.map(a=>agendaItem(a,true)).join(''):empty('calendar-x','Sem consultas','Este paciente ainda não possui consultas.');openModal('patient-modal');window.refreshIcons?.();}catch(err){toast(err.message,'error');}}
$('#patient-form').addEventListener('submit',async e=>{e.preventDefault();const id=$('#patient-id').value;try{const r=await api(`/api/admin/pacientes/${id}`,{method:'PUT',body:JSON.stringify({nome:$('#patient-name').value,email:$('#patient-email').value,cpf:$('#patient-cpf').value,data_nascimento:$('#patient-birth').value,telefone:$('#patient-phone').value,endereco:$('#patient-address').value,ativo:$('#patient-active').value==='1'})});toast(r.mensagem);closeModal('patient-modal');loadPatients();}catch(err){toast(err.message,'error');}});

async function loadAppointments(){
  const q=new URLSearchParams(); if($('#appointments-search').value.trim())q.set('busca',$('#appointments-search').value.trim());if($('#appointments-status').value)q.set('status',$('#appointments-status').value);if($('#appointments-doctor').value)q.set('medico_id',$('#appointments-doctor').value);if($('#appointments-date').value)q.set('data',$('#appointments-date').value);
  try{adminState.appointments=await api(`/api/admin/agendamentos?${q}`);renderAppointments();}catch(err){toast(err.message,'error');}
}
function renderAppointments(){const b=$('#appointments-table');b.innerHTML=adminState.appointments.length?adminState.appointments.map(a=>`<tr class="clickable" data-appt-id="${a.id}"><td><span class="cell-primary">${escape(a.paciente)}</span><span class="cell-secondary">${escape(a.email)}</span></td><td>${escape(a.medico||'—')}<span class="cell-secondary">${escape(prettySpecialty(a.especialidade))}</span></td><td>${formatDate(a.data)}<span class="cell-secondary">${formatTime(a.horario)}</span></td><td>${statusBadge(a.status)}</td><td>${paymentBadge(a.pagamento_status)}</td><td><button class="icon-button" type="button"><i data-lucide="chevron-right"></i></button></td></tr>`).join(''):`<tr><td colspan="6">${empty('calendar-search','Nenhuma consulta encontrada','Ajuste os filtros para continuar.')}</td></tr>`;$$('[data-appt-id]',b).forEach(r=>r.addEventListener('click',()=>openAppointment(r.dataset.apptId)));window.refreshIcons?.();}

async function openAppointment(id){
  try{const {consulta:a}=await api(`/api/admin/agendamentos/${id}`);$('#appointment-modal-title').textContent=a.paciente;$('#appointment-modal-subtitle').textContent=`${formatDate(a.data)} às ${formatTime(a.horario)} • ${a.medico_nome||'Médico não informado'}`;
    $('#appointment-detail').innerHTML=[
      ['Paciente',a.paciente],['E-mail',a.email],['Médico',a.medico_nome],['Especialidade',prettySpecialty(a.especialidade)],['Data',formatDate(a.data)],['Horário',formatTime(a.horario)],['Status',statusBadge(a.status),true],['Valor',formatMoney(a.valor_consulta)],['Pagamento',paymentBadge(a.pagamento_status),true],['Confirmado em',a.pagamento_status==='pago'?formatDateTime(a.pagamento_confirmado_em):'Ainda não confirmado'],['Motivo',a.motivo_consulta||'Não informado'],['Diagnóstico',a.diagnostico||'Não informado'],['Receita',a.receita||'Não informada'],['Observações',a.observacoes||'Não informado'],['Retorno',a.retorno?(a.data_retorno?`Sim — ${formatDate(a.data_retorno)}`:'Sim'):'Não'],['Realizado em',a.realizado_em?formatDateTime(a.realizado_em):'Ainda não realizada']
    ].map(([l,v,html])=>`<div class="detail-row ${['Motivo','Diagnóstico','Receita','Observações'].includes(l)?'full':''}"><span>${l}</span>${['Motivo','Diagnóstico','Receita','Observações'].includes(l)?`<p>${html?v:escape(v)}</p>`:`<strong>${html?v:escape(v)}</strong>`}</div>`).join('');
    const actions=[];
    if(a.status==='agendada')actions.push(`<button class="btn btn-secondary" data-action="confirm">Confirmar consulta</button>`);
    if(['agendada','confirmada'].includes(a.status))actions.push(`<button class="btn btn-danger" data-action="cancel">Cancelar consulta</button>`);
    if(a.status!=='cancelada'&&a.pagamento_status!=='pago')actions.push(`<button class="btn btn-primary" data-action="pay">Confirmar pagamento</button>`);
    $('#appointment-actions').innerHTML=actions.join('');
    $('[data-action="confirm"]')?.addEventListener('click',()=>appointmentAction(id,'confirmar','Confirmar consulta?','A consulta será marcada como confirmada.','Confirmar'));
    $('[data-action="cancel"]')?.addEventListener('click',()=>appointmentAction(id,'cancelar','Cancelar consulta?',`A consulta de ${a.paciente} será cancelada. O histórico será preservado.`,'Cancelar consulta',true));
    $('[data-action="pay"]')?.addEventListener('click',()=>confirmPayment(id,a));
    openModal('appointment-modal');window.refreshIcons?.();
  }catch(err){toast(err.message,'error');}
}
async function appointmentAction(id,route,title,message,confirmText,danger=false){const ok=await confirmAction({title,message,confirmText,danger});if(!ok)return;try{const r=await api(`/api/admin/agendamentos/${id}/${route}`,{method:'PUT'});toast(r.mensagem);closeModal('appointment-modal');await refreshOperationalData();}catch(err){toast(err.message,'error');}}
async function confirmPayment(id,a){const ok=await confirmAction({title:'Confirmar pagamento?',message:`Confirme apenas se o pagamento presencial de ${a.paciente} foi realmente recebido.\nValor: ${formatMoney(a.valor_consulta)}`,confirmText:'Confirmar pagamento'});if(!ok)return;try{const r=await api(`/api/admin/pagamentos/${id}/confirmar`,{method:'PUT'});toast(r.mensagem);closeModal('appointment-modal');await refreshOperationalData();window.loadNotifications?.();}catch(err){toast(err.message,'error');}}

async function loadPayments(){try{const s=$('#payments-status').value;adminState.payments=await api(`/api/admin/pagamentos?status=${encodeURIComponent(s)}`);renderPayments();}catch(err){toast(err.message,'error');}}
function renderPayments(){const b=$('#payments-table');b.innerHTML=adminState.payments.length?adminState.payments.map(p=>`<tr class="clickable" data-payment-id="${p.id}"><td><span class="cell-primary">${escape(p.paciente)}</span></td><td>${escape(p.medico||'—')}</td><td>${formatDate(p.data)}<span class="cell-secondary">${formatTime(p.horario)} • ${statusLabel(p.consulta_status)}</span></td><td>${formatMoney(p.valor_consulta)}</td><td>${paymentBadge(p.pagamento_status)}</td><td>${p.pagamento_status==='pago'?formatDateTime(p.pagamento_confirmado_em):'—'}</td><td>${p.pagamento_status==='pendente'&&p.consulta_status!=='cancelada'?`<button class="btn btn-primary" data-pay-direct="${p.id}" type="button">Confirmar pagamento</button>`:`<button class="btn btn-ghost" type="button">Detalhes</button>`}</td></tr>`).join(''):`<tr><td colspan="7">${empty('wallet-cards','Nenhum pagamento encontrado','Os pagamentos das consultas aparecerão aqui.')}</td></tr>`;$$('[data-payment-id]',b).forEach(r=>r.addEventListener('click',e=>{if(e.target.closest('[data-pay-direct]'))return;openAppointment(r.dataset.paymentId)}));$$('[data-pay-direct]',b).forEach(btn=>btn.addEventListener('click',async e=>{e.stopPropagation();const p=adminState.payments.find(x=>String(x.id)===btn.dataset.payDirect);await confirmPayment(p.id,p);}));window.refreshIcons?.();}

function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function compareAppointments(a,b){return `${dateOnly(a.data)} ${formatTime(a.horario)}`.localeCompare(`${dateOnly(b.data)} ${formatTime(b.horario)}`);}
function agendaItem(a,compact=false){return `<button class="agenda-item" type="button" data-agenda-appt="${a.id}" style="width:100%;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer"><strong>${formatTime(a.horario)}</strong><div><span class="cell-primary">${escape(a.paciente)}</span><span class="cell-secondary">${escape(a.medico||a.medico_nome||'Médico')} • ${escape(prettySpecialty(a.especialidade))}</span></div><div>${statusBadge(a.status)}</div><div>${paymentBadge(a.pagamento_status)}</div></button>`;}

async function loadAgenda(){
  try{adminState.appointments=await api('/api/admin/agendamentos');renderAgenda();}catch(err){toast(err.message,'error');}
}
function renderAgenda(){
  const d=adminState.agendaDate, view=adminState.agendaView;$$('[data-agenda-view]').forEach(b=>b.classList.toggle('active',b.dataset.agendaView===view));
  if(view==='month'){ $('#agenda-calendar-wrap').hidden=false;$('#agenda-list-view').hidden=true;renderMonthCalendar(d); }
  else { $('#agenda-calendar-wrap').hidden=true;$('#agenda-list-view').hidden=false;renderAgendaListView(view,d); }
  window.refreshIcons?.();
}
function renderMonthCalendar(d){
  const y=d.getFullYear(),m=d.getMonth(),names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];$('#agenda-title').textContent=`${names[m]} ${y}`;
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let html=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=>`<div class="calendar-weekday">${x}</div>`).join('');
  for(let i=0;i<first;i++)html+='<div class="calendar-cell muted"></div>';
  for(let day=1;day<=days;day++){const date=localDate(new Date(y,m,day)),items=adminState.appointments.filter(a=>dateOnly(a.data)===date);html+=`<button class="calendar-cell ${date===localDate(new Date())?'today':''}" data-calendar-date="${date}" type="button"><span class="calendar-number">${day}</span>${items.length?`<span class="calendar-count">${items.length} ${items.length===1?'consulta':'consultas'}</span>`:''}</button>`;}
  $('#agenda-calendar').innerHTML=html;$$('[data-calendar-date]').forEach(b=>b.addEventListener('click',()=>{adminState.agendaDate=new Date(`${b.dataset.calendarDate}T12:00:00`);adminState.agendaView='day';renderAgenda();}));
}
function renderAgendaListView(view,d){
  let start=new Date(d),end=new Date(d);if(view==='week'){const day=start.getDay();start.setDate(start.getDate()-day);end=new Date(start);end.setDate(start.getDate()+6);$('#agenda-title').textContent=`${formatDate(localDate(start))} — ${formatDate(localDate(end))}`;}else{$('#agenda-title').textContent=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});}
  const items=adminState.appointments.filter(a=>{const x=dateOnly(a.data);return view==='day'?x===localDate(d):x>=localDate(start)&&x<=localDate(end)}).sort(compareAppointments);
  $('#agenda-list-view').innerHTML=items.length?items.map(a=>agendaItem(a)).join(''):empty('calendar-x','Nenhuma consulta','Não há consultas neste período.');$$('[data-agenda-appt]').forEach(b=>b.addEventListener('click',()=>openAppointment(b.dataset.agendaAppt)));window.refreshIcons?.();
}
$$('[data-agenda-view]').forEach(b=>b.addEventListener('click',()=>{adminState.agendaView=b.dataset.agendaView;renderAgenda();}));
$('#agenda-today').addEventListener('click',()=>{adminState.agendaDate=new Date();renderAgenda();});
$('#agenda-prev').addEventListener('click',()=>{if(adminState.agendaView==='month')adminState.agendaDate.setMonth(adminState.agendaDate.getMonth()-1);else adminState.agendaDate.setDate(adminState.agendaDate.getDate()-(adminState.agendaView==='week'?7:1));renderAgenda();});
$('#agenda-next').addEventListener('click',()=>{if(adminState.agendaView==='month')adminState.agendaDate.setMonth(adminState.agendaDate.getMonth()+1);else adminState.agendaDate.setDate(adminState.agendaDate.getDate()+(adminState.agendaView==='week'?7:1));renderAgenda();});

async function loadReports(){
  const start=$('#report-start'),end=$('#report-end');if(!start.value){const d=new Date();d.setMonth(d.getMonth()-5);d.setDate(1);start.value=localDate(d);}if(!end.value)end.value=localDate(new Date());
  const q=new URLSearchParams({inicio:start.value,fim:end.value});if($('#report-doctor').value)q.set('medico_id',$('#report-doctor').value);
  try{const r=await api(`/api/admin/relatorios?${q}`);$('#report-metrics').innerHTML=`<div class="metric"><strong>${Number(r.resumo.total)||0}</strong><span>Consultas</span></div><div class="metric"><strong>${Number(r.resumo.realizadas)||0}</strong><span>Realizadas</span></div><div class="metric"><strong>${Number(r.resumo.pagamentos_pendentes)||0}</strong><span>Pagamentos pendentes</span></div><div class="metric"><strong>${formatMoney(r.resumo.faturamento)}</strong><span>Faturamento</span></div>`;renderBars('#report-monthly-chart',r.mensal,'mes','faturamento',v=>formatMoney(v));renderBars('#report-doctor-chart',r.por_medico.slice(0,8),'nome','consultas',v=>`${v} consultas`);}catch(err){toast(err.message,'error');}
}
function renderBars(selector,rows,labelKey,valueKey,formatter){const max=Math.max(1,...rows.map(r=>Number(r[valueKey])||0));$(selector).innerHTML=rows.length?rows.map(r=>`<div style="display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center;padding:7px 0"><span style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escape(r[labelKey])}</span><div style="height:8px;background:var(--surface-2);border-radius:999px;overflow:hidden"><div style="height:100%;width:${Math.max(2,(Number(r[valueKey])||0)/max*100)}%;background:var(--brand);border-radius:999px"></div></div><strong style="font-size:11px">${escape(formatter(Number(r[valueKey])||0))}</strong></div>`).join(''):empty('chart-no-axes-combined','Sem dados','Não há dados para o período selecionado.');}
$('#report-run').addEventListener('click',loadReports);

async function loadLogs(){try{const rows=await api('/api/admin/logs?limite=150');$('#logs-table').innerHTML=rows.length?rows.map(l=>`<tr><td>${formatDateTime(l.criado_em)}</td><td>${escape(l.usuario_nome||'Sistema')}</td><td><span class="badge">${escape(l.usuario_tipo||'sistema')}</span></td><td>${escape(l.acao)}</td></tr>`).join(''):`<tr><td colspan="4">${empty('history','Nenhum log','As ações importantes aparecerão aqui.')}</td></tr>`;}catch(err){toast(err.message,'error');}}

async function loadSettings(){try{const s=await api('/api/admin/configuracoes');$('#setting-name').value=s.nome_clinica||'';$('#setting-phone').value=s.telefone||'';$('#setting-email').value=s.email||'';$('#setting-address').value=s.endereco||'';$('#setting-hours').value=s.horario_funcionamento||'';$('#setting-logo').value=s.logo||'';}catch(err){toast(err.message,'error');}}
$('#setting-logo-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024){toast('A imagem deve ter no máximo 2 MB.','warning');e.target.value='';return;}$('#setting-logo').value=await fileToDataUrl(f);});
$('#settings-form').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('/api/admin/configuracoes',{method:'PUT',body:JSON.stringify({nome_clinica:$('#setting-name').value,telefone:$('#setting-phone').value,email:$('#setting-email').value,endereco:$('#setting-address').value,horario_funcionamento:$('#setting-hours').value,logo:$('#setting-logo').value||null})});toast(r.mensagem);}catch(err){toast(err.message,'error');}});
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}

function prettySpecialty(v){return String(v||'Não informada').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}

async function refreshOperationalData(){await Promise.all([loadDashboard(),loadAppointments(),loadPayments(),loadAgenda()]);}

function debounce(fn,ms=300){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
$('#doctors-search').addEventListener('input',debounce(loadDoctors));$('#doctors-status').addEventListener('change',loadDoctors);
$('#patients-search').addEventListener('input',()=>{clearTimeout(patientSearchTimer);patientSearchTimer=setTimeout(loadPatients,300);});
['#appointments-search','#appointments-status','#appointments-doctor','#appointments-date'].forEach(s=>$(s).addEventListener(s==='#appointments-search'?'input':'change',debounce(loadAppointments,200)));
$('#appointments-clear').addEventListener('click',()=>{$('#appointments-search').value='';$('#appointments-status').value='';$('#appointments-doctor').value='';$('#appointments-date').value='';loadAppointments();});
$('#payments-status').addEventListener('change',loadPayments);

$('#logout').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});}catch(_){}location.href='login.html';});

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshOperationalData();});

(async function init(){
  if(!await ensureAdmin())return;
  try{
    await Promise.all([loadDoctors(),loadDashboard(),loadAppointments(),loadPatients(),loadPayments(),loadAgenda(),loadLogs()]);
    setTimeout(()=>document.querySelector('#page-loader')?.classList.add('hidden'),100);
    setInterval(()=>{if(document.visibilityState==='visible')Promise.all([loadDashboard(),loadPayments()]);},15000);
  }catch(err){toast(err.message,'error');}
  window.refreshIcons?.();
})();
