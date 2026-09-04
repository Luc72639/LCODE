# LCODE Briefing Studio

Ferramenta oficial da LCODE para coleta de briefing de clientes antes do
desenvolvimento de sites e sistemas. Tela inicial + formulário guiado em
7 etapas + confirmação, sem construtor visual — apenas planejamento.

## Estrutura

```
LCODE-Briefing-Studio/
├── index.html
├── css/
│   ├── style.css        tokens, layout e componentes
│   └── responsive.css   media queries
├── js/
│   ├── storage.js        rascunho automático + trava de envio único
│   ├── email.js           montagem da mensagem + envio via EmailJS
│   └── app.js             navegação, validação e telas
├── assets/
│   ├── logo.png
│   ├── favicon.png / favicon-512.png
│   └── icons/
└── README.md
```

## Configurar o e-mail (EmailJS)
As chaves já estão preenchidas em `js/email.js`:

```js
PUBLIC_KEY  = "cdzdiwUboGj62MUNX"
SERVICE_ID  = "service_8mkkkdp"
TEMPLATE_ID = "template_h93nism"
```

No template do EmailJS, use `{{mensagem_completa}}` no corpo do e-mail — ela
já chega organizada em seções (CLIENTE, PROJETO, IDENTIDADE VISUAL,
CONTEÚDO, ESTRUTURA, REFERÊNCIAS).

## Envio único
Depois de um envio bem-sucedido, o dispositivo é marcado via `localStorage`
e o formulário passa a mostrar a tela de confirmação em vez do briefing.
Para testar novamente, limpe o `localStorage` do site.

## Tema
Claro por padrão, com alternância para escuro salva em `localStorage`.

## Publicar
Site 100% estático (HTML/CSS/JS puro) — publique a pasta diretamente no
Cloudflare Pages ou qualquer hospedagem estática, sem etapa de build.
