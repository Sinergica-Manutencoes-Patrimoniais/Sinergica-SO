import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarIgAutomation,
  criarOptOut,
  desativarIgAutomation,
  listarIgAutomations,
  listarOptOuts,
  removerOptOut,
} from "../application/automacao";
import { buscarConfigCanal } from "../application/buscar-config-canal";
import {
  criarCanalExterno,
  criarWaTemplate,
  desativarCanalExterno,
  editarWaTemplate,
  listarCanaisExternos,
  listarWaTemplates,
} from "../application/canais-externos";
import type { ClienteOpcao } from "../application/config-gateway";
import {
  criarConhecimentoEntrada,
  desativarConhecimentoEntrada,
  editarConhecimentoEntrada,
  listarConhecimentoEntradas,
} from "../application/conhecimento";
import { criarFluxo } from "../application/criar-fluxo";
import { criarInstanciaAgente } from "../application/criar-instancia-agente";
import { criarPersona } from "../application/criar-persona";
import { criarTag } from "../application/criar-tag";
import { desativarFluxo } from "../application/desativar-fluxo";
import { desativarInstanciaAgente } from "../application/desativar-instancia-agente";
import { desativarPersona } from "../application/desativar-persona";
import { desativarTag } from "../application/desativar-tag";
import { editarPersona } from "../application/editar-persona";
import { editarTag } from "../application/editar-tag";
import {
  conectarEvolution,
  criarEvolution,
  desconectarEvolution,
  listarEvolution,
  sincronizarWebhookEvolution,
} from "../application/evolution";
import {
  criarFluxoDeRecipe,
  listarFluxoLogs,
  listarFluxoRecipes,
} from "../application/fluxos-avancados";
import { listarClientesConfig } from "../application/listar-clientes-config";
import { listarFluxos } from "../application/listar-fluxos";
import { listarInstanciasAgente } from "../application/listar-instancias-agente";
import { listarPersonas } from "../application/listar-personas";
import { listarTags } from "../application/listar-tags";
import {
  criarEspecialista,
  desativarEspecialista,
  listarEspecialistas,
} from "../application/persona-especialistas";
import { criarLicao, desativarLicao, listarLicoes } from "../application/persona-licoes";
import { salvarConfigCanal } from "../application/salvar-config-canal";
import { salvarConfigIa } from "../application/salvar-config-ia";
import { salvarConfigOperacao } from "../application/salvar-config-operacao";
import { salvarPassosFluxo } from "../application/salvar-passos-fluxo";
import {
  buscarLeadScoringConfig,
  criarClusterRegra,
  desativarClusterRegra,
  listarClusterRegras,
  salvarLeadScoringConfig,
} from "../application/scoring-clusters";
import { CanalExternoTab } from "../components/CanalExternoTab";
import { ClustersTab } from "../components/ClustersTab";
import { ConfigCanalForm } from "../components/ConfigCanalForm";
import { ConfigIaForm } from "../components/ConfigIaForm";
import { ConhecimentoList } from "../components/ConhecimentoList";
import { EvolutionTab } from "../components/EvolutionTab";
import { FluxosManager } from "../components/FluxosManager";
import { IgCommentAutomationsTab } from "../components/IgCommentAutomationsTab";
import { InstanciasAgenteList } from "../components/InstanciasAgenteList";
import { OperacaoTab } from "../components/OperacaoTab";
import { OptOutsTab } from "../components/OptOutsTab";
import { PersonasList } from "../components/PersonasList";
import { ScoringTab } from "../components/ScoringTab";
import { TagsList } from "../components/TagsList";
import { WaTemplatesTab } from "../components/WaTemplatesTab";
import type {
  IgAutomationFormData,
  IgAutomationItem,
  OptOutFormData,
  OptOutItem,
} from "../domain/automacao";
import type {
  CanalExternoFormData,
  CanalExternoItem,
  WaTemplateFormData,
  WaTemplateItem,
} from "../domain/canais-externos";
import type { ConfigCanalItem, ModoZe } from "../domain/config-canal";
import type { ConhecimentoEntradaFormData, ConhecimentoEntradaItem } from "../domain/conhecimento";
import type {
  EvolutionAcaoResultado,
  EvolutionCriarForm,
  EvolutionInstancia,
} from "../domain/evolution";
import type { FluxoItem, FluxoLog, FluxoRecipe, PassoFluxo } from "../domain/fluxos";
import type { InstanciaAgenteItem } from "../domain/instancias-agente";
import type { EspecialistaItem, LicaoItem } from "../domain/operacao";
import type { ConfigIaFormData, PersonaFormData, PersonaItem } from "../domain/personas";
import type {
  ClusterRegraFormData,
  ClusterRegraItem,
  LeadScoringConfigFormData,
  LeadScoringConfigItem,
} from "../domain/scoring-clusters";
import type { TagItem } from "../domain/tags";
import { supabaseAutomacaoAdapter } from "../infrastructure/supabase-automacao-adapter";
import { supabaseCanaisExternosAdapter } from "../infrastructure/supabase-canais-externos-adapter";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";
import { supabaseConhecimentoAdapter } from "../infrastructure/supabase-conhecimento-adapter";
import { supabaseEvolutionAdapter } from "../infrastructure/supabase-evolution-adapter";
import { supabaseFluxoAdapter } from "../infrastructure/supabase-fluxo-adapter";
import { supabaseOperacaoAdapter } from "../infrastructure/supabase-operacao-adapter";
import { supabaseScoringClustersAdapter } from "../infrastructure/supabase-scoring-clusters-adapter";

