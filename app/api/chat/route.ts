import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { conversarLLM, responderLLM } from "@/lib/ai/chat-llm";
import { processJob } from "@/lib/jobs/runner";
import { gerarPlanoDev } from "@/lib/dev/plano";

type SbAny = ReturnType<typeof createClient>;

/** Snapshot compacto de números reais do sistema p/ embasar respostas. */
async function montarSnapshot(supabase: SbAny): Promise<string> {
  try {
    const head = (q: ReturnType<SbAny["from"]>) => q;
    const [cli, prod, nfs, pes, vis, top] = await Promise.all([
      supabase.from("empresas").select("id", { count: "exact", head: true }).eq("eh_cliente", true),
      supabase.from("empresas").select("id", { count: "exact", head: true }).eq("eh_produtor", true),
      supabase.from("notas_fiscais").select("id", { count: "exact", head: true }),
      supabase.from("pessoas").select("id", { count: "exact", head: true }),
      supabase.from("visitas").select("id", { count: "exact", head: true }),
      supabase.rpc("nf_realizado_emissor", { p_ano: null }),
    ]);
    void head;
    const topTxt = (((top.data as { razao_social: string; ton: number; nfs: number }[]) ?? []) || [])
      .slice(0, 5)
      .map((p) => `  • ${p.razao_social}: ${Math.round(Number(p.ton))} t (${p.nfs} NFs)`)
      .join("\n");
    return [
      "Números atuais do sistema (use para responder com dados reais):",
      `- Clientes: ${cli.count ?? "?"} · Produtores: ${prod.count ?? "?"} · NFs: ${nfs.count ?? "?"} · Pessoas: ${pes.count ?? "?"} · Visitas: ${vis.count ?? "?"}`,
      topTxt ? `- Maiores produtores por volume (NFs):\n${topTxt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;

interface Decisao {
  acao: "disparar" | "responder" | "desenvolvimento";
  agente?: string | null;
  alvo?: string | null;
  pedido?: string | null;
  resposta?: string;
}

function parseDecisao(raw: string): Decisao | null {
  try {
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    return JSON.parse(raw.slice(a, b + 1)) as Decisao;
  } catch {
    return null;
  }
}

/** Heurística de último recurso (sem IA): entende pedidos simples de atualizar. */
function heuristica(msg: string, ctxTipo?: string): Decisao {
  const m = msg.toLowerCase();

  // 1) Ação de agente (atualizar/enriquecer um produtor/contato da página atual).
  const querAtualizar = /\b(atualiz|enriquec|sincroniz)\w*/.test(m);
  if (querAtualizar && ctxTipo === "emissor") {
    return { acao: "disparar", agente: "cascade_update", alvo: "", resposta: "Disparei a atualização em cadeia deste produtor (e do grupo)." };
  }
  if (querAtualizar && ctxTipo === "pessoa") {
    return { acao: "disparar", agente: "person_analysis", alvo: "", resposta: "Disparei o enriquecimento web deste contato." };
  }

  // 2) Pergunta curta (termina com "?" e é curta) → responder.
  const ehPergunta = /\?\s*$/.test(msg.trim()) && msg.length < 140;

  // 3) Pedido de desenvolvimento (amplo): verbos de criação/ajuste OU frases de
  //    requisito ("precisa/deve/poderia… aparecer/exibir/abrir/permitir/voltar…"),
  //    menções a tela/campo/botão/fluxo, etc. Frases longas que não são pergunta
  //    nem ação também são tratadas como demanda de desenvolvimento.
  const ehDev =
    /\b(crie|criar|cria|desenvolv|implement|adicion|inclu[ai]|nova?\s+(tela|funcionalidade|p[aá]gina|aba|campo|bot[aã]o|op[cç][aã]o)|corrig|conserta|bug|erro|melhor|aprimor|refator|ajust|otimiz|deveria|precisa|preciso|poderia|seria bom|permitir|exibir|mostrar|aparecer|navegar|voltar|abrir os dados|tela|campo|bot[aã]o|fluxo|layout|rel[aá]torio|dashboard)\b/.test(m) ||
    (!ehPergunta && msg.trim().length > 80);

  if (ehDev) {
    return { acao: "desenvolvimento", pedido: msg, resposta: "" };
  }

  return {
    acao: "responder",
    resposta:
      "Entendi. Para uma ação: na tela de um produtor peça \"atualizar dados/grupo\"; na de um contato, \"atualizar pela web\". Para melhorias/correções do sistema, descreva o que precisa que eu gero um plano de desenvolvimento para aprovação.",
  };
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const mensagem = String(body?.mensagem ?? "").trim();
  const ctx = (body?.contexto ?? {}) as {
    entidade_tipo?: string;
    entidade_id?: string;
    nome?: string;
    pathname?: string;
    pagina?: string;
  };
  if (!mensagem) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  // Aprendizados recentes (para não repetir erros).
  const { data: aprend } = await supabase
    .from("agente_aprendizados")
    .select("problema, solucao, sucesso, contexto")
    .order("criado_em", { ascending: false })
    .limit(5);
  const learnings = (aprend ?? [])
    .map((a) => `- ${a.problema}${a.solucao ? ` → ${a.solucao}` : ""} (${a.sucesso ? "resolveu" : "pendente"})`)
    .join("\n");

  // Histórico recente da conversa (contexto) — o agente lembra o que já foi dito.
  const { data: hist } = await supabase
    .from("chat_mensagens")
    .select("papel, conteudo")
    .eq("criado_por", session.user.id)
    .order("criado_em", { ascending: false })
    .limit(6);
  const historico = (hist ?? [])
    .reverse()
    .map((h) => `${h.papel === "user" ? "Usuário" : "Assistente"}: ${String(h.conteudo).slice(0, 200)}`)
    .join("\n");

  // O que já foi pedido em desenvolvimento (para não duplicar e dar continuidade).
  const { data: devs } = await supabase
    .from("dev_tasks")
    .select("titulo, status")
    .order("criado_em", { ascending: false })
    .limit(8);
  const backlog = (devs ?? [])
    .map((d) => `- ${d.titulo ?? "(sem título)"} [${d.status}]`)
    .join("\n");

  const system = `Você é o assistente dos agentes do AggregaIntel (inteligência de mercado de agregados).
Responda SEMPRE em JSON puro:
{"acao":"disparar"|"responder"|"desenvolvimento","agente":"cascade_update"|"person_analysis"|null,"alvo":"nome do produtor/contato OU vazio se for o item da página atual","pedido":"texto do pedido de desenvolvimento (só quando acao=desenvolvimento)","resposta":"mensagem curta em pt-BR ao usuário"}

Use acao "desenvolvimento" quando o usuário pedir para CRIAR/CORRIGIR/MELHORAR o próprio sistema/app (nova tela, novo campo, corrigir bug de código, melhorar fluxo). Nesse caso preencha "pedido" com a descrição. O sistema vai gerar uma análise crítica + plano para aprovação (não executa nada sozinho).

Agentes disponíveis:
- cascade_update: atualiza dados cadastrais + quadro societário de um PRODUTOR e de todas as empresas do mesmo grupo (fontes gratuitas: BrasilAPI/minhareceita/ReceitaWS).
- person_analysis: enriquece um CONTATO/pessoa pela web (CPF, contatos, redes, sociedades).

Como o sistema trata ERROS (use para responder perguntas sobre isso):
- Consultas de CNPJ usam cascata de fontes GRÁTIS: BrasilAPI → minhareceita.org → ReceitaWS; se uma falha, tenta a próxima.
- Um job NUNCA é marcado "sucesso" se houve falhas: fica "parcial" (algo deu certo) ou "erro" (nada). Cada falha é registrada e vira aprendizado para não repetir.
- O OCR de NF também tem cascata grátis: Gemini → Qwen2.5-VL local (Ollama) → Claude (pago, último recurso).

Use acao "disparar" SOMENTE quando o usuário claramente pedir uma AÇÃO (atualizar/pesquisar/enriquecer) e houver alvo compatível (preferindo o item da página). Para PERGUNTAS (ex.: "como os erros são tratados?"), use "responder" com uma explicação útil e específica — nunca a resposta genérica.
Contexto da página atual: tipo=${ctx.entidade_tipo ?? "nenhum"}${ctx.nome ? `, nome="${ctx.nome}"` : ""}.
${historico ? `Conversa recente (mantenha continuidade, não repita o já feito):\n${historico}\n` : ""}
${backlog ? `Pedidos de desenvolvimento já registrados (não duplique; dê continuidade):\n${backlog}\n` : ""}
${learnings ? `Aprendizados recentes (evite repetir estes erros):\n${learnings}` : ""}
Siga boas práticas de desenvolvimento e eficiência; busque o objetivo do usuário com o menor esforço e sem retrabalho.`;

  let decisao: Decisao;
  let provedor = "heuristica";
  try {
    const r = await conversarLLM(system, mensagem);
    provedor = r.provedor;
    decisao = parseDecisao(r.raw) ?? heuristica(mensagem, ctx.entidade_tipo);
  } catch {
    decisao = heuristica(mensagem, ctx.entidade_tipo);
  }

  let acaoExec: Record<string, unknown> | null = null;
  let resposta = decisao.resposta || "Ok.";

  // Pedido de desenvolvimento → gera análise crítica + plano e cria item no backlog.
  if (decisao.acao === "desenvolvimento") {
    const pedido = (decisao.pedido || mensagem).trim();
    try {
      const ctxStr = [
        `Página onde a demanda foi reportada: ${ctx.pagina ?? ctx.pathname ?? "desconhecida"}${
          ctx.entidade_tipo ? ` — ${ctx.entidade_tipo}${ctx.nome ? ` "${ctx.nome}"` : ""}` : ""
        } (rota ${ctx.pathname ?? "?"}). Considere que o problema/demanda se refere a esta página.`,
        backlog ? `Itens de desenvolvimento já registrados (não duplique; considere dependências):\n${backlog}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const plano = await gerarPlanoDev(pedido, ctxStr);
      const { data: dt } = await supabase
        .from("dev_tasks")
        .insert({
          titulo: plano.titulo,
          pedido,
          plano: plano.plano,
          status: "aguardando_aprovacao",
          provedor: plano.provedor,
          contexto: ctx,
          criado_por: session.user.id,
        })
        .select("id")
        .single();
      acaoExec = { tipo: "dev_task", id: dt?.id ?? null, titulo: plano.titulo };
      resposta = `📋 Analisei e montei um plano com análise crítica: **${plano.titulo}**.\nRevise e aprove em Configurações → Desenvolvimento. Depois de aprovado, ele entra no backlog para ser implementado pelo fluxo controlado de desenvolvimento.`;
    } catch (e) {
      resposta = `Não consegui gerar o plano agora: ${e instanceof Error ? e.message : "falha"}.`;
    }
    await supabase.from("chat_mensagens").insert([
      { papel: "user", conteudo: mensagem, contexto: ctx, criado_por: session.user.id },
      { papel: "assistant", conteudo: resposta, contexto: ctx, acao: acaoExec, provedor, criado_por: session.user.id },
    ]);
    return NextResponse.json({ resposta, provedor, acao: acaoExec });
  }

  // Resposta conversacional rica (assistente): texto livre embasado em dados.
  if (decisao.acao === "responder") {
    try {
      const snapshot = await montarSnapshot(supabase);
      const sysResp = `Você é o assistente do AggregaIntel (inteligência de mercado de agregados). Responda em pt-BR, de forma direta, útil e honesta. Pode explicar funcionalidades, interpretar dados e orientar o uso do sistema. Se não tiver o dado exato, diga onde encontrá-lo no app (ex.: Mapa, Projeção, NFs). Não invente números.
Contexto da página: ${ctx.pagina ?? ctx.pathname ?? "—"}${ctx.entidade_tipo ? ` (${ctx.entidade_tipo}${ctx.nome ? ` "${ctx.nome}"` : ""})` : ""}.
${snapshot ? snapshot + "\n" : ""}${historico ? `Conversa recente:\n${historico}` : ""}`;
      const r = await responderLLM(sysResp, mensagem);
      resposta = r.raw.trim() || resposta;
      provedor = r.provedor;
    } catch {
      /* mantém a resposta curta da classificação */
    }
  }

  if (decisao.acao === "disparar" && decisao.agente) {
    try {
      const alvo = await resolverAlvo(supabase, decisao.agente, decisao.alvo, ctx);
      if (!alvo) {
        resposta = `Não localizei o ${decisao.agente === "person_analysis" ? "contato" : "produtor"} alvo. Abra a página dele ou diga o nome exato.`;
      } else {
        const { data: job } = await supabase
          .from("jobs")
          .insert({
            tipo: decisao.agente,
            titulo: alvo.titulo,
            payload: alvo.payload,
            entidade_tipo: alvo.entidade_tipo,
            entidade_id: alvo.entidade_id,
            criado_por: session.user.id,
            status: "pendente",
          })
          .select("id")
          .single();
        if (job) {
          void processJob(job.id, session.access_token);
          acaoExec = { agente: decisao.agente, jobId: job.id, alvo: alvo.titulo };
          resposta = `${resposta} (Tarefa iniciada em segundo plano — acompanhe em Tarefas.)`;
        }
      }
    } catch (e) {
      resposta = `Tentei disparar o agente mas houve um erro: ${e instanceof Error ? e.message : "falha"}.`;
    }
  }

  // Persiste a conversa (usuário + assistente).
  await supabase.from("chat_mensagens").insert([
    { papel: "user", conteudo: mensagem, contexto: ctx, criado_por: session.user.id },
    { papel: "assistant", conteudo: resposta, contexto: ctx, acao: acaoExec, provedor, criado_por: session.user.id },
  ]);

  return NextResponse.json({ resposta, provedor, acao: acaoExec });
}

