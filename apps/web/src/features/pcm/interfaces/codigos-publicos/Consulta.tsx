import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { localizarCodigoPublico } from "../../infrastructure/supabase-codigos-publicos-adapter";
import { SubstituicaoCodigoPublico } from "./Substituicao";
import { EdicaoRascunhoCodigo } from "./EdicaoRascunho";
import { AliasesAtivo } from "./AliasesAtivo";
import { DeclaracaoEtiqueta } from "./DeclaracaoEtiqueta";
import { EvidenciasUso } from "./EvidenciasUso";
import { CategoriaComponente } from "./CategoriaComponente";
import { ConsultaCodigoGrupo } from "./ConsultaCodigoGrupo";
import { ConsultaUnificada } from "./ConsultaUnificada";

export function ConsultaCodigoPublico({
  userId,
  clienteId,
}: { userId: string; clienteId: string }) {
  if (import.meta.env.VITE_SSO_BUSCA_UNIFICADA_GRUPO_ENABLED === "true") return <ConsultaUnificada userId={userId} clienteId={clienteId} />;
  return <Conteudo key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} />;
}

function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [codigo, setCodigo] = useState("");
  const [busca, setBusca] = useState("");
  const permissao = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "permissao"],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
      const autorizada = await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.ler", clienteId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
      return autorizada;
    },
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const resultado = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "busca", busca],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
      const resposta = await localizarCodigoPublico(clienteId, busca, userId, signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
      return resposta;
    },
    enabled: permitido && Boolean(busca) && busca === codigo,
    gcTime: 0,
  });
  const encontrado = permitido && !resultado.isFetching && !resultado.isError && busca === codigo && resultado.data?.situacao === "encontrado" && "tipo" in resultado.data && "ativoId" in resultado.data ? resultado.data : null;
  const atual = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "codigo-atual", encontrado?.tipo, encontrado?.ativoId],
    enabled: permitido && !!encontrado && (import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" || import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true"),
    gcTime: 0,
    queryFn: async ({ signal }) => {
      if (!encontrado) throw new Error("Ativo não selecionado.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
      if (import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true") {
        const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_codigo_atual_mediado", {
          p_ator_id: userId, p_cliente_id: clienteId, p_tipo: encontrado.tipo, p_ativo_id: encontrado.ativoId,
        }).abortSignal(signal);
        if (error) throw error;
        const depois = await supabase.auth.getUser();
        if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
        if (!data || data.tipo !== encontrado.tipo || data.ativoId !== encontrado.ativoId || typeof data.codigo !== "string" || !data.codigo.trim() || data.codigo.length > 200)
          throw new Error("Código atual indisponível.");
        return data.codigo as string;
      }
      const consulta = encontrado.tipo === "sistema"
        ? supabase.schema("pcm").from("sistemas").select("codigo").eq("cliente_id", clienteId).eq("id", encontrado.ativoId).is("deleted_at", null).abortSignal(signal).maybeSingle()
        : supabase.schema("pcm").from("equipamentos").select("identificador").eq("client_id", clienteId).eq("id", encontrado.ativoId).is("deleted_at", null).abortSignal(signal).maybeSingle();
      const { data, error } = await consulta;
      if (error) throw error;
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão indisponível ou alterada.");
      const valor = data && ("codigo" in data ? data.codigo : "identificador" in data ? data.identificador : null);
      if (typeof valor !== "string" || !valor.trim() || valor.length > 200) throw new Error("Código atual indisponível.");
      return valor;
    },
  });
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso aos códigos…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  return (
    <section aria-label="Localizar código público">
      <h2>Localizar código público</h2>
      <ConsultaCodigoGrupo userId={userId} clienteId={clienteId} />
      <p>
        Consulta exata neste Cliente; não altera códigos nem verifica conflitos em outros Clientes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!codigo.trim()) return;
          if (codigo === busca) void resultado.refetch();
          else setBusca(codigo);
        }}
      >
        <label>
          Código{" "}
          <input
            value={codigo}
            maxLength={200}
            required
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <button type="submit" disabled={resultado.isFetching}>Consultar</button>
      </form>
      {busca === codigo && resultado.isFetching && <output>Consultando código…</output>}
      {busca === codigo && resultado.isError && (
        <p role="alert">
          Não foi possível consultar o código.{" "}
          <button type="button" onClick={() => void resultado.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {busca === codigo &&
        !resultado.isFetching &&
        !resultado.isError &&
        resultado.data?.situacao === "ambiguo" && (
          <p role="alert">Código ambíguo neste Cliente; procure o PCM.</p>
        )}
      {busca === codigo &&
        !resultado.isFetching &&
        !resultado.isError &&
        resultado.data?.situacao === "nao_encontrado" && (
          <p>Código não encontrado neste Cliente.</p>
        )}
      {busca === codigo &&
        !resultado.isFetching &&
        !resultado.isError &&
        resultado.data?.situacao === "encontrado" && (
          <>
            <p>
              {resultado.data.tipo === "sistema" ? "Sistema" : "Equipamento ou Componente (cadastro compartilhado)"} · ID{" "}
              {resultado.data.ativoId}
            </p>
            {import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true" && <section aria-label="Código atual do cadastro">
              {atual.isFetching && <output>Consultando código atual…</output>}
              {atual.isError && <p role="alert">Código atual indisponível. <button type="button" onClick={() => void atual.refetch()}>Tentar novamente</button></p>}
              {!atual.isFetching && !atual.isError && atual.data && <p>Código consultado: {busca} · código atual: {atual.data}. Códigos anteriores permanecem no histórico quando disponíveis.</p>}
            </section>}
            <EdicaoRascunhoCodigo userId={userId} clienteId={clienteId} tipo={resultado.data.tipo} ativoId={resultado.data.ativoId} />
            <AliasesAtivo userId={userId} clienteId={clienteId} tipo={resultado.data.tipo} ativoId={resultado.data.ativoId} />
            <EvidenciasUso userId={userId} clienteId={clienteId} tipo={resultado.data.tipo} ativoId={resultado.data.ativoId} />
            {resultado.data.tipo === "componente" && <CategoriaComponente userId={userId} clienteId={clienteId} componenteId={resultado.data.ativoId} />}
            <DeclaracaoEtiqueta userId={userId} clienteId={clienteId} tipo={resultado.data.tipo} ativoId={resultado.data.ativoId} />
            {import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" && import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED !== "true" && atual.isFetching && <output>Consultando código atual…</output>}
            {import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" && import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED !== "true" && atual.isError && <p role="alert">Código atual indisponível; correção não oferecida. <button type="button" onClick={() => void atual.refetch()}>Tentar novamente</button></p>}
            {import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" && !atual.isFetching && !atual.isError && atual.data && (
              <SubstituicaoCodigoPublico
                key={JSON.stringify([userId, clienteId, resultado.data.tipo, resultado.data.ativoId, atual.data])}
                userId={userId}
                clienteId={clienteId}
                tipo={resultado.data.tipo}
                ativoId={resultado.data.ativoId}
                codigoAnterior={atual.data}
              />
            )}
          </>
        )}
    </section>
  );
}
