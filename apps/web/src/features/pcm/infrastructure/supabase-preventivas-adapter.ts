import { supabase } from "../../../lib/supabase-client";
import type {
  AtualizarPlanoPreventivoInput,
  AvaliacaoPreventiva,
  CatalogoPreventivas,
  OcorrenciaPreventiva,
  PlanoPreventivo,
  ResultadoPreventivas,
} from "../application/preventivas-gateway";

export type ContextoPreventivas = { clienteId?: string };

type PlanoPreventivoPersistido = Pick<
  PlanoPreventivo,
  | "id"
  | "cliente_id"
  | "sistema_id"
  | "equipamento_id"
  | "primeira_data"
  | "intervalo_unidade"
  | "intervalo_n"
>;

type OrdemPreventivaRow = {
  id: string;
  ocorrencia_preventiva_id: string;
  status: string;
  numero: string;
  tecnico_funcionario_id: string | null;
  check_out_at: string | null;
  auvo_detalhes: { taskUrl?: unknown } | null;
};

export async function listarPaginasPreventivas<T extends { id: string }>(
  buscar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>,
): Promise<T[]> {
  const itens: T[] = [];
  const ids = new Set<string>();
  let total: number | null = null;
  while (total === null || itens.length < total) {
    const inicio = itens.length;
    const { data, count, error } = await buscar(inicio, inicio + 499);
    if (error) throw error;
    if (count === null || !Number.isSafeInteger(count) || count < 0 || count > 50_000 ||
      (total !== null && count !== total) || !Array.isArray(data)) throw new Error("Não foi possível conferir todos os registros.");
    total = count;
    if (data.length > 500 || inicio + data.length > total || (data.length === 0 && inicio < total))
      throw new Error("Paginação incompleta.");
    for (const item of data) {
      const id = typeof item.id === "string" ? item.id.toLowerCase() : "";
      if (!id || ids.has(id) || (itens.length && id <= itens[itens.length - 1]!.id.toLowerCase()))
        throw new Error("Paginação divergente.");
      ids.add(id);
      itens.push(item);
    }
  }
  return itens;
}

async function listarNomesDosAlvos(tabela: "sistemas" | "equipamentos", ids: string[], clienteId?: string) {
  const unicos = [...new Set(ids)];
  const resultado: Array<{ id: string; nome: string }> = [];
  for (let i = 0; i < unicos.length; i += 100) {
    const lote = unicos.slice(i, i + 100);
    const pagina = await listarPaginasPreventivas<{ id: string; nome: string }>((inicio, fim) => {
      let consulta = supabase.schema("pcm").from(tabela).select("id,nome", { count: "exact" }).in("id", lote);
      if (clienteId !== undefined) consulta = consulta.eq(tabela === "sistemas" ? "cliente_id" : "client_id", clienteId);
      return consulta.order("id").range(inicio, fim) as unknown as PromiseLike<{ data: Array<{ id: string; nome: string }> | null; count: number | null; error: unknown }>;
    });
    if (pagina.some((item) => !lote.includes(item.id) || typeof item.nome !== "string"))
      throw new Error("Alvo fora do contexto.");
    resultado.push(...pagina);
  }
  return resultado;
}

