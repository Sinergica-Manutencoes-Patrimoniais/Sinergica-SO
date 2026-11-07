import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { EdicaoRascunhoCodigo } from "./EdicaoRascunho";
import { AliasesAtivo } from "./AliasesAtivo";
import { EvidenciasUso } from "./EvidenciasUso";
import { CategoriaComponente } from "./CategoriaComponente";
import { DeclaracaoEtiqueta } from "./DeclaracaoEtiqueta";
import { SubstituicaoCodigoPublico } from "./Substituicao";
import { HistoricoCodigoGrupo } from "./HistoricoCodigoGrupo";
import { QrCodigoGrupo } from "./QrCodigoGrupo";

const resposta = z.union([
  z.object({ situacao: z.literal("nao_encontrado") }).strict(),
  z.object({ situacao: z.literal("ambiguo") }).strict(),
  z.object({ situacao: z.literal("encontrado"), tipo: z.enum(["sistema", "componente"]), ativoId: z.string().guid() }).strict(),
  z.object({ situacao: z.literal("encontrado"), tipo: z.literal("grupo_quantitativo"), ativoId: z.string().guid(), codigoAtual: z.string().min(1).max(200), codigoHistorico: z.boolean() }).strict(),
]);

export function ConsultaUnificada({ userId, clienteId }: { userId: string; clienteId: string }) {
  return <Conteudo key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} />;
}

