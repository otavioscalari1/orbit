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
- `npm run dev`: os dois juntos (precisa do `concurrently` instalado na raiz)

O Vite repassa toda requisição `/api/*` do frontend para o backend (proxy em `client/vite.config.ts`).

## Migrations do banco

As migrations são **arquivos SQL escritos à mão**. Elas são a fonte da verdade da estrutura do banco.

- **Pasta**: `migrations/`, na raiz do projeto.
- **Nome do arquivo**: `NNN_descricao_curta_em_ingles.sql`, com número de 3 dígitos sequencial e descrição em inglês, em `snake_case`. Exemplos: `001_create_initial_tables.sql`, `002_add_grade_to_questions.sql`.
- **Toda migration começa com `BEGIN;` e termina com `COMMIT;`**. Assim, se algo falhar no meio, nada é aplicado pela metade.
- **Nunca editar uma migration que já foi aplicada.** Para corrigir ou mudar algo, crie uma nova migration com o próximo número.
- Uma migration deve fazer **uma mudança coerente**, descrita no nome do arquivo.
- **Não usar `prisma migrate`**: ele gera migrations no formato próprio do Prisma, com pastas e timestamps, e isso conflita com estas regras. O script `db:migrate` em `server/package.json` ainda aponta para `prisma migrate dev` e precisa ser substituído.
- **Depois de aplicar uma migration**, mantenha o `server/prisma/schema.prisma` igual ao banco e regenere o client com `npx prisma generate` (na pasta `server`). O `schema.prisma` serve só para gerar os tipos do Prisma Client e não cria tabelas.

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
- **Fonte**: Outfit (Google Fonts), aplicada via `font-display`.
- **Logo**: "orbit" todo em minúsculo, "or" branco e "bit" na cor `brand`. O "o" tem um anel de Saturno inclinado a 45°, com a metade de trás atrás da letra e a da frente por cima. Componente: `client/src/components/Logo.tsx`.
- **Favicon**: o "o" com anel sobre um quadrado `ink` com cantos arredondados (`client/public/favicon.svg`).

## Segurança

- `server/.env` nunca vai para o Git, porque contém a senha do banco. Variáveis novas também devem ser adicionadas ao `.env.example`, sem os valores reais.
- O frontend nunca acessa o banco diretamente. Todo acesso passa pela API em `server/`.

## Git

- O repositório remoto é `https://github.com/otavioscalari1/orbit.git` e a branch principal é `main`.
- Só fazer commit ou push quando o autor pedir.
