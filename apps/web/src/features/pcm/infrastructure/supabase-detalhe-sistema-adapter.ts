import { supabase } from "../../../lib/supabase-client";
import type { DetalheSistemaGateway } from "../application/detalhe-sistema-gateway";
import type {
  CadastroSistema,
  ComponenteSistema,
  OsSistema,
  PreventivaSistema,
} from "../domain/detalhe-sistema";
import { agregarOsSistema } from "../domain/detalhe-sistema";

type SistemaRow = {
  id: string;
  cliente_id: string;
  nome: string;
  codigo: string | null;
  categoria: string | null;
  descricao: string | null;
  area_id: string | null;
  local_id: string | null;
  auvo_equipment_id: number | null;
  auvo_sync_status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ComponenteRow = {
  id: string;
  nome: string;
  identificador: string | null;
  area_id: string | null;
  local_id: string | null;
  auvo_equipment_id: number | null;
};

type OrdemRow = {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  prioridade: string | null;
  tecnico_funcionario_id: string | null;
  data_agendada: string | null;
  check_out_at: string | null;
  updated_at: string | null;
  auvo_task_id: number | null;
  sistema_id: string | null;
  equipamento_id: string | null;
};

type PlanoRow = {
  id: string;
  nome: string;
  estado: "rascunho" | "ativo" | "pausado";
  sistema_id: string | null;
  equipamento_id: string | null;
  intervalo_unidade: "semanas" | "meses";
  intervalo_n: number;
};

type OcorrenciaRow = {
  id: string;
  plano_id: string;
  vencimento: string;
  visita_em: string | null;
  envio_estado: string;
  auvo_task_id: number | null;
  tecnico_funcionario_id: string | null;
  resultado_estado: "pendente" | "ok" | "nao_ok";
};

const ORDEM_COLUNAS =
  "id,numero,titulo,status,prioridade,tecnico_funcionario_id,data_agendada,check_out_at,updated_at,auvo_task_id,sistema_id,equipamento_id";

function lancarSeErro(resultado: { error: unknown }) {
  if (resultado.error) throw resultado.error;
}

async function membrosAtuais(sistemaId: string, clienteId: string): Promise<ComponenteRow[]> {
  const membros = await supabase
    .schema("pcm")
    .from("sistema_itens")
    .select("item_id")
    .eq("sistema_id", sistemaId);
  lancarSeErro(membros);
  const ids = (membros.data ?? []).map((row) => row.item_id as string);
  if (ids.length === 0) return [];
  const componentes = await supabase
    .schema("pcm")
    .from("equipamentos")
    .select("id,nome,identificador,area_id,local_id,auvo_equipment_id")
    .eq("client_id", clienteId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .in("id", ids)
    .order("nome");
  lancarSeErro(componentes);
  return (componentes.data ?? []) as ComponenteRow[];
}

async function posicoesDoCliente(clienteId: string) {
  const areas = await supabase
    .schema("pcm")
    .from("areas")
    .select("id,nome")
    .eq("cliente_id", clienteId)
    .eq("ativo", true)
    .order("ordem");
  lancarSeErro(areas);
  const areaPorId = new Map(
    (areas.data ?? []).map((area) => [area.id as string, area.nome as string]),
  );
  const areaIds = [...areaPorId.keys()];
  if (areaIds.length === 0) return { areaPorId, caminhoLocalPorId: new Map<string, string>() };
  const locais = await supabase
    .schema("pcm")
    .from("locais")
    .select("id,nome,area_id,parent_id")
    .in("area_id", areaIds)
    .eq("ativo", true)
    .order("ordem");
  lancarSeErro(locais);
  const porId = new Map(
    (locais.data ?? []).map((local) => [
      local.id as string,
      {
        nome: local.nome as string,
        areaId: local.area_id as string,
        parentId: local.parent_id as string | null,
      },
    ]),
  );
  const caminhoLocalPorId = new Map<string, string>();
  const caminho = (id: string): string => {
    const salvo = caminhoLocalPorId.get(id);
    if (salvo) return salvo;
    const local = porId.get(id);
    if (!local) return "";
    const anterior = local.parentId ? caminho(local.parentId) : (areaPorId.get(local.areaId) ?? "");
    const valor = [anterior, local.nome].filter(Boolean).join(" > ");
    caminhoLocalPorId.set(id, valor);
    return valor;
  };
  for (const id of porId.keys()) caminho(id);
  return { areaPorId, caminhoLocalPorId };
}

function posicaoDe(
  item: Pick<ComponenteRow | SistemaRow, "area_id" | "local_id">,
  posicoes: Awaited<ReturnType<typeof posicoesDoCliente>>,
): string | null {
  if (item.local_id) return posicoes.caminhoLocalPorId.get(item.local_id) ?? null;
  return item.area_id ? (posicoes.areaPorId.get(item.area_id) ?? null) : null;
}

function paraOs(
  row: OrdemRow,
  origem: OsSistema["origens"][number],
  tecnicoPorId: Map<string, string>,
): OsSistema {
  return {
    id: row.id,
    numero: row.numero,
    titulo: row.titulo,
    status: row.status,
    prioridade: row.prioridade,
    tecnicoNome: row.tecnico_funcionario_id
      ? (tecnicoPorId.get(row.tecnico_funcionario_id) ?? null)
      : null,
    dataAgendada: row.data_agendada,
    concluidaEm: row.check_out_at,
    atualizadaEm: row.updated_at,
    auvoTaskId: row.auvo_task_id,
    origens: [origem],
  };
}

export const supabaseDetalheSistemaAdapter: DetalheSistemaGateway = {
  async obterCadastro(sistemaId, clienteEsperadoId) {
    let sistemaQuery = supabase
      .schema("pcm")
      .from("sistemas")
      .select(
        "id,cliente_id,nome,codigo,categoria,descricao,area_id,local_id,auvo_equipment_id,auvo_sync_status,created_at,updated_at",
      )
      .eq("id", sistemaId)
      .eq("ativo", true)
      .is("deleted_at", null);
    if (clienteEsperadoId) sistemaQuery = sistemaQuery.eq("cliente_id", clienteEsperadoId);
    const sistemaResultado = await sistemaQuery.maybeSingle();
    lancarSeErro(sistemaResultado);
    if (!sistemaResultado.data) return null;
    const sistema = sistemaResultado.data as SistemaRow;
    const [cliente, posicoes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select("nome")
        .eq("id", sistema.cliente_id)
        .maybeSingle(),
      posicoesDoCliente(sistema.cliente_id),
    ]);
    lancarSeErro(cliente);
    return {
      id: sistema.id,
      clienteId: sistema.cliente_id,
      nome: sistema.nome,
      identificador: sistema.codigo,
      clienteNome: (cliente.data?.nome as string | undefined) ?? null,
      categoria: sistema.categoria,
      descricao: sistema.descricao,
      posicao: posicaoDe(sistema, posicoes),
      syncStatus: sistema.auvo_sync_status,
      criadoEm: sistema.created_at,
      atualizadoEm: sistema.updated_at,
      // A lista de componentes é uma seção independente do drawer. Não a carregue aqui:
      // uma falha nela não pode esconder o cadastro já autorizado do Sistema.
      quantidadeComponentes: null,
    };
  },

  async listarComponentes(sistemaId, clienteId) {
    const [componentes, posicoes] = await Promise.all([
      membrosAtuais(sistemaId, clienteId),
      posicoesDoCliente(clienteId),
    ]);
    return componentes.map((componente) => ({
      id: componente.id,
      nome: componente.nome,
      identificador: componente.identificador,
      posicao: posicaoDe(componente, posicoes),
    }));
  },

  async listarOs(sistemaId, clienteId) {
    const [sistemaResultado, componentes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("sistemas")
        .select("nome,auvo_equipment_id")
        .eq("id", sistemaId)
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .is("deleted_at", null)
        .maybeSingle(),
      membrosAtuais(sistemaId, clienteId),
    ]);
    lancarSeErro(sistemaResultado);
    if (!sistemaResultado.data) return [];
    const sistema = sistemaResultado.data as { nome: string; auvo_equipment_id: number | null };
    const componentePorId = new Map(componentes.map((item) => [item.id, item]));
    const idsComponentes = [...componentePorId.keys()];
    const auvoOrigem = new Map<number, OsSistema["origens"][number]>();
    if (sistema.auvo_equipment_id != null)
      auvoOrigem.set(sistema.auvo_equipment_id, { tipo: "sistema", nome: sistema.nome });
    for (const componente of componentes) {
      if (componente.auvo_equipment_id != null) {
        auvoOrigem.set(componente.auvo_equipment_id, {
          tipo: "componente",
          id: componente.id,
          nome: componente.nome,
        });
      }
    }
    const [diretasSistema, diretasComponentes, vinculosAuvo] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ordens_servico")
        .select(ORDEM_COLUNAS)
        .eq("client_id", clienteId)
        .eq("sistema_id", sistemaId)
        .is("deleted_at", null),
      idsComponentes.length
        ? supabase
            .schema("pcm")
            .from("ordens_servico")
            .select(ORDEM_COLUNAS)
            .eq("client_id", clienteId)
            .in("equipamento_id", idsComponentes)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      auvoOrigem.size
        ? supabase
            .schema("pcm")
            .from("os_equipamentos_auvo")
            .select("ordem_servico_id,auvo_equipment_id")
            .in("auvo_equipment_id", [...auvoOrigem.keys()])
        : Promise.resolve({ data: [], error: null }),
    ]);
    [diretasSistema, diretasComponentes, vinculosAuvo].forEach(lancarSeErro);
    const idsOsAuvo = [
      ...new Set((vinculosAuvo.data ?? []).map((vinculo) => vinculo.ordem_servico_id as string)),
    ];
    const ordensAuvo = idsOsAuvo.length
      ? await supabase
          .schema("pcm")
          .from("ordens_servico")
          .select(ORDEM_COLUNAS)
          .eq("client_id", clienteId)
          .in("id", idsOsAuvo)
          .is("deleted_at", null)
      : { data: [], error: null };
    lancarSeErro(ordensAuvo);
    const todasOrdens = [
      ...((diretasSistema.data ?? []) as OrdemRow[]),
      ...((diretasComponentes.data ?? []) as OrdemRow[]),
      ...((ordensAuvo.data ?? []) as OrdemRow[]),
    ];
    const tecnicoIds = [
      ...new Set(
        todasOrdens
          .map((ordem) => ordem.tecnico_funcionario_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const tecnicos = tecnicoIds.length
      ? await supabase.schema("pcm").from("funcionarios").select("id,nome").in("id", tecnicoIds)
      : { data: [], error: null };
    lancarSeErro(tecnicos);
    const tecnicoPorId = new Map(
      (tecnicos.data ?? []).map((tecnico) => [tecnico.id as string, tecnico.nome as string]),
    );
    const osDiretasSistema = ((diretasSistema.data ?? []) as OrdemRow[]).map((ordem) =>
      paraOs(ordem, { tipo: "sistema", nome: sistema.nome }, tecnicoPorId),
    );
    const osDiretasComponentes = ((diretasComponentes.data ?? []) as OrdemRow[]).flatMap(
      (ordem) => {
        const componente = ordem.equipamento_id ? componentePorId.get(ordem.equipamento_id) : null;
        return componente
          ? [
              paraOs(
                ordem,
                { tipo: "componente", id: componente.id, nome: componente.nome },
                tecnicoPorId,
              ),
            ]
          : [];
      },
    );
    const vinculosPorOs = new Map<string, OsSistema["origens"]>();
    for (const vinculo of vinculosAuvo.data ?? []) {
      const origem = auvoOrigem.get(vinculo.auvo_equipment_id as number);
      if (!origem) continue;
      const atuais = vinculosPorOs.get(vinculo.ordem_servico_id as string) ?? [];
      vinculosPorOs.set(vinculo.ordem_servico_id as string, [...atuais, origem]);
    }
    const osAuvo = ((ordensAuvo.data ?? []) as OrdemRow[]).flatMap((ordem) =>
      (vinculosPorOs.get(ordem.id) ?? []).map((origem) => paraOs(ordem, origem, tecnicoPorId)),
    );
    return agregarOsSistema([...osDiretasSistema, ...osDiretasComponentes, ...osAuvo]);
  },

  async listarPreventivas(sistemaId, clienteId) {
    const [sistemaResultado, componentes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("sistemas")
        .select("nome")
        .eq("id", sistemaId)
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .is("deleted_at", null)
        .maybeSingle(),
      membrosAtuais(sistemaId, clienteId),
    ]);
    lancarSeErro(sistemaResultado);
    if (!sistemaResultado.data) return [];
    const nomeSistema = sistemaResultado.data.nome as string;
    const idsComponentes = componentes.map((item) => item.id);
    const [planosSistema, planosComponentes] = await Promise.all([
      supabase
        .schema("pcm")
        .from("planos_preventivos")
        .select("id,nome,estado,sistema_id,equipamento_id,intervalo_unidade,intervalo_n")
        .eq("cliente_id", clienteId)
        .eq("sistema_id", sistemaId),
      idsComponentes.length
        ? supabase
            .schema("pcm")
            .from("planos_preventivos")
            .select("id,nome,estado,sistema_id,equipamento_id,intervalo_unidade,intervalo_n")
            .eq("cliente_id", clienteId)
            .in("equipamento_id", idsComponentes)
        : Promise.resolve({ data: [], error: null }),
    ]);
    [planosSistema, planosComponentes].forEach(lancarSeErro);
    const planos = [
      ...new Map(
        [
          ...((planosSistema.data ?? []) as PlanoRow[]),
          ...((planosComponentes.data ?? []) as PlanoRow[]),
        ].map((plano) => [plano.id, plano]),
      ).values(),
    ];
    if (planos.length === 0) return [];
    const planoIds = planos.map((plano) => plano.id);
    const ocorrenciasResultado = await supabase
      .schema("pcm")
      .from("ocorrencias_preventivas")
      .select(
        "id,plano_id,vencimento,visita_em,envio_estado,auvo_task_id,tecnico_funcionario_id,resultado_estado",
      )
      .in("plano_id", planoIds)
      .order("vencimento");
    lancarSeErro(ocorrenciasResultado);
    const ocorrencias = (ocorrenciasResultado.data ?? []) as OcorrenciaRow[];
    const ocorrenciaIds = ocorrencias.map((ocorrencia) => ocorrencia.id);
    const [ordens, tecnicos] = await Promise.all([
      ocorrenciaIds.length
        ? supabase
            .schema("pcm")
            .from("ordens_servico")
            .select("id,ocorrencia_preventiva_id,numero,status,check_out_at")
            .eq("client_id", clienteId)
            .in("ocorrencia_preventiva_id", ocorrenciaIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      [
        ...new Set(
          ocorrencias
            .map((ocorrencia) => ocorrencia.tecnico_funcionario_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ].length
        ? supabase
            .schema("pcm")
            .from("funcionarios")
            .select("id,nome")
            .in("id", [
              ...new Set(
                ocorrencias
                  .map((ocorrencia) => ocorrencia.tecnico_funcionario_id)
                  .filter((id): id is string => Boolean(id)),
              ),
            ])
        : Promise.resolve({ data: [], error: null }),
    ]);
    [ordens, tecnicos].forEach(lancarSeErro);
    const osPorOcorrencia = new Map(
      (ordens.data ?? []).map((ordem) => [
        ordem.ocorrencia_preventiva_id as string,
        ordem as { id: string; numero: string; status: string; check_out_at: string | null },
      ]),
    );
    const tecnicoPorId = new Map(
      (tecnicos.data ?? []).map((tecnico) => [tecnico.id as string, tecnico.nome as string]),
    );
    const componentePorId = new Map(componentes.map((item) => [item.id, item.nome]));
    const hoje = new Date().toISOString().slice(0, 10);
    return planos.map((plano) => {
      const ocorrenciasDoPlano = ocorrencias.filter(
        (ocorrencia) => ocorrencia.plano_id === plano.id,
      );
      return {
        id: plano.id,
        plano: plano.nome,
        alvo: plano.sistema_id
          ? nomeSistema
          : (componentePorId.get(plano.equipamento_id ?? "") ?? "Componente"),
        planoPausado: plano.estado === "pausado",
        periodicidade: `${plano.intervalo_n} ${plano.intervalo_unidade}`,
        proximoVencimento:
          plano.estado === "pausado"
            ? null
            : (ocorrenciasDoPlano.find((ocorrencia) => ocorrencia.vencimento >= hoje)?.vencimento ??
              null),
        ocorrencias: ocorrenciasDoPlano.map((ocorrencia) => {
          const ordem = osPorOcorrencia.get(ocorrencia.id);
          return {
            id: ocorrencia.id,
            vencimento: ocorrencia.vencimento,
            visitaEm: ocorrencia.visita_em,
            estado: ocorrencia.envio_estado,
            resultado: ocorrencia.resultado_estado,
            concluidaEm: ordem?.check_out_at ?? null,
            tecnicoNome: ocorrencia.tecnico_funcionario_id
              ? (tecnicoPorId.get(ocorrencia.tecnico_funcionario_id) ?? null)
              : null,
            osId: ordem?.id ?? null,
            osNumero: ordem?.numero ?? null,
            auvoTaskId: ocorrencia.auvo_task_id,
          };
        }),
      };
    });
  },
};
