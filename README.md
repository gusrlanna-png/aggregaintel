# AggregaIntel

Plataforma **mobile-first** de inteligência de mercado para agregados minerais
(brita, areia, pó de pedra) — Martins Lanna Group / MBV Mineração Bela Vista.

Responde à pergunta central do negócio: *qual é a produção real dos
concorrentes, quem são seus clientes e onde está a oportunidade de crescimento
da MBV?*

> **Sem dados fictícios.** O app começa **vazio**. Produtores e clientes vêm da
> extração de NFs, da importação de arquivos ou do cadastro individual. Sem o
> Supabase configurado, os dados são persistidos **localmente (localStorage)** no
> navegador; ao configurar o `.env.local`, o Supabase assume.

---

## Stack

| Camada      | Tecnologia                                            |
|-------------|-------------------------------------------------------|
| Front-end   | Next.js 14 (App Router) · React 18 · TypeScript       |
| UI          | Tailwind CSS · shadcn/ui (Radix) · lucide-react        |
| Dados/Auth  | Supabase (PostgreSQL + Auth Magic Link + Storage + RLS)|
| Gráficos    | Recharts                                              |
| IA          | Claude API (Vision para OCR de NF)                     |
| Automação   | n8n (OCR, CFEM, WhatsApp, geocoding)                   |
| PWA         | next-pwa (instalável no Android, offline básico)       |

---

## Pré-requisitos

- Node.js 18+ (testado com 24)
- Conta Supabase, chave da Anthropic e chave do Google Maps (opcionais no modo demo)

> ⚠️ **Não rode o projeto dentro de uma pasta do Google Drive/OneDrive.** A
> sincronização corrompe o `node_modules` (erros `EPERM`/`EBADF`). Use um
> caminho local — este projeto vive em `C:\Users\gusta\dev\aggregaintel`.

---

## Instalação e execução

```bash
npm install
cp .env.local.example .env.local   # edite com suas chaves (ou deixe em branco p/ demo)
npm run dev                        # http://localhost:3000  → redireciona p/ /dashboard
```

Build de produção:

```bash
npm run build && npm start
```

---

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode as migrations na ordem (SQL Editor ou CLI):

   ```bash
   supabase link --project-ref <ref>
   supabase db push          # aplica supabase/migrations/001..007
   psql "$DATABASE_URL" -f supabase/seed.sql   # dados iniciais (opcional)
   ```

   Ou cole cada arquivo de `supabase/migrations/` no SQL Editor, em ordem.
3. **Storage:** crie o bucket privado `notas-fiscais` (máx. 50MB; tipos
   `image/jpeg, image/png, image/webp, application/pdf`). As políticas RLS estão
   em `007_storage.sql`.
4. **Tipos (opcional):** `supabase gen types typescript --linked > lib/supabase/database.types.ts`.
5. Copie a URL e a anon key para `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) e a
   `SUPABASE_SERVICE_ROLE_KEY` (apenas server-side).

Autenticação: **Magic Link** por e-mail (Supabase Auth). O `middleware.ts`
protege todas as rotas exceto `/login`.

---

## Variáveis de ambiente

Veja `.env.local.example`. Resumo:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — ligam o backend.
- `SUPABASE_SERVICE_ROLE_KEY` — uso server-side (push, n8n).
- `ANTHROPIC_API_KEY` / `CLAUDE_MODEL` — OCR de NF via Claude Vision.
- `GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — geocoding e mapas.
- `N8N_WEBHOOK_*` — automações.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push.
- `NEXT_PUBLIC_MBV_CNPJ` / `NEXT_PUBLIC_MBV_RAZAO` — identifica a MBV nos cálculos.

---

## Módulos

1. **Captura de NF** (`/nf`) — foto/PDF → OCR (Claude Vision) → revisão →
   Supabase + Storage. FAB de câmera. (`/api/nf/extract`)
2. **Concorrentes & projeção** (`/concorrentes`) — fichas, mapa e o **motor de
   projeção** por numeração de NF (`lib/utils/projecao.ts`). No cadastro:
   **busca por CNPJ** (BrasilAPI, `/api/cnpj/[cnpj]`) que preenche os dados
   cadastrais; toggle **"Nossa empresa (MBV)"**; **grupo econômico** (crie e
   vincule várias empresas); aba **Análise de mercado** (`/api/market-analysis`
   — Claude + web search quando há `ANTHROPIC_API_KEY`, senão atalhos de busca
   em notícias, redes sociais, licenciamento SEMAD/SIAM, JusBrasil, ANM).
3. **Clientes & consumo inverso** (`/clientes`) — calculadora de traço
   (concreto/asfalto/pré-moldado/varejo), mix de fornecedores e **oportunidade
   MBV** em t/mês e R$/mês.
4. **Dashboard** (`/dashboard`) — KPIs, market share, ranking e alertas.
5. **Mercado & CFEM** (`/mercado`, `/cfem`) — mapas, evolução do mercado e CFEM/ANM.
6. **Inteligência** (`/inteligencia`) — upload de WhatsApp + entrada manual + feed.

### Validação do motor de projeção

Na aba **Produção** da ICAL SJL, o gap das NFs `977.875 → 1.361.948`
(Δ ≈ 384.073) gera a projeção de volume. O cálculo está em
`lib/utils/projecao.ts` (`calcProjecao`).

---

## n8n

Templates importáveis em `n8n/workflows/` (substitua as credenciais marcadas
`REPLACE`):

1. `1-ocr-nf.json` — OCR de NF via webhook.
2. `2-cfem-sync.json` — sync ANM/CFEM (cron mensal + webhook manual).
3. `3-whatsapp-parse.json` — parser/classificador de WhatsApp.
4. `4-geocoding.json` — geocoding automático.

VPS de referência: `http://45.39.210.115:5678`. Configure as credenciais
**Supabase Service Role** e **Anthropic API** em cada workflow.

---

## Deploy (Vercel)

```bash
vercel --prod
```

Adicione **todas** as variáveis de ambiente no painel da Vercel
(Settings → Environment Variables). O `next-pwa` gera `sw.js` no build.

### Instalar como app no Android

1. Abra a URL no Chrome do Android.
2. Menu ⋮ → **Instalar app** (ou banner de instalação).
3. O ícone aparece na tela inicial; abre em tela cheia (standalone).

---

## Estrutura

```
app/                 # rotas (App Router)
  (auth)/            # área autenticada (dashboard, nf, concorrentes, clientes, mercado, cfem, inteligencia)
  api/               # nf/extract, geocode, cfem/sync, push/subscribe
  login/             # Magic Link
components/          # ui (shadcn) + nf, concorrentes, clientes, charts, maps, dashboard, inteligencia
lib/
  supabase/          # clients, data-access, types, config
  claude/            # wrapper + prompt de OCR
  n8n/               # triggers de webhook
  utils/             # projecao, agregados (constantes), ocr-map
  demo/              # dados de demonstração
supabase/migrations/ # 001..007 + seed.sql
n8n/workflows/       # JSONs dos fluxos
public/              # manifest.json, icons, sw.js (gerado)
```

---

## Status / próximos passos

- [x] Build de produção sem erros, PWA gerada, 21 rotas.
- [x] Modo demonstração completo (sem credenciais).
- [ ] Conectar Supabase real (migrations + seed + bucket).
- [ ] Handler de Web Push no service worker (subscription/API/tabela já prontos).
- [ ] Importar e ativar os 4 workflows n8n no VPS.
- [ ] Popular os 16 emissores reais a partir das 18 NFs analisadas.
