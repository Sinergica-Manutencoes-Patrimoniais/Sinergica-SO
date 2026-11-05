import { useState } from "react";
import { criarRelatorioPdf } from "../../../../lib/pdf/relatorio-pdf";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

type Ciclo = {
  ciclo: number;
  vencimento: string;
  toleranciaAntes: number;
  toleranciaDepois: number;
};
function celula(valor: string | number): string {
  let texto = String(valor);
  let indice = 0;
  while (
    indice < texto.length &&
    (/\s/u.test(texto.charAt(indice)) || texto.charCodeAt(indice) <= 31)
  )
    indice++;
  const primeiro = texto.charCodeAt(0);
  if (
    "=+-@".includes(texto[indice] ?? "\0") ||
    primeiro === 9 ||
    primeiro === 10 ||
    primeiro === 13
  )
    texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}
export function ExportarPreviaCiclos({
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  inicio,
  fim,
  ciclos,
  feriados,
}: {
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  inicio: string;
  fim: string;
  ciclos: Ciclo[];
  feriados: string[];
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  async function exportar() {
    setOcupado(true);
    setErro("");
    try {
      if (!(await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)))
        throw new Error("Acesso indisponível.");
      const documento = await criarRelatorioPdf({
        titulo: "Prévia de ciclos por calendário",
        subtitulo: "Simulação parcial - não é cronograma operacional",
      });
      documento.escreverTexto(
        `Cliente: ${clienteId}\nPlano: ${planoId}\nVersão: ${versaoId}\nRotina: ${rotinaId}\nPeríodo consultado: ${inicio} a ${fim}\nFiltro: uma Rotina por calendário\nCapacidade: não incluída\nFonte de feriados oficiais: indisponível. Datas hipotéticas foram informadas manualmente.\nA prévia não considera cancelamentos, execução ou geração oficial. Não demonstra lista completa de feriados.`,
      );
      documento.escreverTexto(
        `\nFeriados hipotéticos informados: ${feriados.length ? feriados.join(", ") : "nenhum"}`,
      );
      if (!ciclos.length)
        documento.escreverTexto("Nenhum ciclo retornado para o período consultado.");
      for (const item of ciclos)
        documento.escreverTexto(
          `\nCiclo ${item.ciclo} - vencimento ${item.vencimento}\nTolerância: ${item.toleranciaAntes} dias antes e ${item.toleranciaDepois} dias depois\nFeriado: ${feriados.includes(item.vencimento) ? "hipotético informado; vencimento mantido" : "indeterminado; não consultado em fonte oficial"}`,
        );
      const bytes = await documento.finalizar();
      if (!(await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)))
        throw new Error("Acesso indisponível.");
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "previa-ciclos-calendario.pdf";
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setErro("Não foi possível exportar a prévia. Confira permissão e dados.");
    } finally {
      setOcupado(false);
    }
  }
  async function exportarCsv() {
    setOcupado(true);
    setErro("");
    try {
      if (!(await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)))
        throw new Error("Acesso indisponível.");
      const linhas: (string | number)[][] = [
        [
          "Tipo",
          "Cliente ID",
          "Plano ID",
          "Versão ID",
          "Rotina ID",
          "Período início",
          "Período fim",
          "Feriados hipotéticos",
          "Ciclo",
          "Vencimento",
          "Tolerância antes (dias)",
          "Tolerância depois (dias)",
          "Feriado",
        ],
        ...ciclos.map((item) => [
          "Prévia parcial; não é cronograma operacional",
          clienteId,
          planoId,
          versaoId,
          rotinaId,
          inicio,
          fim,
          feriados.join(", "),
          item.ciclo,
          item.vencimento,
          item.toleranciaAntes,
          item.toleranciaDepois,
          feriados.includes(item.vencimento)
            ? "hipotético informado; vencimento mantido"
            : "indeterminado; fonte oficial não consultada",
        ]),
      ];
      if (!ciclos.length)
        linhas.push([
          "Prévia parcial; nenhum ciclo retornado; não é cronograma operacional",
          clienteId,
          planoId,
          versaoId,
          rotinaId,
          inicio,
          fim,
          feriados.join(", "),
          "",
          "",
          "",
          "",
          "fonte oficial de feriados não consultada",
        ]);
      const conteudo = `\uFEFF${linhas.map((linha) => linha.map(celula).join(";")).join("\r\n")}\r\n`;
      if (!(await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)))
        throw new Error("Acesso indisponível.");
      const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "previa-ciclos-calendario.csv";
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setErro("Não foi possível exportar a prévia. Confira permissão e dados.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div>
      <button type="button" disabled={ocupado} onClick={() => void exportar()}>
        {ocupado ? "Gerando…" : "Exportar prévia parcial em PDF"}
      </button>
      {import.meta.env.VITE_SSO_EXPORTAR_PREVIA_CICLOS_CSV_ENABLED === "true" && (
        <button type="button" disabled={ocupado} onClick={() => void exportarCsv()}>
          Exportar prévia parcial em CSV
        </button>
      )}
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
