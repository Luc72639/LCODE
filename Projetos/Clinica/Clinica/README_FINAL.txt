CLÍNICA VIDA+ / LCODE — VERSÃO FINAL
=====================================

COMO INICIAR
1. Certifique-se de que o MySQL está ligado e que existe o banco clinica_vida.
2. Abra PowerShell na pasta backend.
3. Execute: .\iniciar.ps1
4. Informe a senha do MySQL quando solicitado.
5. Abra no navegador: http://localhost:3000

Se as dependências forem removidas da pasta do projeto, rode "npm install" antes de iniciar.

BANCO DE DADOS
- A tabela agendamentos continua sendo a fonte central de consultas, histórico clínico e financeiro.
- Na primeira execução, o servidor verifica e acrescenta apenas campos/tabelas necessários ao projeto final.
- A tabela antiga consultas_realizadas não é utilizada.
- Não existe metodo_pagamento. O pagamento é presencial e só registra pendente/pago.
- O valor da consulta é salvo também no agendamento para preservar o histórico financeiro se o preço do médico mudar depois.

FLUXOS PRINCIPAIS
PACIENTE
- cadastro e login
- agendamento com horários reais disponíveis
- dashboard
- consultas e histórico
- detalhes clínicos após realização
- perfil editável

MÉDICO
- dashboard
- agenda exclusiva
- atendimento com Salvar e Finalizar atendimento separados
- diagnóstico, receita, observações e retorno
- histórico do paciente com o próprio médico
- impressão de receita
- perfil somente leitura
- foto de perfil editável

ADMINISTRADOR
- dashboard
- agenda dia/semana/mês
- agendamentos clicáveis
- pacientes com busca, detalhes, edição e histórico
- médicos clicáveis, edição, desativação e reativação
- pagamentos presenciais com confirmação
- relatórios simples
- logs administrativos
- configurações gerais da clínica

INTERFACE
- modo claro/escuro com preferência salva
- sidebar aberta/compacta com preferência salva
- sidebar em formato drawer no celular
- Lucide Icons
- toasts e modais próprios
- notificações internas pelo sino
- busca e filtros nas telas principais

SEGURANÇA
- senhas com bcrypt
- rotas protegidas por perfil
- SQL parametrizado
- dados de outros pacientes não são expostos publicamente
- backend e node_modules bloqueados na pasta pública
- senha do MySQL não fica gravada no código

OBSERVAÇÃO
Para demonstração no portfólio, use apenas dados fictícios.
