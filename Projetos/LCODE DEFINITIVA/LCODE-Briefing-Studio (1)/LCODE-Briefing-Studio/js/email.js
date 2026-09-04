/**
 * email.js
 * Monta a mensagem organizada do briefing e envia via EmailJS.
 *
 * Configuração — plano gratuito do EmailJS:
 * 1. Crie uma conta em emailjs.com e conecte o e-mail que vai receber os briefings.
 * 2. Crie um template com a variável {{mensagem_completa}} no corpo.
 * 3. Cole os três IDs abaixo (Public Key, Service ID, Template ID).
 */
const EmailService = (() => {
  const PUBLIC_KEY = "cdzdiwUboGj62MUNX";
  const SERVICE_ID = "service_8mkkkdp";
  const TEMPLATE_ID = "template_h93nism";
  const DESTINATION = "paulo.luc777@gmail.com";

  if (window.emailjs && typeof emailjs.init === "function") {
    emailjs.init({ publicKey: PUBLIC_KEY });
  }

  const line = (label, value) => `${label}: ${fallback(value)}`;
  const fallback = (v) => (Array.isArray(v) ? (v.length ? v.join(", ") : "Não informado") : (v && String(v).trim()) || "Não informado");
  const block = (title, lines) => `${title}\n${"-".repeat(title.length)}\n${lines.join("\n")}`;

  function buildMessage(d) {
    const cliente = block("CLIENTE", [
      line("Empresa", d.empresa),
      line("Responsável", d.responsavel),
      line("WhatsApp", d.whatsapp),
      line("E-mail", d.email),
      line("Segmento", d.segmento),
      line("Cidade", d.cidade),
      line("Instagram", d.instagram),
      line("Site atual", d.siteAtual),
    ]);

    const projeto = block("PROJETO", [
      line("Solução procurada", d.solucao),
      line("Objetivo", d.objetivo),
      "",
      line("Sobre a empresa", d.sobreEmpresa),
      line("Serviços/produtos", d.servicosProdutos),
      line("Clientes", d.clientes),
      line("Diferencial", d.diferencial),
    ]);

    const identidade = block("IDENTIDADE VISUAL", [
      line("Estilo", d.estilo),
      line("Cores desejadas", d.coresDesejadas),
      line("Cores indesejadas", d.coresIndesejadas),
      line("Referências visuais", d.referenciasVisuais),
    ]);

    const conteudo = block("CONTEÚDO", [
      line("Já possui", d.possui),
      line("Situação das imagens", d.imagens),
    ]);

    const estrutura = block("ESTRUTURA", [
      line("Páginas desejadas", d.paginas),
      line("Seção específica", d.secaoEspecifica),
    ]);

    const referencias = block("REFERÊNCIAS", [
      line("Sites que gosta", d.sitesQueGosta),
      line("Outras referências", d.outrasReferencias),
      line("O que não gostaria", d.naoGostaria),
      line("Observações finais", d.observacoes),
    ]);

    return [
      "NOVO BRIEFING LCODE",
      "====================================",
      "",
      cliente, "", projeto, "", identidade, "", conteudo, "", estrutura, "", referencias,
      "",
      "====================================",
      `Enviado em: ${new Date().toLocaleString("pt-BR")}`,
    ].join("\n");
  }

  async function send(d) {
    if (!window.emailjs) throw new Error("EmailJS não carregado.");
    return emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: DESTINATION,
      reply_to: d.email,
      from_name: d.responsavel || d.empresa,
      subject: `Novo briefing LCODE — ${d.empresa}`,
      mensagem_completa: buildMessage(d),
      empresa: d.empresa,
      responsavel: d.responsavel,
      whatsapp: d.whatsapp,
    });
  }

  return { send, buildMessage };
})();
