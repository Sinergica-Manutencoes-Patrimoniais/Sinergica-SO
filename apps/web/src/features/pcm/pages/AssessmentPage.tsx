// AssessmentPage.tsx — E01-S90. Inspeção como documento de assessment do cliente: questionário do
// Auvo vira itens, cada item deriva Chamado/Backlog/OS com responsável (design.md D1/D2/D3).
import { Button, Modal, Skeleton } from "@sinergica/ui";
import { ArrowLeft, ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import {
  criarAssessment,
  derivarItemParaChamado,
  derivarItemParaOsOuBacklog,
  importarQuestionario,
  listarItensAssessment,
} from "../application/assessment";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import type { ClienteOpcao, InspecaoItem, InspecaoResumo } from "../application/qualidade-gateway";
import {
  DESTINO_ITEM_LABEL,
  type DestinoItemAssessment,
  MOTIVO_ASSESSMENT_LABEL,
  type MotivoAssessment,
  RESPONSAVEL_DESTINO_LABEL,
  type ResponsavelDestino,
} from "../domain/assessment";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; clientes: ClienteOpcao[]; assessments: InspecaoResumo[] };

function hojeIso(): string {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

export function AssessmentPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionado, setSelecionado] = useState<InspecaoResumo | null>(null);
  const [itens, setItens] = useState<InspecaoItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [modalNovo, setModalNovo] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalDerivar, setModalDerivar] = useState<{
    item: InspecaoItem;
    destino: DestinoItemAssessment;
  } | null>(null);
  const [dadosOs, setDadosOs] = useState<DadosAberturaOs | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
    try {
      const [clientes, todasInspecoes] = await Promise.all([
        supabaseQualidadeAdapter.listarClientes(),
        supabaseQualidadeAdapter.listarInspecoes(),
      ]);
      setEstado({
        fase: "pronto",
        clientes,
        assessments: todasInspecoes.filter((i) => i.eAssessment),
      });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar assessments.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const abrirItens = useCallback(async (assessment: InspecaoResumo) => {
    setSelecionado(assessment);
    setCarregandoItens(true);
    try {
      setItens(await listarItensAssessment(supabaseQualidadeAdapter, assessment.id));
    } finally {
      setCarregandoItens(false);
    }
  }, []);

  async function salvarNovo(clientId: string, motivo: MotivoAssessment) {
    if (!user) return;
    setErroAcao(null);
    const criado = await criarAssessment(supabaseQualidadeAdapter, {
      clientId,
      motivo,
      dataInspecao: hojeIso(),
      createdBy: user.id,
    });
    setModalNovo(false);
    await carregar();
    await abrirItens(criado);
  }

  async function confirmarImportar(auvoTaskId: number) {
    if (!user || !selecionado) return;
    setErroAcao(null);
    try {
      setItens(
        await importarQuestionario(
          supabaseQualidadeAdapter,
          selecionado.id,
          selecionado.clientId,
          auvoTaskId,
          user.id,
        ),
      );
      setModalImportar(false);
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível importar o questionário Auvo.",
      );
    }
  }

  async function abrirModalDerivar(item: InspecaoItem, destino: DestinoItemAssessment) {
    setModalDerivar({ item, destino });
    if (!dadosOs) setDadosOs(await carregarDadosAberturaOs(supabaseOrdemServicoAdapter));
  }

  async function confirmarDerivar(
    responsavel: ResponsavelDestino,
    campos: { tipoTarefaId: string; tecnicoId: string | null } | null,
  ) {
    if (!user || !selecionado || !modalDerivar) return;
    setErroAcao(null);
    const { item, destino } = modalDerivar;
    if (destino === "chamado") {
      await derivarItemParaChamado(
        supabaseQualidadeAdapter,
        supabaseChamadosAdapter,
        item,
        selecionado.clientId,
        responsavel,
        user.id,
      );
    } else if (campos && (destino === "backlog" || destino === "os")) {
      await derivarItemParaOsOuBacklog(
        supabaseQualidadeAdapter,
        supabaseOrdemServicoAdapter,
        item,
        {
          clientId: selecionado.clientId,
          titulo: item.descricao,
          descricao: null,
          categoria: "corretiva",
          prioridade: "media",
          gravidade: 3,
          urgencia: 3,
          tendencia: 3,
          dorCliente: null,
          observacao: null,
          localDescricao: null,
          solicitante: null,
          origem: "vistoria",
          tecnicoId: campos.tecnicoId,
          tipoTarefaId: campos.tipoTarefaId,
          dataPrevista: null,
        },
        destino,
        responsavel,
        user.id,
      );
    }
    setModalDerivar(null);
    setItens(await listarItensAssessment(supabaseQualidadeAdapter, selecionado.id));
  }

  if (permissoesCarregando || estado.fase === "carregando") {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo PCM.
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-body text-ink-3">{estado.mensagem}</p>
        <Button
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={carregar}
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (selecionado) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => setSelecionado(null)}
          className="self-start"
        >
          Voltar
        </Button>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-heading font-semibold text-ink">{selecionado.titulo}</h1>
            <p className="text-body text-ink-3">
              {selecionado.clienteNome} ·{" "}
              {selecionado.motivoAssessment
                ? MOTIVO_ASSESSMENT_LABEL[selecionado.motivoAssessment]
                : "—"}
            </p>
          </div>
          {temEscrita && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setModalImportar(true)}
            >
              Importar questionário Auvo
            </Button>
          )}
        </div>

        {erroAcao && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}

        {carregandoItens ? (
          <Skeleton className="h-4 w-40" />
        ) : itens.length === 0 ? (
          <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
            <ClipboardCheck className="mx-auto h-9 w-9 text-ink-3" />
            <p className="mt-3 text-body text-ink-3">
              Nenhum item ainda — importe um questionário do Auvo pra começar.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {itens.map((item) => (
              <section
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-ink">{item.descricao}</p>
                  {item.auvoImportacaoProvisoria && (
                    <p className="mt-0.5 text-caption font-semibold text-orange">
                      Provisório — será atualizado quando a tarefa Auvo for concluída.
                    </p>
                  )}
                  {item.destino && (
                    <p className="mt-0.5 text-caption text-ink-3">
                      Derivado: {DESTINO_ITEM_LABEL[item.destino]}
                      {item.destinoResponsavel &&
                        ` · ${RESPONSAVEL_DESTINO_LABEL[item.destinoResponsavel]}`}
                    </p>
                  )}
                </div>
                {temEscrita && !item.destino && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => abrirModalDerivar(item, "chamado")}
                    >
                      Gerar Chamado
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => abrirModalDerivar(item, "backlog")}
                    >
                      Enviar ao backlog
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => abrirModalDerivar(item, "os")}
                    >
                      Gerar OS
                    </Button>
                  </>
                )}
              </section>
            ))}
          </div>
        )}

        {modalImportar && (
          <ImportarQuestionarioModal
            onCancel={() => setModalImportar(false)}
            onConfirmar={confirmarImportar}
          />
        )}
        {modalDerivar && dadosOs && (
          <DerivarItemModal
            destino={modalDerivar.destino}
            dadosOs={dadosOs}
            onCancel={() => setModalDerivar(null)}
            onConfirmar={confirmarDerivar}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold text-ink">Assessment</h2>
          <p className="text-body text-ink-3">
            Documento de estado do cliente — questionário do Auvo vira itens de ação
          </p>
        </div>
        <div className="flex items-center gap-2">
          {temEscrita && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setModalNovo(true)}
            >
              Novo assessment
            </Button>
          )}
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={carregar}>
            Atualizar
          </Button>
        </div>
      </div>

      {estado.assessments.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <ClipboardCheck className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhum assessment cadastrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {estado.assessments.map((assessment) => (
            <button
              key={assessment.id}
              type="button"
              onClick={() => abrirItens(assessment)}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-left hover:bg-line-soft"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-ink">
                  {assessment.clienteNome}
                </p>
                <p className="text-caption text-ink-3">
                  {`${
                    assessment.motivoAssessment
                      ? MOTIVO_ASSESSMENT_LABEL[assessment.motivoAssessment]
                      : "—"
                  } · ${assessment.dataInspecao} · ${assessment.totalItens} ${
                    assessment.totalItens === 1 ? "item" : "itens"
                  }`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {modalNovo && (
        <NovoAssessmentModal
          clientes={estado.clientes}
          onCancel={() => setModalNovo(false)}
          onSalvar={salvarNovo}
        />
      )}
    </div>
  );
}

function NovoAssessmentModal({
  clientes,
  onCancel,
  onSalvar,
}: {
  clientes: ClienteOpcao[];
  onCancel: () => void;
  onSalvar: (clientId: string, motivo: MotivoAssessment) => Promise<void>;
}) {
  const [clientId, setClientId] = useState(clientes[0]?.id ?? "");
  const [motivo, setMotivo] = useState<MotivoAssessment>("inicio");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(clientId, motivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o assessment.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo="Novo assessment"
      tamanho="md"
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Cliente *</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input w-full"
          >
            {clientes.length === 0 ? (
              <option value="">Nenhum cliente disponível</option>
            ) : (
              clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Motivo *</span>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoAssessment)}
            className="input w-full"
          >
            {Object.entries(MOTIVO_ASSESSMENT_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={salvar}
            disabled={salvando || !clientId}
            loading={salvando}
          >
            Criar assessment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportarQuestionarioModal({
  onCancel,
  onConfirmar,
}: {
  onCancel: () => void;
  onConfirmar: (auvoTaskId: number) => Promise<void>;
}) {
  const [auvoTaskId, setAuvoTaskId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(Number(auvoTaskId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível importar o questionário.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo="Importar questionário Auvo"
      tamanho="md"
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            ID da tarefa Auvo (questionário concluído) *
          </span>
          <input
            value={auvoTaskId}
            onChange={(e) => setAuvoTaskId(e.target.value)}
            className="input w-full"
            inputMode="numeric"
            placeholder="Ex: 123456"
          />
        </label>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={salvando || !auvoTaskId.trim()}
            loading={salvando}
          >
            Importar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DerivarItemModal({
  destino,
  dadosOs,
  onCancel,
  onConfirmar,
}: {
  destino: DestinoItemAssessment;
  dadosOs: DadosAberturaOs;
  onCancel: () => void;
  onConfirmar: (
    responsavel: ResponsavelDestino,
    campos: { tipoTarefaId: string; tecnicoId: string | null } | null,
  ) => Promise<void>;
}) {
  const [responsavel, setResponsavel] = useState<ResponsavelDestino>("sinergica");
  const [tipoTarefaId, setTipoTarefaId] = useState(dadosOs.tiposTarefa[0]?.id ?? "");
  const [tecnicoId, setTecnicoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precisaOs = destino !== "chamado";

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(
        responsavel,
        precisaOs ? { tipoTarefaId, tecnicoId: tecnicoId || null } : null,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível derivar o item.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={DESTINO_ITEM_LABEL[destino]}
      tamanho="md"
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Responsável *</span>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value as ResponsavelDestino)}
            className="input w-full"
          >
            {Object.entries(RESPONSAVEL_DESTINO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {precisaOs && (
          <>
            <div className="block">
              <label
                htmlFor="assessment-derivar-tipo-tarefa"
                className="mb-1 block text-caption font-semibold text-ink-3"
              >
                Tipo de tarefa *
              </label>
              {dadosOs.tiposTarefa.length === 0 ? (
                <p className="text-caption text-ink-3">
                  Nenhum tipo de tarefa cadastrado. Cadastre em PCM → Cadastros → Tipos de Tarefa.
                </p>
              ) : (
                <select
                  id="assessment-derivar-tipo-tarefa"
                  value={tipoTarefaId}
                  onChange={(e) => setTipoTarefaId(e.target.value)}
                  className="input w-full"
                >
                  {dadosOs.tiposTarefa.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">
                Técnico responsável
              </span>
              <select
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
                className="input w-full"
              >
                <option value="">Sem técnico</option>
                {dadosOs.tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nome}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={salvando || (precisaOs && !tipoTarefaId)}
            loading={salvando}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
