import { Button } from "@sinergica/ui";
import { Calendar, ClipboardList, Headset, Layers } from "lucide-react";

/** Atalhos contextuais do Cliente 360; sem permissão de escrita não há ação exposta. */
export function Cliente360AcoesRapidas({
  habilitado,
  onNovoChamado,
  onNovaOs,
  onNovaPreventiva,
  onNovoComponente,
}: {
  habilitado: boolean;
  onNovoChamado: () => void;
  onNovaOs: () => void;
  onNovaPreventiva: () => void;
  onNovoComponente: () => void;
}) {
  if (!habilitado) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2" aria-label="Ações rápidas do cliente">
      <Button size="sm" variant="secondary" onClick={onNovoChamado}>
        <Headset className="h-4 w-4" /> Novo chamado
      </Button>
      <Button size="sm" variant="secondary" onClick={onNovaOs}>
        <ClipboardList className="h-4 w-4" /> Nova OS
      </Button>
      <Button size="sm" variant="secondary" onClick={onNovaPreventiva}>
        <Calendar className="h-4 w-4" /> Nova preventiva
      </Button>
      <Button size="sm" variant="secondary" onClick={onNovoComponente}>
        <Layers className="h-4 w-4" /> Novo componente
      </Button>
    </div>
  );
}
