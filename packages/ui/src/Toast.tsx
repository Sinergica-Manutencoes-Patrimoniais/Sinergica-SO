import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ToastTone = "sucesso" | "erro" | "aviso" | "info";

interface ToastItem {
  id: string;
  tone: ToastTone;
  mensagem: string;
  acao?: { rotulo: string; executar: () => void };
}

interface ToastApi {
  sucesso: (mensagem: string) => void;
  erro: (mensagem: string) => void;
  aviso: (mensagem: string) => void;
  info: (mensagem: string) => void;
  comDesfazer: (mensagem: string, desfazer: () => void) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONE: Record<ToastTone, typeof CheckCircle2> = {
  sucesso: CheckCircle2,
  erro: XCircle,
  aviso: AlertTriangle,
  info: Info,
};

const TONE_CLASSE: Record<ToastTone, string> = {
  sucesso: "border-success-line bg-success-soft text-success",
  erro: "border-danger-line bg-danger-soft text-danger",
  aviso: "border-warning-line bg-warning-soft text-warning",
  info: "border-info-line bg-info-soft text-info",
};

const AUTO_DISMISS_MS = 4000;
const MAX_VISIVEL = 3;

// E00-S16 AC-2 — fila com no máximo 3 visíveis + contador, nunca cobre a tela inteira num
// import em lote. Sucesso/info somem sozinhos; erro/aviso ficam até o usuário dispensar (o
// usuário precisa poder ler e agir, não só ver passar).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Entra e sai pelo mesmo lado (canto inferior direito) — a saída não é um `unmount` seco:
  // marca "saindo" primeiro (dispara a animação de saída) e só depois de fato remove.
  const remover = useCallback((id: string) => {
    setSaindo((atual) => new Set(atual).add(id));
    setTimeout(() => {
      setItens((atual) => atual.filter((item) => item.id !== id));
      setSaindo((atual) => {
        const novo = new Set(atual);
        novo.delete(id);
        return novo;
      });
    }, 180);
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const adicionar = useCallback(
    (tone: ToastTone, mensagem: string, acao?: ToastItem["acao"]) => {
      const id = crypto.randomUUID();
      setItens((atual) => [...atual, { id, tone, mensagem, acao }]);
      if (tone === "sucesso" || tone === "info") {
        timers.current.set(
          id,
          setTimeout(() => remover(id), AUTO_DISMISS_MS),
        );
      }
    },
    [remover],
  );

  const api = useMemo<ToastApi>(
    () => ({
      sucesso: (m) => adicionar("sucesso", m),
      erro: (m) => adicionar("erro", m),
      aviso: (m) => adicionar("aviso", m),
      info: (m) => adicionar("info", m),
      comDesfazer: (m, desfazer) =>
        adicionar("sucesso", m, {
          rotulo: "Desfazer",
          executar: desfazer,
        }),
    }),
    [adicionar],
  );

  const visiveis = itens.slice(0, MAX_VISIVEL);
  const ocultos = itens.length - visiveis.length;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-3 bottom-3 z-[200] flex w-full max-w-sm flex-col gap-2 sm:right-4 sm:bottom-4">
        {visiveis.map((item) => {
          const Icone = ICONE[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "erro" ? "alert" : "status"}
              aria-live={item.tone === "erro" ? "assertive" : "polite"}
              data-state={saindo.has(item.id) ? "closed" : "open"}
              className={`anim-toast pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-overlay ${TONE_CLASSE[item.tone]}`}
            >
              <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{item.mensagem}</p>
              {item.acao && (
                <button
                  type="button"
                  onClick={() => {
                    item.acao?.executar();
                    remover(item.id);
                  }}
                  className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
                >
                  {item.acao.rotulo}
                </button>
              )}
              <button
                type="button"
                aria-label="Dispensar"
                onClick={() => remover(item.id)}
                className="shrink-0 opacity-60 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {ocultos > 0 && (
          <p className="pointer-events-none text-center text-[11px] text-ink-3">+{ocultos} mais</p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa de <ToastProvider> no topo da árvore");
  return ctx;
}