/** A contagem e as páginas podem mudar entre consultas; nesse caso a leitura falha fechada. */
export async function listarOrdensDasOcorrencias(ocorrenciaIds: string[], clienteId?: string): Promise<OrdemPreventivaRow[]> {
  if (ocorrenciaIds.length === 0) return [];
  const tamanhoPagina = 500;
  const limite = 50_000;
  const ids = new Set<string>();
  const ordens: OrdemPreventivaRow[] = [];
  for (let loteInicio = 0; loteInicio < ocorrenciaIds.length; loteInicio += 100) {
    const lote = ocorrenciaIds.slice(loteInicio, loteInicio + 100);
    const autorizadas = new Set(lote);
    let total: number | null = null;
    let carregadas = 0;
    let ultimoId = "";
    while (total === null || carregadas < total) {
      const inicio = carregadas;
      let consulta = supabase.schema("pcm").from("ordens_servico")
        .select("id,ocorrencia_preventiva_id,status,numero,tecnico_funcionario_id,check_out_at,auvo_detalhes", { count: "exact" })
        .in("ocorrencia_preventiva_id", lote)
        .is("deleted_at", null);
      if (clienteId !== undefined) consulta = consulta.eq("client_id", clienteId);
      const { data, error, count } = await consulta
        .order("id", { ascending: true })
        .range(inicio, inicio + tamanhoPagina - 1);
      if (error) throw error;
      if (!Number.isSafeInteger(count) || count === null || count < 0 || count > limite || ordens.length + count - carregadas > limite ||
        (total !== null && count !== total) || !Array.isArray(data)) throw new Error("Não foi possível conferir todas as OS.");
      total = count;
      if (data.length > tamanhoPagina || inicio + data.length > total || (data.length === 0 && inicio < total))
        throw new Error("Paginação de OS incompleta.");
      for (const ordem of data as OrdemPreventivaRow[]) {
        const id = typeof ordem.id === "string" ? ordem.id.toLowerCase() : "";
        if (!id || ids.has(id) || !autorizadas.has(ordem.ocorrencia_preventiva_id) || (ultimoId && id <= ultimoId))
          throw new Error("Paginação de OS divergente.");
        ids.add(id);
        ultimoId = id;
        ordens.push(ordem);
        carregadas++;
      }
    }
  }
  return ordens;
}

function lancarSeErro(resultado: { error: unknown }) {
  if (resultado.error) throw resultado.error;
}

function alteracaoEstrutural(
  atual: PlanoPreventivoPersistido,
  alteracoes: AtualizarPlanoPreventivoInput["alteracoes"],
): boolean {
  return (
    (alteracoes.sistema_id !== undefined && alteracoes.sistema_id !== atual.sistema_id) ||
    (alteracoes.equipamento_id !== undefined &&
      alteracoes.equipamento_id !== atual.equipamento_id) ||
    (alteracoes.primeira_data !== undefined && alteracoes.primeira_data !== atual.primeira_data) ||
    (alteracoes.intervalo_unidade !== undefined &&
      alteracoes.intervalo_unidade !== atual.intervalo_unidade) ||
    (alteracoes.intervalo_n !== undefined && alteracoes.intervalo_n !== atual.intervalo_n)
  );
}

/**
 * Atualiza um plano sem jamais reescrever suas ocorrências. A validação ocorre aqui, próxima da
 * escrita, porque uma tela antiga ou uma chamada concorrente não pode burlar o bloqueio visual.
 */
