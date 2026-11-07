import { conferirLeituraOperacional, type CamposCriticosOperacionais } from "./contrato-operacional.ts";
import { avaliarBuscaTarefa, type BuscaTarefaPorIdentidade } from "./reconciliar-task.ts";

/** Contrato do dono da OS. Nenhuma implementação operacional é conectada aqui. */
export type ContextoDespachoT24 = { clienteId:string;clienteAuvoId:string;tipoTarefaId:string;tipoTarefaAuvoId:string;titulo:string;descricao:string|null;prioridade:string };
export type ConcessaoT24 = {
  tentativaId: string; fence: number; osId: string; visitaId: string; revisao: number;
  operacao: "criar" | "atualizar"; tarefaId: string | null;
  esperado: Omit<CamposCriticosOperacionais, "tarefaId">; despacho:ContextoDespachoT24; questionarioObrigatorio: boolean;
};
type Resultado = "sem_trabalho" | "bloqueado" | "reconciliacao" | "incerto" | "confirmado";
export type RepositorioT24 = {
  /** Deve ser atômica, exclusiva e conferir confirmação PCM, política e janela T−24. */
  conceder: () => Promise<ConcessaoT24 | null>;
  /** Revalida gate, fence, identidade, revisão e janela imediatamente antes do efeito. */
  iniciarEfeito: (concessao: ConcessaoT24) => Promise<"autorizado" | "bloqueado" | "incerto">;
  registrar: (concessao: ConcessaoT24, estado: "bloqueado" | "reconciliacao" | "incerto" | "confirmado", tarefaId: string | null, motivo: string, observado?: CamposCriticosOperacionais) => Promise<boolean>;
  /** Melhor esforço; não confirma efeito e pode não executar se o runtime encerrar. */
  registrarTardia?: (concessao: ConcessaoT24, tarefaId: string | null, motivo: string) => Promise<void>;
};
export type FornecedorT24 = {
  /** Só retorna contrato comprovado após validação independente do ambiente. */
  contratoComprovado: () => Promise<boolean>;
  buscarIdentidade: (osId: string) => Promise<BuscaTarefaPorIdentidade>;
  criar: (concessao: ConcessaoT24) => Promise<{ tarefaId: string }>;
  atualizar: (concessao: ConcessaoT24, tarefaId: string) => Promise<void>;
  /** Deve recusar tarefa cuja identidade externa não corresponda à OS. */
  ler: (tarefaId: string, osId: string) => Promise<CamposCriticosOperacionais>;
};

const idValido = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 200 && id.trim() === id;
async function aguardarEfeito<T>(promessa: Promise<T>): Promise<{ concluido: true; valor: T } | { concluido: false }> {
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<{ concluido: false }>((resolver) => { prazo = setTimeout(() => resolver({ concluido: false }), 15_000); });
  try { return await Promise.race([promessa.then((valor) => ({ concluido: true as const, valor })), expiracao]); }
  finally { if (prazo !== undefined) clearTimeout(prazo); }
}
const concessaoValida = (c: ConcessaoT24) => !!c && idValido(c.tentativaId) && idValido(c.osId) && idValido(c.visitaId) &&
  Number.isSafeInteger(c.fence) && c.fence > 0 && Number.isSafeInteger(c.revisao) && c.revisao > 0 &&
  !!c.despacho && idValido(c.despacho.clienteId) && idValido(c.despacho.clienteAuvoId) && idValido(c.despacho.tipoTarefaId) && idValido(c.despacho.tipoTarefaAuvoId) &&
  typeof c.despacho.titulo === "string" && c.despacho.titulo.trim().length > 0 && (c.despacho.descricao === null || typeof c.despacho.descricao === "string") && idValido(c.despacho.prioridade) &&
  typeof c.questionarioObrigatorio === "boolean" && (c.operacao === "criar" ? c.tarefaId === null : c.operacao === "atualizar" && idValido(c.tarefaId));

/**
 * Composição isolada, sem agendamento ou credenciais. Exige persistência de produção
 * com fences e prova independente do contrato antes de qualquer ligação operacional.
 */
