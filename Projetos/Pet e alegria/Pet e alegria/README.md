# Pet e Alegria — LCODE V5

Projeto fictício de pet shop com visual alegre, adoção responsável, painel administrativo e banco MySQL.

## Direção desta versão

O site público foi tratado como um **pet shop real**, não como uma demonstração técnica. A API continua existindo internamente porque o frontend e o painel precisam dela, mas não é divulgada no menu, na Home ou no rodapé e não existe mais página pública de documentação.

## Tecnologias

- HTML, CSS e JavaScript
- Node.js + Express
- MySQL (`mysql2`)
- autenticação administrativa com `bcryptjs`
- sessões persistidas no MySQL
- Helmet, rate limit e validação de dados

## Como iniciar — PowerShell

O fluxo foi simplificado para ficar parecido com o da Clínica Vida+: **não é necessário usar arquivo BAT**.

1. Ligue o seu MySQL portátil e deixe a janela do `mysqld` aberta.
2. Abra o PowerShell na pasta deste projeto.
3. Na primeira vez, rode:

```powershell
npm.cmd install
```

4. Para iniciar o projeto, rode:

```powershell
.\iniciar.ps1
```

5. Digite a senha do `root` do MySQL quando solicitado.

O sistema cria/atualiza automaticamente o banco `pet_e_alegria`, as tabelas necessárias e os dados iniciais. Se ainda não existir administrador, a senha temporária do primeiro admin aparece no terminal uma única vez.

## Endereços locais

- Site: `http://localhost:3000`
- Adoção: `http://localhost:3000/adocao.html`
- Admin: `http://localhost:3000/admin.html`

## Banco

Por padrão:

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_NAME=pet_e_alegria
```

A senha não precisa ficar escrita no projeto: `iniciar.ps1` pede a senha no terminal em cada inicialização.

## Observação

A camada HTTP usada internamente pelo site continua versionada em `/api/v1`, mas não é apresentada como produto público do Pet e Alegria.
