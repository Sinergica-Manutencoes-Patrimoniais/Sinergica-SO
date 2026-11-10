import { useState } from "react";
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";

type Props = { userId: string; clienteId: string; planoId: string; preparadaId: string; tipo?: "calendario" | "visita" };
export function FilaAposPreparacao(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.preparadaId, props.tipo ?? "calendario"])} {...props} />;
}
function Conteudo(props: Props) {
  const [aberta, setAberta] = useState(false);
  const habilitada = props.tipo === "visita" ? import.meta.env.VITE_SSO_FILA_VISITA_ENABLED === "true" : import.meta.env.VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED === "true";
  if (!habilitada) return null;
  return <><button type="button" aria-expanded={aberta} onClick={() => setAberta((anterior) => !anterior)}>{aberta ? "Ocultar fila" : "Conferir fila"}</button>{aberta && <FilaPreventivaPcm {...props} />}</>;
}
