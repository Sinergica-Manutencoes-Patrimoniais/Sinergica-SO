import type { CategoriaOs, OrigemOs } from "../domain/abertura-os";
import type { TipoOsHub } from "../domain/hub-os";
import type { PesosGutd } from "../domain/priorizacao-backlog";

export interface ClienteOpcao {
  id: string;
  nome: string;
}

export interface TecnicoOpcao {
  id: string;
  nome: string;
  auvoUserId: number;
}

export interface TipoTarefaOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface DadosAberturaOs {
  clientes: ClienteOpcao[];
  tecnicos: TecnicoOpcao[];
  tiposTarefa: TipoTarefaOpcao[];
}

export interface CriarOrdemServicoInput {
  clientId: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaOs;
  prioridade: "baixa" | "normal" | "media" | "alta" | "critica";
  gravidade: number;
  urgencia: number;
  tendencia: number;
  /** E01-S82: "Dor do cliente" (D do GUTD) — opcional (AC-4, retrocompat). */
  dorCliente: number | null;
  /** E01-S83 AC-4: texto livre, opcional. */
  observacao: string | null;
  localDescricao: string | null;
  solicitante: string | null;
  origem: OrigemOs;
  tecnicoId: string | null;
  tipoTarefaId: string;
  dataPrevista: string | null;
  createdBy: string;
  /** E01-S05: setado só quando a OS nasce de uma visita PMOC ("Criar OS" síncrono na agenda). */
  pmocScheduleId?: string | null;
  /** E01-S88 AC-3: setado só quando a OS nasce de um Chamado ("Gerar OS"/"Enviar ao backlog"). */
  chamadoId?: string | null;
  /** E01-S90 AC-3: setado só quando a OS/backlog nasce de um item de assessment (coluna já existia
   * desde E01-S83/`0128`, sem consumidor até esta story). */
  origemInspecaoItemId?: string | null;
}

/** E01-S07: comando real enviado ao gateway — inclui `tipoOs`, calculado pelo use-case
 * (`inferirTipoOsHub`, AC-1) a partir da `categoria` do `CriarOrdemServicoInput`. A UI nunca monta
 * isto diretamente; continua submetendo `CriarOrdemServicoInput`. */
export interface CriarOrdemServicoCommand extends CriarOrdemServicoInput {
  tipoOs: TipoOsHub | null;
  /** Vínculo com o cronograma PMOC que originou a OS. Sempre `null` na criação manual — o produtor
   * real é a Edge Function `pmoc-auvo-create-os`, ainda não construída (fora de escopo de E01-S07). */
  pmocScheduleId: string | null;
  /** E01-S88 AC-3: Chamado que originou a OS — `null` fora do fluxo "Gerar OS a partir do Chamado". */
  chamadoId: string | null;
  /** E01-S90 AC-3: item de assessment que originou a OS/backlog — `null` fora desse fluxo. */
  origemInspecaoItemId: string | null;
}

export interface OrdemServicoCriada {
  id: string;
  numero: string;
}

/** E01-S69: campos editáveis de uma OS já existente — deliberadamente menor que
 * `CriarOrdemServicoInput` (sem cliente/origem/solicitante/tipo de tarefa, que não fazem sentido
 * mudar depois de aberta; ver spec.md AC-1). */
export interface EditarOrdemServicoInput {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaOs;
  prioridade: "baixa" | "normal" | "media" | "alta" | "critica";
  gravidade: number;
  urgencia: number;
  tendencia: number;
  dorCliente: number | null;
  observacao: string | null;
  tecnicoId: string | null;
  dataPrevista: string | null;
  updatedBy: string;
}

export interface OrdemServicoGateway {
  carregarDadosAbertura(): Promise<DadosAberturaOs>;
  criarOrdemServico(input: CriarOrdemServicoCommand): Promise<OrdemServicoCriada>;
  editarOrdemServico(input: EditarOrdemServicoInput): Promise<void>;
  /** E01-S81 AC-4: sinaliza se a IA de título está configurada/ativa — booleano público, nunca
   * expõe a credencial (checagem separada de `fn_integracao_tem_segredo`, que é superadmin-only). */
  iaTituloAtiva(): Promise<boolean>;
  /** AC-2: gera um título declarativo a partir da descrição via Edge Function (OpenRouter). */
  gerarTituloOs(descricao: string): Promise<string>;
  /** E01-S82 AC-2: pesos GUTD vigentes — pro preview de prioridade no form de OS. */
  obterPesosGutd(): Promise<PesosGutd>;
}
