import { RecursoNaoAtivado } from "@sinergica/ui";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { flagLigada } from "../config/flags-sso";
import { AreaClienteAdminPage } from "../features/area-cliente/pages/AreaClienteAdminPage";
import { AtendimentoConfigPage } from "../features/atendimento/pages/AtendimentoConfigPage";
import { AtendimentoDashboardPage } from "../features/atendimento/pages/AtendimentoDashboardPage";
import { AtendimentoInboxPage } from "../features/atendimento/pages/AtendimentoInboxPage";
import { PainelComercialCliente } from "../features/comercial/components/PainelComercialCliente";
import { OrcamentosDaOs } from "../features/comercial/interfaces/orcamento-operacional/OrcamentosDaOs";
import { ConfigFunilPage as ComercialConfigFunilPage } from "../features/comercial/pages/ConfigFunilPage";
import { ContasPage as ComercialContasPage } from "../features/comercial/pages/ContasPage";
import { ContratosPage as ComercialContratosPage } from "../features/comercial/pages/ContratosPage";
import { DashboardComercialPage as ComercialDashboardPage } from "../features/comercial/pages/DashboardComercialPage";
import { FunilPage as ComercialFunilPage } from "../features/comercial/pages/FunilPage";
import { ParametrosPrecoPage as ComercialParametrosPrecoPage } from "../features/comercial/pages/ParametrosPrecoPage";
import type { ModuloId as ModuloNegocioId } from "../features/config/domain/modulo";
import { AtivacaoJornadasPage } from "../features/config/pages/AtivacaoJornadasPage";
import { ConfigIaPage } from "../features/config/pages/ConfigIaPage";
import { GruposPage } from "../features/config/pages/GruposPage";
import { IntegracoesPage } from "../features/config/pages/IntegracoesPage";
import { RelatorioGastoIaPage } from "../features/config/pages/RelatorioGastoIaPage";
import { UsuariosPage } from "../features/config/pages/UsuariosPage";
import type { FinanceiroView } from "../features/financeiro/mock/FinanceiroMockRouter";
import { FinanceiroMockRouter } from "../features/financeiro/mock/FinanceiroMockRouter";
import { CategoriasPage as FinanceiroCategoriasPage } from "../features/financeiro/pages/CategoriasPage";
import { CobrancaPage as FinanceiroCobrancaPage } from "../features/financeiro/pages/CobrancaPage";
import { CockpitFinanceiroPage as FinanceiroCockpitPage } from "../features/financeiro/pages/CockpitFinanceiroPage";
import { ContasPagarPage as FinanceiroContasPagarPage } from "../features/financeiro/pages/ContasPagarPage";
import { ContasPage as FinanceiroContasPage } from "../features/financeiro/pages/ContasPage";
import { ContasReceberPage as FinanceiroContasReceberPage } from "../features/financeiro/pages/ContasReceberPage";
import { ContratosPage as FinanceiroContratosPage } from "../features/financeiro/pages/ContratosPage";
import { CustosPessoalPage as FinanceiroCustosPessoalPage } from "../features/financeiro/pages/CustosPessoalPage";
import { DrePage as FinanceiroDrePage } from "../features/financeiro/pages/DrePage";
import { FechamentoPage as FinanceiroFechamentoPage } from "../features/financeiro/pages/FechamentoPage";
import { FinanceiroDashboardPage } from "../features/financeiro/pages/FinanceiroDashboardPage";
import { ImportOfxPage as FinanceiroImportOfxPage } from "../features/financeiro/pages/ImportOfxPage";
import { ImpostosPage as FinanceiroImpostosPage } from "../features/financeiro/pages/ImpostosPage";
import { LancamentosPage as FinanceiroLancamentosPage } from "../features/financeiro/pages/LancamentosPage";
import { OrcamentoPage as FinanceiroOrcamentoPage } from "../features/financeiro/pages/OrcamentoPage";
import { RentabilidadePage as FinanceiroRentabilidadePage } from "../features/financeiro/pages/RentabilidadePage";
import type { GuiaView } from "../features/guia/GuiaRouter";
import { GuiaRouter } from "../features/guia/GuiaRouter";
import { NovaOrdemServicoModal } from "../features/pcm/components/NovaOrdemServicoModal";
import { CapacidadesWorkspace } from "../features/pcm/interfaces/capacidades-sso/Workspace";
import { AgendaTecnicoPage } from "../features/pcm/pages/AgendaTecnicoPage";
import { ApontamentoHorasPage } from "../features/pcm/pages/ApontamentoHorasPage";
import { AssessmentPage } from "../features/pcm/pages/AssessmentPage";
import {
  EquipamentoCategoriasPage,
  PalavrasChavePage,
  SegmentosPage,
} from "../features/pcm/pages/CatalogoSimplesPage";
import { ClienteGruposPage } from "../features/pcm/pages/ClienteGruposPage";
import { ConfigLocalizacaoAuvoPage } from "../features/pcm/pages/ConfigLocalizacaoAuvoPage";
import { ConfigPriorizacaoPage } from "../features/pcm/pages/ConfigPriorizacaoPage";
import { EquipamentosPage } from "../features/pcm/pages/EquipamentosPage";
import { EquipesPage } from "../features/pcm/pages/EquipesPage";
import { FerramentasPage } from "../features/pcm/pages/FerramentasPage";
import { FerramentasPorTecnicoPage } from "../features/pcm/pages/FerramentasPorTecnicoPage";
import { FuncionariosPage } from "../features/pcm/pages/FuncionariosPage";
import { InspecoesPage } from "../features/pcm/pages/InspecoesPage";
import { LaudosSpdaPage } from "../features/pcm/pages/LaudosSpdaPage";
import { ListaClientesPage } from "../features/pcm/pages/ListaClientesPage";
import { MarcacoesClientePage } from "../features/pcm/pages/MarcacoesClientePage";
import { MonitorExcecoesAuvoPage } from "../features/pcm/pages/MonitorExcecoesAuvoPage";
import { OrdensServicoPage } from "../features/pcm/pages/OrdensServicoPage";
import { PcmDashboardPage } from "../features/pcm/pages/PcmDashboardPage";
import { PmocPage } from "../features/pcm/pages/PmocPage";
import { PreventivasPage } from "../features/pcm/pages/PreventivasPage";
import { RelatorioClientePage } from "../features/pcm/pages/RelatorioClientePage";
import { RelatorioDiarioPage } from "../features/pcm/pages/RelatorioDiarioPage";
import { RelatorioPlanejamentoPage } from "../features/pcm/pages/RelatorioPlanejamentoPage";
import { SistemasPage } from "../features/pcm/pages/SistemasPage";
import { TiposInspecaoPage } from "../features/pcm/pages/TiposInspecaoPage";
import { TiposTarefaPage } from "../features/pcm/pages/TiposTarefaPage";
import { VisaoClientePage } from "../features/pcm/pages/VisaoClientePage";
import { DashboardGeral } from "./DashboardGeral";
import { useAuth } from "./auth-context";
import { MODULOS, isModuloNegocio } from "./modulos";
import type { AreaAtiva, ModuloId, ModuloTab } from "./modulos";
import { useNavGuard } from "./nav-guard-context";
import {
  ATENDIMENTO_NAV,
  COMERCIAL_NAV,
  CONFIG_NAV,
  FINANCEIRO_NAV,
  GUIA_NAV,
  NAVEGACAO_SSO,
  PCM_NAV,
  bloqueioDeAdministracao,
  navegacaoAgrupada,
  navegacaoVisivel,
} from "./navegacao-sso";
import type { AtendimentoView, ComercialView, ConfigTab, PcmView } from "./navegacao-sso";
import { usePermissoes } from "./permissoes-context";
import { rotaInicialDaUrl } from "./rotas-legadas";
import { useTheme } from "./theme-context";

