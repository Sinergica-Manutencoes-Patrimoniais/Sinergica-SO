import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseLevantamentosAdapter } from "../../infrastructure/supabase-levantamentos-adapter";
import { LevantamentosWorkspace } from "./Workspace";
import { ImportacaoCsv } from "./ImportacaoCsv";
import { ImportacaoXlsxExperimental } from "./ImportacaoXlsxExperimental";
import { RevisaoQuarentenaCsv } from "./RevisaoQuarentenaCsv";
import { Recepcao } from "./Recepcao";

export function EntradaLevantamentos({
  habilitado,
  ...props
}: { habilitado: string | undefined; userId: string; clienteId: string; loteRecebido?: string | null }) {
  if (habilitado !== "true") return null;
  return <LevantamentosConectado {...props} />;
}

export function LevantamentosConectado(props: { userId: string; clienteId: string; loteRecebido?: string | null }) {
  const [recebido,setRecebido]=useState<{userId:string;clienteId:string;loteId:string} | null>(null);
  const contexto = useRef({ userId: props.userId, clienteId: props.clienteId, versao: 0 });
  if (contexto.current.userId !== props.userId || contexto.current.clienteId !== props.clienteId) {
    contexto.current = { userId: props.userId, clienteId: props.clienteId, versao: contexto.current.versao + 1 };
  }
  const permissao = useQuery({
    queryKey: ["levantamentos", props.userId, props.clienteId, "permissao"],
    enabled: Boolean(props.userId && props.clienteId),
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir", props.clienteId),
  });
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso aos levantamentos…</output>;
  if (permissao.isError)
    return (
      <div role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar acesso novamente
        </button>
      </div>
    );
  if (!permissao.data) return null;
  const versaoContexto = contexto.current.versao;
  const abrirLote = (loteId: string) => {
    if (contexto.current.versao !== versaoContexto) return;
    setRecebido({userId:props.userId,clienteId:props.clienteId,loteId});
  };
  return <><RevisaoQuarentenaCsv userId={props.userId} clienteId={props.clienteId} onRecebido={abrirLote} />
    {import.meta.env.VITE_SSO_RECEPCAO_MANUAL_LEVANTAMENTO_ENABLED === "true" && <Recepcao
      key={`${props.userId}:${props.clienteId}`}
      userId={props.userId}
      clienteId={props.clienteId}
      confirmarContexto={async () => {
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== props.userId || contexto.current.versao !== versaoContexto) throw new Error("Sessão ou Cliente alterado");
      }}
      onRecebido={abrirLote}
      reservarRecepcao={import.meta.env.VITE_SSO_RESERVA_RECEPCAO_MANUAL_ENABLED === "true" ? async (clienteId, pedido) => {
        if (clienteId !== props.clienteId || contexto.current.versao !== versaoContexto) throw new Error("Contexto alterado");
        return supabaseLevantamentosAdapter.reservarRecepcao(props.userId, clienteId, pedido);
      } : undefined}
      consultarRecibo={import.meta.env.VITE_SSO_RECIBO_RECEPCAO_MANUAL_ENABLED === "true" ? async (clienteId, pedido) => {
        if (clienteId !== props.clienteId || contexto.current.versao !== versaoContexto) throw new Error("Contexto alterado");
        return supabaseLevantamentosAdapter.consultarReciboRecepcao(props.userId, clienteId, pedido);
      } : undefined}
      cancelarRecepcao={import.meta.env.VITE_SSO_CANCELAR_RECEPCAO_MANUAL_ENABLED === "true" ? async (clienteId, pedido, motivo) => {
        if (clienteId !== props.clienteId || contexto.current.versao !== versaoContexto) throw new Error("Contexto alterado");
        return supabaseLevantamentosAdapter.cancelarRecepcao(props.userId, clienteId, pedido, motivo);
      } : undefined}
      receber={async (clienteId, pedido) => {
        const antes = await supabase.auth.getUser();
        if (clienteId !== props.clienteId || antes.error || antes.data.user?.id !== props.userId || contexto.current.versao !== versaoContexto) throw new Error("Sessão ou Cliente alterado");
        const resultado = await supabaseLevantamentosAdapter.receber(clienteId, pedido);
        const depois = await supabase.auth.getUser();
        if (depois.error || depois.data.user?.id !== props.userId || contexto.current.versao !== versaoContexto) throw new Error("Resultado não confirmado para esta sessão");
        return resultado;
      }}
    />}
    <ImportacaoCsv userId={props.userId} clienteId={props.clienteId} onRecebido={abrirLote} />
    <ImportacaoXlsxExperimental key={`${props.userId}:${props.clienteId}`} userId={props.userId} clienteId={props.clienteId} onRecebido={abrirLote} />
    <LevantamentosWorkspace userId={props.userId} clienteId={props.clienteId} gateway={supabaseLevantamentosAdapter} loteRecebido={recebido?.userId===props.userId && recebido.clienteId===props.clienteId?recebido.loteId:props.loteRecebido ?? null} /></>;
}
