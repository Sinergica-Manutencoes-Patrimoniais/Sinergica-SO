import { useCallback } from "react";
import { useToast } from "./Toast";

// E00-S16 AC-4 — ação reversível executa na hora, sem diálogo, e oferece "Desfazer" no toast.
// Confirmar tudo treina o usuário a clicar sem ler — confirmação fica reservada ao genuinamente
// irreversível (ConfirmDialog). `desfazer` é best-effort: se falhar, o toast de erro do próprio
// chamador é quem avisa (este hook não engole a rejeição).
export function useAcaoComDesfazer() {
  const toast = useToast();

  const executar = useCallback(
    async (opcoes: {
      acao: () => Promise<void>;
      desfazer: () => Promise<void>;
      mensagem: string;
    }) => {
      await opcoes.acao();
      toast.comDesfazer(opcoes.mensagem, () => {
        opcoes.desfazer().catch((error) => {
          toast.erro(error instanceof Error ? error.message : "Não foi possível desfazer.");
        });
      });
    },
    [toast],
  );

  return { executar };
}