// ─── componentes ─────────────────────────────────────────────────────────────

function EmConstrucao({ modulo }: { modulo: ModuloTab }) {
  const Icon = modulo.icon;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
      <div className="w-16 h-16 rounded-2xl bg-line flex items-center justify-center">
        <Icon className="w-8 h-8 text-ink-3" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink-2">{modulo.label}</h2>
        <p className="text-body text-ink-3 mt-1 max-w-sm">{modulo.descricao}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-warning bg-orange-soft border border-warning-line rounded-full px-3 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-orange" />
        Em construção
      </span>
    </div>
  );
}

// ─── página principal ────────────────────────────────────────────────────────

// E01-S190: enquanto `E00-S26` não entregar uma verificação de capacidade sem cliente
// (`config.sso_autorizar_acao` exige `p_cliente_id`), nenhuma entrada da árvore declara
// `capacidade` e o conjunto é vazio — a autorização da Administração sai do nível de permissão
// no módulo, que o servidor já resolve em `config.minhas_permissoes`.
const CAPACIDADES_SSO_VAZIAS: ReadonlySet<string> = new Set<string>();

export function HomePage() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { podeAcessar } = usePermissoes();
  const { confirmarSaida } = useNavGuard();
  // E01-S190 (BL 013): navegação por função. Desligada = menu idêntico ao anterior, item por item.
  const navegacaoPorFuncao = flagLigada("VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED");
  const [activeModulo, setActiveModulo] = useState<AreaAtiva>(() => {
    if (new URLSearchParams(window.location.search).get("guia") === "pcm") return "guia";
    // AC-3: deep-link de rota antiga (`?view=`) cai direto no PCM, nunca numa tela de erro.
    if (navegacaoPorFuncao && rotaInicialDaUrl(window.location.search)) return "pcm";
    return "inicio";
  });
  const [configTab, setConfigTab] = useState<ConfigTab>("grupos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Sub-navegação do Atendimento (E02-S02) — só "inbox" por enquanto (E02-S03+ adiciona mais).
  const [atendimentoView, setAtendimentoView] = useState<AtendimentoView>("inbox");
  // Sub-navegação do PCM (Task 18/E01-S12) — mesmo padrão useState de abas, sem lib de rotas.
  const [pcmView, setPcmView] = useState<PcmView>(() =>
    navegacaoPorFuncao ? (rotaInicialDaUrl(window.location.search) ?? "dashboard") : "dashboard",
  );
  const [relatorioDiarioDataInicial, setRelatorioDiarioDataInicial] = useState<
    string | undefined
  >();
  // Sub-navegação do Financeiro.
  const [financeiroView, setFinanceiroView] = useState<FinanceiroView>("dashboard");
  // E03-S08 AC-10/task 8: dashboard é o item default do módulo, mesmo padrão do Financeiro
  // (E04-S03) — "o funil está funcionando?" é a pergunta que abriu o épico, por isso é a primeira
  // tela, não o Kanban de trabalho (que segue disponível, só deixou de ser o default da E03-S02).
  const [comercialView, setComercialView] = useState<ComercialView>("dashboard");
  // Sub-navegação do Guia do SO (documentação de onboarding — features/guia/).
  const [guiaView, setGuiaView] = useState<GuiaView>(() =>
    new URLSearchParams(window.location.search).get("guia") === "pcm" ? "pcm" : "visao-geral",
  );
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [novaOsAberta, setNovaOsAberta] = useState(false);
  const [feedbackOs, setFeedbackOs] = useState<string | null>(null);
  const [pcmRefreshKey, setPcmRefreshKey] = useState(0);
  // E01-S49: deep-link do cliente-360 pra uma OS específica — guarda de onde veio pra oferecer
  // "voltar ao cliente" sem precisar de router. `seq` força o efeito em `OrdensServicoPage` a
  // reagir mesmo clicando duas vezes seguidas na MESMA OS (osId igual não mudaria de valor).
  const [osDeepLink, setOsDeepLink] = useState<{
    osId: string;
    origemClienteId: string | null;
    seq: number;
  } | null>(null);
  // E03-S05, AC-7: deep-link da aba Comercial da Visão 360 ("ver assessment completo") pra
  // `InspecoesPage`, mesmo padrão do `osDeepLink` acima.
  const [inspecaoDeepLinkId, setInspecaoDeepLinkId] = useState<string | null>(null);
  // E03-S09, AC-5: deep-link da aba Comercial da Visão 360 ("ver conversa que originou o lead")
  // pra `AtendimentoInboxPage` — mesmo padrão do `inspecaoDeepLinkId` acima.
  const [conversaDeepLinkId, setConversaDeepLinkId] = useState<string | null>(null);
  // E01-S75 AC-5: período vindo do Apontamento de Horas — só setado junto com `clienteSelecionado`
  // pela navegação de "Horas por cliente"; nulo em qualquer outro caminho pra Visão 360 (clique
  // direto em ListaClientesPage não filtra nada).
  const [clientePeriodo, setClientePeriodo] = useState<{ inicio: string; fim: string } | null>(
    null,
  );
  // E01-S75 AC-5: filtro pré-setado vindo de "Horas por técnico" — semeia os filtros de
  // OrdensServicoPage no mount (a página sempre remonta ao entrar em "ordens" vindo de outra view).
  const [ordensFiltrosPreset, setOrdensFiltrosPreset] = useState<{
    tecnicoFuncionarioId: string;
    dataInicio: string;
    dataFim: string;
  } | null>(null);
  function navegarModulo(area: AreaAtiva) {
    if (area !== activeModulo && !confirmarSaida()) return;
    setActiveModulo(area);
    setMobileSidebarOpen(false);
  }

  function irParaPcmView(view: PcmView) {
    if (view !== pcmView && !confirmarSaida()) return;
    setPcmView(view);
    setClienteSelecionado(null); // ao trocar de sub-tela, sai da Visão 360 de um cliente específico
    setClientePeriodo(null);
    setOsDeepLink(null);
    setOrdensFiltrosPreset(null);
    setInspecaoDeepLinkId(null);
  }

  function abrirClienteNoPeriodo(clienteId: string, periodo: { inicio: string; fim: string }) {
    setClienteSelecionado(clienteId);
    setClientePeriodo(periodo);
    setPcmView("clientes");
  }

  function abrirOrdensDoTecnicoNoPeriodo(
    tecnicoFuncionarioId: string,
    periodo: { inicio: string; fim: string },
  ) {
    setOrdensFiltrosPreset({
      tecnicoFuncionarioId,
      dataInicio: periodo.inicio,
      dataFim: periodo.fim,
    });
    setPcmView("ordens");
  }

  function abrirOrdensHoje() {
    const hoje = new Date().toISOString().slice(0, 10);
    setOrdensFiltrosPreset({ tecnicoFuncionarioId: "", dataInicio: hoje, dataFim: hoje });
    setPcmView("ordens");
  }

  function abrirInspecaoDoComercial(inspecaoId: string) {
    setInspecaoDeepLinkId(inspecaoId);
    setClienteSelecionado(null);
    setPcmView("inspecoes");
  }

  function abrirConversaDoComercial(conversaId: string) {
    setConversaDeepLinkId(conversaId);
    setAtendimentoView("inbox");
    navegarModulo("atendimento");
  }

  function abrirOsDoCliente(osId: string) {
    if (clienteSelecionado) {
      setOsDeepLink((atual) => ({
        osId,
        origemClienteId: clienteSelecionado,
        seq: (atual?.seq ?? 0) + 1,
      }));
    }
    setPcmView("ordens");
  }

  function abrirOsDoSistema(osId: string) {
    setClienteSelecionado(null);
    setOsDeepLink((atual) => ({
      osId,
      origemClienteId: null,
      seq: (atual?.seq ?? 0) + 1,
    }));
    setPcmView("ordens");
  }

  function voltarAoClienteDoDeepLink() {
    if (!osDeepLink?.origemClienteId) return;
    setClienteSelecionado(osDeepLink.origemClienteId);
    setPcmView("clientes");
    setOsDeepLink(null);
  }

  // AC-4: superadmin sempre vê tudo (claim user_modulos vem vazio pra ele — bypass, igual RLS);
  // demais papéis só veem módulo com ao menos leitura resolvida (config.minhas_permissoes).
  function podeVerModulo(id: ModuloId): boolean {
    if (!isModuloNegocio(id)) return true;
    return user?.papel === "superadmin" || podeAcessar(id, "leitura");
  }

  // `navegacaoVisivel` é pura e não conhece `ModuloId`; este adaptador só estreita o tipo. A
  // decisão continua sendo a permissão resolvida no servidor — nenhum `if` por papel aqui.
  const podeAcessarNav = useCallback(
    (modulo: string, nivel: "leitura" | "escrita") => podeAcessar(modulo as ModuloNegocioId, nivel),
    [podeAcessar],
  );
  const entradasVisiveis = navegacaoPorFuncao
    ? navegacaoVisivel(NAVEGACAO_SSO, podeAcessarNav, CAPACIDADES_SSO_VAZIAS)
    : [];
  // AC-5/AC-6: ocultar do menu não basta — a rota oculta também é bloqueada. Quem cair numa view
  // de Administração sem autorização (deep-link, estado antigo, link colado) não vê a tela.
  const bloqueioAdmin = navegacaoPorFuncao
    ? bloqueioDeAdministracao(pcmView, podeAcessarNav, CAPACIDADES_SSO_VAZIAS)
    : null;

  const podeGerenciarConfig = user?.papel === "superadmin" || user?.papel === "supervisor";
  const podeCriarOs = podeAcessar("pcm", "escrita");
  const dashboardModuloIds = MODULOS.filter((m) => m.id !== "inicio" && podeVerModulo(m.id)).map(
    (m) => m.id,
  );

  const modulo = MODULOS.find((m) => m.id === activeModulo);
  const initials =
    user?.nome
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join("") ?? "?";
  const sidebarCompacta = sidebarCollapsed && !mobileSidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-navy-deep/55 backdrop-blur-[2px] lg:hidden"
        />
      )}
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-hidden border-r border-navy-line bg-navy-deep shadow-drawer transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "lg:w-14" : "lg:w-56"}`}
      >
        {/* Brand */}
        <div className="flex min-h-14 items-center border-b border-navy-line px-3 py-3">
          <div className={`flex flex-1 items-center ${sidebarCompacta ? "lg:justify-center" : ""}`}>
            {sidebarCompacta ? (
              <img
                src="/logos/logo-simbolo-laranja.png"
                alt="Sinérgica"
                className="w-8 h-8 object-contain shrink-0"
              />
            ) : (
              <img
                src="/logos/logo-horizontal-branco.png"
                alt="Sinérgica"
                className="h-7 object-contain"
              />
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileSidebarOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-nav-ink hover:bg-card/[0.07] hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {activeModulo === "inicio" ? (
            <div>
              {!sidebarCompacta && (
                <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                  MÓDULOS
                </p>
              )}
              {MODULOS.filter((m) => m.id !== "inicio" && podeVerModulo(m.id)).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    title={m.label}
                    onClick={() => navegarModulo(m.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white ${sidebarCompacta ? "justify-center" : ""}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {!sidebarCompacta && <span className="truncate">{m.label}</span>}
                  </button>
                );
              })}
            </div>
          ) : activeModulo === "config" ? (
            <div>
              {!sidebarCompacta && (
                <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                  CONFIGURAÇÕES
                </p>
              )}
              {CONFIG_NAV.filter(
                (item) => item.id !== "capacidades" || user?.papel === "superadmin",
              )
                .filter(
                  (item) =>
                    item.id !== "ativacao" ||
                    (user?.papel === "superadmin" &&
                      flagLigada("VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED")),
                )
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === configTab;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => {
                        setConfigTab(item.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                        isActive
                          ? "border-orange bg-card/[0.07] text-white font-medium"
                          : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
            </div>
          ) : activeModulo === "pcm" ? (
            navegacaoPorFuncao ? (
              navegacaoAgrupada(entradasVisiveis).map((bloco) => (
                <div key={bloco.nivel}>
                  {!sidebarCompacta && (
                    <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                      {bloco.titulo}
                    </p>
                  )}
                  {bloco.grupos.map((grupo) => (
                    <div key={grupo.grupo} className="mb-1">
                      {!sidebarCompacta && bloco.grupos.length > 1 && (
                        <p className="px-2 text-caption text-nav-ink">{grupo.grupo}</p>
                      )}
                      {grupo.itens.map((entrada) => {
                        const Icon = entrada.icone;
                        const view = entrada.view;
                        const isActive = view === pcmView;
                        return (
                          <button
                            key={entrada.id}
                            type="button"
                            title={entrada.label}
                            onClick={
                              entrada.atalhoConfigGrupos
                                ? () => {
                                    setConfigTab("grupos");
                                    navegarModulo("config");
                                  }
                                : view
                                  ? () => irParaPcmView(view)
                                  : undefined
                            }
                            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                              isActive
                                ? "border-orange bg-card/[0.07] text-white font-medium"
                                : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                            {!sidebarCompacta && <span className="truncate">{entrada.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              PCM_NAV.map((group) => (
                <div key={group.titulo}>
                  {!sidebarCompacta && (
                    <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                      {group.titulo}
                    </p>
                  )}
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const view = item.view;
                    // E01-S114 AC-3: com filhos, também ativo se o pcmView atual for de um filho —
                    // mantém o contexto visível (submenu sempre expandido, ver AC-1 "padrão simples").
                    const filhoAtivo =
                      item.filhos?.some((filho) => filho.view === pcmView) ?? false;
                    const isActive = view ? view === pcmView || filhoAtivo : item.active;
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          title={item.label}
                          onClick={
                            item.atalhoConfigGrupos
                              ? () => {
                                  setConfigTab("grupos");
                                  navegarModulo("config");
                                }
                              : view
                                ? () => irParaPcmView(view)
                                : undefined
                          }
                          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                            isActive
                              ? "border-orange bg-card/[0.07] text-white font-medium"
                              : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                          {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                        </button>
                        {item.filhos && !sidebarCompacta && (
                          <div className="ml-4 border-l border-navy-line pl-2">
                            {item.filhos.map((filho) => {
                              const FilhoIcon = filho.icon;
                              const filhoIsActive = filho.view === pcmView;
                              return (
                                <button
                                  key={filho.label}
                                  type="button"
                                  title={filho.label}
                                  onClick={
                                    filho.view
                                      ? () => irParaPcmView(filho.view as PcmView)
                                      : undefined
                                  }
                                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${
                                    filhoIsActive
                                      ? "border-orange bg-card/[0.07] text-white font-medium"
                                      : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                                  }`}
                                >
                                  <FilhoIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                                  <span className="truncate">{filho.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )
          ) : activeModulo === "atendimento" ? (
            ATENDIMENTO_NAV.map((group) => (
              <div key={group.titulo}>
                {!sidebarCompacta && (
                  <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                    {group.titulo}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.view === atendimentoView;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      title={item.label}
                      onClick={() => {
                        setAtendimentoView(item.view);
                        // Clique manual no menu não é o deep-link do Comercial (E03-S09) — limpa
                        // pra não reabrir uma conversa antiga se o usuário voltar pro Inbox depois.
                        setConversaDeepLinkId(null);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                        isActive
                          ? "border-orange bg-card/[0.07] text-white font-medium"
                          : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          ) : activeModulo === "financeiro" ? (
            FINANCEIRO_NAV.map((group) => (
              <div key={group.titulo}>
                {!sidebarCompacta && (
                  <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                    {group.titulo}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.view === financeiroView;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      title={item.label}
                      onClick={() => {
                        setFinanceiroView(item.view);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                        isActive
                          ? "border-orange bg-card/[0.07] text-white font-medium"
                          : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          ) : activeModulo === "comercial" ? (
            <div>
              {!sidebarCompacta && (
                <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                  COMERCIAL
                </p>
              )}
              {COMERCIAL_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = item.view === comercialView;
                return (
                  <button
                    key={item.label}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      setComercialView(item.view);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                      isActive
                        ? "border-orange bg-card/[0.07] text-white font-medium"
                        : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ) : activeModulo === "guia" ? (
            <div>
              {!sidebarCompacta && (
                <p className="px-2 text-micro font-semibold text-nav-ink uppercase tracking-widest mb-1">
                  GUIA DO SO
                </p>
              )}
              {GUIA_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = item.view === guiaView;
                return (
                  <button
                    key={item.label}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      setGuiaView(item.view);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                      isActive
                        ? "border-orange bg-card/[0.07] text-white font-medium"
                        : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {!sidebarCompacta && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            !sidebarCompacta && (
              <div className="px-2 pt-4 text-center">
                <p className="text-caption text-nav-ink">
                  Navegação disponível quando o módulo for construído.
                </p>
              </div>
            )
          )}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-navy-line space-y-0.5">
          <button
            type="button"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden w-full items-center gap-2.5 rounded-sm border-l-2 border-transparent px-2 py-1.5 text-body text-nav-ink transition-colors hover:bg-card/[0.04] hover:text-white lg:flex ${sidebarCompacta ? "justify-center" : ""}`}
          >
            {sidebarCompacta ? (
              <ChevronRight className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                <span>Recolher</span>
              </>
            )}
          </button>
          {podeGerenciarConfig && (
            <button
              type="button"
              title="Configurações"
              onClick={() => navegarModulo("config")}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body transition-colors cursor-pointer border-l-2 ${sidebarCompacta ? "justify-center" : ""} ${
                activeModulo === "config"
                  ? "border-orange bg-card/[0.07] text-white font-medium"
                  : "border-transparent text-nav-ink hover:bg-card/[0.04] hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              {!sidebarCompacta && <span>Configurações</span>}
            </button>
          )}
          <button
            type="button"
            title="Sair"
            onClick={logout}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm text-body text-nav-ink hover:bg-card/[0.04] hover:text-white transition-colors cursor-pointer border-l-2 border-transparent ${sidebarCompacta ? "justify-center" : ""}`}
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} />
            {!sidebarCompacta && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar com abas */}
        <header className="bg-card border-b border-line shrink-0">
          <div className="flex min-h-12 items-center gap-1 overflow-x-auto px-3 no-scrollbar sm:px-4">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMobileSidebarOpen(true)}
              className="sticky left-0 z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-card text-ink-2 hover:bg-line-soft lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            {MODULOS.filter((m) => podeVerModulo(m.id)).map((m) => {
              const Icon = m.icon;
              const isActive = m.id === activeModulo;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navegarModulo(m.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-3 text-caption font-medium transition-colors sm:px-3.5 sm:text-body ${
                    isActive
                      ? "border-orange text-navy"
                      : "border-transparent text-ink-3 hover:text-ink hover:border-line"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-orange" : ""}`}
                    strokeWidth={isActive ? 2 : 1.8}
                  />
                  {m.label}
                </button>
              );
            })}

            {/* Guia do SO — documentação de onboarding, sempre visível, sem gate de permissão de
                módulo (igual "config", mas sem exigir papel administrativo). Fica por último,
                depois de Área do Cliente. */}
            <button
              type="button"
              onClick={() => navegarModulo("guia")}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-3 text-caption font-medium transition-colors sm:px-3.5 sm:text-body ${
                activeModulo === "guia"
                  ? "border-orange text-navy"
                  : "border-transparent text-ink-3 hover:text-ink hover:border-line"
              }`}
            >
              <BookOpen
                className={`w-4 h-4 ${activeModulo === "guia" ? "text-orange" : ""}`}
                strokeWidth={activeModulo === "guia" ? 2 : 1.8}
              />
              Guia do SO
            </button>

            {/* Avatar no canto */}
            <div className="ml-auto pl-4 flex items-center gap-2 shrink-0">
              <button
                type="button"
                title={mode === "dark" ? "Usar modo dia" : "Usar modo noite"}
                aria-label={mode === "dark" ? "Usar modo dia" : "Usar modo noite"}
                onClick={toggleMode}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
              >
                {mode === "dark" ? (
                  <Sun className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Moon className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
              <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white text-caption font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          {/* Conteúdo por módulo */}
          {activeModulo === "inicio" ? (
            <DashboardGeral moduloIds={dashboardModuloIds} onSelect={navegarModulo} />
          ) : activeModulo === "pcm" ? (
            bloqueioAdmin ? (
              // E00-S28 AC-3: recurso barrado se anuncia; `return null` silencioso é indistinguível
              // de "não existe". Quem não administra não vê nome de permissão, flag ou gate (AC-6
              // do componente) — só que a área existe e não é dele.
              <RecursoNaoAtivado
                recurso={`Administração · ${bloqueioAdmin.label}`}
                podeAdministrar={podeAcessarNav("pcm", "escrita")}
                faltando={["permissão de escrita no módulo PCM"]}
              />
            ) : pcmView === "clientes" ? (
              clienteSelecionado ? (
                // Visão 360 de um cliente específico. O botão "Voltar" é RE-navegação (não mutação),
                // por isso mora aqui e não dentro da VisaoClientePage — que segue read-only (AC-7).
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setClienteSelecionado(null);
                      setClientePeriodo(null);
                    }}
                    className="self-start inline-flex items-center gap-1.5 text-body font-semibold text-orange hover:text-orange-deep cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                    Voltar para clientes
                  </button>
                  <VisaoClientePage
                    clienteId={clienteSelecionado}
                    onAbrirOs={abrirOsDoCliente}
                    periodo={clientePeriodo ?? undefined}
                    painelOrcamentoOs={
                      user?.id && flagLigada("VITE_SSO_ORCAMENTO_OPERACIONAL_ENABLED")
                        ? (ordemServicoId) => (
                            <OrcamentosDaOs
                              usuario={user?.id ?? ""}
                              cliente={clienteSelecionado}
                              ordemServico={ordemServicoId}
                            />
                          )
                        : undefined
                    }
                    // E03-S01 AC-9: o shell injeta a aba Comercial. `features/pcm` não importa
                    // `features/comercial` (fronteira do CLAUDE.md) — quem compõe é o app.
                    // Sem o módulo, nada é injetado e a aba não aparece.
                    painelComercial={
                      podeVerModulo("comercial") ? (
                        <PainelComercialCliente
                          clienteId={clienteSelecionado}
                          onAbrirLevantamento={abrirInspecaoDoComercial}
                          onAbrirConversa={abrirConversaDoComercial}
                        />
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <ListaClientesPage onSelecionar={setClienteSelecionado} />
              )
            ) : pcmView === "inspecoes" ? (
              <InspecoesPage inspecaoIdInicial={inspecaoDeepLinkId} />
            ) : pcmView === "assessment" ? (
              <AssessmentPage />
            ) : pcmView === "cliente-marcacoes" ? (
              <MarcacoesClientePage />
            ) : pcmView === "cliente-grupos" ? (
              <ClienteGruposPage />
            ) : pcmView === "funcionarios" ? (
              <FuncionariosPage />
            ) : pcmView === "equipamentos" ? (
              <EquipamentosPage />
            ) : pcmView === "sistemas" ? (
              <SistemasPage onAbrirOs={abrirOsDoSistema} />
            ) : pcmView === "equipes" ? (
              <EquipesPage />
            ) : pcmView === "agenda-tecnico" ? (
              <AgendaTecnicoPage />
            ) : pcmView === "relatorio-planejamento" ? (
              <RelatorioPlanejamentoPage />
            ) : pcmView === "relatorio-diario" ? (
              <RelatorioDiarioPage dataInicial={relatorioDiarioDataInicial} />
            ) : pcmView === "relatorio-cliente" ? (
              <RelatorioClientePage />
            ) : pcmView === "ferramentas" ? (
              <FerramentasPage />
            ) : pcmView === "ferramentas-por-tecnico" ? (
              <FerramentasPorTecnicoPage />
            ) : pcmView === "apontamento-horas" ? (
              <ApontamentoHorasPage
                onAbrirCliente={abrirClienteNoPeriodo}
                onAbrirTecnico={abrirOrdensDoTecnicoNoPeriodo}
              />
            ) : pcmView === "tipos-inspecao" ? (
              <TiposInspecaoPage />
            ) : pcmView === "tipos-tarefa" ? (
              <TiposTarefaPage />
            ) : pcmView === "segmentos" ? (
              <SegmentosPage />
            ) : pcmView === "palavras-chave" ? (
              <PalavrasChavePage />
            ) : pcmView === "equipamento-categorias" ? (
              <EquipamentoCategoriasPage />
            ) : pcmView === "laudos-spda" ? (
              <LaudosSpdaPage />
            ) : pcmView === "pmoc" ? (
              <PmocPage />
            ) : pcmView === "preventivas" ? (
              <PreventivasPage />
            ) : pcmView === "monitor-excecoes-auvo" ? (
              <MonitorExcecoesAuvoPage />
            ) : pcmView === "ordens" || pcmView === "chamados" || pcmView === "backlog" ? (
              // E01-S118: Chamados/Operação/Backlog são o mesmo board (o Chamado evolui pra OS);
              // `view=backlog` (deep-link do Dashboard) abre já na aba Backlog.
              <div className="flex flex-col gap-4">
                {osDeepLink?.origemClienteId && (
                  <button
                    type="button"
                    onClick={voltarAoClienteDoDeepLink}
                    className="self-start inline-flex items-center gap-1.5 text-body font-semibold text-orange hover:text-orange-deep cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                    Voltar ao cliente
                  </button>
                )}
                <OrdensServicoPage
                  refreshKey={pcmRefreshKey}
                  onNovaOs={() => setNovaOsAberta(true)}
                  abaInicial={pcmView === "backlog" ? "backlog" : undefined}
                  osIdInicialToken={
                    osDeepLink ? `${osDeepLink.osId}::${osDeepLink.seq}` : undefined
                  }
                  painelOrcamentoOs={
                    user?.id &&
                    osDeepLink?.origemClienteId &&
                    flagLigada("VITE_SSO_ORCAMENTO_OPERACIONAL_ENABLED")
                      ? (ordemServicoId) =>
                          ordemServicoId === osDeepLink?.osId ? (
                            <OrcamentosDaOs
                              usuario={user?.id ?? ""}
                              cliente={osDeepLink?.origemClienteId ?? ""}
                              ordemServico={ordemServicoId}
                            />
                          ) : null
                      : undefined
                  }
                  filtrosIniciais={
                    ordensFiltrosPreset
                      ? {
                          tecnicoFuncionarioId: ordensFiltrosPreset.tecnicoFuncionarioId,
                          dataInicio: ordensFiltrosPreset.dataInicio,
                          dataFim: ordensFiltrosPreset.dataFim,
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {feedbackOs && (
                  <div className="rounded-md border border-success-line bg-success-soft px-4 py-2 text-body text-success">
                    {feedbackOs}
                  </div>
                )}
                <PcmDashboardPage
                  refreshKey={pcmRefreshKey}
                  podeCriarOs={podeCriarOs}
                  onNovaOs={() => setNovaOsAberta(true)}
                  onVerOrdens={() => irParaPcmView("ordens")}
                  onVerOrdensHoje={abrirOrdensHoje}
                  onVerBacklog={() => irParaPcmView("backlog")}
                  onVerAgenda={() => irParaPcmView("agenda-tecnico")}
                  onVerInspecoes={() => irParaPcmView("inspecoes")}
                  onVerFerramentas={() => irParaPcmView("ferramentas-por-tecnico")}
                  onVerRelatorioDiario={(data) => {
                    setRelatorioDiarioDataInicial(data);
                    irParaPcmView("relatorio-diario");
                  }}
                />
              </div>
            )
          ) : activeModulo === "config" ? (
            configTab === "grupos" ? (
              <GruposPage />
            ) : configTab === "usuarios" ? (
              <UsuariosPage />
            ) : configTab === "capacidades" && user?.papel === "superadmin" ? (
              <CapacidadesWorkspace userId={user.id} />
            ) : configTab === "ia" ? (
              <ConfigIaPage />
            ) : configTab === "gasto-ia" ? (
              <RelatorioGastoIaPage />
            ) : configTab === "priorizacao" ? (
              <ConfigPriorizacaoPage />
            ) : configTab === "localizacao-auvo" ? (
              <ConfigLocalizacaoAuvoPage />
            ) : configTab === "ativacao" &&
              user?.papel === "superadmin" &&
              flagLigada("VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED") ? (
              <AtivacaoJornadasPage userId={user.id} />
            ) : (
              <IntegracoesPage />
            )
          ) : activeModulo === "atendimento" ? (
            atendimentoView === "dashboard" ? (
              <AtendimentoDashboardPage />
            ) : atendimentoView === "inbox" ? (
              <AtendimentoInboxPage conversaIdInicial={conversaDeepLinkId} />
            ) : atendimentoView === "config" ? (
              <AtendimentoConfigPage />
            ) : null
          ) : activeModulo === "financeiro" ? (
            financeiroView === "dashboard" ? (
              <FinanceiroDashboardPage />
            ) : financeiroView === "lancamentos" ? (
              <FinanceiroLancamentosPage />
            ) : financeiroView === "categorias" ? (
              <FinanceiroCategoriasPage />
            ) : financeiroView === "contas" ? (
              <FinanceiroContasPage />
            ) : financeiroView === "contratos" ? (
              <FinanceiroContratosPage />
            ) : financeiroView === "receber" ? (
              <FinanceiroContasReceberPage />
            ) : financeiroView === "ofx" ? (
              <FinanceiroImportOfxPage />
            ) : financeiroView === "pagar" ? (
              <FinanceiroContasPagarPage />
            ) : financeiroView === "rentabilidade" ? (
              <FinanceiroRentabilidadePage />
            ) : financeiroView === "pessoal" ? (
              <FinanceiroCustosPessoalPage />
            ) : financeiroView === "cobranca" ? (
              <FinanceiroCobrancaPage />
            ) : financeiroView === "impostos" ? (
              <FinanceiroImpostosPage />
            ) : financeiroView === "fechamento" ? (
              <FinanceiroFechamentoPage />
            ) : financeiroView === "dre" ? (
              <FinanceiroDrePage />
            ) : financeiroView === "orcamento" ? (
              <FinanceiroOrcamentoPage />
            ) : financeiroView === "cockpit" ? (
              <FinanceiroCockpitPage />
            ) : (
              <FinanceiroMockRouter view={financeiroView} />
            )
          ) : activeModulo === "comercial" ? (
            // Abrir a Conta cai na Visão 360 do PCM — é a mesma Conta (ADR-0020), e a aba
            // Comercial de lá mostra o funil. Nada de reconstruir a 360 dentro do Comercial.
            comercialView === "dashboard" ? (
              <ComercialDashboardPage />
            ) : comercialView === "config-funil" ? (
              <ComercialConfigFunilPage />
            ) : comercialView === "precificacao" ? (
              <ComercialParametrosPrecoPage />
            ) : comercialView === "contratos" ? (
              <ComercialContratosPage />
            ) : comercialView === "funil" ? (
              <ComercialFunilPage
                onAbrirConta={(clienteId) => {
                  navegarModulo("pcm");
                  irParaPcmView("clientes");
                  setClienteSelecionado(clienteId);
                }}
              />
            ) : (
              <ComercialContasPage
                onAbrirConta={(clienteId) => {
                  navegarModulo("pcm");
                  irParaPcmView("clientes");
                  setClienteSelecionado(clienteId);
                }}
              />
            )
          ) : activeModulo === "area-cliente" ? (
            <AreaClienteAdminPage
              onAbrirClientes={() => {
                navegarModulo("pcm");
                irParaPcmView("clientes");
              }}
            />
          ) : activeModulo === "guia" ? (
            <GuiaRouter view={guiaView} />
          ) : modulo ? (
            <EmConstrucao modulo={modulo} />
          ) : null}
        </main>
      </div>
      {podeCriarOs && (
        <NovaOrdemServicoModal
          aberto={novaOsAberta}
          onFechar={() => setNovaOsAberta(false)}
          onCriada={(numero) => {
            setFeedbackOs(`Chamado ${numero} criado em solicitação.`);
            setPcmView("ordens");
            setClienteSelecionado(null);
            setPcmRefreshKey((atual) => atual + 1);
            setTimeout(() => setFeedbackOs(null), 5000);
          }}
        />
      )}
    </div>
  );
}