function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [entrada, setEntrada] = useState("");
  const [busca, setBusca] = useState("");
  const consulta = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "unificada-grupo", busca],
    enabled: Boolean(busca) && busca === entrada,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_localizar_codigo_com_grupo", {
        p_cliente_id: clienteId, p_codigo: busca,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = resposta.parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
  });
  const resultado = busca === entrada && !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  const ativo: Extract<z.infer<typeof resposta>, { situacao: "encontrado"; tipo: "sistema" | "componente" }> | null =
    resultado?.situacao === "encontrado" && resultado.tipo !== "grupo_quantitativo" ? resultado : null;
  const selecionado: Extract<z.infer<typeof resposta>, { situacao: "encontrado" }> | null =
    resultado?.situacao === "encontrado" ? resultado : null;
  const nome = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "nome-unificado", selecionado?.tipo, selecionado?.ativoId],
    enabled: !!selecionado, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      if (!selecionado) throw new Error("Cadastro não selecionado.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const tabela = selecionado.tipo === "sistema" ? "sistemas" : selecionado.tipo === "grupo_quantitativo" ? "grupos_quantitativos" : "equipamentos";
      const campoCliente = selecionado.tipo === "componente" ? "client_id" : "cliente_id";
      const { data, error } = await supabase.schema("pcm").from(tabela).select("id,nome").eq(campoCliente, clienteId)
        .eq("id", selecionado.ativoId).is("deleted_at", null).abortSignal(signal).maybeSingle();
      if (error) throw error;
      const r = z.object({ id: z.string().guid(), nome: z.string().min(1).max(200) }).strict().parse(data);
      if (r.id.toLowerCase() !== selecionado.ativoId.toLowerCase()) throw new Error("Cadastro divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return r.nome;
    },
  });
  const atual = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "unificada-codigo-atual", ativo?.tipo, ativo?.ativoId],
    enabled: !!ativo && (import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" || import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true" || import.meta.env.VITE_SSO_QR_CODIGO_ATIVO_ENABLED === "true"),
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!ativo) throw new Error("Ativo não selecionado.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      let codigo: unknown;
      if (import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true") {
        const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_codigo_atual_mediado", {
          p_ator_id: userId, p_cliente_id: clienteId, p_tipo: ativo.tipo, p_ativo_id: ativo.ativoId,
        }).abortSignal(signal);
        if (error) throw error;
        if (!data || data.tipo !== ativo.tipo || data.ativoId !== ativo.ativoId) throw new Error("Ativo divergente.");
        codigo = data.codigo;
      } else {
        const q = ativo.tipo === "sistema"
          ? supabase.schema("pcm").from("sistemas").select("codigo").eq("cliente_id", clienteId).eq("id", ativo.ativoId).is("deleted_at", null).abortSignal(signal).maybeSingle()
          : supabase.schema("pcm").from("equipamentos").select("identificador").eq("client_id", clienteId).eq("id", ativo.ativoId).is("deleted_at", null).abortSignal(signal).maybeSingle();
        const { data, error } = await q;
        if (error) throw error;
        codigo = data && ("codigo" in data ? data.codigo : "identificador" in data ? data.identificador : null);
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted || typeof codigo !== "string" || !codigo.trim() || codigo.length > 200) throw new Error("Código atual indisponível.");
      return codigo;
    },
  });
  return <section aria-label="Localizar código público">
    <h2>Localizar código público</h2>
    <p>Busca Sistemas, Equipamentos, Componentes e Grupos neste Cliente; códigos ambíguos exigem conferência do PCM.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (!entrada.trim()) return; if (entrada === busca) void consulta.refetch(); else setBusca(entrada); }}>
      <label>Código <input required maxLength={200} value={entrada} onChange={(e) => setEntrada(e.target.value)} /></label>
      <button type="submit" disabled={consulta.isFetching}>Consultar</button>
    </form>
    {busca === entrada && consulta.isFetching && <output>Consultando código…</output>}
    {busca === entrada && consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {resultado?.situacao === "ambiguo" && <p role="alert">Código ambíguo neste Cliente; procure o PCM.</p>}
    {resultado?.situacao === "nao_encontrado" && <p>Código não encontrado neste Cliente.</p>}
    {resultado?.situacao === "encontrado" && <p>{resultado.tipo === "sistema" ? "Sistema" : resultado.tipo === "componente" ? "Equipamento ou Componente (cadastro compartilhado)" : "Grupo Quantitativo"} · ID {resultado.ativoId}
      {resultado.tipo === "grupo_quantitativo" && <> · código atual {resultado.codigoAtual} · {resultado.codigoHistorico ? "código consultado é anterior" : "código consultado é atual"}</>}.</p>}
    {selecionado && nome.isFetching && <output>Consultando nome do cadastro…</output>}
    {selecionado && nome.isError && <p role="alert">Nome indisponível ou cadastro sem acesso. <button type="button" onClick={() => void nome.refetch()}>Tentar novamente</button></p>}
    {selecionado && !nome.isFetching && !nome.isError && nome.data && <p>Nome: {nome.data}.</p>}
    {ativo && <>
      <EdicaoRascunhoCodigo userId={userId} clienteId={clienteId} tipo={ativo.tipo} ativoId={ativo.ativoId} />
      <AliasesAtivo userId={userId} clienteId={clienteId} tipo={ativo.tipo} ativoId={ativo.ativoId} />
      <EvidenciasUso userId={userId} clienteId={clienteId} tipo={ativo.tipo} ativoId={ativo.ativoId} />
      {ativo.tipo === "componente" && <CategoriaComponente userId={userId} clienteId={clienteId} componenteId={ativo.ativoId} />}
      <DeclaracaoEtiqueta userId={userId} clienteId={clienteId} tipo={ativo.tipo} ativoId={ativo.ativoId} />
      {(import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" || import.meta.env.VITE_SSO_CODIGO_ATUAL_MEDIADO_ENABLED === "true") && atual.isFetching && <output>Consultando código atual…</output>}
      {atual.isError && <p role="alert">Código atual indisponível. <button type="button" onClick={() => void atual.refetch()}>Tentar novamente</button></p>}
      {!atual.isFetching && !atual.isError && atual.data && <p>Código atual: {atual.data}. {busca.trim().toUpperCase() === atual.data.trim().toUpperCase() ? "O código consultado corresponde ao atual." : "O código consultado difere do atual; confira o histórico abaixo."}</p>}
      {!atual.isFetching && !atual.isError && atual.data && <QrCodigoGrupo userId={userId} clienteId={clienteId} ativoId={ativo.ativoId} tipo={ativo.tipo} codigo={atual.data} />}
      {import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGOS_ENABLED === "true" && !atual.isFetching && !atual.isError && atual.data &&
        <SubstituicaoCodigoPublico key={JSON.stringify([userId, clienteId, ativo.tipo, ativo.ativoId, atual.data])} userId={userId} clienteId={clienteId} tipo={ativo.tipo} ativoId={ativo.ativoId} codigoAnterior={atual.data} />}
    </>}
    {resultado?.situacao === "encontrado" && resultado.tipo === "grupo_quantitativo" && <>
      <HistoricoCodigoGrupo key={JSON.stringify([userId, clienteId, resultado.ativoId])} userId={userId} clienteId={clienteId} grupoId={resultado.ativoId} />
      <QrCodigoGrupo userId={userId} clienteId={clienteId} ativoId={resultado.ativoId} tipo="grupo_quantitativo" codigo={resultado.codigoAtual} />
      <DeclaracaoEtiqueta userId={userId} clienteId={clienteId} tipo="grupo_quantitativo" ativoId={resultado.ativoId} />
      {import.meta.env.VITE_SSO_SUBSTITUICAO_CODIGO_GRUPO_ENABLED === "true" &&
        <SubstituicaoCodigoPublico key={JSON.stringify([userId, clienteId, resultado.ativoId, resultado.codigoAtual])} userId={userId} clienteId={clienteId}
          tipo="grupo_quantitativo" ativoId={resultado.ativoId} codigoAnterior={resultado.codigoAtual} />}
    </>}
  </section>;
}
