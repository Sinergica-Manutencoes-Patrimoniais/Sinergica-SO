import { Popover } from "@sinergica/ui";
import { Smile } from "lucide-react";
import { useRef, useState } from "react";

// E02-S29 AC-1 — conjunto curado por categoria relevante a atendimento (reações, positivo,
// negativo, saudação/despedida), não o unicode inteiro — ruído num chat de suporte.
const CATEGORIAS: { titulo: string; emoji: string[] }[] = [
  { titulo: "Reações", emoji: ["👍", "👎", "🙏", "👏", "✅", "❌"] },
  { titulo: "Positivo", emoji: ["😀", "😊", "😄", "🎉", "❤️", "💪"] },
  { titulo: "Negativo", emoji: ["😕", "😟", "😢", "😠", "⚠️", "😅"] },
  { titulo: "Saudação", emoji: ["👋", "🙌", "🤝", "😴", "☕", "📅"] },
];

export interface EmojiPickerProps {
  // Elemento de texto alvo — a inserção usa a posição do cursor dele (AC-2).
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  valor: string;
  onMudar: (novoValor: string) => void;
  disabled?: boolean;
}

// E02-S29 — mesmo componente usado no composer principal (ConversaChat) e no RichComposer
// (AC-3), pra não duplicar a lista de emoji.
export function EmojiPicker({ inputRef, valor, onMudar, disabled }: EmojiPickerProps) {
  const [aberto, setAberto] = useState(false);
  const posicaoRef = useRef<{ inicio: number; fim: number } | null>(null);

  function inserir(emoji: string) {
    const campo = inputRef.current;
    const inicio = posicaoRef.current?.inicio ?? campo?.selectionStart ?? valor.length;
    const fim = posicaoRef.current?.fim ?? campo?.selectionEnd ?? valor.length;
    const novoValor = valor.slice(0, inicio) + emoji + valor.slice(fim);
    onMudar(novoValor);
    const novaPosicao = inicio + emoji.length;
    posicaoRef.current = { inicio: novaPosicao, fim: novaPosicao };
    // Devolve o foco pro campo com o cursor logo depois do emoji — permite encadear vários
    // sem reabrir o painel (AC-2).
    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(novaPosicao, novaPosicao);
    });
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(next) => {
        if (next) {
          const campo = inputRef.current;
          posicaoRef.current = {
            inicio: campo?.selectionStart ?? valor.length,
            fim: campo?.selectionEnd ?? valor.length,
          };
        }
        setAberto(next);
      }}
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label="Inserir emoji"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-line-soft hover:text-ink disabled:opacity-40"
        >
          <Smile className="h-4 w-4" />
        </button>
      }
    >
      <div className="flex max-w-64 flex-col gap-2">
        {CATEGORIAS.map((categoria) => (
          <div key={categoria.titulo}>
            <p className="px-1 text-micro font-semibold text-ink-3">{categoria.titulo}</p>
            <div className="mt-1 grid grid-cols-6 gap-0.5">
              {categoria.emoji.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => inserir(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-line-soft"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Popover>
  );
}
