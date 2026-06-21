# Chat / Assistente + Agentes — documentação para portar a outro projeto

Ferramenta de **chat conversacional com IA + disparo de agentes em background +
geração de plano de desenvolvimento**, com **cascata de IA gratuita** (Gemini →
Groq → Qwen local → heurística), **voz (Whisper)**, **fila assíncrona**, e
**isolamento por usuário** (RLS; admin = visão master).

Stack-base: Next.js 14 (App Router, API routes, `runtime=nodejs`), Supabase
(Postgres + Auth + RLS), React Query, Tailwind/shadcn, lucide-react.

---

## 1. Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `components/chat/chat-widget.tsx` | UI flutuante: balão, mensagens, **voz**, **textarea auto-expansível**, **fila assíncrona**, contexto da rota. |
| `app/api/chat/route.ts` | Cérebro: classifica a mensagem (disparar/responder/desenvolvimento), monta snapshot de dados, persiste a conversa. |
| `lib/ai/chat-llm.ts` | Cascata de IA grátis. `conversarLLM` (JSON, p/ decisão) e `responderLLM` (texto livre, p/ resposta). |
| `lib/dev/plano.ts` | Gera **análise crítica + plano** (Claude → cascata grátis) para pedidos de desenvolvimento → grava em `dev_tasks`. |
| `app/api/transcribe/route.ts` | **Voz → texto** via Groq Whisper (FormData `file`). |
| `lib/jobs/runner.ts` | Motor de agentes em background: `HANDLERS` por tipo + `processJob`. Roda no servidor com o **token do usuário** (respeita RLS; sem service_role). |
| `lib/jobs/client.ts` | `enqueueJob`, `getJobsRecentes`, `getJob` (client). |
| `app/api/jobs/run/route.ts` | Enfileira job + dispara `processJob` (fire-and-forget) + **reaper** de jobs presos. |
| `components/jobs/jobs-indicator.tsx` | Indicador de tarefas em andamento (opcional). |
| `app/(auth)/configuracoes/desenvolvimento/page.tsx` | Backlog de `dev_tasks`: revisar plano + aprovar/recusar. |

---

## 2. Fluxo de uma mensagem

```
Usuário (chat-widget) ──POST /api/chat {mensagem, contexto}──▶ route.ts
  1. carrega contexto: aprendizados, histórico, backlog de dev
  2. conversarLLM(system, mensagem) → JSON { acao, agente, alvo, pedido, resposta }
     (fallback: heuristica())
  3. roteia por `acao`:
     • "desenvolvimento" → gerarPlanoDev() → insert dev_tasks(aguardando_aprovacao)
     • "responder"       → montarSnapshot() + responderLLM() → texto livre rico
     • "disparar"        → resolverAlvo() → insert jobs + processJob() (background)
  4. persiste user + assistant em chat_mensagens
◀── { resposta, provedor, acao }
```

`contexto` (derivado da rota no widget): `{ entidade_tipo, entidade_id, pathname, pagina }` — dá ao assistente o "onde o usuário está" e o alvo padrão dos agentes.

---

## 3. Cascata de IA (`lib/ai/chat-llm.ts`)

Dois modos, mesma cascata **Gemini → Groq → Qwen(Ollama) → (heurística)**:
- `conversarLLM(system, user)` → **JSON** (decisão estruturada). Força `responseMimeType/response_format/format=json`.
- `responderLLM(system, user)` → **texto livre** (resposta conversacional).

Provedores e env:
| Provedor | Env | Default |
|---|---|---|
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | gemini-2.5-flash |
| Groq | `GROQ_API_KEY`, `GROQ_MODEL` | llama-3.3-70b-versatile |
| Qwen local (Ollama) | `OLLAMA_URL`, `OLLAMA_MODEL` | http://127.0.0.1:11434, qwen2.5:3b |
| Whisper (voz) | `GROQ_API_KEY`, `GROQ_WHISPER_MODEL` | whisper-large-v3-turbo |
| Plano dev (preferencial) | Claude (`lib/claude/client`) | CLAUDE_MODEL |

Se nenhum responder, `conversarLLM` lança e a rota cai na `heuristica()` (regex: detecta "atualizar/enriquecer" = ação; "?" curto = pergunta; verbos de criação/ajuste = desenvolvimento).

---

## 4. Sistema de agentes / jobs (background)

- Fila na tabela **`jobs`**; runner **in-process** (`processJob`) disparado por `void processJob(jobId, accessToken)` em `/api/jobs/run` (sem await → responde na hora, trabalho continua).
- `HANDLERS: Record<tipo, (job, sb, ctx) => Promise<resultado>>`. Cada handler recebe um Supabase client **com o token do usuário** (`createTokenClient`) → respeita RLS. **Não usa service_role** (decisão de segurança).
- Progresso/etapa gravados em `jobs`; log de ações em **`job_eventos`**.
- Status: pendente → processando → concluido | **parcial** | erro | cancelado. Nunca marca "concluido" se houve falhas (vira parcial/erro). Respeita on/off do agente na tabela `agentes`.
- **Reaper**: jobs presos em "processando" >15min (servidor reiniciou) viram "erro" para reprocessar.
- Aprendizado: falhas gravam em **`agente_aprendizados`** (alimentam o system prompt do chat p/ não repetir erros).
- Handlers exemplo (específicos do AggregaIntel, trocáveis): `person_analysis`, `cascade_update`.

