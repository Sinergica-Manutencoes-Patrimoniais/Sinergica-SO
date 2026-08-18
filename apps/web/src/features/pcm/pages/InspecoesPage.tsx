import { Button, ConfirmDialog, Modal, Skeleton } from "@sinergica/ui";
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
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import {
  classificarItensParaBacklog,
  confirmarGerarBacklog,
  derivarItemParaChamado,
} from "../application/assessment";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import {
  aplicarTemplate,
  atualizarResultadoItem,
  criarInspecao,
  criarItemInspecao,
  descartarItem,
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
  parsearPlanilhaLevantamento,
  prepararRevisaoImportacaoExcel,
} from "../domain/inspecao-excel";
import type { ItemClassificado } from "../domain/inspecao-revisao-lote";
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
import { PRIORIDADE_LABEL, prioridadeColor } from "../domain/ordens-servico";
import {
  PESOS_GUTD_PADRAO,
  calcularScoreGut,
  calcularScoreGutd,
  classificarPrioridade,
  classificarPrioridadeGutd,
} from "../domain/priorizacao-backlog";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";
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

/** Rótulos dos 4 fatores do GUTd (E01-S82). "dorCliente" precisa de rótulo próprio — capitalizar
 * a chave sairia como "Dorcliente". */
const ROTULO_FATOR_GUTD: Record<"gravidade" | "urgencia" | "tendencia" | "dorCliente", string> = {
  gravidade: "Gravidade",
  urgencia: "Urgência",
  tendencia: "Tendência",
  dorCliente: "Dor do cliente",
};

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

