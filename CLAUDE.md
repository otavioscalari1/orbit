# Orbit

App para organizar a vida na faculdade: calendário com provas e trabalhos, criação de questões de estudo, upload de arquivos importantes, entre outras funcionalidades.

O autor está começando em projetos do zero. Converse sempre em **português (pt-BR)**, explique o porquê das decisões e evite jargão sem explicação.

## Stack

- **Frontend** (`client/`): React + TypeScript + Vite + Tailwind CSS v4
- **Backend** (`server/`): Node + Express + TypeScript (executado com `tsx`)
- **Banco de dados**: PostgreSQL 18 local (porta 5432, banco `orbit`), visualizado pelo DBeaver
- **Acesso ao banco no código**: Prisma Client (com `@prisma/adapter-pg`)

## Estrutura

```
orbit/
├── CLAUDE.md
├── migrations/          # migrations SQL escritas à mão (ver regras abaixo)
├── client/              # frontend
│   ├── public/          # favicon.svg etc.
│   └── src/
│       ├── components/  # componentes reutilizáveis (ex.: Logo.tsx)
│       ├── App.tsx
│       └── index.css    # tema do Tailwind (cores, fontes)
└── server/              # backend
    ├── prisma/schema.prisma
    ├── prisma.config.ts
    ├── src/
    │   ├── index.ts         # rotas da API (prefixo /api)
    │   ├── lib/prisma.ts    # conexão única com o banco
    │   └── generated/       # código gerado pelo Prisma (não editar, não versionar)
    ├── uploads/             # arquivos enviados (não versionar)
    ├── .env                 # senha do banco (NUNCA versionar)
    └── .env.example
```

## Comandos (rodar na raiz `C:\orbit`)

- `npm run dev:client`: só o frontend em http://localhost:5173
- `npm run dev:server`: só o backend em http://localhost:3333
- `npm run dev`: os dois juntos (usa o `concurrently`)

O Vite repassa toda requisição `/api/*` do frontend para o backend (proxy em `client/vite.config.ts`).

## API e dados

- **Todos os dados do usuário ficam no banco**, nunca em localStorage ou cookies. O frontend lê e grava pela API (`client/src/lib/api.ts`).
- **Ainda não existe login.** O backend usa um usuário padrão (`usuario@orbit.local`), criado automaticamente na primeira requisição (`server/src/lib/currentUser.ts`). Toda rota filtra os dados pelo usuário atual.
- **Rotas ficam em `server/src/routes/`**, uma por recurso:
  - `GET` e `PUT /api/time-window`: janela de horário do dia.
  - `GET`, `POST`, `PUT /:id` e `DELETE /:id` em `/api/classes`: aulas da rotina semanal.
  - `GET /api/events?from=AAAA-MM-DD&to=AAAA-MM-DD`, `POST`, `PUT /:id` e `DELETE /:id` em `/api/events`: eventos do calendário.
  - `/api/notes` (Lousa):
    - `GET`, `POST` e `GET`, `PATCH` e `DELETE` em `/:id`: anotações;
    - `POST /:id/pages`, `PUT /:id/pages/:pageId` (`{ strokes, elements }`) e `DELETE /:id/pages/:pageId`: folhas.
    - `POST /:id/images` (o arquivo da imagem, não JSON) e `GET /:id/images/:imageId`: imagens.
    - Os traços à mão ficam em `note_pages.strokes` e os elementos editáveis (imagem, texto, forma) em `note_pages.elements`, ambos jsonb, em coordenadas de uma folha virtual de 1000×1414 (proporção A4).
    - As imagens ficam na tabela `note_images` (bytea), reduzidas para no máximo 1600 px antes do envio.
    - O desenho é compartilhado entre a tela e o PDF (`client/src/lib/board.ts`).
  - `GET`, `POST` (`{ url, folderId? }`), `PATCH /:id` (`{ folderId }`, para mover de pasta) e `DELETE /:id` em `/api/videos`: biblioteca de vídeos do YouTube.
  - `GET`, `POST` e `PATCH /:id` (`{ name }`) e `DELETE /:id` em `/api/video-folders`: pastas de vídeos.
    - Cada vídeo fica em uma pasta, ou em nenhuma (`folder_id` nulo = "Sem pasta").
    - Excluir uma pasta não apaga os vídeos: eles voltam para "Sem pasta".
    - O backend extrai o código do vídeo do link (`server/src/lib/youtube.ts`) e busca título e canal no oEmbed do YouTube, que é público e não precisa de chave.
    - O player usa o domínio `youtube-nocookie.com`.
- **Validação:** o backend sempre valida a entrada, mesmo que o frontend já valide, e responde `400` com `{ error: "mensagem em português" }`.

