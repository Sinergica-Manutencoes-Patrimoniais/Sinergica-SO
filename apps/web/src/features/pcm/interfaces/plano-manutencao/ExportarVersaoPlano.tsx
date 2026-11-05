import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { criarRelatorioPdf } from "../../../../lib/pdf/relatorio-pdf";
import { supabase } from "../../../../lib/supabase-client";
import type { PlanoResumo, RotinaDetalhe, VersaoPlano } from "../../application/plano-manutencao-gateway";
import { contextoExportacaoValido, csvVersaoPlano, textoVersaoPlano } from "../../domain/exportacao-plano";
import { xlsxVersaoPlano } from "../../infrastructure/exportacao-plano-xlsx";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

// Exporta somente o snapshot já consultado da versão aprovada. Não projeta calendário operacional.
export function ExportarVersaoPlano({ clienteId, plano, versao, rotinas, completo }: {
  clienteId: string; plano: PlanoResumo; versao: VersaoPlano; rotinas: RotinaDetalhe[]; completo: boolean;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const contextoValido = contextoExportacaoValido(clienteId, plano, versao, rotinas);
  const dadosExportacao = () => ({
    clienteId, planoNome: plano.nome, versaoId: versao.id, versaoNumero: versao.numero,
    vigenciaInicio: versao.vigenciaInicio, vigenciaFim: versao.vigenciaFim,
    rotinas: rotinas.map((r) => ({ ...r, alvoNome: r.alvoNome ?? r.alvoId })),
  });
  const conferir = import.meta.env.VITE_SSO_METADADOS_EXPORTACAO_ENABLED === "true";
  const metadados = useQuery({ queryKey: ["metadados-exportacao-plano", clienteId, plano.id, versao.id], enabled: conferir, gcTime: 0, queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_metadados_exportacao_plano", { p_cliente_id: clienteId, p_plano_id: plano.id, p_versao_id: versao.id }).abortSignal(signal); if (error) throw error; if (!data || data.custosIncluidos !== false || data.cronogramaOperacionalIncluido !== false || data.artefatoGerado !== false) throw new Error("Metadados inválidos."); return data as { clienteId: string; planoId: string; versaoId: string; numeroVersao: number; vigenciaInicio: string | null; vigenciaFim: string | null; rotinasSnapshot: number | null; arrayRotinasDisponivel: boolean }; } });
  const conferido = !conferir || (!metadados.isFetching && !metadados.isError && !!metadados.data && metadados.data.arrayRotinasDisponivel && metadados.data.clienteId === clienteId && metadados.data.planoId === plano.id && metadados.data.versaoId === versao.id && metadados.data.numeroVersao === versao.numero && metadados.data.vigenciaInicio === versao.vigenciaInicio && metadados.data.vigenciaFim === versao.vigenciaFim && metadados.data.rotinasSnapshot === rotinas.length);
  async function conferirAntesDoDownload() {
    if (!conferir) return;
    const atualizado = await metadados.refetch();
    const m = atualizado.data;
    if (atualizado.isError || !m || !m.arrayRotinasDisponivel || m.clienteId !== clienteId || m.planoId !== plano.id || m.versaoId !== versao.id || m.numeroVersao !== versao.numero || m.vigenciaInicio !== versao.vigenciaInicio || m.vigenciaFim !== versao.vigenciaFim || m.rotinasSnapshot !== rotinas.length) throw new Error("Metadados alterados ou indisponíveis.");
  }
  async function exportar() {
    setErro(""); setGerando(true);
    try {
      if (!completo || !conferido || !contextoValido)
        throw new Error("Dados incompletos.");
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) throw new Error("Acesso revogado.");
      const documento = await criarRelatorioPdf({ titulo: "Plano de Manutenção", subtitulo: "Versão aprovada - sem cronograma operacional" });
      documento.escreverTexto(textoVersaoPlano(dadosExportacao()));
      const bytes = await documento.finalizar();
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) throw new Error("Acesso revogado.");
      await conferirAntesDoDownload();
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      try {
        const link = document.createElement("a"); link.href = url; link.download = `plano-versao-${versao.numero}.pdf`; link.click();
      } finally { URL.revokeObjectURL(url); }
    } catch {
      setErro("Não foi possível exportar. Confira acesso, dados completos e caracteres do documento.");
    } finally { setGerando(false); }
  }
  async function exportarCsv() {
    setErro(""); setGerando(true);
    try {
      if (!completo || !conferido || !contextoValido) throw new Error("Dados incompletos.");
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) throw new Error("Acesso revogado.");
      const conteudo = csvVersaoPlano(dadosExportacao());
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) throw new Error("Acesso revogado.");
      await conferirAntesDoDownload();
      const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
      try { const link = document.createElement("a"); link.href = url; link.download = `plano-versao-${versao.numero}.csv`; link.click(); } finally { URL.revokeObjectURL(url); }
    } catch { setErro("Não foi possível exportar o CSV. Confira acesso e dados completos."); } finally { setGerando(false); }
  }
  async function exportarXlsx() {
    setErro(""); setGerando(true);
    try {
      if (!completo || !conferido || !contextoValido) throw new Error("Dados incompletos.");
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) throw new Error("Acesso revogado.");
      const arquivo = await xlsxVersaoPlano(dadosExportacao());
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) throw new Error("Acesso revogado.");
      await conferirAntesDoDownload();
      const url = URL.createObjectURL(arquivo);
      try { const link = document.createElement("a"); link.href = url; link.download = `plano-versao-${versao.numero}.xlsx`; link.click(); } finally { URL.revokeObjectURL(url); }
    } catch { setErro("Não foi possível exportar o XLSX. Confira acesso e dados completos."); } finally { setGerando(false); }
  }
  return <div>
    <p>PDF da versão aprovada, sem cronograma operacional nem capacidade. Carregue todas as Rotinas.</p>
    {conferir && <p>Conferência de identificadores, vigência e quantidade: {conferido ? "compatível" : "pendente ou inconsistente; exportação bloqueada"}. Esta comparação não comprova conteúdo completo.</p>}{conferir && metadados.isError && <p role="alert">Metadados indisponíveis. <button type="button" onClick={() => void metadados.refetch()}>Tentar novamente</button></p>}
    {!contextoValido && <p role="alert">Versão, Plano ou Rotinas inconsistentes; exportação bloqueada.</p>}
    <button type="button" disabled={!completo || !conferido || !contextoValido || gerando} onClick={() => void exportar()}>{gerando ? "Gerando…" : "Exportar versão em PDF"}</button>
    {import.meta.env.VITE_SSO_EXPORTAR_PLANO_CSV_ENABLED === "true" && <><p>CSV da versão aprovada, sem custos, capacidade ou cronograma operacional. Pode ser aberto em planilhas; não é XLSX.</p><button type="button" disabled={!completo || !conferido || !contextoValido || gerando} onClick={() => void exportarCsv()}>{gerando ? "Gerando…" : "Exportar versão em CSV"}</button></>}
    {import.meta.env.VITE_SSO_EXPORTAR_PLANO_XLSX_ENABLED === "true" && <><p>XLSX experimental da versão, sem custos, capacidade ou cronograma operacional; conteúdo ainda não conferido integralmente com o snapshot aprovado.</p><button type="button" disabled={!completo || !conferido || !contextoValido || gerando} onClick={() => void exportarXlsx()}>{gerando ? "Gerando…" : "Exportar versão em XLSX"}</button></>}
    {erro && <p role="alert">{erro}</p>}
  </div>;
}
