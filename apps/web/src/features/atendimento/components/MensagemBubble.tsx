import { AlertTriangle, Bot, User } from "lucide-react";
import type { MensagemItem } from "../domain/mensagens";

export function MensagemBubble({ mensagem }: { mensagem: MensagemItem }) {
  const minha = mensagem.direcao === "saida";
  const deAgente = mensagem.remetenteTipo === "ze" || mensagem.remetenteTipo === "agente";
  const cor = deAgente
    ? "bg-orange-soft text-ink border border-orange/30"
    : minha
      ? "bg-orange text-white"
      : "bg-line-soft text-ink";

  return (
    <div className={`flex ${minha ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-[8px] px-3 py-2 text-sm ${cor}`}>
        {deAgente && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
            <Bot className="h-3 w-3" />
            {mensagem.remetenteTipo === "ze" ? "Agente Zé" : "Agente"}
          </div>
        )}
        {mensagem.remetenteTipo === "humano" && minha && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
            <User className="h-3 w-3" />
            Você
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
        {mensagem.tipoConteudo === "audio" && mensagem.midiaUrl && (
          <audio controls src={mensagem.midiaUrl} className="mt-2 max-w-full">
            <track kind="captions" />
          </audio>
        )}
        {mensagem.tipoConteudo === "midia" &&
          mensagem.midiaUrl &&
          (mensagem.midiaMime?.startsWith("image/") ? (
            <img
              src={mensagem.midiaUrl}
              alt={mensagem.midiaNome ?? "Imagem enviada"}
              className="mt-2 max-h-72 rounded"
            />
          ) : (
            <a
              href={mensagem.midiaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block underline"
            >
              {mensagem.midiaNome ?? "Abrir anexo"}
            </a>
          ))}
        {mensagem.tipoConteudo === "template" && (
          <p className="mt-1 text-xs opacity-75">
            Template · {String(mensagem.payload.templateNome ?? "")}
          </p>
        )}
        {mensagem.tipoConteudo === "interativa" && Array.isArray(mensagem.payload.botoes) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(mensagem.payload.botoes as string[]).map((botao) => (
              <span key={botao} className="rounded border border-current px-2 py-1 text-xs">
                {botao}
              </span>
            ))}
          </div>
        )}
        {mensagem.statusEntrega === "erro" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[#A23B25]">
            <AlertTriangle className="h-3 w-3" />
            Falha ao enviar{mensagem.erroDetalhe ? `: ${mensagem.erroDetalhe}` : ""}
          </p>
        )}
        {mensagem.statusEntrega === "enviando" && (
          <p className="mt-1 text-xs opacity-70">Enviando...</p>
        )}
      </div>
    </div>
  );
}
