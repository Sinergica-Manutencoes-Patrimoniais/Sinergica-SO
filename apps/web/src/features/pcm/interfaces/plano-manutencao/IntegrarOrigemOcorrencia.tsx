import { useState } from "react";
import { RelacaoPlanoLegado } from "./RelacaoPlanoLegado";
import { flagLigada } from "../../../../config/flags-sso";

type Props = { userId: string; clienteId: string; planoId: string; revision: number; preparadaId: string; tipo: "calendario" | "visita" };
export function IntegrarOrigemOcorrencia(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.preparadaId, props.tipo])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, revision, preparadaId, tipo }: Props) {
  const [aberta, setAberta] = useState(false);
  const habilitada = flagLigada("VITE_SSO_RELACAO_PLANO_LEGADO_ENABLED") && (tipo === "visita" ? flagLigada("VITE_SSO_MATERIALIZAR_VISITA_LEGADO_ENABLED") : flagLigada("VITE_SSO_MATERIALIZAR_CICLO_LEGADO_ENABLED"));
  if (!habilitada) return null;
  return <section aria-label="Vincular origem da ocorrência"><button type="button" aria-expanded={aberta} onClick={() => setAberta((atual) => !atual)}>{aberta ? "Ocultar vínculo legado" : "Vincular Plano Preventivo existente"}</button>{aberta && <><p>Ocorrência {preparadaId}. Escolha e confira um Plano Preventivo existente; nenhuma relação é criada automaticamente.</p><RelacaoPlanoLegado userId={userId} clienteId={clienteId} planoId={planoId} revision={revision} origemPreparada={{ tipo, id: preparadaId }} /></>}</section>;
}