export async function atualizarPlanoPreventivo({
  planoId,
  clienteId,
  userId,
  alteracoes,
}: AtualizarPlanoPreventivoInput): Promise<void> {
  const planoResultado = await supabase
    .schema("pcm")
    .from("planos_preventivos")
    .select("id,cliente_id,sistema_id,equipamento_id,primeira_data,intervalo_unidade,intervalo_n")
    .eq("id", planoId)
    .maybeSingle();
  lancarSeErro(planoResultado);
  const plano = planoResultado.data as PlanoPreventivoPersistido | null;
  if (!plano) throw new Error("Plano preventivo não encontrado.");
  if (plano.cliente_id !== clienteId) {
    throw new Error("O plano preventivo não pertence ao cliente em contexto.");
  }

  if (alteracaoEstrutural(plano, alteracoes)) {
    const ocorrenciasResultado = await supabase
      .schema("pcm")
      .from("ocorrencias_preventivas")
      .select("id", { count: "exact", head: true })
      .eq("plano_id", planoId);
    lancarSeErro(ocorrenciasResultado);
    if ((ocorrenciasResultado.count ?? 0) > 0) {
      throw new Error(
        "Alvo e recorrência não podem ser alterados após a primeira ocorrência. Pause e crie um novo plano.",
      );
    }
  }

  const { error } = await supabase
    .schema("pcm")
    .from("planos_preventivos")
    .update({ ...alteracoes, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", planoId)
    .eq("cliente_id", clienteId);
  lancarSeErro({ error });
}

/**
 * Faz a filtragem no servidor e preserva a cadeia plano -> ocorrência -> avaliação.
 * Nunca é permitido buscar ocorrências ou avaliações sem os IDs já autorizados do plano.
 */
export async function listarPreventivas(
  contexto: ContextoPreventivas = {},
): Promise<ResultadoPreventivas> {
  const planosSemAlvo = await listarPaginasPreventivas<PlanoPreventivo>((inicio, fim) => {
    let consulta = supabase.schema("pcm").from("planos_preventivos").select("*", { count: "exact" });
    if (contexto.clienteId !== undefined) consulta = consulta.eq("cliente_id", contexto.clienteId);
    return consulta.order("id", { ascending: true }).range(inicio, fim) as unknown as PromiseLike<{ data: PlanoPreventivo[] | null; count: number | null; error: unknown }>;
  });
  planosSemAlvo.sort((a, b) => (a.primeira_data ?? "").localeCompare(b.primeira_data ?? "") || a.id.localeCompare(b.id));
  const sistemaIds = planosSemAlvo
    .map((plano) => plano.sistema_id)
    .filter((id): id is string => id != null);
  const equipamentoIds = planosSemAlvo
    .map((plano) => plano.equipamento_id)
    .filter((id): id is string => id != null);
  const [sistemas, equipamentos] = await Promise.all([
    listarNomesDosAlvos("sistemas", sistemaIds, contexto.clienteId),
    listarNomesDosAlvos("equipamentos", equipamentoIds, contexto.clienteId),
  ]);
  const alvoPorId = new Map<string, string>([
    ...sistemas.map((sistema) => [sistema.id, sistema.nome] as const),
    ...equipamentos.map(
      (equipamento) => [equipamento.id, equipamento.nome] as const,
    ),
  ]);
  const planos = planosSemAlvo.map((plano) => {
    const alvoNome = alvoPorId.get(plano.sistema_id ?? plano.equipamento_id ?? "");
    return alvoNome ? { ...plano, alvo_nome: alvoNome } : plano;
  });
  const planoIds = planos.map((plano) => plano.id);
  if (planoIds.length === 0) return { planos: [], ocorrencias: [], avaliacoes: [] };

  const ocorrencias: OcorrenciaPreventiva[] = [];
  for (let i = 0; i < planoIds.length; i += 100) {
    const lote = planoIds.slice(i, i + 100);
    const pagina = await listarPaginasPreventivas<OcorrenciaPreventiva>((inicio, fim) => supabase
      .schema("pcm").from("ocorrencias_preventivas").select("*", { count: "exact" })
      .in("plano_id", lote).eq("origem", "legado")
      .order("id", { ascending: true }).range(inicio, fim) as unknown as PromiseLike<{ data: OcorrenciaPreventiva[] | null; count: number | null; error: unknown }>);
    if (pagina.some((ocorrencia) => !lote.includes(ocorrencia.plano_id))) throw new Error("Ocorrência fora do contexto.");
    ocorrencias.push(...pagina);
    if (ocorrencias.length > 50_000) throw new Error("Limite de ocorrências excedido.");
  }
  ocorrencias.sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? "") || a.id.localeCompare(b.id));
  const ocorrenciaIds = ocorrencias.map((ocorrencia) => ocorrencia.id);
  if (ocorrenciaIds.length === 0) return { planos, ocorrencias: [], avaliacoes: [] };

  const [avaliacoesResultado, ordensPreventivas] = await Promise.all([
    supabase
      .schema("pcm")
      .from("avaliacoes_preventivas")
      .select("*")
      .in("ocorrencia_id", ocorrenciaIds)
      .order("recebido_em", { ascending: false })
      .limit(30),
    listarOrdensDasOcorrencias(ocorrenciaIds, contexto.clienteId),
  ]);
  lancarSeErro(avaliacoesResultado);
  const osPorOcorrencia = new Map<string, OrdemPreventivaRow[]>();
  for (const ordem of ordensPreventivas) {
    const ordens = osPorOcorrencia.get(ordem.ocorrencia_preventiva_id) ?? [];
    ordens.push(ordem);
    osPorOcorrencia.set(ordem.ocorrencia_preventiva_id, ordens);
  }
  const tecnicoIds = [
    ...new Set(
      ocorrencias
        .map(
          (ocorrencia) =>
            (osPorOcorrencia.get(ocorrencia.id)?.length === 1
              ? osPorOcorrencia.get(ocorrencia.id)?.[0]?.tecnico_funcionario_id
              : null) ??
            ocorrencia.tecnico_funcionario_id,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const funcionariosResultado = tecnicoIds.length
    ? await supabase.schema("pcm").from("funcionarios").select("id,nome").in("id", tecnicoIds)
    : { data: [], error: null };
  lancarSeErro(funcionariosResultado);
  const tecnicoPorId = new Map(
    (funcionariosResultado.data ?? []).map((funcionario) => [funcionario.id, funcionario.nome]),
  );
  return {
    planos,
    ocorrencias: ocorrencias.map((ocorrencia) => {
      const ordens = osPorOcorrencia.get(ocorrencia.id) ?? [];
      const ordem = ordens.length === 1 ? ordens[0] : undefined;
      const tecnicoNome = tecnicoPorId.get(
        ordem?.tecnico_funcionario_id ?? ocorrencia.tecnico_funcionario_id ?? "",
      );
      const taskUrl = ordem?.auvo_detalhes?.taskUrl;
      return {
        ...ocorrencia,
        ordens_vinculadas: ordens.map(({ id, numero, status }) => ({ id, numero, status })),
        os_status: ordem?.status ?? null,
        ...(ordem?.id ? { os_id: ordem.id } : {}),
        ...(ordem?.numero ? { os_numero: ordem.numero } : {}),
        ...(ordem?.check_out_at ? { os_concluida_em: ordem.check_out_at } : {}),
        ...(tecnicoNome ? { tecnico_nome: tecnicoNome } : {}),
        ...(typeof taskUrl === "string" ? { auvo_task_url: taskUrl } : {}),
      };
    }),
    avaliacoes: (avaliacoesResultado.data ?? []) as AvaliacaoPreventiva[],
  };
}

/** Catálogos são carregados apenas ao abrir o formulário; no 360 o alvo já nasce filtrado. */
export async function listarCatalogoPreventivas(
  contexto: ContextoPreventivas = {},
): Promise<CatalogoPreventivas> {
  const sistemasBase = supabase
    .schema("pcm")
    .from("sistemas")
    .select("id,nome,cliente_id,auvo_equipment_id")
    .is("deleted_at", null)
    .eq("ativo", true);
  const equipamentosBase = supabase
    .schema("pcm")
    .from("equipamentos")
    .select("id,nome,client_id,auvo_equipment_id")
    .is("deleted_at", null)
    .eq("ativo", true);
  const [clientes, sistemas, equipamentos, questionarios, tipos, tecnicos] = await Promise.all([
    contexto.clienteId
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .schema("pcm")
          .from("clientes")
          .select("id,nome")
          .is("deleted_at", null)
          .order("nome"),
    (contexto.clienteId ? sistemasBase.eq("cliente_id", contexto.clienteId) : sistemasBase).order(
      "nome",
    ),
    (contexto.clienteId
      ? equipamentosBase.eq("client_id", contexto.clienteId)
      : equipamentosBase
    ).order("nome"),
    supabase.schema("pcm").from("questionarios").select("id,nome").eq("ativo", true).order("nome"),
    supabase
      .schema("pcm")
      .from("tipos_tarefa")
      .select("id,nome")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome,auvo_user_id")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("nome"),
  ]);
  [clientes, sistemas, equipamentos, questionarios, tipos, tecnicos].forEach(lancarSeErro);
  return {
    clientes: clientes.data ?? [],
    sistemas: sistemas.data ?? [],
    equipamentos: equipamentos.data ?? [],
    questionarios: questionarios.data ?? [],
    tipos: tipos.data ?? [],
    tecnicos: tecnicos.data ?? [],
  } as CatalogoPreventivas;
}
