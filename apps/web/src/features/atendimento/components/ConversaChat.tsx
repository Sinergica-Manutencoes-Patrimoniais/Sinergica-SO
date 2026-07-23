import { Bot, History, MessageCircle, RefreshCw, Send, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { WaTemplateItem } from "../domain/canais-externos";
import { canalSuportaIa, labelCanal } from "../domain/conversas";
import type { ConversaItem } from "../domain/conversas";
import type { MensagemItem } from "../domain/mensagens";
import type { MensagemRicaInput } from "../domain/mensagens";
import type { TagItem } from "../domain/tags";
import { MensagemBubble } from "./MensagemBubble";
import { RichComposer } from "./RichComposer";

export function ConversaChat({
  conversa,
  mensagens,
  temEscrita,
  onEnviar,
  onAssumir,
  onDevolver,
  onAcionarIa,
  templates,
  tagsDisponiveis,
  onEnviarRico,
  onAtualizarTags,
  onEnviarHistorico,
}: {
  conversa: ConversaItem | null;
  mensagens: MensagemItem[];
  temEscrita: boolean;
  onEnviar: (texto: string) => Promise<void>;
  onAssumir: () => Promise<void>;
  onDevolver: () => Promise<void>;
  onAcionarIa: () => Promise<void>;
  templates: WaTemplateItem[];
  tagsDisponiveis: TagItem[];
  onEnviarRico: (input: MensagemRicaInput) => Promise<void>;
  onAtualizarTags: (tags: string[]) => Promise<void>;
  onEnviarHistorico?: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [acao, setAcao] = useState<"assumir" | "devolver" | "ia" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mensagens.length > 0) fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  if (!conversa) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[8px] border border-line bg-card text-ink-3">
        <MessageCircle className="h-8 w-8" />
        <p className="mt-2 text-sm">Selecione uma conversa para ver o histórico.</p>
      </div>
    );
  }

  const suportaIa = canalSuportaIa(conversa.canal);

  async function enviar() {
    if (!texto.trim()) return;
    try {
      setEnviando(true);
      setErro(null);
      await onEnviar(texto);
      setTexto("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  async function executarAcao(tipo: "assumir" | "devolver" | "ia", fn: () => Promise<void>) {
    try {
      setAcao(tipo);
      setErro(null);
      await fn();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setAcao(null);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-[8px] border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {conversa.clienteNome ?? conversa.contatoNome ?? "Contato sem nome"}
          </p>
          <p className="text-xs text-ink-3">
            {!suportaIa
              ? `${labelCanal(conversa.canal)} · atendimento humano`
              : conversa.modo === "pausado"
                ? "Atendimento assumido — Zé pausado nesta conversa"
                : "Agente Zé ativo"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-line-soft px-2 py-0.5 text-[10px] font-semibold text-ink-2">
              {labelCanal(conversa.canal)}
            </span>
            {conversa.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                disabled={!temEscrita}
                onClick={() => onAtualizarTags(conversa.tags.filter((item) => item !== tag))}
                className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] text-ink-2"
                title="Remover tag"
              >
                {tag} ×
              </button>
            ))}
            {temEscrita && (
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value)
                    void onAtualizarTags([...conversa.tags, event.target.value]);
                }}
                className="rounded border border-line bg-card text-[10px]"
              >
                <option value="">+ tag</option>
                {tagsDisponiveis
                  .filter((tag) => tag.ativo && !conversa.tags.includes(tag.nome))
                  .map((tag) => (
                    <option key={tag.id} value={tag.nome}>
                      {tag.nome}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
        {temEscrita && (
          <div className="flex shrink-0 gap-2">
            {!suportaIa ? (
              <span className="inline-flex h-8 items-center rounded-[6px] border border-line bg-line-soft px-2.5 text-xs font-semibold text-ink-3">
                IA indisponível
              </span>
            ) : conversa.modo === "auto" ? (
              <button
                type="button"
                disabled={acao !== null}
                onClick={() => executarAcao("assumir", onAssumir)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Assumir
              </button>
            ) : (
              <button
                type="button"
                disabled={acao !== null}
                onClick={() => executarAcao("devolver", onDevolver)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
              >
                <Bot className="h-3.5 w-3.5" />
                Devolver ao Zé
              </button>
            )}
            {suportaIa && (
              <button
                type="button"
                disabled={acao !== null}
                onClick={() => executarAcao("ia", onAcionarIa)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Responder com IA agora
              </button>
            )}
            {onEnviarHistorico && (
              <button
                type="button"
                disabled={acao !== null}
                onClick={onEnviarHistorico}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
              >
                <History className="h-3.5 w-3.5" />
                Enviar histórico
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {mensagens.length === 0 ? (
          <p className="text-center text-sm text-ink-3">Sem mensagens ainda.</p>
        ) : (
          mensagens.map((mensagem) => <MensagemBubble key={mensagem.id} mensagem={mensagem} />)
        )}
        <div ref={fimRef} />
      </div>

      {erro && (
        <div className="mx-4 mb-2 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
          {erro}
        </div>
      )}

      {temEscrita && (
        <RichComposer
          templates={templates}
          disabled={conversa.canal !== "whatsapp"}
          onEnviar={onEnviarRico}
        />
      )}

      {temEscrita && (
        <div className="flex items-center gap-2 border-t border-line p-3">
          <textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                enviar();
              }
            }}
            placeholder="Escreva uma mensagem..."
            className="input min-h-[40px] flex-1 resize-none"
            rows={1}
          />
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