type Aba =
  | "ia"
  | "operacao"
  | "conhecimento"
  | "meta-wa"
  | "wa-templates"
  | "instagram"
  | "messenger"
  | "ig-comments"
  | "optouts"
  | "scoring"
  | "clusters"
  | "evolution"
  | "canal"
  | "tags"
  | "personas"
  | "agentes"
  | "fluxos";

export function AtendimentoConfigPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [aba, setAba] = useState<Aba>("canal");
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const [configAtual, setConfigAtual] = useState<ConfigCanalItem | null>(null);
  const [carregandoConfig, setCarregandoConfig] = useState(false);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [instanciasAgente, setInstanciasAgente] = useState<InstanciaAgenteItem[]>([]);
  const [fluxos, setFluxos] = useState<FluxoItem[]>([]);
  const [fluxoRecipes, setFluxoRecipes] = useState<FluxoRecipe[]>([]);
  const [fluxoLogs, setFluxoLogs] = useState<FluxoLog[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [personaOperacaoId, setPersonaOperacaoId] = useState<string | null>(null);
  const [licoes, setLicoes] = useState<LicaoItem[]>([]);
  const [especialistas, setEspecialistas] = useState<EspecialistaItem[]>([]);
  const [conhecimentoEntradas, setConhecimentoEntradas] = useState<ConhecimentoEntradaItem[]>([]);
  const [canaisMetaWa, setCanaisMetaWa] = useState<CanalExternoItem[]>([]);
  const [canaisInstagram, setCanaisInstagram] = useState<CanalExternoItem[]>([]);
  const [canaisMessenger, setCanaisMessenger] = useState<CanalExternoItem[]>([]);
  const [waTemplates, setWaTemplates] = useState<WaTemplateItem[]>([]);
  const [igAutomations, setIgAutomations] = useState<IgAutomationItem[]>([]);
  const [optOuts, setOptOuts] = useState<OptOutItem[]>([]);
  const [scoringConfig, setScoringConfig] = useState<LeadScoringConfigItem | null>(null);
  const [clusters, setClusters] = useState<ClusterRegraItem[]>([]);
  const [evolutionInstancias, setEvolutionInstancias] = useState<EvolutionInstancia[]>([]);

  const temLeitura = podeAcessar("atendimento", "leitura");
  const temEscrita = podeAcessar("atendimento", "escrita");

  const carregarBase = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    // Promise.allSettled (não Promise.all): uma integração externa lenta/fora do ar (ex.: Evolution)
    // não pode derrubar as outras 16 abas — cada seção usa o que carregou e ignora só a sua falha.
    // Achado durante teste manual (E00-S11/rodada de verificação): antes disso, listarEvolution
    // sozinho falhando (CORS local, ou Evolution real fora do ar) travava a página inteira.
    const [
      clientesR,
      tagsR,
      personasR,
      instanciasR,
      fluxosR,
      conhecimentoR,
      metaWaR,
      instagramR,
      messengerR,
      templatesR,
      igAutomationsR,
      optOutsR,
      scoringR,
      clustersR,
      evolutionR,
      recipesR,
    ] = await Promise.allSettled([
      listarClientesConfig(supabaseConfigAdapter),
      listarTags(supabaseConfigAdapter),
      listarPersonas(supabaseConfigAdapter),
      listarInstanciasAgente(supabaseConfigAdapter),
      listarFluxos(supabaseFluxoAdapter),
      listarConhecimentoEntradas(supabaseConhecimentoAdapter),
      listarCanaisExternos(supabaseCanaisExternosAdapter, "meta_wa"),
      listarCanaisExternos(supabaseCanaisExternosAdapter, "instagram"),
      listarCanaisExternos(supabaseCanaisExternosAdapter, "messenger"),
      listarWaTemplates(supabaseCanaisExternosAdapter),
      listarIgAutomations(supabaseAutomacaoAdapter),
      listarOptOuts(supabaseAutomacaoAdapter),
      buscarLeadScoringConfig(supabaseScoringClustersAdapter),
      listarClusterRegras(supabaseScoringClustersAdapter),
      listarEvolution(supabaseEvolutionAdapter),
      listarFluxoRecipes(supabaseFluxoAdapter),
    ]);

    if (clientesR.status === "fulfilled") setClientes(clientesR.value);
    if (tagsR.status === "fulfilled") setTags(tagsR.value);
    if (personasR.status === "fulfilled") setPersonas(personasR.value);
    if (instanciasR.status === "fulfilled") setInstanciasAgente(instanciasR.value);
    if (fluxosR.status === "fulfilled") setFluxos(fluxosR.value);
    if (conhecimentoR.status === "fulfilled") setConhecimentoEntradas(conhecimentoR.value);
    if (metaWaR.status === "fulfilled") setCanaisMetaWa(metaWaR.value);
    if (instagramR.status === "fulfilled") setCanaisInstagram(instagramR.value);
    if (messengerR.status === "fulfilled") setCanaisMessenger(messengerR.value);
    if (templatesR.status === "fulfilled") setWaTemplates(templatesR.value);
    if (igAutomationsR.status === "fulfilled") setIgAutomations(igAutomationsR.value);
    if (optOutsR.status === "fulfilled") setOptOuts(optOutsR.value);
    if (scoringR.status === "fulfilled") setScoringConfig(scoringR.value);
    if (clustersR.status === "fulfilled") setClusters(clustersR.value);
    if (evolutionR.status === "fulfilled") setEvolutionInstancias(evolutionR.value);
    if (recipesR.status === "fulfilled") setFluxoRecipes(recipesR.value);

    const falhas = [
      clientesR,
      tagsR,
      personasR,
      instanciasR,
      fluxosR,
      conhecimentoR,
      metaWaR,
      instagramR,
      messengerR,
      templatesR,
      igAutomationsR,
      optOutsR,
      scoringR,
      clustersR,
      evolutionR,
      recipesR,
    ].filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (falhas.length > 0) {
      console.error(
        "Falha ao carregar parte da config de Atendimento (seções afetadas mostram vazio, resto continua usável):",
        falhas.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))),
      );
    }
    // Só bloqueia a página inteira se TODAS as seções falharem (ex.: sem permissão/rede fora) —
    // uma falha isolada (ex.: só Evolution) não deve impedir editar Tags/Personas/Scoring/etc.
    if (falhas.length === 16) {
      setErro("Não foi possível carregar a config.");
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregarBase();
  }, [permissoesCarregando, temLeitura, carregarBase]);

  useEffect(() => {
    if (!clienteSelecionadoId) {
      setConfigAtual(null);
      return;
    }
    setCarregandoConfig(true);
    buscarConfigCanal(supabaseConfigAdapter, clienteSelecionadoId)
      .then(setConfigAtual)
      .finally(() => setCarregandoConfig(false));
  }, [clienteSelecionadoId]);

  async function handleSalvarConfigCanal(form: { modo: ModoZe; groupJid: string; botJid: string }) {
    if (!user || !clienteSelecionadoId) return;
    const salvo = await salvarConfigCanal(supabaseConfigAdapter, {
      clientId: clienteSelecionadoId,
      modo: form.modo,
      groupJid: form.groupJid,
      botJid: form.botJid,
      userId: user.id,
    });
    setConfigAtual(salvo);
  }

  async function handleCriarTag(nome: string) {
    if (!user) return;
    await criarTag(supabaseConfigAdapter, { nome, userId: user.id });
    await carregarBase();
  }

  async function handleEditarTag(id: string, nome: string) {
    if (!user) return;
    await editarTag(supabaseConfigAdapter, { id, nome, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarTag(id: string) {
    if (!user) return;
    await desativarTag(supabaseConfigAdapter, { id, userId: user.id });
    await carregarBase();
  }

  async function handleCriarPersona(form: PersonaFormData) {
    if (!user) return;
    await criarPersona(supabaseConfigAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleEditarPersona(id: string, form: PersonaFormData) {
    if (!user) return;
    await editarPersona(supabaseConfigAdapter, { ...form, id, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarPersona(id: string) {
    if (!user) return;
    await desativarPersona(supabaseConfigAdapter, { id, userId: user.id });
    await carregarBase();
  }

  async function handleCriarInstanciaAgente(instanceId: string, personaId: string) {
    if (!user) return;
    await criarInstanciaAgente(supabaseConfigAdapter, { instanceId, personaId, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarInstanciaAgente(id: string) {
    if (!user) return;
    await desativarInstanciaAgente(supabaseConfigAdapter, { id, userId: user.id });
    await carregarBase();
  }

  async function handleSalvarConfigIa(personaId: string, form: ConfigIaFormData) {
    if (!user) return;
    await salvarConfigIa(supabaseConfigAdapter, { ...form, personaId, userId: user.id });
    await carregarBase();
  }

  async function carregarOperacao(personaId: string) {
    setPersonaOperacaoId(personaId);
    const [listaLicoes, listaEspecialistas] = await Promise.all([
      listarLicoes(supabaseOperacaoAdapter, personaId),
      listarEspecialistas(supabaseOperacaoAdapter, personaId),
    ]);
    setLicoes(listaLicoes);
    setEspecialistas(listaEspecialistas);
  }

  async function handleSalvarConfigOperacao(
    personaId: string,
    form: {
      toolUseEnabled: boolean;
      ragEnabled: boolean;
      vendasEnabled: boolean;
      consultaPedidosEnabled: boolean;
      limiteDiarioMensagens: string;
      transferirAposNRespostas: string;
      palavrasTransferencia: string[];
      orcamentoMensalUsd: string;
    },
  ) {
    if (!user) return;
    await salvarConfigOperacao(supabaseConfigAdapter, { ...form, personaId, userId: user.id });
    await carregarBase();
  }

  async function handleCriarLicao(
    personaId: string,
    contexto: string,
    respostaErrada: string,
    respostaCerta: string,
  ) {
    if (!user) return;
    await criarLicao(supabaseOperacaoAdapter, {
      personaId,
      contexto,
      respostaErrada,
      respostaCerta,
      userId: user.id,
    });
    await carregarOperacao(personaId);
  }

  async function handleDesativarLicao(id: string) {
    await desativarLicao(supabaseOperacaoAdapter, id);
    if (personaOperacaoId) await carregarOperacao(personaOperacaoId);
  }

  async function handleCriarEspecialista(personaId: string, nome: string, quandoChamar: string) {
    if (!user) return;
    await criarEspecialista(supabaseOperacaoAdapter, {
      personaId,
      nome,
      quandoChamar,
      userId: user.id,
    });
    await carregarOperacao(personaId);
  }

  async function handleDesativarEspecialista(id: string) {
    await desativarEspecialista(supabaseOperacaoAdapter, id);
    if (personaOperacaoId) await carregarOperacao(personaOperacaoId);
  }

  async function handleCriarConhecimento(form: ConhecimentoEntradaFormData) {
    if (!user) return;
    await criarConhecimentoEntrada(supabaseConhecimentoAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleEditarConhecimento(id: string, form: ConhecimentoEntradaFormData) {
    if (!user) return;
    await editarConhecimentoEntrada(supabaseConhecimentoAdapter, { ...form, id, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarConhecimento(id: string) {
    await desativarConhecimentoEntrada(supabaseConhecimentoAdapter, id);
    await carregarBase();
  }

  async function handleCriarCanalExterno(form: CanalExternoFormData) {
    if (!user) return;
    await criarCanalExterno(supabaseCanaisExternosAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarCanalExterno(id: string) {
    await desativarCanalExterno(supabaseCanaisExternosAdapter, id);
    await carregarBase();
  }

  async function handleCriarWaTemplate(form: WaTemplateFormData) {
    if (!user) return;
    await criarWaTemplate(supabaseCanaisExternosAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleEditarWaTemplate(id: string, form: WaTemplateFormData) {
    if (!user) return;
    await editarWaTemplate(supabaseCanaisExternosAdapter, { ...form, id, userId: user.id });
    await carregarBase();
  }

  async function handleCriarIgAutomation(form: IgAutomationFormData) {
    if (!user) return;
    await criarIgAutomation(supabaseAutomacaoAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarIgAutomation(id: string) {
    await desativarIgAutomation(supabaseAutomacaoAdapter, id);
    await carregarBase();
  }

  async function handleRemoverOptOut(id: string) {
    await removerOptOut(supabaseAutomacaoAdapter, id);
    await carregarBase();
  }

  async function handleCriarOptOut(form: OptOutFormData) {
    if (!user) return;
    await criarOptOut(supabaseAutomacaoAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleSalvarScoringConfig(form: LeadScoringConfigFormData) {
    if (!user || !scoringConfig) return;
    const salvo = await salvarLeadScoringConfig(supabaseScoringClustersAdapter, {
      ...form,
      id: scoringConfig.id,
      userId: user.id,
    });
    setScoringConfig(salvo);
  }

  async function handleCriarCluster(form: ClusterRegraFormData) {
    if (!user) return;
    await criarClusterRegra(supabaseScoringClustersAdapter, { ...form, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarCluster(id: string) {
    await desativarClusterRegra(supabaseScoringClustersAdapter, id);
    await carregarBase();
  }

  async function atualizarEvolution() {
    setEvolutionInstancias(await listarEvolution(supabaseEvolutionAdapter));
  }

  async function handleCriarEvolution(form: EvolutionCriarForm): Promise<EvolutionAcaoResultado> {
    if (!user) throw new Error("Sessão expirada.");
    const resultado = await criarEvolution(supabaseEvolutionAdapter, {
      ...form,
      userId: user.id,
    });
    await atualizarEvolution();
    return resultado;
  }

  async function handleConectarEvolution(id: string): Promise<EvolutionAcaoResultado> {
    const resultado = await conectarEvolution(supabaseEvolutionAdapter, id);
    await atualizarEvolution();
    return resultado;
  }

  async function handleDesconectarEvolution(id: string) {
    await desconectarEvolution(supabaseEvolutionAdapter, id);
    await atualizarEvolution();
  }

  async function handleSincronizarWebhookEvolution(id: string) {
    await sincronizarWebhookEvolution(supabaseEvolutionAdapter, id);
    await atualizarEvolution();
  }

  async function handleCriarFluxo(nome: string, personaId: string) {
    if (!user) return;
    await criarFluxo(supabaseFluxoAdapter, { nome, personaId, userId: user.id });
    await carregarBase();
  }

  async function handleCriarFluxoDeRecipe(recipeId: string, nome: string, personaId: string) {
    if (!user) return;
    await criarFluxoDeRecipe(supabaseFluxoAdapter, { recipeId, nome, personaId, userId: user.id });
    await carregarBase();
  }

  async function handleCarregarFluxoLogs(fluxoId: string) {
    setFluxoLogs(await listarFluxoLogs(supabaseFluxoAdapter, fluxoId));
  }

  async function handleSalvarPassosFluxo(fluxoId: string, passos: PassoFluxo[]) {
    if (!user) return;
    await salvarPassosFluxo(supabaseFluxoAdapter, { fluxoId, passos, userId: user.id });
    await carregarBase();
  }

  async function handleDesativarFluxo(id: string) {
    if (!user) return;
    await desativarFluxo(supabaseFluxoAdapter, { id, userId: user.id });
    await carregarBase();
  }

  if (permissoesCarregando || carregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Atendimento.
        </p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{erro}</p>
        <button
          type="button"
          onClick={carregarBase}
          className="mt-4 text-sm font-semibold text-orange"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-[8px] border border-line bg-card px-1.5 pt-1.5 shadow-[0_1px_2px_rgba(20,28,54,0.03)]">
        <button
          type="button"
          onClick={() => setAba("ia")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "ia" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          IA
        </button>
        <button
          type="button"
          onClick={() => setAba("operacao")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "operacao" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Operação
        </button>
        <button
          type="button"
          onClick={() => setAba("conhecimento")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "conhecimento"
              ? "border-b-2 border-orange text-ink"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Conhecimento
        </button>
        <button
          type="button"
          onClick={() => setAba("meta-wa")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "meta-wa" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Meta WA
        </button>
        <button
          type="button"
          onClick={() => setAba("wa-templates")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "wa-templates"
              ? "border-b-2 border-orange text-ink"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Templates
        </button>
        <button
          type="button"
          onClick={() => setAba("instagram")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "instagram"
              ? "border-b-2 border-orange text-ink"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Instagram
        </button>
        <button
          type="button"
          onClick={() => setAba("messenger")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "messenger"
              ? "border-b-2 border-orange text-ink"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Messenger
        </button>
        <button
          type="button"
          onClick={() => setAba("ig-comments")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "ig-comments"
              ? "border-b-2 border-orange text-ink"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Coment. IG
        </button>
        <button
          type="button"
          onClick={() => setAba("optouts")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "optouts" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Opt-outs
        </button>
        <button
          type="button"
          onClick={() => setAba("scoring")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "scoring" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Scoring
        </button>
        <button
          type="button"
          onClick={() => setAba("clusters")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "clusters" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Clusters
        </button>
        <button
          type="button"
          onClick={() => setAba("evolution")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "evolution"
              ? "border-b-2 border-orange text-ink"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Evolution
        </button>
        <button
          type="button"
          onClick={() => setAba("canal")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "canal" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Canal
        </button>
        <button
          type="button"
          onClick={() => setAba("tags")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "tags" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Tags
        </button>
        <button
          type="button"
          onClick={() => setAba("personas")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "personas" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Personas
        </button>
        <button
          type="button"
          onClick={() => setAba("agentes")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "agentes" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Agentes
        </button>
        <button
          type="button"
          onClick={() => setAba("fluxos")}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
            aba === "fluxos" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Fluxos
        </button>
      </div>

      {aba === "ia" ? (
        <ConfigIaForm
          personas={personas}
          temEscrita={temEscrita}
          onSalvar={handleSalvarConfigIa}
          onSalvarIdentidade={handleEditarPersona}
        />
      ) : aba === "operacao" ? (
        <OperacaoTab
          personas={personas}
          temEscrita={temEscrita}
          licoes={licoes}
          especialistas={especialistas}
          onSelecionarPersona={carregarOperacao}
          onSalvar={handleSalvarConfigOperacao}
          onCriarLicao={handleCriarLicao}
          onDesativarLicao={handleDesativarLicao}
          onCriarEspecialista={handleCriarEspecialista}
          onDesativarEspecialista={handleDesativarEspecialista}
        />
      ) : aba === "conhecimento" ? (
        <ConhecimentoList
          entradas={conhecimentoEntradas}
          personas={personas}
          temEscrita={temEscrita}
          onCriar={handleCriarConhecimento}
          onEditar={handleEditarConhecimento}
          onDesativar={handleDesativarConhecimento}
        />
      ) : aba === "meta-wa" ? (
        <CanalExternoTab
          tipo="meta_wa"
          titulo="Meta WA"
          canais={canaisMetaWa}
          temEscrita={temEscrita}
          onCriar={handleCriarCanalExterno}
          onDesativar={handleDesativarCanalExterno}
        />
      ) : aba === "wa-templates" ? (
        <WaTemplatesTab
          templates={waTemplates}
          canaisWa={canaisMetaWa}
          temEscrita={temEscrita}
          onCriar={handleCriarWaTemplate}
          onEditar={handleEditarWaTemplate}
        />
      ) : aba === "instagram" ? (
        <CanalExternoTab
          tipo="instagram"
          titulo="Instagram"
          canais={canaisInstagram}
          temEscrita={temEscrita}
          onCriar={handleCriarCanalExterno}
          onDesativar={handleDesativarCanalExterno}
        />
      ) : aba === "messenger" ? (
        <CanalExternoTab
          tipo="messenger"
          titulo="Messenger"
          canais={canaisMessenger}
          temEscrita={temEscrita}
          onCriar={handleCriarCanalExterno}
          onDesativar={handleDesativarCanalExterno}
        />
      ) : aba === "ig-comments" ? (
        <IgCommentAutomationsTab
          automacoes={igAutomations}
          canaisInstagram={canaisInstagram}
          temEscrita={temEscrita}
          onCriar={handleCriarIgAutomation}
          onDesativar={handleDesativarIgAutomation}
        />
      ) : aba === "optouts" ? (
        <OptOutsTab
          optOuts={optOuts}
          temEscrita={temEscrita}
          onRemover={handleRemoverOptOut}
          onCriar={handleCriarOptOut}
        />
      ) : aba === "scoring" ? (
        <ScoringTab
          config={scoringConfig}
          temEscrita={temEscrita}
          onSalvar={handleSalvarScoringConfig}
        />
      ) : aba === "clusters" ? (
        <ClustersTab
          clusters={clusters}
          temEscrita={temEscrita}
          onCriar={handleCriarCluster}
          onDesativar={handleDesativarCluster}
        />
      ) : aba === "evolution" ? (
        <EvolutionTab
          instancias={evolutionInstancias}
          temEscrita={temEscrita}
          onAtualizar={atualizarEvolution}
          onCriar={handleCriarEvolution}
          onConectar={handleConectarEvolution}
          onSincronizarWebhook={handleSincronizarWebhookEvolution}
          onDesconectar={handleDesconectarEvolution}
        />
      ) : aba === "canal" ? (
        <ConfigCanalForm
          clientes={clientes}
          clienteSelecionadoId={clienteSelecionadoId}
          onSelecionarCliente={(clientId) => setClienteSelecionadoId(clientId || null)}
          configAtual={configAtual}
          carregandoConfig={carregandoConfig}
          temEscrita={temEscrita}
          onSalvar={handleSalvarConfigCanal}
        />
      ) : aba === "tags" ? (
        <TagsList
          tags={tags}
          temEscrita={temEscrita}
          onCriar={handleCriarTag}
          onEditar={handleEditarTag}
          onDesativar={handleDesativarTag}
        />
      ) : aba === "personas" ? (
        <PersonasList
          personas={personas}
          temEscrita={temEscrita}
          onCriar={handleCriarPersona}
          onEditar={handleEditarPersona}
          onDesativar={handleDesativarPersona}
        />
      ) : aba === "agentes" ? (
        <InstanciasAgenteList
          instancias={instanciasAgente}
          personas={personas}
          temEscrita={temEscrita}
          onCriar={handleCriarInstanciaAgente}
          onDesativar={handleDesativarInstanciaAgente}
        />
      ) : (
        <FluxosManager
          fluxos={fluxos}
          personas={personas}
          temEscrita={temEscrita}
          onCriar={handleCriarFluxo}
          onSalvarPassos={handleSalvarPassosFluxo}
          onDesativar={handleDesativarFluxo}
          recipes={fluxoRecipes}
          logs={fluxoLogs}
          onCriarDeRecipe={handleCriarFluxoDeRecipe}
          onCarregarLogs={handleCarregarFluxoLogs}
        />
      )}
    </div>
  );
}
