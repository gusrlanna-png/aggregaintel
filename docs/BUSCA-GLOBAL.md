# BUSCA GLOBAL — configuração e tudo que foi desenvolvido

Sistema de busca do AggregaIntel em **duas camadas**:
1. **Busca global (macro)** — um único campo que varre **todo o sistema** (páginas + entidades), no **Dashboard** (campo grande) e no **cabeçalho** (ícone). Resultados **agrupados por tipo**, navegáveis.
2. **Busca por página** — um campo único em cada lista que **varre todos os campos** daquela tela (fuzzy), via o matcher central `matchBusca`.

Princípio: **fuzzy por padrão** (ignora acento, cedilha, til e casa por dígitos de CNPJ/CPF/nº) e **extensível** — adicionar uma nova fonte de busca é 1 query + 1 grupo.

---

## 1. Arquivos

| Arquivo | Papel |
|---|---|
| `components/search/global-search.tsx` | A busca global (componente `GlobalSearch`), com variantes `header` e `hero`. |
| `components/ui/busca-tabela.tsx` | Campo padrão `BuscaTabela` + **`matchBusca`** (matcher fuzzy central) + `normalizar`. |
| `lib/supabase/nf.ts` → `searchNFs()` | Busca de NF **server-side** por todos os campos (coluna `busca`). |
| `lib/supabase/email-indice.ts` → `buscarEmailIndice()` | Busca nos e-mails M365 indexados. |
| `app/(auth)/dashboard/page.tsx` | Usa `<GlobalSearch variant="hero" />`. |
| `components/layout/app-header.tsx` | Usa `<GlobalSearch variant="header" />`. |
| Migrações `058` e `063` | Coluna `notas_fiscais.busca` (trigger `to_jsonb` + nomes de emissor/cliente) + **sem acento** (translate) + índice trigram. |

---

## 2. Busca global — fontes/grupos já desenvolvidos

Ordem dos grupos exibidos no diálogo (`global-search.tsx`):

| Grupo | Fonte (query) | Casa por | Abre |
|---|---|---|---|
| **Páginas** | lista estática `PAGINAS` | título + termos | a rota |
| **Produtores** | `getProdutoresMercado` | razão, CNPJ, município, grupo | `/concorrentes/{id}` |
| **Clientes** | `getClientes` | razão, fantasia, CNPJ, município, grupo | `/clientes/{id}` |
| **Grupos econômicos** | derivado de clientes+produtores (dedup) | nome do grupo | `/grupos/{nome}` |
| **Pessoas** | `getPessoas` | nome, CPF, município | `/pessoas/{id}` |
| **Notas Fiscais** | `searchNFs(q)` (server-side) | **todos os campos** da NF + emissor/cliente | `/nf/{id}` |
| **E-mails (M365)** | `buscarEmailIndice({termo})` | assunto/trecho/remetente | `/pessoas/{id}` ou `/configuracoes/emails` |

Comportamento:
- Abre por **ícone (cabeçalho)** ou **campo grande (dashboard)**; diálogo central.
- Entidades só aparecem com termo digitado; **Páginas** aparecem sempre (navegação).
- NFs e e-mails entram com **≥2 caracteres** (consultam o servidor); o resto filtra em memória (listas já carregadas, `enabled: open`).
- Cada query usa `enabled: open` (só busca quando o diálogo está aberto) e React Query cacheia.

---

## 3. Matcher fuzzy central (`matchBusca`)

`matchBusca(busca, ...campos)` — usado em **toda lista por página** e na global:
- **Normaliza** (minúsculo + remove acentos/cedilha/til via NFD) os campos e a query.
- Casa se a query normalizada estiver no texto concatenado dos campos.
- Também casa por **dígitos** (CNPJ/CPF/nº): se a query tiver ≥2 dígitos, compara só os dígitos.
- Query vazia = casa tudo.

`BuscaTabela` é o input padrão (ícone, limpar, `<datalist>` de sugestões). Padrão de uso numa lista:
```tsx
const [busca, setBusca] = useState("");
const filtrados = itens.filter((x) => matchBusca(busca, x.nome, x.cnpj, x.municipio, x.valor));
<BuscaTabela value={busca} onChange={setBusca} placeholder="Buscar…" id="clientes" />
```

---

## 4. Busca de NF — server-side, todos os campos, fuzzy

Para a NF (paginada no servidor), a busca não pode ser só na página carregada. Solução:
- Coluna **`notas_fiscais.busca`** mantida por **trigger** a partir de **`to_jsonb(NF)`** (todos os campos atuais **e futuros** automaticamente) + **razão/fantasia de emissor e cliente** — e **sem acento** (via `translate`). Índice **GIN trigram** (`pg_trgm`) para `ilike` rápido.
- `getNFs({busca})` e `searchNFs(q)` quebram o termo, **tiram o acento** e aplicam `ilike` por token (AND).
- Cobre **emissor, destinatário/cliente, transportador, motorista, placa, produto, CFOP, chave, valor, endereço de entrega, observações** e qualquer **campo novo** que entrar na NF.

---

## 5. Como adicionar uma NOVA fonte à busca global (extensível)

No `global-search.tsx`:
1. **Query** da fonte:
   ```tsx
   const { data: visitas = [] } = useQuery({
     queryKey: ["visita-busca-global", q],
     queryFn: () => buscarVisitas(q),
     enabled: open && q.trim().length >= 2,
   });
   ```
2. **Resultados** (mapear para `{ href, titulo, detalhe }`), filtrando com `matchBusca` quando for em memória.
3. **Render** do grupo + somar ao `total`:
   ```tsx
   <Grupo titulo="Visitas" icon={MapPin} itens={visRes} onPick={pick} />
   ```
É só isso — o padrão `Resultado { href, titulo, detalhe }` + `<Grupo>` mantém tudo uniforme. (Foi assim que entraram Grupos econômicos e E-mails.)

---

## 6. O que foi solicitado e desenvolvido (histórico)

- [x] **Busca macro global** no Dashboard + cabeçalho (resultados agrupados).
- [x] **Busca unificada por página** (um campo varre todos os campos da tela).
- [x] **Fuzzy universal** — ignora acento, cedilha e til; casa por dígitos.
- [x] **NF: busca em todos os campos** (emissor, destinatário, transportador, motorista…), server-side, à prova de campos futuros.
- [x] **Inclusão de Pessoas, Grupo econômico e E-mails** na busca global (pedido específico).
- [x] **Padrão extensível** ("melhora a cada inclusão"): nova fonte = 1 query + 1 grupo.
- [x] **NF/produto/emissor clicáveis** nas listas levando ao cadastro (navegação por links).

---

## 7. Dependências
- React Query (`@tanstack/react-query`), shadcn `Dialog`/`Input`, lucide-react.
- Postgres `pg_trgm` (índice da `busca` da NF).
- Funções de leitura por domínio: `getProdutoresMercado`, `getClientes`, `getPessoas`, `searchNFs`, `buscarEmailIndice` (adapte ao novo projeto, se portar).

---

## 8. Para portar a outro projeto
1. Copie `busca-tabela.tsx` (matcher central) e `global-search.tsx`.
2. Troque a lista `PAGINAS` pelas rotas do novo projeto.
3. Troque as queries/grupos pelas entidades do novo domínio (mantendo o padrão `Resultado` + `<Grupo>`).
4. (Opcional) Para busca server-side "todos os campos" numa tabela grande, replique a coluna `busca` por trigger `to_jsonb` + índice trigram (ver migrações 058/063).
