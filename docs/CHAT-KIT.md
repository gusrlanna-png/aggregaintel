# CHAT-KIT — Guia completo para levar o Chat/Assistente + Agentes a outro projeto

Pacote: **chat conversacional com IA + disparo de agentes em background +
geração de plano de desenvolvimento**, com **IA gratuita em cascata** (Gemini →
Groq → Qwen local → heurística), **voz (Whisper)**, **fila assíncrona** e
**isolamento por usuário** (RLS; admin = visão master).

Pré-requisitos no projeto destino: **Next.js 14 (App Router)** + **Supabase**
(Postgres + Auth + RLS) + React Query + Tailwind/shadcn + lucide-react.

> Documento-irmão (visão de arquitetura): `docs/chat-assistente-portavel.md`.

---

## 1. Passo a passo (bootstrap)

1. **Banco**: rode a migração SQL do **Anexo A** (cria 6 tabelas + RLS + funções).
2. **Funções de RBAC**: garanta que existam `is_admin()` e `meu_perfil()` (Anexo A traz versões mínimas se o projeto não tiver).
3. **Env**: configure ao menos **1 provedor de IA** (Anexo B). Tudo é opcional — a cascata cai para o próximo / heurística.
4. **Copiar arquivos genéricos** (seção 2) para o projeto destino.
5. **Montar o widget** no layout autenticado: `<ChatWidget />`.
6. **Adaptar 5 pontos** ao domínio do novo projeto (seção 3).
7. (Opcional) **Voz**: precisa só de `GROQ_API_KEY`. **Agentes**: pode começar sem nenhum handler.

---

## 2. Arquivos a copiar (genéricos)

| Arquivo (origem) | Papel | Adaptar? |
|---|---|---|
| `components/chat/chat-widget.tsx` | UI: balão, voz, textarea auto-expansível, fila, contexto da rota | rotas (ponto 4) |
| `app/api/chat/route.ts` | Classifica e roteia (responder/disparar/desenvolvimento) + snapshot | prompts/snapshot/alvo (1,2,3) |
| `lib/ai/chat-llm.ts` | Cascata de IA grátis: `conversarLLM` (JSON) e `responderLLM` (texto) | não |
| `lib/dev/plano.ts` | Gera análise+plano → `dev_tasks` | `PROJETO_CONTEXTO` (ponto 1) |
| `app/api/transcribe/route.ts` | Voz→texto (Groq Whisper) | não |
| `lib/jobs/runner.ts` | Motor de agentes (HANDLERS + processJob) | HANDLERS (ponto 3) |
| `lib/jobs/client.ts` | enqueueJob / getJobsRecentes / getJob | não |
| `app/api/jobs/run/route.ts` | Enfileira + dispara + reaper | não |
| `app/(auth)/configuracoes/desenvolvimento/page.tsx` | Backlog de dev (aprovar/recusar) | opcional |

> Os arquivos completos estão neste repositório (caminhos acima). São o ponto de partida — copie e adapte só os 5 pontos abaixo.

---

## 3. Os 5 pontos a adaptar ao novo domínio

1. **System prompts** — em `app/api/chat/route.ts` (variável `system`) e em `lib/dev/plano.ts` (`PROJETO_CONTEXTO`): troque a descrição do produto/módulos/agentes pelo domínio do novo projeto.
2. **`montarSnapshot()`** (em `route.ts`): troque as consultas (counts/top N) por números do novo domínio — é o que embasa as respostas com dados reais.
3. **`HANDLERS`** (em `runner.ts`) e **`resolverAlvo()`** (em `route.ts`): substitua os agentes (no AggregaIntel: `person_analysis`, `cascade_update`) pelos do novo projeto — ou comece **vazio** (chat só responde/gera plano).
4. **`contextoDaRota()`** e **`rotaLiberada`/menu** (no `chat-widget.tsx`): ajuste o mapa de rotas → nome da página/entidade.
5. **RBAC** — `is_admin()` / `meu_perfil()`: reutilize o do novo projeto, ou use as versões mínimas do Anexo A (ou simplifique RLS para `authenticated`).

---

## 4. Fluxo (resumo)

```
chat-widget ──POST /api/chat {mensagem, contexto}──▶ route.ts
  carrega: aprendizados + histórico + backlog de dev
  conversarLLM(system, msg) → JSON {acao, agente, alvo, pedido, resposta}  (fallback: heuristica)
  roteia:
    "desenvolvimento" → gerarPlanoDev() → insert dev_tasks(aguardando_aprovacao)
    "responder"       → montarSnapshot() + responderLLM() → texto livre
    "disparar"        → resolverAlvo() → insert jobs + processJob() (background)
  persiste user+assistant em chat_mensagens
◀── {resposta, provedor, acao}
```

`contexto = { entidade_tipo, entidade_id, pathname, pagina }` (derivado da rota).
Agentes rodam **no servidor com o token do usuário** (respeitam RLS; **sem service_role**). Status do job: pendente→processando→concluido|parcial|erro|cancelado; **reaper** recupera presos >15min; falhas viram `agente_aprendizados`.

---

## Anexo A — Migração SQL (tabelas + RLS + funções)

