import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { CriarOrdemServicoCommand } from "../application/ordem-servico-gateway";
import type { StatusOrdemServico } from "../domain/ordens-servico";

export interface PedidoConversaoIntegral {
  requestId: string;
  osId: string;
  clienteId: string;
  chamadoId: string;
  ator: string;
  expectedRevision: number;
  escopoSha256?: string;
  protocoloConcorrente?: "escopo-v1";
  parcelaDireta?: { id: string; descricao: string; escopoRevision: number; motivo: string; origem?: "direta" | "backlog" };
  abertura: CriarOrdemServicoCommand;
  destino: "backlog" | "convertido_os";
  statusHub: Exclude<StatusOrdemServico, "solicitacao"> | null;
}

const identidade = z.object({ requestId: z.string().guid(), osId: z.string().guid(), clienteId: z.string().guid(), chamadoId: z.string().guid(), ator: z.string().guid(), expectedRevision: z.number().int().safe().positive(), escopoSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), protocoloConcorrente: z.literal("escopo-v1").optional(), parcelaDireta:z.object({id:z.string().guid(),descricao:z.string().min(1).max(1000),escopoRevision:z.number().int().safe().positive(),motivo:z.string().trim().min(1).max(2000),origem:z.enum(["direta","backlog"]).optional()}).strict().optional(), destino: z.enum(["backlog", "convertido_os"]), statusHub: z.enum(["corretiva", "backlog", "planejamento", "em_execucao", "finalizado", "cancelado"]).nullable() });
const resposta = z.object({ requestId: z.string().guid(), osId: z.string().guid(), chamadoId: z.string().guid(), numero: z.string().min(1), revision: z.number().int().safe().positive() }).strict();

export async function consultarFotografiaEscopoConversao(cliente: string, chamado: string, ator: string, signal?: AbortSignal) {
  const clienteId = z.string().guid().parse(cliente); const chamadoId = z.string().guid().parse(chamado);
  const esperado = z.string().guid().parse(ator); const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== esperado) throw new Error("Sessão alterada.");
  signal?.throwIfAborted();
  let consulta = supabase.schema("pcm").rpc("sso_fotografia_escopo_conversao", { p_cliente_id: clienteId, p_chamado_id: chamadoId });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta; if (error) throw error;
  const foto = z.object({ clienteId: z.string().guid(), chamadoId: z.string().guid(), revision: z.number().int().safe().positive(),
    escopoSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(data);
  const depois = await supabase.auth.getUser(); signal?.throwIfAborted();
  if (depois.error || depois.data.user?.id !== esperado || foto.clienteId !== clienteId || foto.chamadoId !== chamadoId) throw new Error("Sessão ou fotografia divergente.");
  return foto;
}

/** Consulta apenas pela fronteira autorizada; erro não retorna lista parcial. */
export async function listarComponentesConversao(cliente: string, chamado: string) {
  const clienteId = z.string().guid().parse(cliente);
  const chamadoId = z.string().guid().parse(chamado);
  const itens: { id: string; nome: string }[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 1000; pagina++) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_listar_componentes_conversao", {
      p_cliente_id: clienteId, p_chamado_id: chamadoId, p_apos: cursor, p_limite: 100,
    });
    if (error) throw error;
    const linhas = z.array(z.object({id:z.string().guid(),nome:z.string()}).strict()).max(100).parse(data);
    if (linhas.length === 0) return itens.sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR") || a.id.localeCompare(b.id));
    for (const linha of linhas) {
      if (cursor && linha.id <= cursor) throw new Error("Paginação de Componentes inválida.");
      itens.push(linha);
      cursor = linha.id;
    }
  }
  throw new Error("Limite de páginas de Componentes excedido.");
}

