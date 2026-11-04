import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { pedidoPromocaoParcialSchema, reciboPromocaoParcialSchema } from "./PromoverRetornoParcial";

type Pedido = z.infer<typeof pedidoPromocaoParcialSchema>;
type Tentativa = { chave: string; texto: string; pedido: Pedido };
type Props = { userId: string; clienteId: string; retornosCarregados: string[] };

export function RecuperarPromocaoParcial(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}

function Conteudo({ userId, clienteId, retornosCarregados }: Props) {
  const prefixo = `sso-promocao-retorno-parcial:${userId}:${clienteId}:`;
  const tentativas: Tentativa[] = [];
  let invalida = false;
  const [mensagem, setMensagem] = useState("");
  const [, atualizar] = useState(0);
  const trava = useRef(false);
  const cache = useQueryClient();
  async function conferirSessao() {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i);
      if (!chave?.startsWith(prefixo)) continue;
      try {
        const texto = sessionStorage.getItem(chave);
        if (!texto || texto.length > 20000) throw new Error("Tentativa inválida.");
        const pedido = pedidoPromocaoParcialSchema.parse(JSON.parse(texto));
        if (pedido.atorId !== userId || pedido.clienteId !== clienteId || chave !== `${prefixo}${pedido.retornoId}`) throw new Error("Contexto divergente.");
        if (!retornosCarregados.includes(pedido.retornoId)) tentativas.push({ chave, texto, pedido });
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  const consulta = useMutation({
    mutationFn: async (t: Tentativa) => {
      await conferirSessao();
      if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error("Tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_promocao_retorno_parcial", {
        p_ator_id: userId, p_cliente_id: clienteId, p_retorno_id: t.pedido.retornoId,
      });
      if (error || !data) throw new Error("Recibo indisponível.");
      const r = reciboPromocaoParcialSchema.parse(data); const p = t.pedido;
      if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.retornoId !== p.retornoId ||
        r.retornoRevision !== p.retornoRevision + 1 || r.chamadoId !== p.chamadoId || r.parcelaId !== p.parcelaId ||
        r.cicloId !== p.cicloId || r.descricaoRestante !== p.descricaoRestante || r.minutosRestantes !== p.minutosRestantes) throw new Error("Recibo divergente.");
      await conferirSessao();
      return r;
    },
    onSuccess: async (r, t) => {
      try {
        await cache.invalidateQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId], refetchType: "none" });
        await conferirSessao();
        if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(t.chave); atualizar((n) => n + 1);
        setMensagem(`Chamado ${r.numero} confirmado. A consulta não criou OS ou tarefa.`);
        void cache.refetchQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId], type: "active" });
      } catch { setMensagem("Recibo encontrado, mas tentativa não foi removida. Procure suporte."); }
    },
    onError: () => setMensagem("Recibo indisponível ou divergente. A tentativa foi preservada; procure suporte."),
    onSettled: () => { trava.current = false; },
  });
  if (!tentativas.length && !invalida && !mensagem) return null;
  return <section aria-label="Recuperar promoção parcial"><h5>Promoções pendentes nesta aba</h5>
    <p>Consultar o recibo não cria outro Chamado.</p>
    {invalida && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    <ul>{tentativas.map((t) => <li key={t.chave}>Retorno {t.pedido.retornoId} · revisão {t.pedido.retornoRevision} · {t.pedido.minutosRestantes} min. <button type="button" disabled={consulta.isPending} onClick={() => {
      if (trava.current) return; trava.current = true; setMensagem(""); consulta.mutate(t);
    }}>Consultar recibo</button></li>)}</ul>
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
