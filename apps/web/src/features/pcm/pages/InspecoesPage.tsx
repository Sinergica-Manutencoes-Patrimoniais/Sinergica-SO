import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sheet,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  aplicarTemplate,
  criarInspecao,
  criarItemInspecao,
  editarInspecao,
  editarItemInspecao,
  excluirItemInspecao,
} from "../application/qualidade";
import type {
  ChecklistTemplate,
  ClienteOpcao,
  InspecaoItem,
  InspecaoResumo,
  ItemInspecaoImportado,
  MidiaItem,
  TipoInspecao,
} from "../application/qualidade-gateway";
import {
  GRAUS_RISCO,
  GRAU_RISCO_LABEL,
  type GrauRisco,
  INSPECAO_STATUS_LABEL,
  type ItemResultado,
  RESULTADOS_INSPECAO,
  RESULTADO_LABEL,
  SISTEMAS_INSPECAO,
  SISTEMA_ICONE,
  type SistemaInspecao,
  grauRiscoColor,
  resultadoColor,
  rotuloSistema,
  statusColor,
} from "../domain/inspecoes-laudos";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      clientes: ClienteOpcao[];
      inspecoes: InspecaoResumo[];
      tipos: TipoInspecao[];
      templates: ChecklistTemplate[];
    };

type ModalAtivo =
  | "nova-inspecao"
  | "editar-inspecao"
  | "novo-item"
  | "importar-pdf"
  | "importar-xls"
  | null;
type FiltroSistema = SistemaInspecao | "todos";

const SISTEMAS: SistemaInspecao[] = SISTEMAS_INSPECAO.map((item) => item.valor);

type PdfJsLib = {
  getDocument: (input: unknown) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
      }>;
    }>;
  };
  GlobalWorkerOptions: { workerSrc: string };
};