```sql
-- Funções de RBAC (use as do seu projeto se já existirem; estas são mínimas).
create table if not exists app_usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, nome text, perfil text not null default 'usuario', ativo boolean not null default true
);
alter table app_usuarios enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='app_usuarios' and policyname='au_self') then
    create policy au_self on app_usuarios for select to authenticated using (id = auth.uid() or
      exists(select 1 from app_usuarios a where a.id=auth.uid() and a.perfil='admin' and a.ativo));
  end if;
end $$;

create or replace function is_admin() returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists(select 1 from app_usuarios where id=auth.uid() and perfil='admin' and ativo) $$;
create or replace function meu_perfil() returns text language sql stable security definer set search_path to 'public'
as $$ select perfil from app_usuarios where id=auth.uid() and ativo $$;
revoke execute on function is_admin(), meu_perfil() from anon;
grant execute on function is_admin(), meu_perfil() to authenticated;

-- ── CHAT ──────────────────────────────────────────────────────────────────
create table if not exists chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  papel text not null,                 -- 'user' | 'assistant'
  conteudo text not null,
  contexto jsonb,                      -- {entidade_tipo, entidade_id, pathname, pagina}
  acao jsonb,                          -- ação executada (agente/dev_task) p/ auditoria
  provedor text,                       -- gemini|groq|qwen|heuristica
  modulo text default 'geral',
  criado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists idx_chat_user on chat_mensagens(criado_por, criado_em desc);
alter table chat_mensagens enable row level security;
create policy cm_select on chat_mensagens for select to authenticated using (criado_por = auth.uid() or is_admin());
create policy cm_insert on chat_mensagens for insert to authenticated with check (criado_por = auth.uid());
create policy cm_delete on chat_mensagens for delete to authenticated using (criado_por = auth.uid() or is_admin());

-- ── JOBS (agentes background) ───────────────────────────────────────────────
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  status text not null default 'pendente',  -- pendente|processando|concluido|parcial|erro|cancelado
  titulo text, payload jsonb default '{}', resultado jsonb,
  progresso int default 0, etapa text, erro text,
  entidade_tipo text, entidade_id uuid, agente_chave text, tentativas int default 0,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(), iniciado_em timestamptz, concluido_em timestamptz
);
create index if not exists idx_jobs_user on jobs(criado_por, criado_em desc);
alter table jobs enable row level security;
create policy jb_select on jobs for select to authenticated using (criado_por = auth.uid() or is_admin());
create policy jb_insert on jobs for insert to authenticated with check (criado_por = auth.uid());
create policy jb_update on jobs for update to authenticated using (criado_por = auth.uid() or is_admin()) with check (true);
create policy jb_delete on jobs for delete to authenticated using (criado_por = auth.uid() or is_admin());

create table if not exists job_eventos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  agente_chave text, nivel text, mensagem text, dados jsonb,
  criado_em timestamptz not null default now()
);
alter table job_eventos enable row level security;
create policy je_select on job_eventos for select to authenticated
  using (exists(select 1 from jobs j where j.id=job_eventos.job_id and (j.criado_por=auth.uid() or is_admin())));
create policy je_insert on job_eventos for insert to authenticated
  with check (exists(select 1 from jobs j where j.id=job_eventos.job_id and j.criado_por=auth.uid()));

-- ── AGENTES (liga/desliga) + APRENDIZADO ────────────────────────────────────
create table if not exists agentes (
  id uuid primary key default gen_random_uuid(),
  chave text unique not null, nome text, descricao text, tipo text,
  ativo boolean not null default true, regras jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
alter table agentes enable row level security;
create policy ag_all on agentes for all to authenticated using (true) with check (true);

create table if not exists agente_aprendizados (
  id uuid primary key default gen_random_uuid(),
  chave_agente text, contexto text, problema text, solucao text, sucesso boolean,
  criado_em timestamptz not null default now()
);
alter table agente_aprendizados enable row level security;
create policy ap_all on agente_aprendizados for all to authenticated using (true) with check (true);

-- ── DEV TASKS (chat → plano → aprovação) ────────────────────────────────────
create table if not exists dev_tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text, pedido text, plano text,
  status text not null default 'aguardando_aprovacao', -- aguardando_aprovacao|aprovado|recusado|concluido
  prioridade int, provedor text, contexto jsonb,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
alter table dev_tasks enable row level security;
create policy dt_all on dev_tasks for all to authenticated using (true) with check (true);
```

---

## Anexo B — Variáveis de ambiente

```bash
# IA do chat (configure ao menos uma; cai em cascata na ordem)
GEMINI_API_KEY=...          # free tier
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=...            # também usado na VOZ (Whisper)
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
OLLAMA_URL=http://127.0.0.1:11434   # Qwen local (opcional)
OLLAMA_MODEL=qwen2.5:3b

# Plano de desenvolvimento (opcional; melhora a análise)
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Anexo C — Checklist de recursos
- [x] Chat flutuante por página com contexto da rota.
- [x] Cascata de IA grátis (Gemini→Groq→Qwen→heurística) — JSON e texto livre.
- [x] Resposta conversacional embasada em dados reais (snapshot).
- [x] Voz (gravar→Whisper; fallback Web Speech do navegador).
- [x] Fila assíncrona + textarea auto-expansível (Enter envia / Shift+Enter quebra).
- [x] Agentes em background (fila + runner in-process, token do usuário, reaper).
- [x] Plano de desenvolvimento a partir do chat → backlog com aprovação.
- [x] Isolamento por usuário (RLS) + visão master (admin).
- [x] Histórico persistido + aprendizado de erros dos agentes.

---

## Notas de segurança (manter no novo projeto)
- **Sem service_role** nos agentes: o runner usa o **token do usuário** → tudo respeita RLS.
- **Isolamento por usuário** no chat/jobs (cada um vê o seu; admin = master).
- **Sem auto-deploy**: o "desenvolvimento via chat" só gera plano para aprovação; a implementação é feita pelo fluxo controlado de dev.
- A **voz** envia o áudio ao Groq (Whisper) só sob ação do usuário; nada é gravado fora isso.
