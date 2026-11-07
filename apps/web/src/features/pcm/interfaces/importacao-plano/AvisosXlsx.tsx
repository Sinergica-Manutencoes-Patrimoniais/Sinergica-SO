import { useState } from "react";

type Item = { referencia: string; motivo: "formula" | "erro" };

/** Componente preparado para o leitor experimental; não habilita a importação. */
export function AvisosXlsx({ estado, itens }: { estado: "pendente" | "conferivel"; itens: readonly Item[] }) {
  const [pagina, setPagina] = useState(0);
  if (!itens.length) return null;
  const inicio = Math.min(pagina, Math.floor((itens.length - 1) / 100)) * 100;
  return <section aria-label="Avisos da planilha">
    <p role={estado === "pendente" ? "alert" : "status"}>
      {estado === "pendente"
        ? "Corrija as células necessárias com fórmula ou erro no arquivo antes de conferir."
        : "Valores armazenados em fórmulas ou erros de colunas auxiliares não foram usados."}
    </p>
    <ul>{itens.slice(inicio, inicio + 100).map((item, i) => <li key={`${item.referencia}:${inicio + i}`}>{item.referencia}: {item.motivo === "formula" ? "fórmula" : "erro"}</li>)}</ul>
    {itens.length > 100 && <>
      <p>Exibindo {Math.min(100, itens.length - inicio)} de {itens.length} avisos.</p>
      <button type="button" disabled={inicio === 0} onClick={() => setPagina(inicio / 100 - 1)}>Avisos anteriores</button>
      <button type="button" disabled={inicio + 100 >= itens.length} onClick={() => setPagina(inicio / 100 + 1)}>Próximos avisos</button>
    </>}
  </section>;
}
