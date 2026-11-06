import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { conferirSessaoMateriais, consultarReciboDisponibilidadePortal, validarPedidoDisponibilidade,
  type PedidoDisponibilidade } from "../infrastructure/supabase-portal-materiais-adapter";

type Tentativa = { chave: string; texto: string; pedido: PedidoDisponibilidade };
type Props = { userId: string; clienteId: string; osId: string; listasVisiveis: string[] };

export function RecuperarDisponibilidadesMateriais(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}

function Conteudo({ userId, clienteId, osId, listasVisiveis }: Props) {
  const prefixo = `sso-portal-material:${userId}:${clienteId}:${osId}:`;
  const tentativas: Tentativa[] = [];
  let invalida = false;
  const [mensagem, setMensagem] = useState("");
  const [, atualizar] = useState(0);
  const trava = useRef(false);
  const cache = useQueryClient();
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i);
      if (!chave?.startsWith(prefixo)) continue;
      try {
        const texto = sessionStorage.getItem(chave);
        if (!texto || texto.length > 10000) throw new Error("Tentativa inválida.");
        const pedido = validarPedidoDisponibilidade(JSON.parse(texto));
        if (chave !== `${prefixo}${pedido.listaId}`) throw new Error("Tentativa inválida.");
        if (!listasVisiveis.includes(pedido.listaId)) tentativas.push({ chave, texto, pedido });
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  const consulta = useMutation({
    mutationFn: async (tentativa: Tentativa) => {
      await conferirSessaoMateriais(userId);
      if (sessionStorage.getItem(tentativa.chave) !== tentativa.texto) throw new Error("Tentativa alterada.");
      await consultarReciboDisponibilidadePortal(tentativa.pedido, userId, clienteId, osId);
    },
    onSuccess: async (_resultado, tentativa) => {
      try {
        await cache.invalidateQueries({ queryKey: ["portal-materiais", userId, clienteId, osId], refetchType: "none" });
        await conferirSessaoMateriais(userId);
        if (sessionStorage.getItem(tentativa.chave) !== tentativa.texto) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(tentativa.chave);
        atualizar((n) => n + 1);
        setMensagem("Registro confirmado. A consulta não informa nova disponibilidade.");
        void cache.refetchQueries({ queryKey: ["portal-materiais", userId, clienteId, osId], type: "active" });
      } catch { setMensagem("Recibo confirmado, mas a tentativa não foi removida. Procure suporte."); }
    },
    onError: () => setMensagem("Recibo indisponível. A tentativa foi preservada; procure suporte."),
    onSettled: () => { trava.current = false; },
  });
  if (!tentativas.length && !invalida && !mensagem) return null;
  return <section aria-label="Recuperar informação de materiais">
    <h4>Informações pendentes nesta aba</h4>
    <p>Consultar recibo não envia nova informação.</p>
    {invalida && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    <ul>{tentativas.map((tentativa) => <li key={tentativa.chave}>
      Lista {tentativa.pedido.listaId} · revisão {tentativa.pedido.expectedRevision} · {tentativa.pedido.situacao.replaceAll("_", " ")}{" "}
      <button type="button" disabled={consulta.isPending} onClick={() => {
        if (trava.current) return;
        trava.current = true; setMensagem(""); consulta.mutate(tentativa);
      }}>Consultar recibo</button>
    </li>)}</ul>
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
