import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Snowflake,
  Wrench,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  avancarStatusNc,
  criarContratoPmoc,
  criarEquipamentoPmoc,
  registrarAnaliseMicrobio,
  registrarNaoConformidade,
} from "../application/pmoc";
import type {
  AtualizarStatusNcInput,
  CriarContratoPmocInput,
  CriarNaoConformidadeInput,
  PmocClienteOpcao,
  PmocContratoResumo,
  PmocDetalhe,
  PmocEquipamentoAuvoSugestao,
} from "../application/pmoc-gateway";
import {
  CHECKLIST_PMOC,
  CONDICAO_EQUIPAMENTO_PMOC,
  type ContratoComAlerta,
  type PmocCondicaoEquipamento,
  type PmocSeveridadeNc,
  type PmocStatusNc,
  type PmocTipoEquipamento,
  type PmocTipoImovel,
  STATUS_AGENDA_LABEL,
  STATUS_CONTRATO_LABEL,
  TIPO_ALERTA_LABEL,
  TIPO_EQUIPAMENTO_PMOC,
  TIPO_IMOVEL_PMOC,
  TIPO_MANUTENCAO_LABEL,
  type TipoAlertaPmoc,
  checklistAcumulado,
  classificarMicrobio,
  contratosComAlerta,
  inferirTipoEquipamentoPmoc,
  proximaTagPmoc,
  statusAgendaColor,
  statusContratoColor,
} from "../domain/pmoc";
import { supabasePmocAdapter } from "../infrastructure/supabase-pmoc-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; clientes: PmocClienteOpcao[]; contratos: PmocContratoResumo[] };

type ModalAtivo = "novo-pmoc" | "novo-equipamento" | "nova-analise" | "nova-nc" | null;

function hojeIso(): string {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

function somarAno(dataIso: string): string {
  const data = new Date(`${dataIso}T00:00:00`);
  data.setFullYear(data.getFullYear() + 1);
  data.setDate(data.getDate() - 1);
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 10);
}

function formatarData(dataIso: string | null): string {
  if (!dataIso) return "—";
  const data = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(data.getTime())) return dataIso;
  return new Intl.DateTimeFormat("pt-BR").format(data);
}

function formatarEndereco(contrato: PmocContratoResumo): string {
  return [contrato.endereco, contrato.cidade, contrato.estado].filter(Boolean).join(" · ") || "—";
}

