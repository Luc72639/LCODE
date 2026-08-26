const form = document.querySelector('.appointment-form');
const doctorSelect = document.querySelector('#doctor');
const specialtySelect = document.querySelector('#specialty');
const dateInput = document.querySelector('#date');
const timeInput = document.querySelector('#time');
const availableTimes = document.querySelector('#available-times');
const motivoConsulta = document.querySelector('#motivo-consulta');
const notification = document.querySelector('#form-notification');
const consultationPrice = document.querySelector('#consultation-price');
const consultationPriceValue = document.querySelector('#consultation-price-value');
const accountLink = document.querySelector('#account-link');
const nameInput = document.querySelector('#name');
const emailInput = document.querySelector('#email');

let medicosDisponiveis = [];
let sessaoAtual = null;

const esc = v => window.appEscape ? window.appEscape(v) : String(v ?? '');

function mostrarNotificacao(tipo, titulo, mensagem) {
  if (!notification) return;
  notification.className = `form-notification show ${tipo}`;
  notification.innerHTML = `<span class="notification-title">${esc(titulo)}</span><span>${esc(mensagem)}</span>`;
}
function esconderNotificacao(){ if(notification){notification.className='form-notification';notification.innerHTML='';} }
function formatarValor(valor){const n=Number(valor);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Valor não informado';}
function mostrarValorConsulta(medico){if(!consultationPrice||!consultationPriceValue)return;if(!medico){consultationPrice.classList.remove('show');consultationPriceValue.textContent='—';return;}consultationPriceValue.textContent=formatarValor(medico.valor_consulta);consultationPrice.classList.add('show');}
function pretty(v){return String(v||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}


async function carregarConfiguracoesPublicas(){
  try{
    const r=await fetch('/api/configuracoes/publicas',{cache:'no-store'});if(!r.ok)return;const c=await r.json();
    if(c.endereco&&document.querySelector('#public-address'))document.querySelector('#public-address').textContent=c.endereco;
    if(c.telefone&&document.querySelector('#public-phone'))document.querySelector('#public-phone').textContent=c.telefone;
    if(c.email&&document.querySelector('#public-email'))document.querySelector('#public-email').textContent=c.email;
  }catch(_){}
}

async function verificarSessaoPublica(){
  try{
    const r=await fetch('/api/sessao',{cache:'no-store'});
    if(!r.ok)throw new Error();
    const d=await r.json();
    sessaoAtual=d.logado?d.usuario:null;
  }catch(_){sessaoAtual=null;}
  atualizarAcessoPublico();
}
function atualizarAcessoPublico(){
  if(!accountLink)return;
  if(!sessaoAtual){accountLink.href='login.html';accountLink.textContent='Entrar';if(nameInput){nameInput.readOnly=false;nameInput.value='';}if(emailInput){emailInput.readOnly=false;emailInput.value='';}return;}
  const pages={paciente:'painel-paciente.html',medico:'painel-medico.html',admin:'painel-admin.html'};
  accountLink.href=pages[sessaoAtual.tipo]||'login.html';accountLink.textContent='Minha conta';
  if(sessaoAtual.tipo==='paciente'){
    if(nameInput){nameInput.value=sessaoAtual.nome||'';nameInput.readOnly=true;}
    if(emailInput){emailInput.value=sessaoAtual.email||'';emailInput.readOnly=true;}
  }
}

async function carregarMedicos(){
  try{
    const r=await fetch('/api/medicos',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Não foi possível carregar os médicos.');medicosDisponiveis=Array.isArray(d)?d:[];
    const specialties=[...new Set(medicosDisponiveis.map(m=>m.especialidade).filter(Boolean))].sort();
    specialtySelect.innerHTML='<option value="">Selecione</option>'+specialties.map(s=>`<option value="${esc(s)}">${esc(pretty(s))}</option>`).join('');
    doctorSelect.innerHTML='<option value="">Primeiro selecione uma especialidade</option>';doctorSelect.disabled=true;
    renderizarEquipe();
  }catch(err){doctorSelect.innerHTML='<option value="">Não foi possível carregar médicos</option>';doctorSelect.disabled=true;mostrarNotificacao('error','Não foi possível carregar a equipe',err.message);}
}
function renderizarEquipe(){
  const grid=document.querySelector('.team-grid');if(!grid||!medicosDisponiveis.length)return;
  const fallbacks=['img/doctor-1.jpg','img/doctor-2.jpg','img/doctor-3.jpg'];
  grid.innerHTML=medicosDisponiveis.slice(0,6).map((m,i)=>`<article class="doctor-card"><img src="${m.foto||fallbacks[i%fallbacks.length]}" alt="${esc(m.nome)}"><div class="doctor-info"><span>${esc(pretty(m.especialidade))}</span><h3>${esc(m.nome)}</h3><p>${esc(m.crm||'Profissional da Clínica Vida+')}</p></div></article>`).join('');
}

specialtySelect?.addEventListener('change',()=>{
  esconderNotificacao();timeInput.value='';availableTimes.innerHTML='<p class="time-placeholder">Selecione um médico e uma data.</p>';mostrarValorConsulta(null);
  const specialty=specialtySelect.value, doctors=medicosDisponiveis.filter(m=>m.especialidade===specialty);
  doctorSelect.disabled=!specialty;doctorSelect.innerHTML=specialty?'<option value="">Selecione um médico</option>'+doctors.map(m=>`<option value="${m.id}">${esc(m.nome)}</option>`).join(''):'<option value="">Primeiro selecione uma especialidade</option>';
});
doctorSelect?.addEventListener('change',()=>{const m=medicosDisponiveis.find(x=>String(x.id)===doctorSelect.value);mostrarValorConsulta(m);timeInput.value='';if(dateInput.value)carregarHorariosDisponiveis();});

dateInput.min=localDate();
dateInput?.addEventListener('change',()=>{esconderNotificacao();carregarHorariosDisponiveis();});
async function carregarHorariosDisponiveis(){
  const medicoId=doctorSelect.value,data=dateInput.value;timeInput.value='';if(!medicoId||!data){availableTimes.innerHTML='<p class="time-placeholder">Selecione um médico e uma data.</p>';return;}
  availableTimes.innerHTML='<p class="time-placeholder">Carregando horários...</p>';
  try{const r=await fetch(`/api/horarios-disponiveis?medico_id=${encodeURIComponent(medicoId)}&data=${encodeURIComponent(data)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Não foi possível carregar os horários.');if(!d.horarios?.length){availableTimes.innerHTML='<p class="time-placeholder">Nenhum horário disponível neste dia.</p>';return;}availableTimes.innerHTML='';d.horarios.forEach(h=>{const b=document.createElement('button');b.type='button';b.className='available-time';b.textContent=h;b.addEventListener('click',()=>{document.querySelectorAll('#available-times .available-time').forEach(x=>x.classList.remove('selecionado'));b.classList.add('selecionado');timeInput.value=h;});availableTimes.appendChild(b);});}catch(err){availableTimes.innerHTML='<p class="time-placeholder">Não foi possível carregar os horários.</p>';mostrarNotificacao('error','Erro ao verificar horários',err.message);}
}

form?.addEventListener('submit',async e=>{
  e.preventDefault();esconderNotificacao();
  if(!sessaoAtual||sessaoAtual.tipo!=='paciente'){
    mostrarNotificacao('warning','Entre como paciente','Para proteger seus dados e seu histórico, faça login ou crie sua conta antes de agendar.');
    window.appToast?.('É necessário entrar como paciente','warning');
    setTimeout(()=>{location.href='login.html?next=index.html%23agendamento';},850);return;
  }
  const specialty=specialtySelect.value,medicoId=doctorSelect.value,date=dateInput.value,time=timeInput.value,motivo=motivoConsulta.value.trim();
  if(!specialty||!medicoId||!date||!time){mostrarNotificacao('warning','Preencha os campos obrigatórios','Escolha especialidade, médico, data e horário.');return;}
  if(date<localDate()){mostrarNotificacao('warning','Data inválida','Escolha uma data de hoje em diante.');return;}
  const med=medicosDisponiveis.find(m=>String(m.id)===String(medicoId));
  const ok=await (window.appConfirm?window.appConfirm({title:'Confirmar agendamento?',message:`${med?.nome||'Médico'}\n${pretty(specialty)}\n${date.split('-').reverse().join('/')} às ${time}\n${formatarValor(med?.valor_consulta)}\n\nO pagamento será realizado presencialmente.`,confirmText:'Agendar consulta'}):Promise.resolve(true));
  if(!ok)return;
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Agendando...';
  try{const r=await fetch('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({motivo_consulta:motivo,especialidade:specialty,medico_id:Number(medicoId),data:date,horario:time})});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Não foi possível realizar o agendamento.');mostrarNotificacao('success','Consulta agendada','Seu agendamento foi criado e já aparece na sua área do paciente.');window.appToast?.('Consulta agendada','success',`${med?.nome||''} • ${date.split('-').reverse().join('/')} ${time}`);specialtySelect.value='';doctorSelect.innerHTML='<option value="">Primeiro selecione uma especialidade</option>';doctorSelect.disabled=true;dateInput.value='';timeInput.value='';motivoConsulta.value='';availableTimes.innerHTML='<p class="time-placeholder">Selecione um médico e uma data.</p>';mostrarValorConsulta(null);}catch(err){mostrarNotificacao('error','Não foi possível agendar',err.message);window.appToast?.(err.message,'error');await carregarHorariosDisponiveis();}finally{btn.disabled=false;btn.textContent='Solicitar agendamento';}
});

// Navegação mobile do site público.
const nav=document.querySelector('.nav');
const publicMenuButton=document.querySelector('#public-menu-button');
publicMenuButton?.addEventListener('click',()=>{nav?.classList.toggle('public-nav-open');window.refreshIcons?.();});
nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>nav.classList.remove('public-nav-open')));
document.addEventListener('click',e=>{if(nav?.classList.contains('public-nav-open')&&!e.target.closest('.header-content'))nav.classList.remove('public-nav-open');});

document.addEventListener('DOMContentLoaded',async()=>{await Promise.all([verificarSessaoPublica(),carregarMedicos(),carregarConfiguracoesPublicas()]);window.refreshIcons?.();});
