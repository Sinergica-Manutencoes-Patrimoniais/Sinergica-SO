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
