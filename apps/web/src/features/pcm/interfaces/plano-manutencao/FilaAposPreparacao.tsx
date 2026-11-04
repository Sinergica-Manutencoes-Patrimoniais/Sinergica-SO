import { useState } from "react";
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";

type Props = { userId: string; clienteId: string; planoId: string; preparadaId: string };
export function FilaAposPreparacao(props: Props) {
  const [aberta, setAberta] = useState(false);
  if (import.meta.env.VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED !== "true") return null;
  return <><button type="button" aria-expanded={aberta} onClick={() => setAberta((anterior) => !anterior)}>{aberta ? "Ocultar fila" : "Conferir inclusão na fila"}</button>{aberta && <FilaPreventivaPcm {...props} />}</>;
}
