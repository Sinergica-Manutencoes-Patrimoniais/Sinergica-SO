import { AlertTriangle, Bot, FileText, Smartphone, User } from "lucide-react";
import { useRef } from "react";
import type { MensagemItem } from "../domain/mensagens";
import { formatarCustoIaMensagem } from "../domain/mensagens";

/**
 * E02-S41 (design.md "Bolha de mensagem") — laranja sai da bolha de saída e volta a significar só
 * CTA/estado ativo/prioridade (comentário do próprio index.css). Azul institucional (navy/info)
 * separa "nós" de "cliente" sem queimar esse recurso, e deixa Zé × humano distinguível de longe —
 * é o que o ADR-0049 (mensagem do aparelho tira o Zé) pede desde sempre.
 */
export function MensagemBubble({ mensagem }: { mensagem: MensagemItem }) {
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const minha = mensagem.direcao === "saida";
  const deAgente = mensagem.remetenteTipo === "ze" || mensagem.remetenteTipo === "agente";
  const deCelular = mensagem.remetenteTipo === "humano" && mensagem.origemEnvio === "celular";
  const cor = deAgente
    ? "bg-info-soft text-ink border border-info-line"
    : minha
      ? deCelular
        ? "bg-navy/8 text-ink border border-navy-line"
        : "bg-navy text-white"
      : "bg-card text-ink border border-line";

  return (
    <div className={`flex ${minha ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[68ch] rounded-lg px-3 py-2 text-body ${cor}`}>
        {deAgente && (
          <div className="mb-1 flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.12em] opacity-70">
            <Bot className="h-3 w-3" />
            {mensagem.remetenteTipo === "ze" ? "Agente Zé" : "Agente"}
          </div>
        )}
        {mensagem.remetenteTipo === "humano" && minha && deCelular && (
          <div className="mb-1 flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.12em] opacity-80">
            <Smartphone className="h-3 w-3" />
            Enviado pelo celular
          </div>
        )}
        {mensagem.remetenteTipo === "humano" && minha && !deCelular && (
          <div className="mb-1 flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.12em] opacity-80">
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
            <>
              <button
                type="button"
                onClick={() => lightboxRef.current?.showModal()}
                className="mt-2 block cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <img
                  src={mensagem.midiaUrl}
                  alt={mensagem.midiaNome ?? "Imagem enviada"}
                  className="max-h-60 rounded-lg"
                />
              </button>
              {/** biome-ignore lint/a11y/useKeyWithClickEvents: <dialog> nativo já fecha com Esc/clique no backdrop */}
              <dialog
                ref={lightboxRef}
                onClick={(e) => e.currentTarget === e.target && lightboxRef.current?.close()}
                className="fixed inset-0 m-auto max-h-[90vh] max-w-[90vw] rounded-lg bg-transparent p-0 backdrop:bg-ink/70"
              >
                <img
                  src={mensagem.midiaUrl}
                  alt={mensagem.midiaNome ?? "Imagem enviada"}
                  className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
                />
              </dialog>
            </>
          ) : (
            <a
              href={mensagem.midiaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-caption text-ink no-underline hover:border-orange/40"
            >
              <FileText className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">{mensagem.midiaNome ?? "Abrir anexo"}</span>
            </a>
          ))}
        {mensagem.tipoConteudo === "template" && (
          <p className="mt-1 text-caption opacity-75">
            Template · {String(mensagem.payload.templateNome ?? "")}
          </p>
        )}
        {mensagem.tipoConteudo === "interativa" && Array.isArray(mensagem.payload.botoes) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(mensagem.payload.botoes as string[]).map((botao) => (
              <span key={botao} className="rounded border border-current px-2 py-1 text-caption">
                {botao}
              </span>
            ))}
          </div>
        )}
        {mensagem.statusEntrega === "erro" && (
          <p className="mt-1 flex items-center gap-1 text-caption text-danger">
            <AlertTriangle className="h-3 w-3" />
            Falha ao enviar{mensagem.erroDetalhe ? `: ${mensagem.erroDetalhe}` : ""}
          </p>
        )}
        {mensagem.statusEntrega === "enviando" && (
          <p className="mt-1 text-caption opacity-70">Enviando…</p>
        )}
        {deAgente && mensagem.custoIa != null && (
          <p
            className="mt-1 text-micro opacity-70"
            title={`Custo de processamento: ${formatarCustoIaMensagem(mensagem.custoIa.usdCost)} (${mensagem.custoIa.modelo ?? "modelo desconhecido"}, ${mensagem.custoIa.tokensIn ?? "?"} in / ${mensagem.custoIa.tokensOut ?? "?"} out)`}
          >
            IA · {formatarCustoIaMensagem(mensagem.custoIa.usdCost)} ·{" "}
            {new Date(mensagem.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