export function InspecoesPage({
  inspecaoIdInicial,
}: {
  /** E03-S05, AC-7: deep-link vindo da aba Comercial da Visão 360 ("ver assessment completo") —
   * o shell (`HomePage`) já trocou a view para "inspecoes", isto só seleciona a inspeção certa
   * assim que a lista carregar (`inspecaoSelecionada` é derivado, então reage sozinho). */
  inspecaoIdInicial?: string | null;
} = {}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(inspecaoIdInicial ?? null);
  // O componente não remonta ao navegar de outra sub-tela PCM/Comercial pra "inspecoes" (mesma
  // posição na árvore de `HomePage`) — o `useState` acima só pega o valor inicial na PRIMEIRA
  // montagem. Este efeito cobre o deep-link de novo, toda vez que `inspecaoIdInicial` mudar.
  useEffect(() => {
    if (inspecaoIdInicial) setSelecionadaId(inspecaoIdInicial);
  }, [inspecaoIdInicial]);
  const [itens, setItens] = useState<InspecaoItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroSistema, setFiltroSistema] = useState<FiltroSistema>("todos");
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null);
  const [itemEditando, setItemEditando] = useState<InspecaoItem | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<InspecaoItem | null>(null);
  const [itemParaAbrirChamado, setItemParaAbrirChamado] = useState<InspecaoItem | null>(null);
  const [itemParaDescartar, setItemParaDescartar] = useState<InspecaoItem | null>(null);
  // E01-S143: triagem — seleção local (nada gravado até "Gerar backlog"), revisão editável da IA.
  const [selecionadosBacklog, setSelecionadosBacklog] = useState<Set<string>>(new Set());
  const [dadosOs, setDadosOs] = useState<DadosAberturaOs | null>(null);
  const [classificandoBacklog, setClassificandoBacklog] = useState(false);
  const [revisaoBacklog, setRevisaoBacklog] = useState<{
    itens: ItemClassificado[];
    correlacionou: boolean;
  } | null>(null);
  const [confirmandoBacklog, setConfirmandoBacklog] = useState(false);

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
    setSelecionadosBacklog(new Set());
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

  async function handleExcluirItem() {
    if (!user || !itemParaExcluir) return;
    const item = itemParaExcluir;
    setSalvando(true);
    try {
      await excluirItemInspecao(supabaseQualidadeAdapter, item.id);
      setItens((atuais) => atuais.filter((atual) => atual.id !== item.id));
      void carregar();
    } finally {
      setSalvando(false);
    }
  }

  // E01-S141 AC-2: mesma função usada na importação em lote, disparada por item individual.
  async function handleAbrirChamado() {
    if (!user || !inspecaoSelecionada || !itemParaAbrirChamado) return;
    const item = itemParaAbrirChamado;
    setSalvando(true);
    try {
      await derivarItemParaChamado(
        supabaseQualidadeAdapter,
        supabaseChamadosAdapter,
        item,
        inspecaoSelecionada.clientId,
        "sinergica",
        user.id,
      );
      setItens((atuais) =>
        atuais.map((atual) => (atual.id === item.id ? { ...atual, destino: "chamado" } : atual)),
      );
    } finally {
      setSalvando(false);
    }
  }

  // E01-S143 AC-1: ribbon rápido de resultado, sem abrir o form completo.
  async function handleMudarResultado(item: InspecaoItem, resultado: ItemResultado) {
    if (!user) return;
    setErroAcao(null);
    try {
      const atualizado = await atualizarResultadoItem(
        supabaseQualidadeAdapter,
        item.id,
        resultado,
        user.id,
      );
      setItens((atuais) => atuais.map((atual) => (atual.id === item.id ? atualizado : atual)));
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível atualizar o resultado.",
      );
    }
  }

  // E01-S143 AC-2: descarte é direto — sem IA, sem passar pela revisão em lote.
  async function handleDescartar() {
    if (!itemParaDescartar) return;
    const item = itemParaDescartar;
    await descartarItem(supabaseQualidadeAdapter, item.id);
    setItens((atuais) =>
      atuais.map((atual) => (atual.id === item.id ? { ...atual, destino: "descarte" } : atual)),
    );
    setSelecionadosBacklog((atuais) => {
      const proximo = new Set(atuais);
      proximo.delete(item.id);
      return proximo;
    });
  }

  function handleToggleSelecaoBacklog(itemId: string) {
    setSelecionadosBacklog((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(itemId)) proximo.delete(itemId);
      else proximo.add(itemId);
      return proximo;
    });
  }

  // E01-S143 AC-4: monta o lote selecionado, chama a IA (mesmo endpoint do import) e abre a revisão.
  async function handleAbrirRevisaoBacklog() {
    const selecionados = itens.filter((item) => selecionadosBacklog.has(item.id));
    if (selecionados.length === 0) return;
    setClassificandoBacklog(true);
    setErroAcao(null);
    try {
      if (!dadosOs) setDadosOs(await carregarDadosAberturaOs(supabaseOrdemServicoAdapter));
      const resultado = await classificarItensParaBacklog(
        supabaseQualidadeAdapter,
        selecionados.map((item) => ({
          id: item.id,
          localizacao: item.localizacao,
          descricao: item.descricao,
        })),
      );
      setRevisaoBacklog(resultado);
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível classificar os itens.",
      );
    } finally {
      setClassificandoBacklog(false);
    }
  }

  // E01-S143 AC-5: confirma a revisão (já editada pelo operador) — grava GUT/esforço e gera 1 OS
  // de backlog por item.
  async function handleConfirmarBacklog(itensRevisados: ItemClassificado[]) {
    if (!user || !inspecaoSelecionada) return;
    setConfirmandoBacklog(true);
    setErroAcao(null);
    try {
      const dados = dadosOs ?? (await carregarDadosAberturaOs(supabaseOrdemServicoAdapter));
      if (!dadosOs) setDadosOs(dados);
      const tipoTarefaId = dados.tiposTarefa[0]?.id;
      if (!tipoTarefaId)
        throw new Error("Nenhum tipo de tarefa cadastrado — configure antes de gerar backlog.");
      const porId = new Map(itens.map((item) => [item.id, item]));
      await confirmarGerarBacklog(
        supabaseQualidadeAdapter,
        supabaseOrdemServicoAdapter,
        itensRevisados.map((classificacao) => {
          const item = porId.get(classificacao.itemId);
          if (!item) throw new Error("Item não encontrado.");
          return { item, classificacao };
        }),
        { clientId: inspecaoSelecionada.clientId, tipoTarefaId, userId: user.id },
      );
      setItens((atuais) =>
        atuais.map((atual) => {
          const classificacao = itensRevisados.find((c) => c.itemId === atual.id);
          if (!classificacao) return atual;
          return {
            ...atual,
            destino: "backlog",
            gravidade: classificacao.gravidade,
            urgencia: classificacao.urgencia,
            tendencia: classificacao.tendencia,
            esforcoHoras: classificacao.esforcoHoras,
            justificativaEsforco: classificacao.justificativaEsforco,
            citacaoNormativa: classificacao.citacaoNormativa,
          };
        }),
      );
      setSelecionadosBacklog(new Set());
      setRevisaoBacklog(null);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível gerar o backlog.");
    } finally {
      setConfirmandoBacklog(false);
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
      const itensCriados = await supabaseQualidadeAdapter.listarItensInspecao(criada.id);
      if (input.criarChamados) {
        try {
          for (const item of itensCriados) {
            await derivarItemParaChamado(
              supabaseQualidadeAdapter,
              supabaseChamadosAdapter,
              item,
              input.clientId,
              "sinergica",
              user.id,
            );
          }
        } catch (error) {
          setErroAcao(
            `Inspeção importada, mas parte dos chamados não foi criada: ${error instanceof Error ? error.message : "erro desconhecido"}`,
          );
        }
      }
      await carregarItens(criada.id);
      void carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível importar a inspeção.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando) {
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
        <p className="text-body text-ink-3 mt-1">
          Você não tem permissão de leitura no módulo PCM.
        </p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-body text-ink-3 mt-1">{estado.mensagem}</p>
        <Button variant="ghost" onClick={carregar} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      <section className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-heading font-semibold text-ink">Relatórios de Inspeção</h1>
            <p className="mt-1 text-body text-ink-3">Vistoria predial mobile com análise por IA</p>
          </div>
          <button
            type="button"
            onClick={carregar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-3 hover:bg-line-soft"
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
              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-success px-2 text-caption font-semibold text-success hover:bg-success-soft"
            >
              <Sheet className="h-4 w-4" />
              XLS
            </button>
            <button
              type="button"
              onClick={() => setModalAtivo("importar-pdf")}
              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-navy px-2 text-caption font-semibold text-navy hover:bg-info-soft"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => setModalAtivo("nova-inspecao")}
              disabled={semClientes}
              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-navy px-2 text-caption font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nova
            </button>
          </div>
        )}

        {semClientes && (
          <div className="mt-4 rounded-md border border-warning-line bg-orange-soft px-3 py-2 text-body text-warning">
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
            placeholder="Buscar por cliente ou título…"
          />
        </div>

        <div className="mt-4 space-y-2">
          {inspecoesFiltradas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-body text-ink-3">
              Nenhuma inspeção encontrada.
            </div>
          ) : (
            inspecoesFiltradas.map((inspecao) => (
              <button
                key={inspecao.id}
                type="button"
                onClick={() => setSelecionadaId(inspecao.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors hover:border-orange/60 ${
                  inspecao.id === selecionadaId
                    ? "border-orange/60 bg-orange-soft/35"
                    : "border-line"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-ink">{inspecao.titulo}</p>
                    <p className="mt-1 truncate text-body text-ink-3">{inspecao.clienteNome}</p>
                    <p className="mt-1 flex items-center gap-1 text-caption text-ink-3">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatarData(inspecao.dataInspecao)}
                      {inspecao.responsavelTecnico ? ` · ${inspecao.responsavelTecnico}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${statusColor(inspecao.status)}`}
                  >
                    {INSPECAO_STATUS_LABEL[inspecao.status]}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 text-caption">
                  <span className="text-ink-3">{inspecao.totalItens} itens</span>
                  <span className="text-danger">{inspecao.itensNaoConformes} NC</span>
                  <span className="text-warning">{inspecao.itensAtencao} atenção</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="min-h-[680px] rounded-xl border border-line bg-card">
        {inspecaoSelecionada ? (
          <div className="flex min-h-[680px] flex-col">
            <div className="sticky top-0 z-10 rounded-t-[10px] bg-navy px-4 py-3 text-white shadow-raised">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSelecionadaId(null)}
                  className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-card/10 hover:text-white xl:hidden"
                  aria-label="Voltar para lista"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold">
                    {inspecaoSelecionada.codigo ? `${inspecaoSelecionada.codigo} · ` : ""}
                    {inspecaoSelecionada.titulo}
                  </p>
                  <p className="mt-0.5 truncate text-caption text-white/65">
                    {inspecaoSelecionada.clienteNome} ·{" "}
                    {formatarData(inspecaoSelecionada.dataInspecao)}
                    {inspecaoSelecionada.tipoInspecaoNome
                      ? ` · ${inspecaoSelecionada.tipoInspecaoNome}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-card/20 px-2 py-0.5 text-caption font-semibold">
                  {INSPECAO_STATUS_LABEL[inspecaoSelecionada.status]}
                </span>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => setModalAtivo("editar-inspecao")}
                    className="rounded-md px-2 py-1 text-caption font-semibold text-white/85 hover:bg-card/10 hover:text-white"
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
                <div className="py-14 text-center text-body text-ink-3">Carregando itens…</div>
              ) : itensFiltrados.length === 0 ? (
                <div className="py-20 text-center">
                  <ImageIcon className="mx-auto h-10 w-10 text-line" />
                  <p className="mt-3 text-body font-medium text-ink-3">Nenhum item registrado</p>
                  <p className="mt-1 text-caption text-ink-4">
                    Toque em “Adicionar item” para começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itensFiltrados.map((item) => (
                    <ItemInspecaoCard
                      key={item.id}
                      item={item}
                      temEscrita={temEscrita}
                      selecionadoBacklog={selecionadosBacklog.has(item.id)}
                      onEditar={() => {
                        setItemEditando(item);
                        setModalAtivo("novo-item");
                      }}
                      onExcluir={() => setItemParaExcluir(item)}
                      onAbrirChamado={() => setItemParaAbrirChamado(item)}
                      onMudarResultado={(resultado) => handleMudarResultado(item, resultado)}
                      onToggleSelecaoBacklog={() => handleToggleSelecaoBacklog(item.id)}
                      onDescartar={() => setItemParaDescartar(item)}
                    />
                  ))}
                </div>
              )}
            </div>

            {temEscrita && (
              <div className="sticky bottom-0 flex flex-col gap-2 rounded-b-[10px] border-t border-line bg-card px-4 py-3">
                {selecionadosBacklog.size > 0 && (
                  <button
                    type="button"
                    onClick={handleAbrirRevisaoBacklog}
                    disabled={classificandoBacklog}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange px-4 py-3 text-body font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
                  >
                    {classificandoBacklog
                      ? "Calculando GUT/esforço…"
                      : `Gerar backlog (${selecionadosBacklog.size})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setItemEditando(null);
                    setModalAtivo("novo-item");
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-body font-semibold text-white hover:bg-navy-deep"
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
              <p className="mt-3 text-body font-medium text-ink-3">Selecione uma inspeção</p>
              <p className="mt-1 text-caption text-ink-4">
                A lista lateral abre os detalhes e itens.
              </p>
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
      {revisaoBacklog && (
        <RevisaoBacklogModal
          itens={revisaoBacklog.itens}
          correlacionou={revisaoBacklog.correlacionou}
          confirmando={confirmandoBacklog}
          onClose={() => setRevisaoBacklog(null)}
          onConfirmar={handleConfirmarBacklog}
        />
      )}

      {erroAcao && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-body text-danger shadow-overlay">
          {erroAcao}
        </div>
      )}

      <ConfirmDialog
        open={itemParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setItemParaExcluir(null);
        }}
        titulo="Excluir item de inspeção"
        descricao={`"${itemParaExcluir?.descricao ?? "Este item"}" será removido.`}
        rotuloConfirmar="Excluir"
        onConfirmar={handleExcluirItem}
      />

      <ConfirmDialog
        open={itemParaAbrirChamado !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setItemParaAbrirChamado(null);
        }}
        titulo="Abrir Chamado a partir deste item"
        descricao={itemParaAbrirChamado?.descricao ?? ""}
        rotuloConfirmar="Abrir Chamado"
        onConfirmar={handleAbrirChamado}
      />

      <ConfirmDialog
        open={itemParaDescartar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setItemParaDescartar(null);
        }}
        titulo="Descartar item"
        descricao="Ele não vai para o backlog."
        rotuloConfirmar="Descartar"
        onConfirmar={handleDescartar}
      />
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
    danger: "text-danger-soft",
    warning: "text-warning-soft",
    success: "text-success-line",
    muted: "text-white/45",
    white: "text-white",
  };
  return (
    <div className={`text-center ${className}`}>
      <div className={`text-heading font-bold tabular-nums ${colors[tone]}`}>{value}</div>
      <div className="text-micro text-white/55">{label}</div>
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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-caption font-semibold transition-colors ${
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
  selecionadoBacklog,
  onEditar,
  onExcluir,
  onAbrirChamado,
  onMudarResultado,
  onToggleSelecaoBacklog,
  onDescartar,
}: {
  item: InspecaoItem;
  temEscrita: boolean;
  selecionadoBacklog: boolean;
  onEditar: () => void;
  onExcluir: () => void;
  onAbrirChamado: () => void;
  onMudarResultado: (resultado: ItemResultado) => void;
  onToggleSelecaoBacklog: () => void;
  onDescartar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const emTriagem = item.destino === null;
  return (
    <article
      className={`rounded-lg border p-4 ${selecionadoBacklog ? "border-orange bg-orange-soft/30" : "border-line bg-card"}`}
    >
      <div className="flex items-start gap-3">
        {item.fotoUrl ? (
          <img
            src={item.fotoUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-md border border-line object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-title">
            {SISTEMA_ICONE[item.sistema]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-paper px-2 py-0.5 text-micro font-semibold text-ink-3">
              {rotuloSistema(item.sistema)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-micro font-semibold ${resultadoColor(item.resultado)}`}
            >
              {RESULTADO_LABEL[item.resultado]}
            </span>
            {item.grauRisco && (
              <span
                className={`rounded-full px-2 py-0.5 text-micro font-semibold ${grauRiscoColor(item.grauRisco)}`}
              >
                Risco {GRAU_RISCO_LABEL[item.grauRisco]}
              </span>
            )}
            {/* E01-S143 AC-6: destino decidido (backlog/os/chamado) = "No backlog"; descarte = "Descartado". */}
            {item.destino !== null && item.destino !== "descarte" && (
              <span className="rounded-full bg-info-soft px-2 py-0.5 text-micro font-semibold text-info">
                No backlog
              </span>
            )}
            {item.destino === "descarte" && (
              <span className="rounded-full bg-line-soft px-2 py-0.5 text-micro font-semibold text-ink-3">
                Descartado
              </span>
            )}
          </div>
          {/* E01-S143 AC-1: ribbon rápido de resultado, só enquanto o item não foi triado. */}
          {emTriagem && temEscrita && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RESULTADOS_INSPECAO.filter((opcao) => opcao.valor !== "nao_aplicavel").map(
                (opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    onClick={() => onMudarResultado(opcao.valor)}
                    className={`rounded-full border px-2.5 py-1 text-micro font-semibold transition-colors ${
                      item.resultado === opcao.valor
                        ? "border-navy bg-navy text-white"
                        : "border-line text-ink-3 hover:text-ink"
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                ),
              )}
            </div>
          )}
          <p className="mt-2 line-clamp-2 text-body font-medium text-ink">{item.descricao}</p>
          <p className="mt-1 truncate text-caption text-ink-3">
            {[item.categoria, item.elemento, item.localizacao].filter(Boolean).join(" · ") ||
              "Localização não informada"}
          </p>
          {/* E01-S143 AC-4/AC-7: Score PCM (GUT) + esforço, só depois que a IA classificou. */}
          {item.gravidade !== null && item.urgencia !== null && item.tendencia !== null && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-paper px-2.5 py-1.5 text-caption">
              <span
                className={`rounded-full px-2 py-0.5 text-micro font-semibold ${prioridadeColor(
                  classificarPrioridade(
                    calcularScoreGut(item.gravidade, item.urgencia, item.tendencia),
                  ),
                )}`}
              >
                {
                  PRIORIDADE_LABEL[
                    classificarPrioridade(
                      calcularScoreGut(item.gravidade, item.urgencia, item.tendencia),
                    )
                  ]
                }
              </span>
              <span className="text-ink-3">
                GUT: {calcularScoreGut(item.gravidade, item.urgencia, item.tendencia)}
                {item.esforcoHoras !== null && ` · ${item.esforcoHoras}h est.`}
              </span>
            </div>
          )}
          {emTriagem && temEscrita && (
            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-caption font-semibold text-orange">
                <input
                  type="checkbox"
                  checked={selecionadoBacklog}
                  onChange={onToggleSelecaoBacklog}
                  className="h-3.5 w-3.5"
                />
                Selecionar p/ backlog
              </label>
              <button
                type="button"
                onClick={onDescartar}
                className="text-caption font-semibold text-ink-3 hover:text-danger"
              >
                Descartar
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAberto((atual) => !atual)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-line-soft hover:text-ink"
          aria-label={aberto ? "Recolher detalhes" : "Expandir detalhes"}
        >
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {aberto && (
        <div className="mt-4 space-y-3 border-t border-line-soft pt-3 text-body">
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
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-3">
                Mídias ({item.midias.length})
              </p>
              <p className="mt-1 text-caption text-ink-3">
                {item.midias.map((midia) => midia.nome).join(", ")}
              </p>
            </div>
          )}
          {item.fotoUrls.length > 1 ? (
            <div>
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-3">
                Fotos ({item.fotoUrls.length})
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {item.fotoUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt=""
                      className="h-16 w-16 rounded-md border border-line object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            item.fotoUrl && (
              <a
                href={item.fotoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-caption font-semibold text-orange hover:text-orange-deep"
              >
                Abrir foto/referência
              </a>
            )
          )}
          {temEscrita && (
            <div className="flex gap-3 border-t border-line-soft pt-3">
              <button
                type="button"
                onClick={onEditar}
                className="text-caption font-semibold text-ink-2 hover:text-ink"
              >
                Editar
              </button>
              {item.destino === null && (
                <button
                  type="button"
                  onClick={onAbrirChamado}
                  className="text-caption font-semibold text-orange hover:text-orange-deep"
                >
                  Abrir chamado
                </button>
              )}
              <button
                type="button"
                onClick={onExcluir}
                className="inline-flex items-center gap-1 text-caption font-semibold text-danger hover:underline"
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

// E01-S143 AC-4/AC-5: revisão editável do que a IA calculou antes de confirmar o backlog — mesmo
// princípio do `ImportarRelatorioModal` (IA é copiloto, humano confirma antes de gravar).
function RevisaoBacklogModal({
  itens,
  correlacionou,
  confirmando,
  onClose,
  onConfirmar,
}: {
  itens: ItemClassificado[];
  correlacionou: boolean;
  confirmando: boolean;
  onClose: () => void;
  onConfirmar: (itens: ItemClassificado[]) => void;
}) {
  const [edicoes, setEdicoes] = useState<ItemClassificado[]>(itens);

  function atualizar(itemId: string, patch: Partial<ItemClassificado>) {
    setEdicoes((atuais) =>
      atuais.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item)),
    );
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
      titulo="Revisar antes de gerar backlog"
      tamanho="md"
    >
      <div className="flex flex-col gap-4">
        {!correlacionou && (
          <div className="mx-4 mt-3 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-caption text-warning">
            A IA não classificou todos os itens — os que faltaram vieram com 3/3/3/3 e esforço 0
            como ponto de partida. Revise cada item antes de confirmar.
          </div>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {edicoes.map((item) => {
            // GUTd (E01-S82): média ponderada dos quatro fatores na escala 1..5 — não o produto
            // G×U×T de 1..125, que é o critério antigo.
            const score = calcularScoreGutd(
              item.gravidade,
              item.urgencia,
              item.tendencia,
              item.dorCliente,
              PESOS_GUTD_PADRAO,
            );
            return (
              <div key={item.itemId} className="rounded-md border border-line-soft p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-micro font-semibold ${prioridadeColor(classificarPrioridadeGutd(score))}`}
                  >
                    {PRIORIDADE_LABEL[classificarPrioridadeGutd(score)]}
                  </span>
                  <span className="text-caption font-semibold text-ink-3">
                    Score PCM (GUTd): {score.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["gravidade", "urgencia", "tendencia", "dorCliente"] as const).map((campo) => (
                    <label key={campo} className="block">
                      <span className="mb-1 block text-micro font-semibold text-ink-3">
                        {ROTULO_FATOR_GUTD[campo]}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        // `dorCliente` é anulável (item antigo, ou IA que não soube dizer). Vazio
                        // não penaliza: `calcularScoreGutd` redistribui o peso entre G/U/T.
                        value={item[campo] ?? ""}
                        onChange={(e) => {
                          const bruto = e.target.value;
                          if (campo === "dorCliente" && bruto === "") {
                            atualizar(item.itemId, { dorCliente: null });
                            return;
                          }
                          atualizar(item.itemId, {
                            [campo]: Math.min(5, Math.max(1, Number(bruto) || 1)),
                          });
                        }}
                        className="input w-full"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-2 block">
                  <span className="mb-1 block text-micro font-semibold text-ink-3">
                    Esforço estimado (horas)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={item.esforcoHoras}
                    onChange={(e) =>
                      atualizar(item.itemId, {
                        esforcoHoras: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="input w-full"
                  />
                </label>
                <label className="mt-2 block">
                  <span className="mb-1 block text-micro font-semibold text-ink-3">
                    Embasamento normativo
                  </span>
                  <textarea
                    value={item.citacaoNormativa ?? ""}
                    onChange={(e) =>
                      atualizar(item.itemId, { citacaoNormativa: e.target.value || null })
                    }
                    rows={2}
                    className="input w-full"
                    placeholder="Ex.: NBR 17240:2010 item 5.4.3"
                  />
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onClose} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirmar(edicoes)}
            disabled={confirmando}
            loading={confirmando}
          >
            {`Gerar backlog (${edicoes.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DetalheItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-1 text-body text-ink">{value || "—"}</p>
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
        <p className="mb-2 text-center text-caption font-semibold text-ink-3">Sistema / Área *</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SISTEMAS.map((sistema) => (
            <button
              key={sistema}
              type="button"
              onClick={() => setForm((atual) => ({ ...atual, sistema }))}
              className={`flex min-h-18 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-body font-semibold transition-colors ${
                form.sistema === sistema
                  ? "border-navy bg-info-soft text-navy"
                  : "border-line text-ink-3 hover:border-navy/40 hover:text-ink"
              }`}
            >
              <span className="text-title">{SISTEMA_ICONE[sistema]}</span>
              <span className="text-center text-caption">
                {rotuloSistema(sistema).split("/")[0]}
              </span>
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
        <div className="rounded-lg border border-line-soft bg-paper p-3">
          <div className="flex items-center justify-between">
            <p className="text-caption font-semibold uppercase tracking-wider text-ink-3">
              Mídias (foto/vídeo/documento)
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={enviandoMidia}
              className="inline-flex items-center gap-1 text-caption font-semibold text-orange hover:text-orange-deep disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {enviandoMidia ? "Enviando…" : "Adicionar"}
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
          {erroMidia && <p className="mt-2 text-caption text-danger">{erroMidia}</p>}
          {midias.length === 0 ? (
            <p className="mt-2 text-caption text-ink-3">Nenhuma mídia anexada.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {midias.map((midia) => (
                <li
                  key={midia.path}
                  className="flex items-center justify-between gap-2 text-caption"
                >
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
                    className="shrink-0 text-danger hover:underline"
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
  criarChamados: boolean;
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemInspecaoImportado[]>([]);
  const [criarChamados, setCriarChamados] = useState(false);
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
    setAviso(null);
    setStep("processando");
    try {
      const extraido =
        tipo === "xls"
          ? await extrairPlanilhaXls(file)
          : { textoParaClassificacao: await extrairTextoPdfOuTexto(file), itensBrutos: [] };
      let processados: ItemInspecaoImportado[];
      try {
        processados = await supabaseQualidadeAdapter.processarRelatorioInspecao(
          extraido.textoParaClassificacao,
        );
        const revisao = prepararRevisaoImportacaoExcel(processados, extraido.itensBrutos);
        processados = revisao.itens;
        setAviso(revisao.aviso);
      } catch (error) {
        if (tipo !== "xls" || extraido.itensBrutos.length === 0) throw error;
        const revisao = prepararRevisaoImportacaoExcel([], extraido.itensBrutos);
        processados = revisao.itens;
        setAviso(revisao.aviso);
      }
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
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line px-6 py-12 text-center hover:border-orange hover:bg-orange-soft/25"
          >
            <Upload className="h-10 w-10 text-ink-3" />
            <span className="mt-3 text-body font-semibold text-ink">
              Arraste ou selecione o arquivo padrão do Auvo
            </span>
            <span className="mt-1 text-caption text-ink-3">
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
            <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
              {erro}
            </div>
          )}
          <div className="rounded-lg bg-info-soft px-4 py-3 text-body text-info">
            A importação usa o modelo do PCM antigo: extrai local, relato/fotos no XLS e envia o
            texto para a análise IA da função `importar-relatorio-pdf`.
          </div>
        </div>
      )}

      {step === "processando" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-orange" />
          <p className="mt-4 text-body font-semibold text-ink">Processando relatório…</p>
          <p className="mt-1 text-caption text-ink-3">
            Extraindo inconformidades e classificando com IA.
          </p>
        </div>
      )}

      {step === "revisao" && (
        <div className="space-y-4">
          {aviso ? (
            <p className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-body text-warning">
              {aviso}
            </p>
          ) : null}
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
            <p className="text-body text-ink-3">
              <span className="font-semibold text-ink">{selecionados.size}</span> de {itens.length}{" "}
              item(ns) selecionados
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelecionados(new Set(itens.map((_, index) => index)))}
                className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink-2 hover:bg-line-soft"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelecionados(new Set())}
                className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink-2 hover:bg-line-soft"
              >
                Limpar
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-body text-ink-2">
            <input
              type="checkbox"
              checked={criarChamados}
              onChange={(event) => setCriarChamados(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-navy"
            />
            <span>
              Após revisar, criar um Chamado por item selecionado. A origem fica vinculada à
              inspeção; deixe desmarcado para apenas gravar os itens.
            </span>
          </label>

          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {itens.map((item, index) => {
              const score = item.gravidade * item.urgencia * item.tendencia;
              const aberto = expandido === index;
              const selecionado = selecionados.has(index);
              return (
                <div
                  key={`${item.local}-${index}`}
                  className={`rounded-lg border p-3 ${
                    selecionado ? "border-orange/45 bg-orange-soft/20" : "border-line opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => toggleItem(index)}
                      className="mt-1 h-4 w-4 accent-navy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-paper px-2 py-0.5 text-micro font-semibold text-ink-3">
                          {SISTEMA_ICONE[item.sistema]} {rotuloSistema(item.sistema)}
                        </span>
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-micro font-semibold text-warning">
                          GUT {score}
                        </span>
                      </div>
                      <p className="mt-2 text-body font-semibold text-ink">{item.tituloBacklog}</p>
                      <p className="mt-1 text-caption text-ink-3">
                        {item.local || "Local não informado"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandido(aberto ? null : index)}
                      className="rounded-md p-1 text-ink-3 hover:bg-line-soft"
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
                      <div className="grid grid-cols-3 gap-2">
                        <GutImportado
                          label="Gravidade"
                          value={item.gravidade}
                          onChange={(value) =>
                            atualizarGutImportado(setItens, index, "gravidade", value)
                          }
                        />
                        <GutImportado
                          label="Urgência"
                          value={item.urgencia}
                          onChange={(value) =>
                            atualizarGutImportado(setItens, index, "urgencia", value)
                          }
                        />
                        <GutImportado
                          label="Tendência"
                          value={item.tendencia}
                          onChange={(value) =>
                            atualizarGutImportado(setItens, index, "tendencia", value)
                          }
                        />
                      </div>
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
                criarChamados,
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
      <span className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <textarea
        className="input mt-1 min-h-20 resize-y text-caption"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function GutImportado({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <select
        className="input mt-1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {[1, 2, 3, 4, 5].map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

function atualizarGutImportado(
  setItens: Dispatch<SetStateAction<ItemInspecaoImportado[]>>,
  index: number,
  campo: "gravidade" | "urgencia" | "tendencia",
  value: number,
) {
  setItens((atuais) =>
    atuais.map((atual, i) => (i === index ? { ...atual, [campo]: value } : atual)),
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
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
      titulo={title}
      tamanho={size === "lg" ? "lg" : "md"}
    >
      {children}
    </Modal>
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
      <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[14px] bg-card shadow-drawer">
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-navy px-4 py-3 text-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/75 hover:bg-card/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-body font-semibold">{title}</h3>
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
      <span className="mb-1 block text-caption font-semibold text-ink-3">{label}</span>
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
        className="inline-flex items-center justify-center rounded-lg bg-navy px-4 py-3 text-body font-semibold text-white hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-3 text-body font-semibold text-ink-2 hover:bg-line-soft"
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

async function extrairPlanilhaXls(file: File) {
  const XLSX = await carregarSheetJs();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Planilha sem abas.");
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return parsearPlanilhaLevantamento(rows);
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