---

## 5. Desenvolvimento via chat (`dev_tasks`)

Pedido de "criar/corrigir/melhorar o sistema" → `gerarPlanoDev()` produz **Título + Análise crítica + Plano + Impactos + Esforço/riscos** (Claude, fallback cascata) → grava `dev_tasks(status=aguardando_aprovacao)`. Painel `/configuracoes/desenvolvimento` revisa e aprova/recusa. **Não há auto-deploy** (a implementação é feita pelo fluxo controlado de dev).

---

## 6. Tabelas + segurança (RLS)

| Tabela | Colunas-chave | RLS |
|---|---|---|
| `chat_mensagens` | papel, conteudo, contexto jsonb, acao jsonb, provedor, **criado_por**, modulo | **`criado_por = auth.uid() OR is_admin()`** (cada um vê o seu; admin = master). Insert: `criado_por = auth.uid()`. |
| `jobs` | tipo, status, titulo, payload, resultado, progresso, etapa, erro, entidade_tipo/id, **criado_por**, iniciado/concluido_em | igual: dono ou admin. |
| `job_eventos` | job_id, nivel, mensagem, dados | segue o dono do job (`exists job own/admin`). |
| `dev_tasks` | titulo, pedido, plano, status, prioridade, provedor, contexto, criado_por | (no AggregaIntel: authenticated; pode-se escopar a admin). |
| `agentes` | chave, nome, descricao, tipo, ativo, regras jsonb | liga/desliga handlers. |
| `agente_aprendizados` | chave_agente, contexto, problema, solucao, sucesso | memória de erros. |

Funções usadas: `is_admin()`, `meu_perfil()` (RBAC). Login: Supabase Auth (e-mail/senha + OAuth Azure/Graph).

---

## 7. Variáveis de ambiente
```
GEMINI_API_KEY, GEMINI_MODEL
GROQ_API_KEY, GROQ_MODEL, GROQ_WHISPER_MODEL
OLLAMA_URL, OLLAMA_MODEL
ANTHROPIC_API_KEY, CLAUDE_MODEL        # opcional, p/ plano dev
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Qualquer provedor é opcional — a cascata cai para o próximo / heurística.

---

## 8. Como portar para OUTRO projeto

**Genérico (copiar quase direto):** `chat-widget.tsx`, `chat-llm.ts`, `transcribe/route.ts`, `jobs/runner.ts` (esqueleto), `jobs/client.ts`, `jobs/run/route.ts`, `dev/plano.ts`, e as tabelas `chat_mensagens/jobs/job_eventos/dev_tasks/agentes/agente_aprendizados` + RLS.

**Específico do AggregaIntel (adaptar):**
1. **System prompts** em `app/api/chat/route.ts` e `lib/dev/plano.ts` → trocar o `PROJETO_CONTEXTO` e a descrição dos agentes pelo domínio do novo projeto.
2. **`montarSnapshot()`** (route.ts) → trocar as queries de dados (counts/top) pelas do novo domínio.
3. **`HANDLERS`** (runner.ts) e **`resolverAlvo()`** (route.ts) → trocar `person_analysis`/`cascade_update` pelos agentes do novo projeto (ou começar vazio).
4. **`contextoDaRota()`/`rotaLiberada`** (widget) → ajustar rotas/entidades.
5. **Funções `is_admin()/meu_perfil()`** → reusar o RBAC do novo projeto (ou simplificar para `authenticated`).

**Passos de bootstrap no novo projeto:**
1. Criar as 6 tabelas + RLS (migração).
2. Definir env das IAs (ao menos 1 provedor).
3. Copiar os arquivos genéricos; montar `<ChatWidget/>` no layout autenticado.
4. Adaptar os 5 pontos específicos acima.
5. (Opcional) Voz: precisa só de `GROQ_API_KEY`. Agentes: começar sem handlers e ir adicionando.

---

## 9. Recursos já configurados (checklist)
- [x] Chat flutuante por página, com contexto da rota.
- [x] Cascata de IA grátis (Gemini→Groq→Qwen→heurística) — JSON e texto livre.
- [x] Resposta conversacional **embasada em dados reais** (snapshot).
- [x] **Voz** (gravar → Whisper; fallback Web Speech do navegador).
- [x] **Fila assíncrona** (enviar várias seguidas) + textarea auto-expansível (Enter envia, Shift+Enter quebra).
- [x] Disparo de **agentes em background** (fila + runner in-process, token do usuário).
- [x] **Plano de desenvolvimento** a partir do chat → backlog com aprovação.
- [x] **Isolamento por usuário** (RLS) + **visão master** (admin).
- [x] Histórico persistido + **aprendizado de erros** dos agentes.
