import { supabase } from "../../../lib/supabase-client";
import type {
  CriarOrdemServicoInput,
  DadosAberturaOs,
  EditarOrdemServicoInput,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "../application/ordem-servico-gateway";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import type { PesosGutd } from "../domain/priorizacao-backlog";

function montarDescricao(input: CriarOrdemServicoInput): string | null {
  const blocos = [input.descricao?.trim()].filter(Boolean);
  return blocos.length > 0 ? blocos.join("\n\n") : null;
}

/** E01-S99/ADR-0014: toda OS precisa de um Chamado por trás (o número exibido é sempre o
 * `CH-XXXX` do Chamado — ver trigger `fn_ordens_servico_sync_numero_chamado`, migration 0151).
 * Quando a criação de OS não vem de um Chamado já existente (`input.chamadoId` ausente — criação
 * manual direta via "Nova Ordem de Serviço"), cria um Chamado por trás pra manter o CH-XXXX como
 * único identificador, sem mudar a UX de "Nova OS". */
async function criarChamadoAutomatico(input: {
  clienteId: string;
  titulo: string;
  createdBy: string;
  /** E01-S152: quando a OS de origem (backlog) já tem descrição/local/fotos, carrega pro Chamado
   * em vez de nascer vazio. */
  descricao?: string | null;
  local?: string | null;
  fotoUrls?: string[];
}): Promise<{ id: string; numero: string }> {
  const { data: numero, error: numeroError } = await supabase
    .schema("pcm")
    .rpc("fn_proximo_numero_chamado");
  if (numeroError) throw numeroError;
  const { data, error } = await supabase
    .schema("pcm")
    .from("chamados")
    .insert({
      numero,
      cliente_id: input.clienteId,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      local: input.local ?? null,
      foto_urls: input.fotoUrls ?? [],
      origem: "manual",
      created_by: input.createdBy,
      updated_by: input.createdBy,
    })
    .select("id,numero")
    .single();
  if (error) throw error;
  await supabase
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: data.id, tipo: "criado", metadata: { numero, auto: true } });
  return { id: data.id as string, numero: data.numero as string };
}

/** Fecha o ciclo do Chamado criado por `criarChamadoAutomatico` — mesma transição que
 * `marcarStatusComOs` faz no fluxo "Gerar OS a partir do Chamado" (`chamados.ts`), só que aqui é o
 * próprio adapter quem criou o Chamado, então quem fecha o ciclo é ele também. */
async function marcarChamadoAutomaticoComOs(
  chamadoId: string,
  ordemServicoId: string,
  updatedBy: string,
): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ordemServicoId)) {
    throw new Error("Identificador de OS inválido.");
  }
  const { data, error } = await supabase
    .schema("pcm")
    .from("chamados")
    .update({
      status: "convertido_os",
      ordem_servico_id: ordemServicoId,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq("id", chamadoId)
    .or(`ordem_servico_id.is.null,ordem_servico_id.eq.${ordemServicoId}`)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Chamado indisponível ou vínculo legado divergente; reconcilie antes de continuar.");
  await supabase
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: chamadoId, tipo: "os_gerada", metadata: { ordemServicoId } });
}

async function confirmarChamadoAtomico(input: { ordemId: string; userId: string; somenteRepetir?: boolean }): Promise<{ numero: string }> {
  const chave = `sso-confirmar-chamado-os:${JSON.stringify([input.userId, input.ordemId])}`;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.ordemId) || !uuid.test(input.userId)) throw new Error("Contexto inválido.");
  const sessao = async () => {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== input.userId) throw new Error("Sessão alterada.");
  };
  await sessao();
  let requestId: string;
  const anterior = sessionStorage.getItem(chave);
  if (anterior === null) {
    if (input.somenteRepetir) throw new Error("Tentativa não encontrada; nenhuma operação enviada.");
    requestId = crypto.randomUUID();
    sessionStorage.setItem(chave, requestId);
  } else {
    if (!uuid.test(anterior)) throw new Error("Tentativa local ilegível. Procure suporte.");
    requestId = anterior;
  }
  if (sessionStorage.getItem(chave) !== requestId) throw new Error("Tentativa alterada.");
  const { data, error } = await supabase.schema("pcm").rpc("sso_confirmar_chamado_os_atomico", {
    p_request_id: requestId, p_os_id: input.ordemId,
  });
  if (error) throw error;
  if (!data || data.requestId !== requestId || data.osId !== input.ordemId ||
    typeof data.chamadoId !== "string" || !uuid.test(data.chamadoId) ||
    typeof data.numero !== "string" || !data.numero.trim() || typeof data.numeroOs !== "string")
    throw new Error("Resposta divergente; mantenha a tentativa e procure suporte.");
  await sessao();
  if (sessionStorage.getItem(chave) !== requestId) throw new Error("Tentativa alterada; procure suporte.");
  sessionStorage.removeItem(chave);
  return { numero: data.numero };
}