export function PmocPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [detalhe, setDetalhe] = useState<PmocDetalhe | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const [clientes, contratos] = await Promise.all([
        supabasePmocAdapter.listarClientes(),
        supabasePmocAdapter.listarContratos(),
      ]);
      setEstado({ fase: "pronto", clientes, contratos });
      setSelecionadoId((atual) => atual ?? contratos[0]?.id ?? null);
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar PMOC.",
      });
    }
  }, []);

  const carregarDetalhe = useCallback(async (contractId: string) => {
    try {
      setDetalhe(await supabasePmocAdapter.obterDetalheContrato(contractId));
    } catch (error) {
      setDetalhe(null);
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível abrir o contrato PMOC.",
      );
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  useEffect(() => {
    if (selecionadoId) void carregarDetalhe(selecionadoId);
  }, [selecionadoId, carregarDetalhe]);

  const resumo = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return {
      ativos: estado.contratos.filter((contrato) => contrato.status === "ativo").length,
      equipamentos: estado.contratos.reduce(
        (total, contrato) => total + contrato.totalEquipamentos,
        0,
      ),
      visitasMes: estado.contratos.reduce((total, contrato) => total + contrato.visitasMes, 0),
      atrasadas: estado.contratos.reduce((total, contrato) => total + contrato.visitasAtrasadas, 0),
      alertas:
        estado.contratos.filter((contrato) => contrato.status === "renovar").length +
        estado.contratos.reduce((total, contrato) => total + contrato.microbioPendentes, 0),
    };
  }, [estado]);

  // E01-S08: painel de triagem cross-contrato — quem precisa de ação sem clicar contrato a contrato.
  const alertasContratos = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return contratosComAlerta(estado.contratos);
  }, [estado]);

  async function handleCriarContrato(input: CriarContratoPmocInput) {
    setSalvando(true);
    setErroAcao(null);
    try {
      const contrato = await criarContratoPmoc(supabasePmocAdapter, input);
      if (estado.fase === "pronto") {
        setEstado({ ...estado, contratos: [contrato, ...estado.contratos] });
      }
      setSelecionadoId(contrato.id);
      setModalAtivo(null);
      await carregarDetalhe(contrato.id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível criar PMOC.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleCriarEquipamento(input: NovoEquipamentoForm) {
    if (!user || !detalhe) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await criarEquipamentoPmoc(supabasePmocAdapter, {
        ...input,
        propertyId: detalhe.contrato.propertyId,
        auvoEquipmentId: input.auvoEquipmentId ?? null,
        createdBy: user.id,
      });
      setModalAtivo(null);
      await carregar();
      await carregarDetalhe(detalhe.contrato.id);
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível adicionar equipamento.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleImportarEquipamentoAuvo(sugestao: PmocEquipamentoAuvoSugestao) {
    if (!user || !detalhe || sugestao.jaImportado) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await criarEquipamentoPmoc(supabasePmocAdapter, {
        propertyId: detalhe.contrato.propertyId,
        auvoEquipmentId: sugestao.auvoEquipmentId,
        tag: proximaTagPmoc(detalhe.equipamentos.map((equipamento) => equipamento.tag)),
        type: inferirTipoEquipamentoPmoc(sugestao.nome),
        brand: null,
        model: null,
        capacityBtu: null,
        location: sugestao.nome,
        environment: null,
        floor: null,
        refrigerant: "R-410A",
        phase: null,
        condition: "bom",
        notes: `Importado do equipamento Auvo #${sugestao.auvoEquipmentId}`,
        createdBy: user.id,
      });
      await carregar();
      await carregarDetalhe(detalhe.contrato.id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível importar do Auvo.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRegistrarAnalise(input: NovaAnaliseForm) {
    if (!user || !detalhe) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await registrarAnaliseMicrobio(supabasePmocAdapter, {
        ...input,
        contractId: detalhe.contrato.id,
        propertyId: detalhe.contrato.propertyId,
        createdBy: user.id,
      });
      setModalAtivo(null);
      await carregar();
      await carregarDetalhe(detalhe.contrato.id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível registrar a análise.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRegistrarNc(
    input: Omit<CriarNaoConformidadeInput, "contractId" | "createdBy">,
  ) {
    if (!user || !detalhe) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await registrarNaoConformidade(supabasePmocAdapter, {
        ...input,
        contractId: detalhe.contrato.id,
        createdBy: user.id,
      });
      setModalAtivo(null);
      await carregar();
      await carregarDetalhe(detalhe.contrato.id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível registrar a NC.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleAvancarStatusNc(atual: PmocStatusNc, input: AtualizarStatusNcInput) {
    if (!detalhe) return;
    setErroAcao(null);
    try {
      await avancarStatusNc(supabasePmocAdapter, atual, input);
      await carregarDetalhe(detalhe.contrato.id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível atualizar a NC.");
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando PMOC…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="rounded-[10px] border border-line bg-card p-8 text-center">
        <h2 className="text-lg font-semibold text-ink-2">PMOC indisponível</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">PMOC · Climatização</h2>
          <p className="text-sm text-ink-3">
            Plano de Manutenção, Operação e Controle com inventário, cronograma e alertas legais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={carregar} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModalAtivo("novo-pmoc")}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Novo PMOC
            </button>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      {resumo && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Contratos ativos" value={resumo.ativos} icon={FileText} />
          <Kpi label="Equipamentos AC" value={resumo.equipamentos} icon={Snowflake} />
          <Kpi label="Visitas no mês" value={resumo.visitasMes} icon={Calendar} />
          <Kpi label="Atrasadas" value={resumo.atrasadas} icon={AlertTriangle} danger />
          <Kpi label="Alertas legais" value={resumo.alertas} icon={ClipboardList} />
        </div>
      )}

      {estado.contratos.length > 0 && (
        <PainelAlertasPmoc
          alertas={alertasContratos}
          onAbrirContrato={(contractId) => setSelecionadoId(contractId)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <section className="rounded-[10px] border border-line bg-card">
          <div className="border-b border-line-soft px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Contratos PMOC</h3>
            <p className="mt-0.5 text-xs text-ink-3">{estado.contratos.length} registros</p>
          </div>
          <div className="max-h-[720px] divide-y divide-line-soft overflow-y-auto">
            {estado.contratos.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-ink-3">
                Nenhum PMOC cadastrado ainda.
              </div>
            ) : (
              estado.contratos.map((contrato) => (
                <button
                  key={contrato.id}
                  type="button"
                  onClick={() => setSelecionadoId(contrato.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-line-soft ${
                    selecionadoId === contrato.id ? "bg-orange-soft/35" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {contrato.imovelNome}
                      </p>
                      <p className="mt-1 truncate text-xs text-ink-3">{contrato.clienteNome}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusContratoColor(contrato.status)}`}
                    >
                      {STATUS_CONTRATO_LABEL[contrato.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniMetric label="ACs" value={contrato.totalEquipamentos} />
                    <MiniMetric label="Mês" value={contrato.visitasMes} />
                    <MiniMetric label="NCs" value={contrato.ncsAbertas} />
                  </div>
                  <p className="mt-3 text-xs text-ink-3">
                    Próxima visita:{" "}
                    <span className="font-semibold text-ink-2">
                      {formatarData(contrato.proximaVisita)}
                    </span>
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="min-h-[720px] rounded-[10px] border border-line bg-card">
          {detalhe ? (
            <DetalhePmoc
              detalhe={detalhe}
              podeEditar={temEscrita}
              salvando={salvando}
              onNovoEquipamento={() => setModalAtivo("novo-equipamento")}
              onImportarAuvo={handleImportarEquipamentoAuvo}
              onNovaAnalise={() => setModalAtivo("nova-analise")}
              onNovaNc={() => setModalAtivo("nova-nc")}
              onAvancarStatusNc={handleAvancarStatusNc}
            />
          ) : (
            <div className="p-10 text-center text-sm text-ink-3">Selecione ou crie um PMOC.</div>
          )}
        </section>
      </div>

      {modalAtivo === "novo-pmoc" && user && (
        <NovoPmocModal
          clientes={estado.clientes}
          createdBy={user.id}
          salvando={salvando}
          onClose={() => setModalAtivo(null)}
          onSubmit={handleCriarContrato}
        />
      )}

      {modalAtivo === "novo-equipamento" && (
        <NovoEquipamentoModal
          salvando={salvando}
          tagInicial={
            detalhe ? proximaTagPmoc(detalhe.equipamentos.map((item) => item.tag)) : "AC-01"
          }
          onClose={() => setModalAtivo(null)}
          onSubmit={handleCriarEquipamento}
        />
      )}

      {modalAtivo === "nova-analise" && (
        <NovaAnaliseMicrobioModal
          salvando={salvando}
          onClose={() => setModalAtivo(null)}
          onSubmit={handleRegistrarAnalise}
        />
      )}

      {modalAtivo === "nova-nc" && (
        <NovaNcModal
          salvando={salvando}
          onClose={() => setModalAtivo(null)}
          onSubmit={handleRegistrarNc}
        />
      )}
    </div>
  );
}

function DetalhePmoc({
  detalhe,
  podeEditar,
  salvando,
  onNovoEquipamento,
  onImportarAuvo,
  onNovaAnalise,
  onNovaNc,
  onAvancarStatusNc,
}: {
  detalhe: PmocDetalhe;
  podeEditar: boolean;
  salvando: boolean;
  onNovoEquipamento: () => void;
  onImportarAuvo: (sugestao: PmocEquipamentoAuvoSugestao) => Promise<void>;
  onNovaAnalise: () => void;
  onNovaNc: () => void;
  onAvancarStatusNc: (atual: PmocStatusNc, input: AtualizarStatusNcInput) => Promise<void>;
}) {
  const contrato = detalhe.contrato;
  const proxima = detalhe.agenda.find(
    (agenda) => agenda.status === "agendado" || agenda.status === "atrasado",
  );
  const checklistProxima = checklistAcumulado(proxima?.maintenanceType ?? "mensal");
  const obrigatorios = checklistProxima.filter((item) => item.obrigatorio);

  return (
    <div>
      <div className="bg-navy px-5 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              PMOC · {contrato.clienteNome}
            </p>
            <h3 className="mt-1 text-xl font-bold">{contrato.imovelNome}</h3>
            <p className="mt-1 text-sm text-white/70">{formatarEndereco(contrato)}</p>
          </div>
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">
            Vigência {formatarData(contrato.startDate)} a {formatarData(contrato.endDate)}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <HeaderMetric label="Responsável técnico" value={contrato.tecnicoNome} />
          <HeaderMetric label="ART" value={contrato.artNumber || "pendente"} />
          <HeaderMetric label="Próxima visita" value={formatarData(contrato.proximaVisita)} />
          <HeaderMetric label="Equipamentos" value={String(contrato.totalEquipamentos)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-ink">Inventário de climatização</h4>
              <p className="text-xs text-ink-3">Evaporadora + condensadora como um sistema</p>
            </div>
            {podeEditar && (
              <button
                type="button"
                onClick={onNovoEquipamento}
                className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-line-soft"
              >
                <Plus className="h-4 w-4" />
                Equipamento
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {detalhe.equipamentos.length === 0 ? (
              <div className="rounded-[8px] border border-line bg-paper px-4 py-8 text-center text-sm text-ink-3 md:col-span-2">
                Nenhum equipamento cadastrado.
              </div>
            ) : (
              detalhe.equipamentos.map((equipamento) => (
                <div key={equipamento.id} className="rounded-[8px] border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-brand text-lg font-bold text-ink">{equipamento.tag}</p>
                      <p className="text-xs text-ink-3">
                        {
                          TIPO_EQUIPAMENTO_PMOC.find((item) => item.valor === equipamento.type)
                            ?.rotulo
                        }
                      </p>
                    </div>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                      {equipamento.condition}
                    </span>
                  </div>
                  {equipamento.auvoEquipmentId && (
                    <span className="mt-2 inline-flex rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-navy">
                      Auvo #{equipamento.auvoEquipmentId}
                    </span>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-3">
                    <span>{equipamento.location || "Sem localização"}</span>
                    <span className="text-right">
                      {equipamento.capacityBtu
                        ? `${equipamento.capacityBtu.toLocaleString("pt-BR")} BTU/h`
                        : "BTU —"}
                    </span>
                    <span>{equipamento.brand || "Marca —"}</span>
                    <span className="text-right">{equipamento.refrigerant}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[8px] border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-ink">Inventário assistido pelo Auvo</h4>
                <p className="mt-1 text-xs text-ink-3">
                  Equipamentos sincronizados do cliente para virar PMOC sem redigitar.
                </p>
              </div>
              <Snowflake className="h-4 w-4 shrink-0 text-orange" />
            </div>
            {detalhe.sugestoesAuvo.length === 0 ? (
              <p className="mt-4 text-sm text-ink-3">
                Sem equipamentos Auvo vinculados a este cliente.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {detalhe.sugestoesAuvo.slice(0, 6).map((sugestao) => (
                  <div
                    key={sugestao.auvoEquipmentId}
                    className="rounded-[6px] border border-line-soft px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{sugestao.nome}</p>
                        <p className="text-xs text-ink-3">Auvo #{sugestao.auvoEquipmentId}</p>
                      </div>
                      {sugestao.jaImportado ? (
                        <span className="rounded-full bg-[#EAF8EF] px-2 py-0.5 text-[11px] font-semibold text-[#267343]">
                          PMOC
                        </span>
                      ) : (
                        podeEditar && (
                          <button
                            type="button"
                            disabled={salvando}
                            onClick={() => onImportarAuvo(sugestao)}
                            className="shrink-0 rounded-[6px] border border-line px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
                          >
                            Importar
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
                {detalhe.sugestoesAuvo.length > 6 && (
                  <p className="text-xs text-ink-3">
                    +{detalhe.sugestoesAuvo.length - 6} equipamentos no cache Auvo
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[8px] border border-line p-4">
            <h4 className="text-sm font-semibold text-ink">Próxima execução</h4>
            {proxima ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusAgendaColor(proxima.status)}`}
                  >
                    {STATUS_AGENDA_LABEL[proxima.status]}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {formatarData(proxima.scheduledDate)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {TIPO_MANUTENCAO_LABEL[proxima.maintenanceType]}
                </p>
                <p className="mt-1 text-xs text-ink-3">
                  {checklistProxima.length} itens no checklist acumulado
                </p>
                {obrigatorios.length > 0 && (
                  <div className="mt-3 rounded-[6px] bg-orange-soft px-3 py-2 text-xs text-orange-deep">
                    Inclui coleta/laudo microbiológico obrigatório.
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-3">Cronograma sem próxima visita aberta.</p>
            )}
          </div>

          <div className="rounded-[8px] border border-line p-4">
            <h4 className="text-sm font-semibold text-ink">Alertas legais</h4>
            <div className="mt-3 space-y-2 text-sm">
              <AlertaLinha
                ativo={contrato.status === "renovar"}
                label="ART / vigência perto do vencimento"
              />
              <AlertaLinha
                ativo={contrato.microbioPendentes > 0}
                label="Laudo microbiológico pendente"
              />
              <AlertaLinha ativo={contrato.ncsAbertas > 0} label="Não-conformidades abertas" />
            </div>
          </div>
        </aside>
      </div>

      <div className="border-t border-line-soft px-5 py-5">
        <h4 className="text-sm font-semibold text-ink">Cronograma anual</h4>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {detalhe.agenda.map((agenda) => (
            <div key={agenda.id} className="rounded-[8px] border border-line px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  Mês {agenda.monthRef}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusAgendaColor(agenda.status)}`}
                >
                  {STATUS_AGENDA_LABEL[agenda.status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatarData(agenda.scheduledDate)}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {TIPO_MANUTENCAO_LABEL[agenda.maintenanceType]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-line-soft p-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-ink">Análises microbiológicas</h4>
            {podeEditar && (
              <button
                type="button"
                onClick={onNovaAnalise}
                className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-line-soft"
              >
                <Plus className="h-4 w-4" />
                Nova análise
              </button>
            )}
          </div>
          {detalhe.microbiologia.length === 0 ? (
            <div className="rounded-[8px] border border-line bg-paper px-4 py-8 text-center text-sm text-ink-3">
              Nenhuma análise registrada.
            </div>
          ) : (
            <div className="space-y-2">
              {detalhe.microbiologia.map((analise) => (
                <div key={analise.id} className="rounded-[8px] border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {formatarData(analise.analysisDate)}
                      </p>
                      <p className="text-xs text-ink-3">{analise.labName || "Laboratório —"}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMicrobioColor(analise.status)}`}
                    >
                      {STATUS_MICROBIO_LABEL[analise.status]}
                    </span>
                  </div>
                  {analise.correctiveActionNeeded && (
                    <div className="mt-2 flex items-center gap-2 rounded-[6px] bg-[#FDECEB] px-3 py-2 text-xs font-semibold text-[#B42318]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Fora dos limites legais — ação corretiva necessária.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-ink">Não-conformidades</h4>
            {podeEditar && (
              <button
                type="button"
                onClick={onNovaNc}
                className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-line-soft"
              >
                <Plus className="h-4 w-4" />
                Nova NC
              </button>
            )}
          </div>
          {detalhe.naoConformidades.length === 0 ? (
            <div className="rounded-[8px] border border-line bg-paper px-4 py-8 text-center text-sm text-ink-3">
              Nenhuma não-conformidade registrada.
            </div>
          ) : (
            <div className="space-y-2">
              {detalhe.naoConformidades.map((nc) => (
                <div key={nc.id} className="rounded-[8px] border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{nc.description}</p>
                      <p className="text-xs text-ink-3">
                        {nc.tag ? `${nc.tag} · ` : ""}
                        {nc.deadline ? `Prazo ${formatarData(nc.deadline)}` : "Sem prazo"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${severidadeNcColor(nc.severity)}`}
                    >
                      {SEVERIDADE_NC_LABEL[nc.severity]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusNcColor(nc.status)}`}
                    >
                      {STATUS_NC_LABEL[nc.status]}
                    </span>
                    {podeEditar && nc.status !== "fechado" && (
                      <button
                        type="button"
                        onClick={() =>
                          onAvancarStatusNc(nc.status, {
                            id: nc.id,
                            status: nc.status === "aberto" ? "em_andamento" : "fechado",
                          })
                        }
                        className="text-xs font-semibold text-orange hover:text-orange-deep"
                      >
                        {nc.status === "aberto" ? "Iniciar" : "Fechar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_MICROBIO_LABEL: Record<"conforme" | "nao_conforme" | "pendente", string> = {
  conforme: "Conforme",
  nao_conforme: "Não-conforme",
  pendente: "Pendente",
};

function statusMicrobioColor(status: "conforme" | "nao_conforme" | "pendente"): string {
  if (status === "conforme") return "bg-[#EAF8EF] text-[#267343]";
  if (status === "nao_conforme") return "bg-[#FDECEB] text-[#B42318]";
  return "bg-line-soft text-ink-2";
}

const SEVERIDADE_NC_LABEL: Record<PmocSeveridadeNc, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

function severidadeNcColor(severity: PmocSeveridadeNc): string {
  if (severity === "alta") return "bg-[#FDECEB] text-[#B42318]";
  if (severity === "media") return "bg-orange-soft text-orange-deep";
  return "bg-line-soft text-ink-2";
}

const STATUS_NC_LABEL: Record<PmocStatusNc, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  fechado: "Fechado",
};

function statusNcColor(status: PmocStatusNc): string {
  if (status === "fechado") return "bg-[#EAF8EF] text-[#267343]";
  if (status === "em_andamento") return "bg-[#EEF2FF] text-navy";
  return "bg-line-soft text-ink-2";
}

function Kpi({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
        <Icon className={`h-4 w-4 ${danger && value > 0 ? "text-orange" : "text-ink-3"}`} />
      </div>
      <p
        className={`mt-2 font-brand text-xl font-bold ${danger && value > 0 ? "text-orange" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[6px] border border-line-soft px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase text-ink-3">{label}</p>
      <p className="font-brand text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PainelAlertasPmoc({
  alertas,
  onAbrirContrato,
}: {
  alertas: ContratoComAlerta[];
  onAbrirContrato: (contractId: string) => void;
}) {
  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[8px] border border-line bg-card px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#267343]" />
        <span className="font-semibold text-[#267343]">Tudo em dia</span>
        <span className="text-ink-3">— nenhum contrato PMOC precisa de atenção agora.</span>
      </div>
    );
  }

  const grupos = new Map<TipoAlertaPmoc, ContratoComAlerta[]>();
  for (const item of alertas) {
    const grupo = grupos.get(item.tipo) ?? [];
    grupo.push(item);
    grupos.set(item.tipo, grupo);
  }

  return (
    <div className="rounded-[10px] border border-line bg-card">
      <div className="border-b border-line-soft px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Precisa de atenção</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          {alertas.length} contrato(s) — clique para abrir
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {[...grupos.entries()].map(([tipo, contratos]) => (
          <div key={tipo} className="rounded-[8px] border border-line-soft p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-orange-deep">
              {TIPO_ALERTA_LABEL[tipo]} ({contratos.length})
            </p>
            <div className="space-y-1">
              {contratos.map((item) => (
                <button
                  key={item.contratoId}
                  type="button"
                  onClick={() => onAbrirContrato(item.contratoId)}
                  className="block w-full truncate rounded-[6px] px-2 py-1 text-left text-sm text-ink-2 hover:bg-line-soft"
                >
                  {item.imovelNome} <span className="text-xs text-ink-3">· {item.clienteNome}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertaLinha({ ativo, label }: { ativo: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ativo ? (
        <AlertTriangle className="h-4 w-4 text-orange" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-[#267343]" />
      )}
      <span className={ativo ? "font-semibold text-orange-deep" : "text-ink-3"}>{label}</span>
    </div>
  );
}

interface NovoPmocEquipamento {
  tag: string;
  type: PmocTipoEquipamento;
  location: string;
  capacityBtu: string;
}

function NovoPmocModal({
  clientes,
  createdBy,
  salvando,
  onClose,
  onSubmit,
}: {
  clientes: PmocClienteOpcao[];
  createdBy: string;
  salvando: boolean;
  onClose: () => void;
  onSubmit: (input: CriarContratoPmocInput) => Promise<void>;
}) {
  const primeiroCliente = clientes[0];
  const [form, setForm] = useState({
    clientId: primeiroCliente?.id ?? "",
    imovelNome: primeiroCliente?.nome ?? "",
    tipoImovel: "residencial" as PmocTipoImovel,
    endereco: primeiroCliente?.endereco ?? "",
    cidade: primeiroCliente?.cidade ?? "Campinas",
    estado: primeiroCliente?.estado ?? "SP",
    cep: primeiroCliente?.cep ?? "",
    cnpjCpf: primeiroCliente?.cnpj ?? "",
    contatoNome: primeiroCliente?.contatoNome ?? "",
    contatoCargo: "Síndico",
    contatoTelefone: primeiroCliente?.contatoTelefone ?? "",
    contatoEmail: primeiroCliente?.contatoEmail ?? "",
    tecnicoNome: "Fabrício Medeiros",
    crea: "",
    artNumber: "",
    artDate: "",
    startDate: hojeIso(),
    endDate: somarAno(hojeIso()),
    notes: "",
  });
  const [equipamentos, setEquipamentos] = useState<NovoPmocEquipamento[]>([
    { tag: "AC-01", type: "split-hiwall", location: "", capacityBtu: "" },
    { tag: "AC-02", type: "split-hiwall", location: "", capacityBtu: "" },
  ]);

  function aplicarCliente(clientId: string) {
    const cliente = clientes.find((item) => item.id === clientId);
    setForm((atual) => ({
      ...atual,
      clientId,
      imovelNome: cliente?.nome ?? atual.imovelNome,
      endereco: cliente?.endereco ?? atual.endereco,
      cidade: cliente?.cidade ?? atual.cidade,
      estado: cliente?.estado ?? atual.estado,
      cep: cliente?.cep ?? atual.cep,
      cnpjCpf: cliente?.cnpj ?? atual.cnpjCpf,
      contatoNome: cliente?.contatoNome ?? atual.contatoNome,
      contatoTelefone: cliente?.contatoTelefone ?? atual.contatoTelefone,
      contatoEmail: cliente?.contatoEmail ?? atual.contatoEmail,
    }));
  }

  return (
    <ModalBase title="Novo PMOC" onClose={onClose} size="lg">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Cliente">
          <select
            className="input"
            value={form.clientId}
            onChange={(e) => aplicarCliente(e.target.value)}
          >
            <option value="">Selecione</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome do imóvel">
          <input
            className="input"
            value={form.imovelNome}
            onChange={(e) => setForm({ ...form, imovelNome: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <select
            className="input"
            value={form.tipoImovel}
            onChange={(e) => setForm({ ...form, tipoImovel: e.target.value as PmocTipoImovel })}
          >
            {TIPO_IMOVEL_PMOC.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Endereço">
          <input
            className="input"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
          />
        </Field>
        <Field label="Cidade">
          <input
            className="input"
            value={form.cidade}
            onChange={(e) => setForm({ ...form, cidade: e.target.value })}
          />
        </Field>
        <Field label="UF">
          <input
            className="input"
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          />
        </Field>
        <Field label="Responsável">
          <input
            className="input"
            value={form.contatoNome}
            onChange={(e) => setForm({ ...form, contatoNome: e.target.value })}
          />
        </Field>
        <Field label="E-mail do responsável">
          <input
            className="input"
            value={form.contatoEmail}
            onChange={(e) => setForm({ ...form, contatoEmail: e.target.value })}
          />
        </Field>
        <Field label="Início">
          <input
            className="input"
            type="date"
            value={form.startDate}
            onChange={(e) =>
              setForm({ ...form, startDate: e.target.value, endDate: somarAno(e.target.value) })
            }
          />
        </Field>
        <Field label="Término">
          <input
            className="input"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </Field>
        <Field label="Responsável técnico">
          <input
            className="input"
            value={form.tecnicoNome}
            onChange={(e) => setForm({ ...form, tecnicoNome: e.target.value })}
          />
        </Field>
        <Field label="ART">
          <input
            className="input"
            value={form.artNumber}
            onChange={(e) => setForm({ ...form, artNumber: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-[8px] border border-line p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-ink">Inventário inicial</h4>
          <button
            type="button"
            onClick={() =>
              setEquipamentos((atuais) => [
                ...atuais,
                {
                  tag: `AC-${String(atuais.length + 1).padStart(2, "0")}`,
                  type: "split-hiwall",
                  location: "",
                  capacityBtu: "",
                },
              ])
            }
            className="text-xs font-semibold text-orange"
          >
            Adicionar linha
          </button>
        </div>
        <div className="space-y-2">
          {equipamentos.map((equipamento, index) => (
            <div
              key={`${equipamento.tag}-${index}`}
              className="grid grid-cols-1 gap-2 md:grid-cols-[90px_1fr_1fr_120px]"
            >
              <input
                className="input"
                value={equipamento.tag}
                onChange={(e) =>
                  setEquipamentos((atuais) =>
                    atuais.map((item, i) =>
                      i === index ? { ...item, tag: e.target.value } : item,
                    ),
                  )
                }
              />
              <select
                className="input"
                value={equipamento.type}
                onChange={(e) =>
                  setEquipamentos((atuais) =>
                    atuais.map((item, i) =>
                      i === index ? { ...item, type: e.target.value as PmocTipoEquipamento } : item,
                    ),
                  )
                }
              >
                {TIPO_EQUIPAMENTO_PMOC.map((item) => (
                  <option key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Localização"
                value={equipamento.location}
                onChange={(e) =>
                  setEquipamentos((atuais) =>
                    atuais.map((item, i) =>
                      i === index ? { ...item, location: e.target.value } : item,
                    ),
                  )
                }
              />
              <input
                className="input"
                placeholder="BTU/h"
                inputMode="numeric"
                value={equipamento.capacityBtu}
                onChange={(e) =>
                  setEquipamentos((atuais) =>
                    atuais.map((item, i) =>
                      i === index ? { ...item, capacityBtu: e.target.value } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>

      <ModalActions
        primaryLabel="Criar PMOC"
        disabled={salvando || !form.clientId || !form.imovelNome.trim()}
        onCancel={onClose}
        onPrimary={() =>
          onSubmit({
            ...form,
            equipamentos: equipamentos.map((equipamento) => ({
              tag: equipamento.tag,
              type: equipamento.type,
              location: equipamento.location || null,
              capacityBtu: equipamento.capacityBtu ? Number(equipamento.capacityBtu) : null,
            })),
            createdBy,
          })
        }
      />
    </ModalBase>
  );
}

interface NovoEquipamentoForm {
  auvoEquipmentId?: number | null;
  tag: string;
  type: PmocTipoEquipamento;
  brand: string | null;
  model: string | null;
  capacityBtu: number | null;
  location: string | null;
  environment: string | null;
  floor: string | null;
  refrigerant: string;
  phase: "mono" | "bi" | "tri" | null;
  condition: PmocCondicaoEquipamento;
  notes: string | null;
}

function NovoEquipamentoModal({
  salvando,
  tagInicial,
  onClose,
  onSubmit,
}: {
  salvando: boolean;
  tagInicial: string;
  onClose: () => void;
  onSubmit: (input: NovoEquipamentoForm) => Promise<void>;
}) {
  const [form, setForm] = useState({
    tag: tagInicial,
    type: "split-hiwall" as PmocTipoEquipamento,
    brand: "",
    model: "",
    capacityBtu: "",
    location: "",
    environment: "",
    floor: "",
    refrigerant: "R-410A",
    phase: "mono" as "mono" | "bi" | "tri",
    condition: "bom" as PmocCondicaoEquipamento,
    notes: "",
  });

  return (
    <ModalBase title="Novo equipamento PMOC" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Tag">
          <input
            className="input"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
          />
        </Field>
        <Field label="Tipo">
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PmocTipoEquipamento })}
          >
            {TIPO_EQUIPAMENTO_PMOC.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marca">
          <input
            className="input"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
        </Field>
        <Field label="Modelo">
          <input
            className="input"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </Field>
        <Field label="Capacidade BTU/h">
          <input
            className="input"
            inputMode="numeric"
            value={form.capacityBtu}
            onChange={(e) => setForm({ ...form, capacityBtu: e.target.value })}
          />
        </Field>
        <Field label="Localização">
          <input
            className="input"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </Field>
        <Field label="Ambiente">
          <input
            className="input"
            value={form.environment}
            onChange={(e) => setForm({ ...form, environment: e.target.value })}
          />
        </Field>
        <Field label="Condição">
          <select
            className="input"
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value as PmocCondicaoEquipamento })
            }
          >
            {CONDICAO_EQUIPAMENTO_PMOC.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ModalActions
        primaryLabel="Adicionar equipamento"
        disabled={salvando || !form.tag.trim()}
        onCancel={onClose}
        onPrimary={() =>
          onSubmit({
            ...form,
            brand: form.brand || null,
            model: form.model || null,
            capacityBtu: form.capacityBtu ? Number(form.capacityBtu) : null,
            location: form.location || null,
            environment: form.environment || null,
            floor: form.floor || null,
            notes: form.notes || null,
          })
        }
      />
    </ModalBase>
  );
}

interface NovaAnaliseForm {
  analysisDate: string;
  labName: string | null;
  labAccreditation: string | null;
  collectionPoints: number | null;
  fungiUfcM3: number | null;
  ieRatio: number | null;
  coliformsResult: "ausencia" | "presenca" | null;
  reportNumber: string | null;
  reportUrl: string | null;
  notes: string | null;
}

function NovaAnaliseMicrobioModal({
  salvando,
  onClose,
  onSubmit,
}: {
  salvando: boolean;
  onClose: () => void;
  onSubmit: (input: NovaAnaliseForm) => Promise<void>;
}) {
  const [form, setForm] = useState({
    analysisDate: hojeIso(),
    labName: "",
    labAccreditation: "",
    collectionPoints: "",
    fungiUfcM3: "",
    ieRatio: "",
    coliformsResult: "" as "" | "ausencia" | "presenca",
    reportNumber: "",
    reportUrl: "",
  });

  // AC-1/AC-3: pré-visualiza o status calculado antes de salvar — o usuário vê o resultado da regra
  // legal (fungos ≤750, I/E ≤1,5, coliformes ausência) antes de confirmar, nunca digita o status.
  const previaStatus = classificarMicrobio({
    fungiUfcM3: form.fungiUfcM3 ? Number(form.fungiUfcM3) : null,
    ieRatio: form.ieRatio ? Number(form.ieRatio) : null,
    coliformsResult: form.coliformsResult || null,
  });

  return (
    <ModalBase title="Nova análise microbiológica" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Data da coleta">
          <input
            type="date"
            className="input"
            value={form.analysisDate}
            onChange={(e) => setForm({ ...form, analysisDate: e.target.value })}
          />
        </Field>
        <Field label="Laboratório">
          <input
            className="input"
            value={form.labName}
            onChange={(e) => setForm({ ...form, labName: e.target.value })}
          />
        </Field>
        <Field label="Fungos (UFC/m³) — limite ≤750">
          <input
            className="input"
            inputMode="decimal"
            value={form.fungiUfcM3}
            onChange={(e) => setForm({ ...form, fungiUfcM3: e.target.value })}
          />
        </Field>
        <Field label="Relação I/E — limite ≤1,5">
          <input
            className="input"
            inputMode="decimal"
            value={form.ieRatio}
            onChange={(e) => setForm({ ...form, ieRatio: e.target.value })}
          />
        </Field>
        <Field label="Coliformes">
          <select
            className="input"
            value={form.coliformsResult}
            onChange={(e) =>
              setForm({ ...form, coliformsResult: e.target.value as "" | "ausencia" | "presenca" })
            }
          >
            <option value="">Sem resultado ainda</option>
            <option value="ausencia">Ausência</option>
            <option value="presenca">Presença</option>
          </select>
        </Field>
        <Field label="Nº do laudo">
          <input
            className="input"
            value={form.reportNumber}
            onChange={(e) => setForm({ ...form, reportNumber: e.target.value })}
          />
        </Field>
      </div>

      <div
        className={`mt-4 rounded-[6px] px-3 py-2 text-sm font-semibold ${statusMicrobioColor(previaStatus)}`}
      >
        Status calculado: {STATUS_MICROBIO_LABEL[previaStatus]}
        {previaStatus === "nao_conforme" && " — ação corretiva será marcada como necessária"}
      </div>

      <ModalActions
        primaryLabel="Registrar análise"
        disabled={salvando || !form.analysisDate}
        onCancel={onClose}
        onPrimary={() =>
          onSubmit({
            analysisDate: form.analysisDate,
            labName: form.labName || null,
            labAccreditation: form.labAccreditation || null,
            collectionPoints: form.collectionPoints ? Number(form.collectionPoints) : null,
            fungiUfcM3: form.fungiUfcM3 ? Number(form.fungiUfcM3) : null,
            ieRatio: form.ieRatio ? Number(form.ieRatio) : null,
            coliformsResult: form.coliformsResult || null,
            reportNumber: form.reportNumber || null,
            reportUrl: form.reportUrl || null,
            notes: null,
          })
        }
      />
    </ModalBase>
  );
}

function NovaNcModal({
  salvando,
  onClose,
  onSubmit,
}: {
  salvando: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<CriarNaoConformidadeInput, "contractId" | "createdBy">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    tag: "",
    description: "",
    severity: "media" as PmocSeveridadeNc,
    recommendedAction: "",
    responsible: "",
    deadline: "",
  });

  return (
    <ModalBase title="Nova não-conformidade" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Descrição">
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Severidade">
          <select
            className="input"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as PmocSeveridadeNc })}
          >
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </Field>
        <Field label="Tag do equipamento (opcional)">
          <input
            className="input"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
          />
        </Field>
        <Field label="Prazo">
          <input
            type="date"
            className="input"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </Field>
        <Field label="Ação recomendada">
          <input
            className="input"
            value={form.recommendedAction}
            onChange={(e) => setForm({ ...form, recommendedAction: e.target.value })}
          />
        </Field>
        <Field label="Responsável">
          <input
            className="input"
            value={form.responsible}
            onChange={(e) => setForm({ ...form, responsible: e.target.value })}
          />
        </Field>
      </div>
      <ModalActions
        primaryLabel="Registrar NC"
        disabled={salvando || !form.description.trim()}
        onCancel={onClose}
        onPrimary={() =>
          onSubmit({
            equipmentId: null,
            tag: form.tag || null,
            description: form.description,
            severity: form.severity,
            recommendedAction: form.recommendedAction || null,
            responsible: form.responsible || null,
            deadline: form.deadline || null,
          })
        }
      />
    </ModalBase>
  );
}

function ModalBase({
  title,
  children,
  onClose,
  size = "md",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
}) {
  return (
    <div className="modal-backdrop">
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-[10px] bg-card shadow-xl ${size === "lg" ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-ink-3 hover:bg-line-soft hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-64px)] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      {children}
    </div>
  );
}

function ModalActions({
  primaryLabel,
  disabled,
  onCancel,
  onPrimary,
}: {
  primaryLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onPrimary: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
        {primaryLabel}
      </button>
    </div>
  );
}