type Sb = ReturnType<typeof createClient>;

async function resolverAlvo(
  supabase: Sb,
  agente: string,
  alvoNome: string | null | undefined,
  ctx: { entidade_tipo?: string; entidade_id?: string; nome?: string }
): Promise<
  | { titulo: string; payload: Record<string, unknown>; entidade_tipo: string; entidade_id: string }
  | null
> {
  const nome = (alvoNome ?? "").trim();

  if (agente === "cascade_update") {
    // Usa o produtor da página, se não houver alvo nomeado.
    let emissorId = !nome && ctx.entidade_tipo === "emissor" ? ctx.entidade_id : undefined;
    let razao = ctx.nome ?? "";
    if (!emissorId && nome) {
      const { data } = await supabase
        .from("emissores").select("id, razao_social").ilike("razao_social", `%${nome}%`).limit(1).maybeSingle();
      if (data) { emissorId = data.id; razao = data.razao_social; }
    } else if (emissorId && !razao) {
      const { data } = await supabase.from("emissores").select("razao_social").eq("id", emissorId).maybeSingle();
      razao = data?.razao_social ?? "";
    }
    if (!emissorId) return null;
    return {
      titulo: `Atualizar em cadeia: ${razao || "produtor"}`,
      payload: { emissorId },
      entidade_tipo: "emissor",
      entidade_id: emissorId,
    };
  }

  if (agente === "person_analysis") {
    let pessoaId = !nome && ctx.entidade_tipo === "pessoa" ? ctx.entidade_id : undefined;
    let pnome = ctx.nome ?? "";
    if (!pessoaId && nome) {
      const { data } = await supabase
        .from("pessoas").select("id, nome").ilike("nome", `%${nome}%`).limit(1).maybeSingle();
      if (data) { pessoaId = data.id; pnome = data.nome; }
    } else if (pessoaId && !pnome) {
      const { data } = await supabase.from("pessoas").select("nome").eq("id", pessoaId).maybeSingle();
      pnome = data?.nome ?? "";
    }
    if (!pessoaId) return null;
    return {
      titulo: `Atualizar contato: ${pnome || "pessoa"}`,
      payload: { pessoaId, nome: pnome, empresas: [] },
      entidade_tipo: "pessoa",
      entidade_id: pessoaId,
    };
  }

  return null;
}