/** Sem retry automático: o chamador conserva e reapresenta o mesmo pedido após resultado incerto. */
export async function converterChamadoIntegral(pedido: PedidoConversaoIntegral) {
  const c = identidade.parse(pedido);
  if (c.protocoloConcorrente && !c.escopoSha256) throw new Error("Fotografia de escopo obrigatória.");
  const a = pedido.abertura;
  if (a.clientId !== c.clienteId || a.chamadoId !== c.chamadoId || a.createdBy !== c.ator || a.semChamado) throw new Error("Cliente ou Chamado divergente.");
  const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== c.ator) throw new Error("Sessão alterada; confira o pedido antes de continuar.");
  const campos = {
    titulo: a.titulo.trim(), descricao: a.descricao?.trim() || null, categoria: a.categoria,
    prioridade: a.prioridade, gravidade: a.gravidade, urgencia: a.urgencia, tendencia: a.tendencia,
    dor_cliente: a.dorCliente ?? null, observacao: a.observacao ?? null, local_descricao: a.localDescricao ?? null,
    solicitante: a.solicitante ?? null, origem: a.origem, tipo_tarefa_id: a.tipoTarefaId ?? null,
    tecnico_funcionario_id: a.tecnicoId ?? null, data_agendada: a.dataPrevista ?? null, tipo_os: a.tipoOs ?? null,
    pmoc_schedule_id: a.pmocScheduleId ?? null, origem_inspecao_item_id: a.origemInspecaoItemId ?? null,
    equipamento_id: a.equipamentoId ?? null, foto_urls: [...(a.fotoUrls ?? [])],
  };
  if (c.parcelaDireta) {
    if (!c.escopoSha256 || c.protocoloConcorrente || c.destino !== "convertido_os" || c.statusHub !== null || a.tecnicoId || a.dataPrevista) throw new Error("Operação de parcela inválida.");
    const {data,error}=await supabase.schema("pcm").rpc(c.parcelaDireta.origem === "backlog" ? "sso_criar_os_parcela_backlog" : "sso_criar_os_parcela_direta",{
      p_ator_id:c.ator,p_cliente_id:c.clienteId,p_request_id:c.requestId,p_chamado_id:c.chamadoId,p_parcela_id:c.parcelaDireta.id,p_os_id:c.osId,
      p_chamado_revision:c.expectedRevision,p_escopo_revision:c.parcelaDireta.escopoRevision,p_escopo_sha256:c.escopoSha256,
      p_descricao_parcela:c.parcelaDireta.descricao,p_campos:campos,p_motivo:c.parcelaDireta.motivo,
    });
    if(error)throw error;
    const r=z.object({requestId:z.string().guid(),chamadoId:z.string().guid(),osId:z.string().guid(),parcelaId:z.string().guid(),
      revision:z.number().int().safe().positive(),estadoOs:z.literal("solicitacao"),execucaoComprovada:z.literal(false),envioAuvo:z.literal(false)}).strict().parse(data);
    const depois=await supabase.auth.getUser();
    if(depois.error||depois.data.user?.id!==c.ator||r.requestId!==c.requestId||r.osId!==c.osId||r.chamadoId!==c.chamadoId||r.parcelaId!==c.parcelaDireta.id)throw new Error("Sessão ou resposta divergente.");
    return r;
  }
  const conferirAtor = import.meta.env.VITE_SSO_CONVERSAO_ATOR_CONFERIDO_ENABLED === "true";
  const funcao = c.protocoloConcorrente ? "sso_converter_os_concorrente" : c.escopoSha256 ? "sso_converter_chamado_escopo_conferido"
    : conferirAtor ? "sso_converter_chamado_ator_conferido" : "sso_converter_chamado_integral_autorizado";
  const { data, error } = await supabase.schema("pcm").rpc(funcao, {
    p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_chamado_id: c.chamadoId,
    p_cliente_id: c.clienteId, p_os_id: c.osId, p_destino: c.destino, p_status_hub: c.statusHub,
    ...(c.escopoSha256 ? { p_escopo_sha256: c.escopoSha256, p_ator_esperado: c.ator } : conferirAtor ? { p_ator_esperado: c.ator } : {}),
    p_campos: campos,
  });
  if (error) throw error;
  const r = resposta.parse(data);
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== c.ator || r.requestId !== c.requestId || r.osId !== c.osId || r.chamadoId !== c.chamadoId) throw new Error("Sessão ou resposta divergente.");
  return r;
}