export async function processarConcessaoT24(repo: RepositorioT24, fornecedor: FornecedorT24, podeIniciar: () => boolean = () => true): Promise<Resultado> {
  const c = await repo.conceder();
  if (c === null) return "sem_trabalho";
  const registrar = async (estado: Exclude<Resultado, "sem_trabalho">, tarefaId: string | null, motivo: string, observado?: CamposCriticosOperacionais): Promise<Resultado> => {
    // Fence recusado significa que outra revisão assumiu; nunca afirmar sucesso.
    return await repo.registrar(c, estado, tarefaId, motivo, observado) ? estado : "incerto";
  };
  if (!concessaoValida(c)) return registrar("bloqueado", null, "concessao_invalida");
  let contrato: boolean;
  try {
    const resposta = await aguardarEfeito(fornecedor.contratoComprovado());
    if (!resposta.concluido) return registrar("bloqueado", null, "prazo_contrato_expirado");
    contrato = resposta.valor;
  }
  catch { return registrar("bloqueado", null, "contrato_indisponivel"); }
  if (contrato !== true) return registrar("bloqueado", null, "contrato_nao_comprovado");

  // Valida também campos esperados antes de iniciar qualquer efeito.
  const previa = { ...c.esperado, tarefaId: c.tarefaId ?? "validacao-interna" };
  const esperado = conferirLeituraOperacional({ contratoComprovado: true, questionarioObrigatorio: c.questionarioObrigatorio, esperado: previa, observado: previa });
  if (esperado.situacao !== "campos_compativeis") return registrar("bloqueado", null, "campos_nao_comprovados");

  let tarefaId = c.tarefaId;
  if (c.operacao === "criar") {
    let busca: Awaited<ReturnType<FornecedorT24["buscarIdentidade"]>>;
    try {
      const resposta = await aguardarEfeito(fornecedor.buscarIdentidade(c.osId));
      if (!resposta.concluido) return registrar("reconciliacao", null, "prazo_busca_expirado");
      busca = resposta.valor;
    }
    catch { return registrar("reconciliacao", null, "busca_indisponivel"); }
    const decisao = avaliarBuscaTarefa(busca);
    if (decisao.situacao === "reconciliacao") return registrar("reconciliacao", decisao.tarefaId, decisao.motivo);
  } else {
    // Conferir a identidade remota antes do PATCH; uma falha não é permissão
    // para substituir a tarefa nem prova de que ela esteja ausente.
    try {
      const leitura = await aguardarEfeito(fornecedor.ler(tarefaId!, c.osId));
      if (!leitura.concluido) return registrar("reconciliacao", tarefaId, "prazo_identidade_expirado");
    }
    catch { return registrar("reconciliacao", tarefaId, "identidade_remota_nao_confirmada"); }
  }
  if (!podeIniciar()) return registrar("bloqueado", tarefaId, "prazo_lote_expirado");
  try {
    const inicio = await repo.iniciarEfeito(c);
    if (inicio === "incerto") return registrar("incerto", tarefaId, "inicio_ja_registrado");
    if (inicio !== "autorizado") return registrar("bloqueado", tarefaId, "concessao_obsoleta");
  } catch { return registrar("incerto", tarefaId, "inicio_nao_confirmado"); }
  try {
    if (c.operacao === "criar") {
      if (!podeIniciar()) return registrar("reconciliacao", null, "prazo_expirado_apos_inicio");
      const emVoo = fornecedor.criar(c);
      const resposta = await aguardarEfeito(emVoo);
      if (!resposta.concluido) {
        const resultado = await registrar("incerto", null, "prazo_criacao_expirado");
        void emVoo.then((r) => idValido(r?.tarefaId) ? repo.registrarTardia?.(c, r.tarefaId, "criacao_retornou_apos_prazo") : undefined).catch(() => {});
        return resultado;
      }
      const criada = resposta.valor;
      if (!idValido(criada?.tarefaId)) return registrar("incerto", null, "resposta_criacao_invalida");
      tarefaId = criada.tarefaId;
    } else {
      // A autorização transacional pode ter esperado por locks depois da primeira
      // leitura. Repetir a identidade imediatamente antes do PATCH; falhar
      // fechado se a tarefa mudou ou a leitura não puder ser confirmada.
      try {
        const leitura = await aguardarEfeito(fornecedor.ler(tarefaId!, c.osId));
        if (!leitura.concluido) return registrar("reconciliacao", tarefaId, "prazo_identidade_apos_inicio_expirado");
      }
      catch { return registrar("reconciliacao", tarefaId, "identidade_remota_nao_confirmada_apos_inicio"); }
      if (!podeIniciar()) return registrar("reconciliacao", tarefaId, "prazo_expirado_apos_inicio");
      const emVoo = fornecedor.atualizar(c, tarefaId!);
      const resposta = await aguardarEfeito(emVoo);
      if (!resposta.concluido) {
        const resultado = await registrar("incerto", tarefaId, "prazo_atualizacao_expirado");
        void emVoo.then(() => repo.registrarTardia?.(c, tarefaId, "atualizacao_retornou_apos_prazo")).catch(() => {});
        return resultado;
      }
    }
    const leitura = await aguardarEfeito(fornecedor.ler(tarefaId!, c.osId));
    if (!leitura.concluido) return registrar("incerto", tarefaId, "prazo_leitura_apos_efeito_expirado");
    const observado = leitura.valor;
    // A identidade remota gerada é conhecida apenas após criação ou recuperação.
    const comparacao = conferirLeituraOperacional({ contratoComprovado: true, questionarioObrigatorio: c.questionarioObrigatorio,
      esperado: { ...c.esperado, tarefaId: tarefaId! }, observado });
    if (comparacao.situacao !== "campos_compativeis") return registrar("reconciliacao", tarefaId, "leitura_divergente");
    return registrar("confirmado", tarefaId, "leitura_compativel", { ...observado, inicio: c.esperado.inicio });
  } catch { return registrar("incerto", tarefaId, "efeito_ou_leitura_incerta"); }
}
