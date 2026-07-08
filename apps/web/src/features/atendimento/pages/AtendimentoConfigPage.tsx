import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { buscarConfigCanal } from "../application/buscar-config-canal";
import type { ClienteOpcao } from "../application/config-gateway";
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
import { listarClientesConfig } from "../application/listar-clientes-config";
import { listarFluxos } from "../application/listar-fluxos";
import { listarInstanciasAgente } from "../application/listar-instancias-agente";
import { listarPersonas } from "../application/listar-personas";
import { listarTags } from "../application/listar-tags";
import { salvarConfigCanal } from "../application/salvar-config-canal";
import { salvarPassosFluxo } from "../application/salvar-passos-fluxo";
import { ConfigCanalForm } from "../components/ConfigCanalForm";
import { FluxosManager } from "../components/FluxosManager";
import { InstanciasAgenteList } from "../components/InstanciasAgenteList";
import { PersonasList } from "../components/PersonasList";
import { TagsList } from "../components/TagsList";
import type { ConfigCanalItem, ModoZe } from "../domain/config-canal";
import type { FluxoItem, PassoFluxo } from "../domain/fluxos";
import type { InstanciaAgenteItem } from "../domain/instancias-agente";
import type { PersonaFormData, PersonaItem } from "../domain/personas";
import type { TagItem } from "../domain/tags";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";
import { supabaseFluxoAdapter } from "../infrastructure/supabase-fluxo-adapter";

type Aba = "canal" | "tags" | "personas" | "agentes" | "fluxos";

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
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const temLeitura = podeAcessar("atendimento", "leitura");
  const temEscrita = podeAcessar("atendimento", "escrita");

  const carregarBase = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaClientes, listaTags, listaPersonas, listaInstancias, listaFluxos] =
        await Promise.all([
          listarClientesConfig(supabaseConfigAdapter),
          listarTags(supabaseConfigAdapter),
          listarPersonas(supabaseConfigAdapter),
          listarInstanciasAgente(supabaseConfigAdapter),
          listarFluxos(supabaseFluxoAdapter),
        ]);
      setClientes(listaClientes);
      setTags(listaTags);
      setPersonas(listaPersonas);
      setInstanciasAgente(listaInstancias);
      setFluxos(listaFluxos);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar a config.");
    } finally {
      setCarregando(false);
    }
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

  async function handleCriarFluxo(nome: string, personaId: string) {
    if (!user) return;
    await criarFluxo(supabaseFluxoAdapter, { nome, personaId, userId: user.id });
    await carregarBase();
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
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b border-line">
        <button
          type="button"
          onClick={() => setAba("canal")}
          className={`px-4 py-2 text-sm font-semibold ${
            aba === "canal" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Canal
        </button>
        <button
          type="button"
          onClick={() => setAba("tags")}
          className={`px-4 py-2 text-sm font-semibold ${
            aba === "tags" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Tags
        </button>
        <button
          type="button"
          onClick={() => setAba("personas")}
          className={`px-4 py-2 text-sm font-semibold ${
            aba === "personas" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Personas
        </button>
        <button
          type="button"
          onClick={() => setAba("agentes")}
          className={`px-4 py-2 text-sm font-semibold ${
            aba === "agentes" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Agentes
        </button>
        <button
          type="button"
          onClick={() => setAba("fluxos")}
          className={`px-4 py-2 text-sm font-semibold ${
            aba === "fluxos" ? "border-b-2 border-orange text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          Fluxos
        </button>
      </div>

      {aba === "canal" ? (
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
        />
      )}
    </div>
  );
}
