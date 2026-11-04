import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ativosClienteQueryKeys } from "../../application/ativos-cliente-queries";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseLevantamentosAdapter } from "../../infrastructure/supabase-levantamentos-adapter";
import { AtualizarLocalizacao } from "./AtualizarLocalizacao";
import { VincularLocalizacao } from "./VincularLocalizacao";

const pedidoSchema = z.object({
  requestId: z.string().uuid(),
  loteId: z.string().uuid(),
  chave: z.string().min(1).max(200),
  revisao: z.number().int().positive(),
  tipo: z.enum(["area", "local", "sublocal"]),
}).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; loteId: string; chave: string; revisao: number; tipo: string };

export function IncorporacaoLocalizacao(props: Props) {
  if (import.meta.env.VITE_SSO_INCORPORACAO_LOCALIZACAO_ENABLED !== "true" ||
    !["area", "local", "sublocal"].includes(props.tipo)) return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])} {...props} />;
}

function Conteudo({ userId, clienteId, loteId, chave, revisao, tipo }: Props) {
  const chaveLocal = `sso-incorporacao-localizacao:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const valor = sessionStorage.getItem(chaveLocal);
      if (!valor) return null;
      const pedido = pedidoSchema.parse(JSON.parse(valor));
      if (pedido.loteId !== loteId || pedido.chave !== chave || pedido.tipo !== tipo) return "invalido";
      return pedido;
    } catch { return "invalido"; }
  });
  const [aviso, setAviso] = useState("");
  const [fotoConfirmada, setFotoConfirmada] = useState<string | null>(null);
  const foto = JSON.stringify([userId, clienteId, loteId, chave, revisao, tipo]);
  const confirmado = fotoConfirmada === foto;
  const enviando = useRef(false);
  const client = useQueryClient();
  const permissao = useQuery({
    queryKey: ["levantamentos", userId, clienteId, "incorporacao-permissao"],
    queryFn: async ({signal}) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const acesso=await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar",clienteId);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return acesso;},
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const envio = useMutation({
    mutationFn: async (pedido: Pedido) => {const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chaveLocal)!==JSON.stringify(pedido))throw new Error("Sessão ou tentativa alterada.");const resultado=await supabaseLevantamentosAdapter.incorporarLocalizacao(pedido);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||sessionStorage.getItem(chaveLocal)!==JSON.stringify(pedido))throw new Error("Sessão ou tentativa alterada.");return resultado;},
    onSuccess: async (_resposta, pedido) => {
      try {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], refetchType: "none" }),
          client.invalidateQueries({ queryKey: ativosClienteQueryKeys.areas(clienteId), refetchType: "none" }),
          client.invalidateQueries({ queryKey: ativosClienteQueryKeys.locais(clienteId), refetchType: "none" }),
        ]);
        const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId)throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chaveLocal) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(chaveLocal);
      } catch {
        setAviso("Registro confirmado, mas tentativa local não foi limpa. Consulte suporte.");
        return;
      }
      setPendente(null);
      setFotoConfirmada(null);
      setAviso("Localização incorporada. As demais linhas continuam independentes.");
      void client.refetchQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], type: "active" });
      void client.refetchQueries({ queryKey: ativosClienteQueryKeys.areas(clienteId), type: "active" });
      void client.refetchQueries({ queryKey: ativosClienteQueryKeys.locais(clienteId), type: "active" });
    },
    onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte em caso de conflito."),
    onSettled: () => { enviando.current = false; },
  });
  function enviar(pedido: Pedido) {
    if (!permitido || enviando.current) return;
    enviando.current = true;
    setAviso("");
    envio.mutate(pedido);
  }
  function iniciar() {
    if (!permitido || !confirmado || pendente || enviando.current) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), loteId, chave, revisao, tipo });
      if (sessionStorage.getItem(chaveLocal) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chaveLocal, JSON.stringify(pedido));
      setPendente(pedido);
      enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa; nada foi enviado."); }
  }
  if (permissao.isFetching || permissao.isPending) return <output>Verificando permissão de incorporação…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar permissão. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  return <section aria-label={`Incorporação da linha ${chave}`}>
    <p>Esta ação cria apenas esta localização no cadastro oficial. O pai deve ter sido incorporado ou atualizado antes; códigos, quantidade e outros atributos não suportados não devem ser descartados. Corrija e reconfira a linha antes da incorporação.</p>
    <AtualizarLocalizacao userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} tipo={tipo}/>
    <VincularLocalizacao userId={userId} clienteId={clienteId} loteId={loteId} chave={chave} revisao={revisao} tipo={tipo}/>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa de incorporação</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        {fotoConfirmada && !confirmado && <p role="alert">A revisão ou o contexto mudou. Confira a linha novamente.</p>}
        <label><input type="checkbox" checked={confirmado} onChange={(e) => setFotoConfirmada(e.target.checked ? foto : null)} /> Conferi nome, localização, hierarquia e possíveis duplicidades.</label>
        <button type="submit" disabled={!confirmado || envio.isPending}>Incorporar localização</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
