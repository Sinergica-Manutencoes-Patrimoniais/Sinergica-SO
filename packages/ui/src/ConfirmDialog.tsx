import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  onConfirmar: () => Promise<void>;
}

// E00-S16 AC-3 — confirmação do produto, não `window.confirm`. Nomeia o que exatamente será
// afetado (o chamador escreve `titulo`/`descricao` com o registro, nunca "este item"). Foco
// inicial no cancelar (não no botão destrutivo); o diálogo não fecha antes da promise resolver
// e, se ela rejeitar, o erro fica visível e o diálogo continua aberto — o usuário não perde o
// contexto e não precisa refazer nada.
export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  rotuloConfirmar = "Excluir",
  onConfirmar,
}: ConfirmDialogProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    setCarregando(true);
    try {
      await onConfirmar();
      onOpenChange(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={carregando ? () => {} : onOpenChange}
      titulo={titulo}
      descricao={descricao}
      tamanho="sm"
    >
      <div className="flex flex-col gap-3">
        {erro && (
          <p
            role="alert"
            className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-caption text-danger"
          >
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <Button data-autofoco variant="secondary" disabled={carregando}>
              Cancelar
            </Button>
          </Dialog.Close>
          <Button variant="danger" onClick={confirmar} loading={carregando}>
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
