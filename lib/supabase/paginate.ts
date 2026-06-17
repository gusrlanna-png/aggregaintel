/**
 * Lê TODAS as linhas de uma query Supabase, contornando o limite de 1000
 * linhas por requisição do PostgREST. Receba uma fábrica que aplica .range().
 *
 * Ex.:
 *   return buscarTudo((from, to) =>
 *     supabase.from("clientes").select("*").order("razao_social").range(from, to)
 *   );
 */
export async function buscarTudo<T>(
  makeQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGINA = 1000;
  const todos: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await makeQuery(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    const lote = (data ?? []) as T[];
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}