export const supabaseOrdemServicoAdapter: OrdemServicoGateway = {
  async listarEquipamentosDoCliente(clienteId) {
    const itens: { id: string; nome: string }[] = [];
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 1000; pagina++) {
      let consulta = supabase.schema("pcm").from("equipamentos").select("id,nome")
        .eq("client_id", clienteId).is("deleted_at", null).order("id", { ascending: true }).limit(100);
      if (cursor) consulta = consulta.gt("id", cursor);
      const { data, error } = await consulta;
      if (error) throw error;
      const linhas = data ?? [];
      if (linhas.length === 0) return itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
      for (const row of linhas) {
        if (typeof row.id !== "string" || typeof row.nome !== "string" || (cursor && row.id <= cursor)) {
          throw new Error("Paginação de Componentes inválida.");
        }
        cursor = row.id;
        itens.push({ id: row.id, nome: row.nome });
      }
    }
    throw new Error("Limite de páginas de Componentes excedido.");
  },

  async carregarDadosAbertura(): Promise<DadosAberturaOs> {
    const [
      { data: clientes, error: clientesError },
      { data: tecnicos, error: tecnicosError },
      { data: tiposTarefa, error: tiposTarefaError },
    ] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase
        .schema("pcm")
        .from("funcionarios")
        .select("id,nome,auvo_user_id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase
        .schema("pcm")
        .from("tipos_tarefa")
        .select("id,nome,auvo_id")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
    ]);

    if (clientesError) throw clientesError;
    if (tecnicosError && tecnicosError.code !== "PGRST205" && tecnicosError.code !== "42P01") {
      throw tecnicosError;
    }
    if (tiposTarefaError) throw tiposTarefaError;

    return {
      clientes: (clientes ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string })),
      tecnicos: (tecnicos ?? []).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        auvoUserId: t.auvo_user_id as number,
      })),
      tiposTarefa: (tiposTarefa ?? []).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        auvoId: t.auvo_id as number | null,
      })),
    };
  },

  async criarOrdemServico(input): Promise<OrdemServicoCriada> {
    let chamadoId = input.chamadoId ?? null;
    let numeroChamado: string | null = null;
    // E01-S151: item de backlog puro (semChamado) nasce sem Chamado — a trigger
    // fn_ordens_servico_sync_numero_chamado (0209) gera o placeholder PRE-XXXXXXXX sozinha.
    if (!chamadoId && !input.semChamado) {
      const chamadoAutomatico = await criarChamadoAutomatico({
        clienteId: input.clientId,
        titulo: input.titulo,
        createdBy: input.createdBy,
        descricao: input.descricao,
        local: input.localDescricao,
        fotoUrls: input.fotoUrls,
      });
      chamadoId = chamadoAutomatico.id;
      numeroChamado = chamadoAutomatico.numero;
    } else if (chamadoId) {
      const { data: chamado, error: chamadoError } = await supabase.schema("pcm").from("chamados")
        .select("numero,cliente_id").eq("id", chamadoId).is("deleted_at", null).single();
      if (chamadoError) throw chamadoError;
      if (!chamado || chamado.cliente_id !== input.clientId || typeof chamado.numero !== "string" || !chamado.numero.trim()) {
        throw new Error("Chamado incompatível com Cliente.");
      }
      numeroChamado = chamado.numero;
    }

    const ordemId = crypto.randomUUID();
    const numero = numeroChamado ?? `PRE-${ordemId.slice(0, 8).toUpperCase()}`;

    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .insert({
        id: ordemId,
        numero,
        client_id: input.clientId,
        titulo: input.titulo,
        descricao: montarDescricao(input),
        categoria: input.categoria,
        status: "solicitacao",
        prioridade: input.prioridade,
        gravidade: input.gravidade,
        urgencia: input.urgencia,
        tendencia: input.tendencia,
        dor_cliente: input.dorCliente,
        observacao: input.observacao,
        local_descricao: input.localDescricao,
        solicitante: input.solicitante,
        origem: input.origem,
        created_by: input.createdBy,
        tipo_tarefa_id: input.tipoTarefaId,
        tecnico_funcionario_id: input.tecnicoId,
        data_agendada: input.dataPrevista,
        tipo_os: input.tipoOs,
        pmoc_schedule_id: input.pmocScheduleId,
        chamado_id: chamadoId,
        origem_inspecao_item_id: input.origemInspecaoItemId,
        equipamento_id: input.equipamentoId ?? null,
        foto_urls: input.fotoUrls ?? [],
      })
      .select("id,numero")
      .single();

    if (error) throw error;

    // Chamado veio pronto do caller (fluxo "Gerar OS a partir do Chamado") — quem fecha o ciclo é
    // `gerarOsDoChamado`/`marcarStatusComOs` (chamados.ts), não aqui, pra respeitar o `destino`
    // escolhido (pode ser "backlog", não só "convertido_os"). `chamadoId` também fica null quando
    // `semChamado` pulou a criação automática (E01-S151) — nada pra fechar ainda.
    if (!input.chamadoId && chamadoId) {
      await marcarChamadoAutomaticoComOs(chamadoId, data.id as string, input.createdBy);
    }

    return { id: data.id as string, numero: data.numero as string };
  },

  // E01-S151: "Confirmar chamado" do Fabrício — promove item PRE-XXXXXXXX pra Chamado de verdade.
  // Reusa exatamente o mesmo par de helpers de `criarOrdemServico` (linha 22/55), só que aplicado
  // depois, sobre uma OS que já existe. Cliente/título vêm da própria OS (não do caller) — evita
  // depender de estado desatualizado em memória. UPDATE não passa pela trigger de sync (0151/0209,
  // só `before insert`) — `numero` precisa ser setado explicitamente aqui.
  async confirmarChamado(input): Promise<{ numero: string }> {
    // Uma tentativa atômica incerta nunca pode cair no fluxo legado se a flag mudar.
    const chaveAtomica = `sso-confirmar-chamado-os:${JSON.stringify([input.userId, input.ordemId])}`;
    if (input.somenteRepetir || import.meta.env.VITE_SSO_CONFIRMAR_CHAMADO_OS_ATOMICO_ENABLED === "true" || sessionStorage.getItem(chaveAtomica) !== null) {
      return confirmarChamadoAtomico(input);
    }
    const { data: ordem, error: ordemError } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select("client_id,titulo,descricao,local_descricao,foto_urls,chamado_id")
      .eq("id", input.ordemId)
      .is("deleted_at", null)
      .single();
    if (ordemError) throw ordemError;
    if (ordem.chamado_id !== null) {
      throw new Error("Esta OS já possui Chamado. Consulte o vínculo existente antes de continuar.");
    }

    const chamadoAutomatico = await criarChamadoAutomatico({
      clienteId: ordem.client_id as string,
      titulo: ordem.titulo as string,
      createdBy: input.userId,
      descricao: ordem.descricao as string | null,
      local: ordem.local_descricao as string | null,
      fotoUrls: (ordem.foto_urls as string[] | null) ?? [],
    });
    const { data: atualizada, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .update({ chamado_id: chamadoAutomatico.id, numero: chamadoAutomatico.numero })
      .eq("id", input.ordemId)
      .eq("client_id", ordem.client_id)
      .is("chamado_id", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!atualizada) throw new Error("A OS mudou durante a confirmação. Consulte o vínculo e reconcilie o Chamado criado antes de repetir.");
    await marcarChamadoAutomaticoComOs(chamadoAutomatico.id, input.ordemId, input.userId);
    return { numero: chamadoAutomatico.numero };
  },

  async obterPorChamado(chamadoId): Promise<OrdemServicoCriada | null> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select("id,numero")
      .eq("chamado_id", chamadoId)
      .is("deleted_at", null)
      .limit(2);
    if (error) throw error;
    if ((data?.length ?? 0) > 1) {
      throw new Error("Este Chamado possui mais de uma OS; consulte as Ordens vinculadas antes de continuar.");
    }
    const unica = data?.[0];
    return unica ? { id: unica.id as string, numero: unica.numero as string } : null;
  },

  async editarOrdemServico(input: EditarOrdemServicoInput): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .update({
        titulo: input.titulo,
        descricao: input.descricao,
        categoria: input.categoria,
        prioridade: input.prioridade,
        gravidade: input.gravidade,
        urgencia: input.urgencia,
        tendencia: input.tendencia,
        dor_cliente: input.dorCliente,
        observacao: input.observacao,
        tecnico_funcionario_id: input.tecnicoId,
        data_agendada: input.dataPrevista,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id);
    if (error) throw error;
  },

  async iaTituloAtiva(): Promise<boolean> {
    const { data, error } = await supabase
      .schema("config")
      .rpc("fn_integracao_ativa_publica", { p_chave: "openrouter" });
    if (error) throw error;
    return Boolean(data);
  },

  async gerarTituloOs(descricao: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke("pcm-os-gerar-titulo", {
      body: { descricao },
    });
    if (error) throw error;
    const titulo = (data as { titulo?: string } | null)?.titulo;
    if (!titulo) throw new Error("A IA não devolveu um título.");
    return titulo;
  },

  async obterPesosGutd(): Promise<PesosGutd> {
    const { data, error } = await supabase
      .schema("config")
      .from("priorizacao_gutd")
      .select("peso_gravidade,peso_urgencia,peso_tendencia,peso_dor_cliente")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return PESOS_GUTD_PADRAO;
    return {
      gravidade: data.peso_gravidade,
      urgencia: data.peso_urgencia,
      tendencia: data.peso_tendencia,
      dorCliente: data.peso_dor_cliente,
    };
  },
};
