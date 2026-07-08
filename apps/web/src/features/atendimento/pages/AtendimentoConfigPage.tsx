import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { buscarConfigCanal } from "../application/buscar-config-canal";
import type { ClienteOpcao } from "../application/config-gateway";
import { criarTag } from "../application/criar-tag";
import { desativarTag } from "../application/desativar-tag";
import { editarTag } from "../application/editar-tag";
import { listarClientesConfig } from "../application/listar-clientes-config";
import { listarTags } from "../application/listar-tags";
import { salvarConfigCanal } from "../application/salvar-config-canal";
import { ConfigCanalForm } from "../components/ConfigCanalForm";
import { TagsList } from "../components/TagsList";
import type { ConfigCanalItem, ModoZe } from "../domain/config-canal";
import type { TagItem } from "../domain/tags";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";

type Aba = "canal" | "tags";

export function AtendimentoConfigPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [aba, setAba] = useState<Aba>("canal");
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const [configAtual, setConfigAtual] = useState<ConfigCanalItem | null>(null);
  const [carregandoConfig, setCarregandoConfig] = useState(false);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const temLeitura = podeAcessar("atendimento", "leitura");
  const temEscrita = podeAcessar("atendimento", "escrita");

  const carregarBase = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaClientes, listaTags] = await Promise.all([
        listarClientesConfig(supabaseConfigAdapter),
        listarTags(supabaseConfigAdapter),
      ]);
      setClientes(listaClientes);
      setTags(listaTags);
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
      ) : (
        <TagsList
          tags={tags}
          temEscrita={temEscrita}
          onCriar={handleCriarTag}
          onEditar={handleEditarTag}
          onDesativar={handleDesativarTag}
        />
      )}
    </div>
  );
}
