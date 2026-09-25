/** Seletor de motivo antes de confirmar perda (E03-S02, AC-4).
 *
 * Cancelar não grava nada — quem chama isto (`FunilPage`) só invoca `onConfirmar` de fato, então
 * o card nunca sai visualmente da coluna de origem até a escolha ser feita. */

import { Button, Field, Modal, Select } from "@sinergica/ui";
import { useState } from "react";
import type { MotivoPerda } from "../domain/funil";

export function MotivoPerdaModal({
  motivos,
  onCancelar,
  onConfirmar,
}: {
  motivos: MotivoPerda[];
  onCancelar: () => void;
  onConfirmar: (motivoPerdaId: string) => void;
}) {
  const ativos = motivos.filter((m) => m.ativo);
  const [motivoId, setMotivoId] = useState(ativos[0]?.id ?? "");

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancelar();
      }}
      titulo="Motivo da perda"
    >
      <div className="space-y-3">
        <p className="text-body text-ink-2">
          Obrigatório para mover a oportunidade para uma etapa de perda — é o que alimenta o
          win/loss no dashboard.
        </p>

        {ativos.length === 0 ? (
          <p className="text-body text-danger">
            Nenhum motivo de perda ativo. Cadastre um em Configuração do funil.
          </p>
        ) : (
          <Field label="Motivo" required>
            {(props) => (
              <Select {...props} value={motivoId} onChange={(e) => setMotivoId(e.target.value)}>
                {ativos.map((motivo) => (
                  <option key={motivo.id} value={motivo.id}>
                    {motivo.nome}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar(motivoId)} disabled={!motivoId || ativos.length === 0}>
            Confirmar perda
          </Button>
        </div>
      </div>
    </Modal>
  );
}
