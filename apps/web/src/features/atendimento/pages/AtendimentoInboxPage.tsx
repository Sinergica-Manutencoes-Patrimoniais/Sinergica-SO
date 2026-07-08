import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { acionarZeAgora } from "../application/acionar-ze-agora";
import { assumirConversa } from "../application/assumir-conversa";
import { listarWaTemplates } from "../application/canais-externos";
import { devolverAoZe } from "../application/devolver-ao-ze";
import { enviarMensagem } from "../application/enviar-mensagem";
import { atualizarTagsConversa, enviarMensagemRica } from "../application/enviar-mensagem-rica";
import { listarConversas } from "../application/listar-conversas";
import { listarMensagens } from "../application/listar-mensagens";
import { listarTags } from "../application/listar-tags";
import { marcarConversaLida } from "../application/marcar-conversa-lida";
import { ConversaChat } from "../components/ConversaChat";
import { ConversaLista } from "../components/ConversaLista";
import { ConversaPerfil } from "../components/ConversaPerfil";
import type { WaTemplateItem } from "../domain/canais-externos";
import type { ConversaItem } from "../domain/conversas";
import type { MensagemItem } from "../domain/mensagens";
import type { MensagemRicaInput } from "../domain/mensagens";
import type { TagItem } from "../domain/tags";
import { supabaseAtendimentoAdapter } from "../infrastructure/supabase-atendimento-adapter";
import { supabaseCanaisExternosAdapter } from "../infrastructure/supabase-canais-externos-adapter";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";

const INTERVALO_LISTA_MS = 5000;
const INTERVALO_MENSAGENS_MS = 3000;

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; conversas: ConversaItem[] };

export function AtendimentoInboxPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemItem[]>([]);
  const [templates, setTemplates] = useState<WaTemplateItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const abaVisivelRef = useRef(true);

  const temLeitura = podeAcessar("atendimento", "leitura");
  const temEscrita = podeAcessar("atendimento", "escrita");

  const carregarConversas = useCallback(async () => {
    try {
      const conversas = await listarConversas(supabaseAtendimentoAdapter);
      setEstado({ fase: "pronto", conversas });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar conversas.",
      });
    }
  }, []);

  const carregarMensagens = useCallback(async (conversaId: string) => {
    try {
      const lista = await listarMensagens(supabaseAtendimentoAdapter, conversaId);
      setMensagens(lista);
    } catch {
      // Falha ao atualizar mensagens não derruba a tela — mantém o histórico já carregado.
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      abaVisivelRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (permissoesCarregando || !temLeitura) return;
    carregarConversas();
    Promise.all([
      listarWaTemplates(supabaseCanaisExternosAdapter),
      listarTags(supabaseConfigAdapter),
    ])
      .then(([listaTemplates, listaTags]) => {
        setTemplates(listaTemplates);
        setTags(listaTags);
      })
      .catch(() => undefined);
    const intervalo = setInterval(() => {
      if (abaVisivelRef.current) carregarConversas();
    }, INTERVALO_LISTA_MS);
    return () => clearInterval(intervalo);
  }, [permissoesCarregando, temLeitura, carregarConversas]);

  useEffect(() => {
    if (!conversaSelecionadaId) {
      setMensagens([]);
      return;
    }
    carregarMensagens(conversaSelecionadaId);
    const intervalo = setInterval(() => {
      if (abaVisivelRef.current) carregarMensagens(conversaSelecionadaId);
    }, INTERVALO_MENSAGENS_MS);
    return () => clearInterval(intervalo);
  }, [conversaSelecionadaId, carregarMensagens]);

  const conversas = estado.fase === "pronto" ? estado.conversas : [];
  const conversaSelecionada = conversas.find((c) => c.id === conversaSelecionadaId) ?? null;

  async function selecionarConversa(conversa: ConversaItem) {
    setConversaSelecionadaId(conversa.id);
    if (conversa.naoLidas > 0) {
      try {
        await marcarConversaLida(supabaseAtendimentoAdapter, { conversaId: conversa.id });
        await carregarConversas();
      } catch {
        // Não bloqueia a navegação se marcar como lida falhar — próxima rodada de polling corrige.
      }
    }
  }

  async function handleEnviar(texto: string) {
    if (!conversaSelecionada) return;
    await enviarMensagem(supabaseAtendimentoAdapter, { conversaId: conversaSelecionada.id, texto });
    await carregarMensagens(conversaSelecionada.id);
  }

  async function handleEnviarRico(input: MensagemRicaInput) {
    if (!conversaSelecionada) return;
    await enviarMensagemRica(supabaseAtendimentoAdapter, {
      ...input,
      conversaId: conversaSelecionada.id,
      canal: conversaSelecionada.canal,
    });
    await carregarMensagens(conversaSelecionada.id);
  }

  async function handleAtualizarTags(novasTags: string[]) {
    if (!conversaSelecionada) return;
    await atualizarTagsConversa(supabaseAtendimentoAdapter, conversaSelecionada.id, novasTags);
    await carregarConversas();
  }

  async function handleAssumir() {
    if (!conversaSelecionada || !user) return;
    await assumirConversa(supabaseAtendimentoAdapter, {
      conversaId: conversaSelecionada.id,
      userId: user.id,
    });
    await carregarConversas();
  }

  async function handleDevolver() {
    if (!conversaSelecionada) return;
    await devolverAoZe(supabaseAtendimentoAdapter, { conversaId: conversaSelecionada.id });
    await carregarConversas();
  }

  async function handleAcionarIa() {
    if (!conversaSelecionada) return;
    await acionarZeAgora(supabaseAtendimentoAdapter, { conversaId: conversaSelecionada.id });
    await carregarMensagens(conversaSelecionada.id);
  }

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
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

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregarConversas}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-160px)] grid-cols-1 gap-4 xl:grid-cols-[320px_1fr_280px]">
      <ConversaLista
        conversas={conversas}
        conversaSelecionadaId={conversaSelecionadaId}
        onSelecionar={selecionarConversa}
      />
      <ConversaChat
        conversa={conversaSelecionada}
        mensagens={mensagens}
        temEscrita={temEscrita}
        onEnviar={handleEnviar}
        onAssumir={handleAssumir}
        onDevolver={handleDevolver}
        onAcionarIa={handleAcionarIa}
        templates={templates}
        tagsDisponiveis={tags}
        onEnviarRico={handleEnviarRico}
        onAtualizarTags={handleAtualizarTags}
      />
      <ConversaPerfil conversa={conversaSelecionada} />
    </div>
  );
}