## Migrations do banco

As migrations são **arquivos SQL escritos à mão**. Elas são a fonte da verdade da estrutura do banco.

- **Pasta**: `migrations/`, na raiz do projeto.
- **Nome do arquivo**: `NNN_descricao_curta_em_ingles.sql`, com número de 3 dígitos sequencial e descrição em inglês, em `snake_case`. Exemplos: `001_create_initial_tables.sql`, `002_add_grade_to_questions.sql`.
- **Toda migration começa com `BEGIN;` e termina com `COMMIT;`**. Assim, se algo falhar no meio, nada é aplicado pela metade.
- **Nunca editar uma migration que já foi aplicada.** Para corrigir ou mudar algo, crie uma nova migration com o próximo número.
- Uma migration deve fazer **uma mudança coerente**, descrita no nome do arquivo.
- **Nada é executado automaticamente no banco.** O autor roda cada migration **manualmente no DBeaver**. Claude só escreve o arquivo `.sql`: nunca executa migrations, `prisma migrate`, `prisma db push` ou qualquer comando que altere o banco. Não existe script nem ferramenta para aplicar migrations.
- **Não usar `prisma migrate` nem `prisma db push`**: além da regra acima, o `prisma migrate` gera migrations no formato próprio do Prisma, com pastas e timestamps, e isso conflita com estas regras.
- **Depois que o autor aplicar uma migration**, mantenha o `server/prisma/schema.prisma` igual ao banco e regenere o client com `npx prisma generate` (na pasta `server`). O `schema.prisma` serve só para gerar os tipos do Prisma Client e não cria tabelas.
- **Dados não vão em migrations.** Elas só mudam a estrutura do banco. Dados iniciais, como o usuário padrão, são criados pelo backend.

Modelo de migration:

```sql
BEGIN;

-- comandos aqui

COMMIT;
```

### Convenções do banco

- Nomes de tabelas e colunas em inglês e em `snake_case`. Tabelas no plural (ex.: `subjects`, `events`).
- Chave primária `id` do tipo `uuid` com `DEFAULT gen_random_uuid()`.
- Toda tabela tem `created_at timestamptz NOT NULL DEFAULT now()`.
- Chaves estrangeiras com o nome `<tabela_no_singular>_id` (ex.: `subject_id`), sempre com `REFERENCES` e regra de `ON DELETE` explícita.

## Convenções de código

- TypeScript em modo `strict`, sem `any`.
- Nomes de variáveis, funções, arquivos e rotas em **inglês**. Textos que aparecem para o usuário e comentários em **português**.
- Rotas da API sempre começam com `/api`.
- Componentes React em PascalCase, um por arquivo, dentro de `client/src/components/`.
- Estilização com classes do Tailwind. Usar as cores do tema (`bg-ink`, `text-brand`...) em vez de valores soltos.

## Design

- **Cor principal** (`brand`): `#5ad1ec`, azul claro puxado para o verde-água. Variante escura (`brand-dark`): `#2fa9c6`.
- **Fundo** (`ink`): `#0b0d10`, quase preto. Superfícies e cartões (`ink-light`): `#14181d`.
- **Texto**: branco. Texto secundário em `text-white/70`.
- **Fonte**: Outfit (Google Fonts), aplicada via `font-display`. JetBrains Mono (`font-mono`) para rótulos técnicos e arte ASCII.
- **Títulos de destaque**: grandes, em negrito e com letras juntas (`tracking-[-0.02em]`).
- **Rótulos técnicos**: `font-mono`, maiúsculos, com um `•` na cor `brand` na frente (ex.: "• ORBIT").
- **Saturno em ASCII** (`client/src/components/AsciiSaturn.tsx`): animação da Home, com o planeta branco e o anel `brand`, girando devagar. Inspirado na textura ASCII do `DESIGN (1).md`. Desse arquivo aproveitamos só o estilo, não as cores.
- **Logo**: "orbit" todo em minúsculo, "or" branco e "bit" na cor `brand`. O "o" tem um anel de Saturno inclinado a 45°, com a metade de trás atrás da letra e a da frente por cima. Componente: `client/src/components/Logo.tsx`.
- **Favicon**: o "o" com anel sobre um quadrado `ink` com cantos arredondados (`client/public/favicon.svg`).

## Segurança

- `server/.env` nunca vai para o Git, porque contém a senha do banco. Variáveis novas também devem ser adicionadas ao `.env.example`, sem os valores reais.
- O frontend nunca acessa o banco diretamente. Todo acesso passa pela API em `server/`.

## Git

- O repositório remoto é `https://github.com/otavioscalari1/orbit.git` e a branch principal é `main`.
- Só fazer commit ou push quando o autor pedir.
