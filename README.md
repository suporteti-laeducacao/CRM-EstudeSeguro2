# CRM de Vendas (white label)

CRM para venda de matrículas. Cada cliente tem o próprio projeto Supabase e o próprio site; nome e logo são configurados na tela **Configurações**, sem mexer no código.

## Como colocar no ar para um cliente novo

Tudo abaixo é feito uma vez por cliente. Rode os comandos no terminal, dentro desta pasta.

### 1. Criar o banco

1. Em [supabase.com](https://supabase.com), crie um projeto novo. Guarde a senha do banco.
2. Copie o **Reference ID** do projeto (Project Settings > General).
3. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. A tela de login não tem cadastro, mas é esta opção que bloqueia cadastros feitos direto pela API. A criação de usuários pelo admin continua funcionando.

### 2. Instalar a estrutura

```
npm install
npx supabase login
npx supabase link --project-ref SEU_REFERENCE_ID
npx supabase db push
npx supabase functions deploy
```

### 3. Publicar o site

Publique na Vercel, Netlify ou Cloudflare Pages (o plano grátis atende). Comando de build: `npm run build`. Pasta de saída: `dist`.

Configure estas variáveis no serviço de hospedagem, com os dados de **Project Settings > API** do projeto do cliente:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Depois, em **Authentication > URL Configuration** no Supabase, coloque o endereço do site em **Site URL**.

### 4. Criar o primeiro administrador

Os usuários são criados pelo admin na tela **Usuários**, então o primeiro admin precisa ser definido à mão:

1. No Supabase, em **Authentication > Users > Add user > Create new user**, informe e-mail e senha e marque **Auto Confirm User**.
2. No **SQL Editor** do Supabase, rode:

```sql
SELECT public.definir_primeiro_admin('email@docliente.com');
```

Esse comando só funciona enquanto não houver nenhum admin. Depois disso, use a tela **Usuários**.

### 5. Personalizar

Entre como admin e abra **Configurações** no menu: informe o nome da empresa e envie a logo.

### 6. Conferir antes de entregar

- [ ] Login e saída do sistema
- [ ] Criar um usuário na tela **Usuários** e entrar com ele (testa as funções de servidor)
- [ ] Conferir que a tela de login não oferece cadastro
- [ ] Cadastrar um aluno e uma venda
- [ ] Enviar um comprovante
- [ ] Baixar o relatório financeiro e o fechamento mensal em PDF, conferindo a logo
- [ ] Recarregar a página em `/vendas` (não pode dar erro 404)

## Rodar no computador

Copie `.env.example` para `.env`, preencha com os dados do projeto e rode `npm run dev`.

Use sempre um projeto de teste ou do próprio cliente: o `.env` decide em qual banco o sistema grava.

## Testes

```
npm run build
npx vitest run
```

## Atenção ao plano grátis do Supabase

- O projeto é pausado depois de 7 dias sem uso e precisa ser reativado no painel.
- Não há backup automático. Com dados financeiros reais, combine uma rotina de exportação ou use um plano pago.
- Confira os limites atuais em [supabase.com/pricing](https://supabase.com/pricing).
