# TikTok Feed

Um feed pessoal e estático para acompanhar os vídeos recentes dos criadores que você segue. A página é hospedada no GitHub Pages; a coleta roda no GitHub Actions e salva somente dados públicos em `data/posts.json`.

## Antes de começar

O coletor usa o Actor [TikTok Scraper, da Clockworks](https://apify.com/clockworks/tiktok-scraper), pois ele aceita perfis públicos, permite limitar a coleta e oferece campos necessários para este feed. Em 13 de novembro de 2026, a página do Actor informa preço **a partir de US$ 1,70 por 1.000 resultados**. Com o limite de 30 criadores × 5 vídeos × 15 coletas/mês (2.250 resultados), a estimativa é **US$ 3,83/mês**, antes de eventuais custos de execução/plataforma do Apify. Preços e créditos mudam: confira a página de Pricing do Actor antes de ativar a automação e mantenha limites de gasto no Apify.

Este projeto nunca baixa vídeos, comentários ou métricas; apenas ID, autor, legenda, data, link e miniatura.

## Configuração inicial

1. Crie uma conta gratuita em [Apify](https://console.apify.com/sign-up).
2. No Apify, abra **Settings → Integrations**, crie um token de API e copie-o. Não o coloque em arquivos do repositório.
3. No GitHub do seu repositório, abra **Settings → Secrets and variables → Actions → New repository secret**. Crie o segredo `APIFY_TOKEN` e cole o token.
4. (Opcional) Em **Variables**, crie `APIFY_ACTOR_ID` com `clockworks/tiktok-scraper`. Se não criar, esse já é o padrão do projeto.
5. Edite [`creators.json`](creators.json) e troque `exemplo_criador` pelos usernames, sem `@`. Você pode adicionar ou remover linhas a qualquer momento pelo próprio GitHub.
6. Faça o commit dessas alterações e abra a aba **Actions**. Selecione **Atualizar TikTok Feed** e clique em **Run workflow** para a primeira coleta.
7. Habilite Pages em **Settings → Pages → Build and deployment → Source: GitHub Actions**. Quando o workflow terminar, o link publicado aparecerá na etapa “Deploy to GitHub Pages” e em **Settings → Pages**.

## Uso e automação

- O workflow roda diariamente às 09:00 de Brasília (12:00 UTC), mas o script coleta somente se a última coleta bem-sucedida tiver pelo menos 48 horas. A execução manual força uma coleta imediatamente.
- Em uma falha de perfil, os posts antigos daquele perfil são preservados. Se todos falharem, `data/posts.json` não é alterado e o site continua no ar.
- O arquivo mantém somente posts dos últimos 30 dias e somente dos creators atualmente listados.
- Na página, aparecem primeiro os vídeos das últimas 48 horas. Use **Mostrar mais** para o restante. Um clique carrega o player oficial do TikTok apenas naquele momento.

## Conferir custos e funcionamento

No Apify, acompanhe **Billing/Usage** e abra a página do Actor para consultar a tabela de preço atual. Defina um limite de gasto/usage limit na conta antes de rodar em escala; não ative plano pago automaticamente. Para reduzir custo, diminua a quantidade de creators, mude a frequência ou reduza o limite de 5 resultados em `scripts/fetch-posts.js`.

No GitHub, abra **Actions → Atualizar TikTok Feed**. Um ✓ verde indica a coleta/publicação concluída; abra o log “Coletar posts” para ver cada perfil processado. O arquivo [`data/posts.json`](data/posts.json) registra também a data da última sincronização bem-sucedida.

## Rodar no computador (opcional)

Copie `.env.example` para `.env`, adicione seu token e instale as dependências:

```bash
npm install
set -a; source .env; set +a
npm run fetch-posts -- --force
```

Em seguida, abra o projeto com qualquer servidor estático local. Nunca envie o arquivo `.env` ao GitHub.