function hojeIso(): string {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

function formatarData(data: string): string {
  const parsed = new Date(`${data}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return data;
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
}

export function InspecoesPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [itens, setItens] = useState<InspecaoItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroSistema, setFiltroSistema] = useState<FiltroSistema>("todos");
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null);
  const [itemEditando, setItemEditando] = useState<InspecaoItem | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");
  const semClientes = estado.fase === "pronto" && estado.clientes.length === 0;

  const inspecaoSelecionada = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return estado.inspecoes.find((inspecao) => inspecao.id === selecionadaId) ?? null;
  }, [estado, selecionadaId]);

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const [clientes, inspecoes, tipos, templates] = await Promise.all([
        supabaseQualidadeAdapter.listarClientes(),
        supabaseQualidadeAdapter.listarInspecoes(),
        supabaseQualidadeAdapter.listarTiposInspecao(),
        supabaseQualidadeAdapter.listarTemplates(),
      ]);
      setEstado({ fase: "pronto", clientes, inspecoes, tipos, templates });
      setSelecionadaId((atual) => atual ?? inspecoes[0]?.id ?? null);
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar inspeções.",
      });
    }
  }, []);

  const carregarItens = useCallback(async (inspecaoId: string) => {
    setCarregandoItens(true);
    try {
      setItens(await supabaseQualidadeAdapter.listarItensInspecao(inspecaoId));
    } catch {
      setItens([]);
      setErroAcao("Não foi possível carregar os itens da inspeção.");
    } finally {
      setCarregandoItens(false);
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  useEffect(() => {
    if (selecionadaId) void carregarItens(selecionadaId);
  }, [selecionadaId, carregarItens]);

  const inspecoesFiltradas = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const termo = busca.trim().toLowerCase();
    return estado.inspecoes.filter((inspecao) => {
      if (!termo) return true;
      return [inspecao.titulo, inspecao.clienteNome, inspecao.responsavelTecnico]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo));
    });
  }, [estado, busca]);

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => filtroSistema === "todos" || item.sistema === filtroSistema);
  }, [itens, filtroSistema]);

  const sistemasUsados = useMemo(
    () => Array.from(new Set(itens.map((item) => item.sistema))) as SistemaInspecao[],
    [itens],
  );

  const totais = useMemo(
    () => ({
      naoConformes: itens.filter((item) => item.resultado === "nao_conforme").length,
      atencao: itens.filter((item) => item.resultado === "atencao").length,
      conformes: itens.filter((item) => item.resultado === "conforme").length,
      semResultado: itens.filter((item) => item.resultado === "nao_avaliado").length,
    }),
    [itens],
  );

  async function handleCriarOuEditarItem(input: NovoItemInput) {
    if (!user || !inspecaoSelecionada) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const payload = {
        inspecaoId: inspecaoSelecionada.id,
        clientId: inspecaoSelecionada.clientId,
        sistema: input.sistema,
        localizacao: input.localizacao || null,
        descricao: input.descricao,
        resultado: input.resultado,
        severidade: "media" as const,
        recomendacao: input.recomendacao || null,
        prazoRecomendado: input.prazoRecomendado || null,
        fotoUrl: itemEditando?.fotoUrl ?? null,
        categoria: input.categoria || null,
        elemento: input.elemento || null,
        identificacao: input.identificacao || null,
        grauRisco: input.grauRisco || null,
        estadoConservacao: input.estadoConservacao || null,
        anomalia: input.anomalia || null,
        medicoes: input.medicoes || null,
        responsavelAcao: input.responsavelAcao || null,
        observacoes: input.observacoes || null,
      };
      const item = itemEditando
        ? await editarItemInspecao(supabaseQualidadeAdapter, {
            ...payload,
            id: itemEditando.id,
            createdBy: user.id,
            updatedBy: user.id,
          })
        : await criarItemInspecao(supabaseQualidadeAdapter, { ...payload, createdBy: user.id });
      setItens((atuais) =>
        itemEditando
          ? atuais.map((atual) => (atual.id === item.id ? item : atual))
          : [...atuais, item],
      );
      setModalAtivo(null);
      setItemEditando(null);
      void carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar item.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluirItem(item: InspecaoItem) {
    if (!user || !confirm("Excluir este item de inspeção?")) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await excluirItemInspecao(supabaseQualidadeAdapter, item.id);
      setItens((atuais) => atuais.filter((atual) => atual.id !== item.id));
      void carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível excluir item.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleCriarOuEditarInspecao(input: NovaInspecaoInput) {
    if (!user || estado.fase !== "pronto") return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const payload = {
        clientId: input.clientId,
        titulo: input.titulo,
        dataInspecao: input.dataInspecao,
        responsavelTecnico: input.responsavelTecnico || null,
        observacoesGerais: input.observacoesGerais || null,
        tipoInspecaoId: input.tipoInspecaoId || null,
        edificacao: input.edificacao || null,
        endereco: input.endereco || null,
        horaInicio: input.horaInicio || null,
        horaFim: input.horaFim || null,
        inspetor: input.inspetor || null,
        responsavelNoLocal: input.responsavelNoLocal || null,
        escopo: input.escopo || null,
        normaTecnica: input.normaTecnica || null,
        art: input.art || null,
        condicoes: input.condicoes || null,
      };
      if (modalAtivo === "editar-inspecao" && inspecaoSelecionada) {
        const editada = await editarInspecao(supabaseQualidadeAdapter, {
          ...payload,
          id: inspecaoSelecionada.id,
          createdBy: user.id,
          updatedBy: user.id,
        });
        setEstado({
          ...estado,
          inspecoes: estado.inspecoes.map((item) => (item.id === editada.id ? editada : item)),
        });
      } else {
        const criada = await criarInspecao(supabaseQualidadeAdapter, {
          ...payload,
          createdBy: user.id,
        });
        setEstado({ ...estado, inspecoes: [criada, ...estado.inspecoes] });
        setSelecionadaId(criada.id);
        if (input.templateId) {
          await aplicarTemplate(supabaseQualidadeAdapter, criada.id, input.templateId, user.id);
          await carregarItens(criada.id);
        }
      }
      setModalAtivo(null);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar inspeção.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleImportar(input: ImportarConfirmacao) {
    if (!user || estado.fase !== "pronto") return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const criada = await supabaseQualidadeAdapter.criarInspecaoImportada({
        clientId: input.clientId,
        titulo: input.titulo,
        dataInspecao: input.dataInspecao,
        responsavelTecnico: input.responsavelTecnico || null,
        observacoesGerais: input.observacoesGerais || null,
        itens: input.itens,
        createdBy: user.id,
      });
      setEstado({ ...estado, inspecoes: [criada, ...estado.inspecoes] });
      setSelecionadaId(criada.id);
      setModalAtivo(null);
      await carregarItens(criada.id);
      void carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível importar a inspeção.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando inspeções…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      <section className="rounded-[10px] border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Relatórios de Inspeção</h2>
            <p className="mt-1 text-sm text-ink-3">Vistoria predial mobile com análise por IA</p>
          </div>
          <button
            type="button"
            onClick={carregar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-line text-ink-3 hover:bg-line-soft"
            aria-label="Atualizar inspeções"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {temEscrita && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setModalAtivo("importar-xls")}
              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[8px] border border-[#1E8E45] px-2 text-xs font-semibold text-[#0D7A35] hover:bg-[#E7F6EC]"
            >
              <Sheet className="h-4 w-4" />
              XLS
            </button>
            <button
              type="button"
              onClick={() => setModalAtivo("importar-pdf")}
              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[8px] border border-navy px-2 text-xs font-semibold text-navy hover:bg-[#EAEEF8]"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => setModalAtivo("nova-inspecao")}
              disabled={semClientes}
              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-[8px] bg-navy px-2 text-xs font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nova
            </button>
          </div>
        )}

        {semClientes && (
          <div className="mt-4 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#7A3F00]">
            Execute o import Auvo de clientes antes de criar inspeções.
          </div>
        )}

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="input w-full"
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Buscar por cliente ou título..."
          />
        </div>

        <div className="mt-4 space-y-2">
          {inspecoesFiltradas.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3">
              Nenhuma inspeção encontrada.
            </div>
          ) : (
            inspecoesFiltradas.map((inspecao) => (
              <button
                key={inspecao.id}
                type="button"
                onClick={() => setSelecionadaId(inspecao.id)}
                className={`w-full rounded-[8px] border p-4 text-left transition-colors hover:border-orange/60 ${
                  inspecao.id === selecionadaId
                    ? "border-orange/60 bg-orange-soft/35"
                    : "border-line"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{inspecao.titulo}</p>
                    <p className="mt-1 truncate text-sm text-ink-3">{inspecao.clienteNome}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-3">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatarData(inspecao.dataInspecao)}
                      {inspecao.responsavelTecnico ? ` · ${inspecao.responsavelTecnico}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(inspecao.status)}`}
                  >
                    {INSPECAO_STATUS_LABEL[inspecao.status]}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  <span className="text-ink-3">{inspecao.totalItens} itens</span>
                  <span className="text-[#C5362B]">{inspecao.itensNaoConformes} NC</span>
                  <span className="text-[#B26A00]">{inspecao.itensAtencao} atenção</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="min-h-[680px] rounded-[10px] border border-line bg-card">
        {inspecaoSelecionada ? (
          <div className="flex min-h-[680px] flex-col">
            <div className="sticky top-0 z-10 rounded-t-[10px] bg-navy px-4 py-3 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSelecionadaId(null)}
                  className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-white/75 hover:bg-white/10 hover:text-white xl:hidden"
                  aria-label="Voltar para lista"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {inspecaoSelecionada.codigo ? `${inspecaoSelecionada.codigo} · ` : ""}
                    {inspecaoSelecionada.titulo}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/65">
                    {inspecaoSelecionada.clienteNome} ·{" "}
                    {formatarData(inspecaoSelecionada.dataInspecao)}
                    {inspecaoSelecionada.tipoInspecaoNome
                      ? ` · ${inspecaoSelecionada.tipoInspecaoNome}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  {INSPECAO_STATUS_LABEL[inspecaoSelecionada.status]}
                </span>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => setModalAtivo("editar-inspecao")}
                    className="rounded-[6px] px-2 py-1 text-xs font-semibold text-white/85 hover:bg-white/10 hover:text-white"
                  >
                    Editar
                  </button>
                )}
              </div>

              {itens.length > 0 && (
                <div className="mt-3 flex gap-4 border-t border-white/10 pt-3">
                  <KpiInspecao label="NC" value={totais.naoConformes} tone="danger" />
                  <KpiInspecao label="Atenção" value={totais.atencao} tone="warning" />
                  <KpiInspecao label="Conf." value={totais.conformes} tone="success" />
                  <KpiInspecao label="N/A" value={totais.semResultado} tone="muted" />
                  <KpiInspecao
                    label="Total"
                    value={itens.length}
                    tone="white"
                    className="ml-auto"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 p-4 pb-24">
              {sistemasUsados.length > 1 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <FiltroSistemaButton
                    ativo={filtroSistema === "todos"}
                    label={`Todos (${itens.length})`}
                    onClick={() => setFiltroSistema("todos")}
                  />
                  {sistemasUsados.map((sistema) => (
                    <FiltroSistemaButton
                      key={sistema}
                      ativo={filtroSistema === sistema}
                      label={`${SISTEMA_ICONE[sistema]} ${rotuloSistema(sistema)}`}
                      onClick={() => setFiltroSistema(sistema)}
                    />
                  ))}
                </div>
              )}

              {carregandoItens ? (
                <div className="py-14 text-center text-sm text-ink-3">Carregando itens…</div>
              ) : itensFiltrados.length === 0 ? (
                <div className="py-20 text-center">
                  <ImageIcon className="mx-auto h-10 w-10 text-line" />
                  <p className="mt-3 text-sm font-medium text-ink-3">Nenhum item registrado</p>
                  <p className="mt-1 text-xs text-ink-4">Toque em “Adicionar item” para começar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itensFiltrados.map((item) => (
                    <ItemInspecaoCard
                      key={item.id}
                      item={item}
                      temEscrita={temEscrita}
                      onEditar={() => {
                        setItemEditando(item);
                        setModalAtivo("novo-item");
                      }}
                      onExcluir={() => handleExcluirItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>

            {temEscrita && (
              <div className="sticky bottom-0 rounded-b-[10px] border-t border-line bg-card px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setItemEditando(null);
                    setModalAtivo("novo-item");
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-deep"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[680px] items-center justify-center px-5 text-center">
            <div>
              <ClipboardCheck className="mx-auto h-10 w-10 text-line" />
              <p className="mt-3 text-sm font-medium text-ink-3">Selecione uma inspeção</p>
              <p className="mt-1 text-xs text-ink-4">A lista lateral abre os detalhes e itens.</p>
            </div>
          </div>
        )}
      </section>

      {(modalAtivo === "nova-inspecao" || modalAtivo === "editar-inspecao") && (
        <NovaInspecaoModal
          clientes={estado.clientes}
          tipos={estado.tipos}
          templates={estado.templates}
          inspecao={
            modalAtivo === "editar-inspecao" ? (inspecaoSelecionada ?? undefined) : undefined
          }
          salvando={salvando}
          onClose={() => setModalAtivo(null)}
          onSubmit={handleCriarOuEditarInspecao}
        />
      )}
      {modalAtivo === "novo-item" && inspecaoSelecionada && (
        <NovoItemModal
          item={itemEditando ?? undefined}
          salvando={salvando}
          onClose={() => {
            setModalAtivo(null);
            setItemEditando(null);
          }}
          onSubmit={handleCriarOuEditarItem}
        />
      )}
      {(modalAtivo === "importar-pdf" || modalAtivo === "importar-xls") && (
        <ImportarRelatorioModal
          tipo={modalAtivo === "importar-pdf" ? "pdf" : "xls"}
          clientes={estado.clientes}
          salvando={salvando}
          onClose={() => setModalAtivo(null)}
          onSubmit={handleImportar}
        />
      )}

      {erroAcao && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-[8px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-3 text-sm text-[#A12D24] shadow-lg">
          {erroAcao}
        </div>
      )}
    </div>
  );
}

function KpiInspecao({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "success" | "muted" | "white";
  className?: string;
}) {
  const colors = {
    danger: "text-[#FFB4AA]",
    warning: "text-[#FFD891]",
    success: "text-[#B9F4CB]",
    muted: "text-white/45",
    white: "text-white",
  };
  return (
    <div className={`text-center ${className}`}>
      <div className={`text-base font-bold tabular-nums ${colors[tone]}`}>{value}</div>
      <div className="text-[10px] text-white/55">{label}</div>
    </div>
  );
}

function FiltroSistemaButton({
  ativo,
  label,
  onClick,
}: {
  ativo: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        ativo ? "border-navy bg-navy text-white" : "border-line bg-card text-ink-3 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ItemInspecaoCard({
  item,
  temEscrita,
  onEditar,
  onExcluir,
}: {
  item: InspecaoItem;
  temEscrita: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <article className="rounded-[8px] border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        {item.fotoUrl ? (
          <img
            src={item.fotoUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-[6px] border border-line object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[6px] border border-line bg-paper text-xl">
            {SISTEMA_ICONE[item.sistema]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-3">
              {rotuloSistema(item.sistema)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultadoColor(item.resultado)}`}
            >
              {RESULTADO_LABEL[item.resultado]}
            </span>
            {item.grauRisco && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${grauRiscoColor(item.grauRisco)}`}
              >
                Risco {GRAU_RISCO_LABEL[item.grauRisco]}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-ink">{item.descricao}</p>
          <p className="mt-1 truncate text-xs text-ink-3">
            {[item.categoria, item.elemento, item.localizacao].filter(Boolean).join(" · ") ||
              "Localização não informada"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((atual) => !atual)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-ink-3 hover:bg-line-soft hover:text-ink"
          aria-label={aberto ? "Recolher detalhes" : "Expandir detalhes"}
        >
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {aberto && (
        <div className="mt-4 space-y-3 border-t border-line-soft pt-3 text-sm">
          <DetalheItem label="Identificação" value={item.identificacao} />
          <DetalheItem label="Estado de conservação" value={item.estadoConservacao} />
          <DetalheItem label="Anomalia" value={item.anomalia} />
          <DetalheItem label="Medições" value={item.medicoes} />
          <DetalheItem label="Recomendação" value={item.recomendacao} />
          <DetalheItem label="Prazo recomendado" value={item.prazoRecomendado} />
          <DetalheItem label="Responsável pela ação" value={item.responsavelAcao} />
          <DetalheItem label="Observações" value={item.observacoes} />
          {item.midias.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                Mídias ({item.midias.length})
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {item.midias.map((midia) => midia.nome).join(", ")}
              </p>
            </div>
          )}
          {item.fotoUrl && (
            <a
              href={item.fotoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs font-semibold text-orange hover:text-orange-deep"
            >
              Abrir foto/referência
            </a>
          )}
          {temEscrita && (
            <div className="flex gap-3 border-t border-line-soft pt-3">
              <button
                type="button"
                onClick={onEditar}
                className="text-xs font-semibold text-ink-2 hover:text-ink"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={onExcluir}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#A23B25] hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DetalheItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || "—"}</p>
    </div>
  );
}

interface NovaInspecaoInput {
  clientId: string;
  titulo: string;
  dataInspecao: string;
  responsavelTecnico: string;
  observacoesGerais: string;
  tipoInspecaoId: string;
  templateId: string;
  edificacao: string;
  endereco: string;
  horaInicio: string;
  horaFim: string;
  inspetor: string;
  responsavelNoLocal: string;
  escopo: string;
  normaTecnica: string;
  art: string;
  condicoes: string;
}

/** E01-S73: cabeçalho ABNT NBR 16747 (Parte 1 — Dados da Inspeção). Serve pra criar E editar —
 * `inspecao` presente = edição (pré-preenche, esconde escolha de template — só faz sentido na
 * criação). */
function NovaInspecaoModal({
  clientes,
  tipos,
  templates,
  inspecao,
  salvando,
  onClose,
  onSubmit,
}: {
  clientes: ClienteOpcao[];
  tipos: TipoInspecao[];
  templates: ChecklistTemplate[];
  inspecao?: InspecaoResumo;
  salvando: boolean;
  onClose: () => void;
  onSubmit: (input: NovaInspecaoInput) => Promise<void>;
}) {
  const [form, setForm] = useState<NovaInspecaoInput>({
    clientId: inspecao?.clientId ?? clientes[0]?.id ?? "",
    titulo: inspecao?.titulo ?? "",
    dataInspecao: inspecao?.dataInspecao ?? hojeIso(),
    responsavelTecnico: inspecao?.responsavelTecnico ?? "",
    observacoesGerais: inspecao?.observacoesGerais ?? "",
    tipoInspecaoId: inspecao?.tipoInspecaoId ?? "",
    templateId: "",
    edificacao: inspecao?.edificacao ?? "",
    endereco: inspecao?.endereco ?? "",
    horaInicio: inspecao?.horaInicio ?? "",
    horaFim: inspecao?.horaFim ?? "",
    inspetor: inspecao?.inspetor ?? "",
    responsavelNoLocal: inspecao?.responsavelNoLocal ?? "",
    escopo: inspecao?.escopo ?? "",
    normaTecnica: inspecao?.normaTecnica ?? "",
    art: inspecao?.art ?? "",
    condicoes: inspecao?.condicoes ?? "",
  });

  const templatesDoTipo = templates.filter(
    (template) => template.tipoInspecaoId === form.tipoInspecaoId,
  );

  return (
    <ModalBase
      title={inspecao ? `Editar inspeção ${inspecao.codigo ?? ""}` : "Nova inspeção"}
      onClose={onClose}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Cliente *">
          <select
            className="input"
            value={form.clientId}
            onChange={(event) => setForm({ ...form, clientId: event.target.value })}
          >
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de inspeção">
          <select
            className="input"
            value={form.tipoInspecaoId}
            onChange={(event) =>
              setForm({ ...form, tipoInspecaoId: event.target.value, templateId: "" })
            }
          >
            <option value="">Sem tipo definido</option>
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Título *" className="md:col-span-2">
          <input
            className="input"
            value={form.titulo}
            onChange={(event) => setForm({ ...form, titulo: event.target.value })}
            placeholder="Ex: Inspeção Predial — Condomínio — julho/2026"
          />
        </Field>
        {!inspecao && templatesDoTipo.length > 0 && (
          <Field label="Checklist (pré-carrega os itens)" className="md:col-span-2">
            <select
              className="input"
              value={form.templateId}
              onChange={(event) => setForm({ ...form, templateId: event.target.value })}
            >
              <option value="">Nenhum — começar em branco</option>
              {templatesDoTipo.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.nome} ({template.itens.length} itens)
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Data *">
          <input
            className="input"
            type="date"
            value={form.dataInspecao}
            onChange={(event) => setForm({ ...form, dataInspecao: event.target.value })}
          />
        </Field>
        <Field label="Edificação / local">
          <input
            className="input"
            value={form.edificacao}
            onChange={(event) => setForm({ ...form, edificacao: event.target.value })}
          />
        </Field>
        <Field label="Endereço" className="md:col-span-2">
          <input
            className="input"
            value={form.endereco}
            onChange={(event) => setForm({ ...form, endereco: event.target.value })}
          />
        </Field>
        <Field label="Hora início">
          <input
            className="input"
            type="time"
            value={form.horaInicio}
            onChange={(event) => setForm({ ...form, horaInicio: event.target.value })}
          />
        </Field>
        <Field label="Hora fim">
          <input
            className="input"
            type="time"
            value={form.horaFim}
            onChange={(event) => setForm({ ...form, horaFim: event.target.value })}
          />
        </Field>
        <Field label="Inspetor">
          <input
            className="input"
            value={form.inspetor}
            onChange={(event) => setForm({ ...form, inspetor: event.target.value })}
          />
        </Field>
        <Field label="Responsável no local">
          <input
            className="input"
            value={form.responsavelNoLocal}
            onChange={(event) => setForm({ ...form, responsavelNoLocal: event.target.value })}
          />
        </Field>
        <Field label="Responsável técnico">
          <input
            className="input"
            value={form.responsavelTecnico}
            onChange={(event) => setForm({ ...form, responsavelTecnico: event.target.value })}
          />
        </Field>
        <Field label="ART (quando aplicável)">
          <input
            className="input"
            value={form.art}
            onChange={(event) => setForm({ ...form, art: event.target.value })}
          />
        </Field>
        <Field label="Norma técnica utilizada" className="md:col-span-2">
          <input
            className="input"
            value={form.normaTecnica}
            onChange={(event) => setForm({ ...form, normaTecnica: event.target.value })}
            placeholder="Ex: ABNT NBR 16747"
          />
        </Field>
        <Field label="Escopo" className="md:col-span-2">
          <textarea
            className="input min-h-16 resize-y"
            value={form.escopo}
            onChange={(event) => setForm({ ...form, escopo: event.target.value })}
          />
        </Field>
        <Field label="Condições da inspeção" className="md:col-span-2">
          <textarea
            className="input min-h-16 resize-y"
            value={form.condicoes}
            onChange={(event) => setForm({ ...form, condicoes: event.target.value })}
          />
        </Field>
        <Field label="Observações gerais" className="md:col-span-2">
          <textarea
            className="input min-h-24 resize-y"
            value={form.observacoesGerais}
            onChange={(event) => setForm({ ...form, observacoesGerais: event.target.value })}
          />
        </Field>
      </div>
      <ModalActions
        primaryLabel={inspecao ? "Salvar alterações" : "Criar inspeção"}
        disabled={salvando || !form.clientId || !form.titulo.trim()}
        onCancel={onClose}
        onPrimary={() => onSubmit(form)}
      />
    </ModalBase>
  );
}

interface NovoItemInput {
  sistema: SistemaInspecao;
  localizacao: string;
  descricao: string;
  categoria: string;
  elemento: string;
  identificacao: string;
  resultado: ItemResultado;
  grauRisco: GrauRisco | "";
  estadoConservacao: string;
  anomalia: string;
  medicoes: string;
  recomendacao: string;
  prazoRecomendado: string;
  responsavelAcao: string;
  observacoes: string;
}

/** E01-S73: item ABNT NBR 16747 (Parte 2 — Itens de Inspeção). `item` presente = edição
 * (pré-preenche + habilita upload de mídia — precisa do id do item já existir no banco). */
function NovoItemModal({
  item,
  salvando,
  onClose,
  onSubmit,
}: {
  item?: InspecaoItem;
  salvando: boolean;
  onClose: () => void;
  onSubmit: (input: NovoItemInput) => Promise<void>;
}) {
  const [form, setForm] = useState<NovoItemInput>({
    sistema: item?.sistema ?? "geral",
    localizacao: item?.localizacao ?? "",
    descricao: item?.descricao ?? "",
    categoria: item?.categoria ?? "",
    elemento: item?.elemento ?? "",
    identificacao: item?.identificacao ?? "",
    resultado: item?.resultado ?? "nao_avaliado",
    grauRisco: item?.grauRisco ?? "",
    estadoConservacao: item?.estadoConservacao ?? "",
    anomalia: item?.anomalia ?? "",
    medicoes: item?.medicoes ?? "",
    recomendacao: item?.recomendacao ?? "",
    prazoRecomendado: item?.prazoRecomendado ?? "",
    responsavelAcao: item?.responsavelAcao ?? "",
    observacoes: item?.observacoes ?? "",
  });
  const [midias, setMidias] = useState<MidiaItem[]>(item?.midias ?? []);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const [erroMidia, setErroMidia] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUploadMidia(file: File) {
    if (!item) return;
    setEnviandoMidia(true);
    setErroMidia(null);
    try {
      const tipo = file.type.startsWith("image/")
        ? "foto"
        : file.type.startsWith("video/")
          ? "video"
          : "documento";
      const midia = await supabaseQualidadeAdapter.uploadMidiaItem(item.id, file, tipo);
      setMidias((atuais) => [...atuais, midia]);
    } catch (error) {
      setErroMidia(error instanceof Error ? error.message : "Não foi possível enviar a mídia.");
    } finally {
      setEnviandoMidia(false);
    }
  }

  async function handleRemoverMidia(midia: MidiaItem) {
    if (!item) return;
    try {
      await supabaseQualidadeAdapter.removerMidiaItem(item.id, midia);
      setMidias((atuais) => atuais.filter((atual) => atual.path !== midia.path));
    } catch (error) {
      setErroMidia(error instanceof Error ? error.message : "Não foi possível remover a mídia.");
    }
  }

  async function handleAbrirMidia(midia: MidiaItem) {
    try {
      const url = await supabaseQualidadeAdapter.urlAssinadaMidia(midia.path);
      window.open(url, "_blank", "noreferrer");
    } catch (error) {
      setErroMidia(error instanceof Error ? error.message : "Não foi possível abrir a mídia.");
    }
  }

  return (
    <BottomSheet
      title={item ? "Editar item de inspeção" : "Novo item de inspeção"}
      onClose={onClose}
    >
      <div>
        <p className="mb-2 text-center text-xs font-semibold text-ink-3">Sistema / Área *</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SISTEMAS.map((sistema) => (
            <button
              key={sistema}
              type="button"
              onClick={() => setForm((atual) => ({ ...atual, sistema }))}
              className={`flex min-h-18 flex-col items-center justify-center gap-1 rounded-[8px] border px-2 py-3 text-sm font-semibold transition-colors ${
                form.sistema === sistema
                  ? "border-navy bg-[#EAEEF8] text-navy"
                  : "border-line text-ink-3 hover:border-navy/40 hover:text-ink"
              }`}
            >
              <span className="text-xl">{SISTEMA_ICONE[sistema]}</span>
              <span className="text-center text-xs">{rotuloSistema(sistema).split("/")[0]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Categoria">
          <input
            className="input"
            value={form.categoria}
            onChange={(event) => setForm({ ...form, categoria: event.target.value })}
          />
        </Field>
        <Field label="Elemento inspecionado">
          <input
            className="input"
            value={form.elemento}
            onChange={(event) => setForm({ ...form, elemento: event.target.value })}
          />
        </Field>
        <Field label="Localização">
          <input
            className="input"
            value={form.localizacao}
            onChange={(event) => setForm({ ...form, localizacao: event.target.value })}
            placeholder="Ex: 3º andar — corredor leste"
          />
        </Field>
        <Field label="Identificação">
          <input
            className="input"
            value={form.identificacao}
            onChange={(event) => setForm({ ...form, identificacao: event.target.value })}
          />
        </Field>
        <Field label="Resultado *">
          <select
            className="input"
            value={form.resultado}
            onChange={(event) =>
              setForm({ ...form, resultado: event.target.value as ItemResultado })
            }
          >
            {RESULTADOS_INSPECAO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grau de risco">
          <select
            className="input"
            value={form.grauRisco}
            onChange={(event) =>
              setForm({ ...form, grauRisco: event.target.value as GrauRisco | "" })
            }
          >
            <option value="">Não informado</option>
            {GRAUS_RISCO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado de conservação">
          <input
            className="input"
            value={form.estadoConservacao}
            onChange={(event) => setForm({ ...form, estadoConservacao: event.target.value })}
          />
        </Field>
        <Field label="Prazo para correção">
          <input
            className="input"
            type="date"
            value={form.prazoRecomendado}
            onChange={(event) => setForm({ ...form, prazoRecomendado: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Descrição / observação *">
        <textarea
          className="input min-h-24 resize-y"
          value={form.descricao}
          onChange={(event) => setForm({ ...form, descricao: event.target.value })}
          placeholder="Descreva o que observou; a análise técnica pode ser complementada depois."
        />
      </Field>
      <Field label="Descrição da anomalia">
        <textarea
          className="input min-h-20 resize-y"
          value={form.anomalia}
          onChange={(event) => setForm({ ...form, anomalia: event.target.value })}
        />
      </Field>
      <Field label="Medições">
        <textarea
          className="input min-h-16 resize-y"
          value={form.medicoes}
          onChange={(event) => setForm({ ...form, medicoes: event.target.value })}
        />
      </Field>
      <Field label="Recomendação">
        <textarea
          className="input min-h-20 resize-y"
          value={form.recomendacao}
          onChange={(event) => setForm({ ...form, recomendacao: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Responsável pela ação corretiva">
          <input
            className="input"
            value={form.responsavelAcao}
            onChange={(event) => setForm({ ...form, responsavelAcao: event.target.value })}
          />
        </Field>
        <Field label="Observações">
          <input
            className="input"
            value={form.observacoes}
            onChange={(event) => setForm({ ...form, observacoes: event.target.value })}
          />
        </Field>
      </div>

      {item && (
        <div className="rounded-[8px] border border-line-soft bg-paper p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              Mídias (foto/vídeo/documento)
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={enviandoMidia}
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange hover:text-orange-deep disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {enviandoMidia ? "Enviando..." : "Adicionar"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUploadMidia(file);
                event.target.value = "";
              }}
            />
          </div>
          {erroMidia && <p className="mt-2 text-xs text-[#A23B25]">{erroMidia}</p>}
          {midias.length === 0 ? (
            <p className="mt-2 text-xs text-ink-3">Nenhuma mídia anexada.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {midias.map((midia) => (
                <li key={midia.path} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleAbrirMidia(midia)}
                    className="truncate text-left text-ink-2 hover:text-orange"
                  >
                    {midia.tipo} · {midia.nome}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoverMidia(midia)}
                    className="shrink-0 text-[#A23B25] hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ModalActions
        primaryLabel={item ? "Salvar alterações" : "Adicionar item"}
        disabled={salvando || !form.descricao.trim()}
        onCancel={onClose}
        onPrimary={() => onSubmit(form)}
      />
    </BottomSheet>
  );
}

type ImportarTipo = "pdf" | "xls";

interface ImportarConfirmacao {
  clientId: string;
  titulo: string;
  dataInspecao: string;
  responsavelTecnico: string;
  observacoesGerais: string;
  itens: ItemInspecaoImportado[];
}

function ImportarRelatorioModal({
  tipo,
  clientes,
  salvando,
  onClose,
  onSubmit,
}: {
  tipo: ImportarTipo;
  clientes: ClienteOpcao[];
  salvando: boolean;
  onClose: () => void;
  onSubmit: (input: ImportarConfirmacao) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "processando" | "revisao">("upload");
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemInspecaoImportado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [expandido, setExpandido] = useState<number | null>(null);
  const [form, setForm] = useState({
    clientId: clientes[0]?.id ?? "",
    titulo: "",
    dataInspecao: hojeIso(),
    responsavelTecnico: "",
    observacoesGerais: "",
  });

  async function handleFile(file: File) {
    setErro(null);
    setStep("processando");
    try {
      const texto =
        tipo === "xls" ? await extrairTextoXls(file) : await extrairTextoPdfOuTexto(file);
      const processados = await supabaseQualidadeAdapter.processarRelatorioInspecao(texto);
      if (processados.length === 0) throw new Error("Nenhum item encontrado no relatório.");
      setItens(processados);
      setSelecionados(new Set(processados.map((_, index) => index)));
      setForm((atual) => ({
        ...atual,
        titulo:
          atual.titulo ||
          `${tipo === "xls" ? "Relatório XLS" : "Relatório PDF"} — ${file.name.replace(/\.[^.]+$/, "")}`,
      }));
      setStep("revisao");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível processar o arquivo.");
      setStep("upload");
    }
  }

  function toggleItem(index: number) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      proximo.has(index) ? proximo.delete(index) : proximo.add(index);
      return proximo;
    });
  }

  const itensSelecionados = itens.filter((_, index) => selecionados.has(index));
  const titulo = tipo === "xls" ? "Importar Relatório XLS (Auvo)" : "Importar Relatório PDF";

  return (
    <ModalBase title={titulo} onClose={onClose} size="lg">
      {step === "upload" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-line px-6 py-12 text-center hover:border-orange hover:bg-orange-soft/25"
          >
            <Upload className="h-10 w-10 text-ink-3" />
            <span className="mt-3 text-sm font-semibold text-ink">
              Arraste ou selecione o arquivo padrão do Auvo
            </span>
            <span className="mt-1 text-xs text-ink-3">
              {tipo === "xls"
                ? 'Relatório "Respostas Inconformidade" (.xls, .xlsx ou .csv)'
                : "Relatório de OS/diagnóstico em PDF"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={tipo === "xls" ? ".xls,.xlsx,.csv" : ".pdf,.txt"}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {erro && (
            <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
              {erro}
            </div>
          )}
          <div className="rounded-[8px] bg-[#EAEEF8] px-4 py-3 text-sm text-[#2E3C70]">
            A importação usa o modelo do PCM antigo: extrai local, relato/fotos no XLS e envia o
            texto para a análise IA da função `importar-relatorio-pdf`.
          </div>
        </div>
      )}

      {step === "processando" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-orange" />
          <p className="mt-4 text-sm font-semibold text-ink">Processando relatório…</p>
          <p className="mt-1 text-xs text-ink-3">
            Extraindo inconformidades e classificando com IA.
          </p>
        </div>
      )}

      {step === "revisao" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Cliente *">
              <select
                className="input"
                value={form.clientId}
                onChange={(event) => setForm({ ...form, clientId: event.target.value })}
              >
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data *">
              <input
                className="input"
                type="date"
                value={form.dataInspecao}
                onChange={(event) => setForm({ ...form, dataInspecao: event.target.value })}
              />
            </Field>
            <Field label="Título *" className="md:col-span-2">
              <input
                className="input"
                value={form.titulo}
                onChange={(event) => setForm({ ...form, titulo: event.target.value })}
              />
            </Field>
            <Field label="Responsável técnico" className="md:col-span-2">
              <input
                className="input"
                value={form.responsavelTecnico}
                onChange={(event) => setForm({ ...form, responsavelTecnico: event.target.value })}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-3">
              <span className="font-semibold text-ink">{selecionados.size}</span> de {itens.length}{" "}
              item(ns) selecionados
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelecionados(new Set(itens.map((_, index) => index)))}
                className="rounded-[6px] border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelecionados(new Set())}
                className="rounded-[6px] border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {itens.map((item, index) => {
              const score = item.gravidade * item.urgencia * item.tendencia;
              const aberto = expandido === index;
              const selecionado = selecionados.has(index);
              return (
                <div
                  key={`${item.local}-${index}`}
                  className={`rounded-[8px] border p-3 ${
                    selecionado ? "border-orange/45 bg-orange-soft/20" : "border-line opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => toggleItem(index)}
                      className="mt-1 h-4 w-4 accent-[#1E2D62]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                          {SISTEMA_ICONE[item.sistema]} {rotuloSistema(item.sistema)}
                        </span>
                        <span className="rounded-full bg-[#FDF1DF] px-2 py-0.5 text-[11px] font-semibold text-[#B26A00]">
                          GUT {score}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">{item.tituloBacklog}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {item.local || "Local não informado"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandido(aberto ? null : index)}
                      className="rounded-[6px] p-1 text-ink-3 hover:bg-line-soft"
                    >
                      {aberto ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {aberto && (
                    <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
                      <TextareaImportado
                        label="Relato original"
                        value={item.relatoOriginal}
                        onChange={(value) =>
                          setItens((atuais) =>
                            atuais.map((atual, i) =>
                              i === index ? { ...atual, relatoOriginal: value } : atual,
                            ),
                          )
                        }
                      />
                      <TextareaImportado
                        label="Descrição técnica"
                        value={item.descricaoTecnica}
                        onChange={(value) =>
                          setItens((atuais) =>
                            atuais.map((atual, i) =>
                              i === index ? { ...atual, descricaoTecnica: value } : atual,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <ModalActions
            primaryLabel={`Importar ${itensSelecionados.length} item(ns)`}
            disabled={
              salvando || itensSelecionados.length === 0 || !form.clientId || !form.titulo.trim()
            }
            onCancel={onClose}
            onPrimary={() =>
              onSubmit({
                ...form,
                observacoesGerais: `Importado de relatório ${tipo.toUpperCase()} Auvo.`,
                itens: itensSelecionados,
              })
            }
          />
        </div>
      )}
    </ModalBase>
  );
}

function TextareaImportado({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <textarea
        className="input mt-1 min-h-20 resize-y text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ModalBase({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="modal-backdrop">
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-[10px] bg-card shadow-2xl ${
          size === "lg" ? "max-w-4xl" : "max-w-2xl"
        }`}
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

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar" />
      <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[14px] bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-navy px-4 py-3 text-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="space-y-4 p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`block ${className}`}>
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
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-[8px] bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center justify-center rounded-[8px] border border-line px-4 py-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
      >
        Cancelar
      </button>
    </div>
  );
}

async function extrairTextoPdfOuTexto(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    return file.text();
  }
  const pdfjs = await carregarPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const partes: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    partes.push(content.items.map((item: { str?: string }) => item.str ?? "").join(" "));
  }
  return partes.join("\n\n").trim();
}

async function carregarPdfJs(): Promise<PdfJsLib> {
  const win = window as typeof window & { pdfjsLib?: PdfJsLib };
  if (!win.pdfjsLib) {
    const importarModulo = new Function("url", "return import(url)") as (
      url: string,
    ) => Promise<PdfJsLib>;
    win.pdfjsLib = await importarModulo(
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs",
    );
  }
  win.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  return win.pdfjsLib;
}

async function extrairTextoXls(file: File): Promise<string> {
  const XLSX = await carregarSheetJs();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Planilha sem abas.");
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  if (rows.length < 2) throw new Error("Planilha vazia ou sem dados.");

  const normalizar = (valor: unknown) =>
    String(valor)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const headerRow = rows[0];
  if (!headerRow) throw new Error("Planilha sem cabeçalho.");
  const header = headerRow.map(normalizar);
  const colLocal = header.findIndex((h) => h.includes("local"));
  const colFotos = header.findIndex((h) => h.includes("ocorr"));
  const colRelato = header.findIndex((h) => h.includes("relato"));
  const iLocal = colLocal >= 0 ? colLocal : 4;
  const iFotos = colFotos >= 0 ? colFotos : 5;
  const iRelato = colRelato >= 0 ? colRelato : 6;

  return rows
    .slice(1)
    .map((row) => ({
      local: String(row[iLocal] ?? "").trim(),
      fotos: String(row[iFotos] ?? "").trim(),
      relato: String(row[iRelato] ?? "").trim(),
    }))
    .filter((row) => row.local || row.relato)
    .map((row) => `Local: ${row.local}\nFotos: ${row.fotos}\nRelato: ${row.relato}`)
    .join("\n\n---\n\n");
}

async function carregarSheetJs(): Promise<{
  read: (
    data: Uint8Array,
    options: { type: "array" },
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (sheet: unknown, options: { header: 1; defval: string }) => unknown[];
  };
}> {
  const win = window as typeof window & { XLSX?: Awaited<ReturnType<typeof carregarSheetJs>> };
  if (!win.XLSX) {
    await carregarScript(
      "sheetjs-cdn",
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    );
  }
  if (!win.XLSX) throw new Error("Não foi possível carregar o leitor de planilhas.");
  return win.XLSX;
}

async function carregarScript(id: string, src: string): Promise<void> {
  if (document.getElementById(id)) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}
