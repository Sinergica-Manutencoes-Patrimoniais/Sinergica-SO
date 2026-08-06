/** E01-S126 — domínio puro do relatório operacional diário. */
export interface ItemAgendaRelatorio {
  id: string;
  clienteId: string;
  clienteNome: string;
  tecnicoId: string;
  tecnicoNome: string;
  data: string;
  horaInicio: string | null;
  /** A Agenda atual ainda não persiste serviço/local; ausente = não deduplicar por segurança. */
  descricao?: string | null;
}

export interface ItemOsPlanejadaRelatorio {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  tecnicoId: string | null;
  tecnicoNome: string | null;
  data: string | null;
  localDescricao: string | null;
  titulo: string;
  prioridade: string;
  createdAt: string;
}

export interface ItemRelatorioPlanejamento {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  tecnicoId: string | null;
  tecnicoNome: string;
  data: string;
  horaInicio: string | null;
  descricao: string;
  origem: "agenda" | "os";
  statusExecucao?: string | null;
  evidênciaAuvoUrl?: string | null;
}

export type ModoRelatorioPlanejamento = "planejamento" | "execucao";

function dataPtBr(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}` : data;
}

export function formatarTextoRelatorioPlanejamento(
  modo: ModoRelatorioPlanejamento,
  itens: readonly ItemRelatorioPlanejamento[],
): string {
  if (itens.length === 0) return "";
  const primeiro = itens[0];
  if (!primeiro) return "";
  const linhas = [
    `${modo === "planejamento" ? "Planejamento" : "Relatório"} - ${primeiro.clienteNome} - ${dataPtBr(primeiro.data)}`,
    `Técnico - ${primeiro.tecnicoNome || "Sem técnico"}`,
  ];
  itens.forEach((item, indice) => {
    linhas.push(`${indice + 1}º - ${item.descricao}`);
    if (modo === "execucao") {
      linhas.push(`• Status: ${item.statusExecucao ?? "Pendente"}`);
      if (item.evidênciaAuvoUrl) linhas.push(`OS Evidência: ${item.evidênciaAuvoUrl}`);
    }
  });
  return linhas.join("\n");
}

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function chave(item: Pick<ItemRelatorioPlanejamento, "clienteNome" | "descricao">): string {
  return `${normalizar(item.clienteNome)}:${normalizar(item.descricao)}`;
}

/** Une Agenda e OS em planejamento. Uma OS vence a Agenda equivalente, pois traz a descrição
 * operacional; o horário da Agenda é preservado quando a OS não o possui. */
export function unirItensPlanejamento(
  agenda: readonly ItemAgendaRelatorio[],
  ordens: readonly ItemOsPlanejadaRelatorio[],
): ItemRelatorioPlanejamento[] {
  const porChave = new Map<string, ItemRelatorioPlanejamento>();
  for (const item of agenda) {
    const convertido: ItemRelatorioPlanejamento = {
      id: `agenda:${item.id}`,
      clienteId: item.clienteId,
      clienteNome: item.clienteNome,
      tecnicoId: item.tecnicoId,
      tecnicoNome: item.tecnicoNome || "Sem técnico",
      data: item.data,
      horaInicio: item.horaInicio,
      descricao: item.descricao?.trim() || item.clienteNome,
      origem: "agenda",
    };
    const chaveAgenda = item.descricao?.trim() ? chave(convertido) : `agenda:${item.id}`;
    porChave.set(chaveAgenda, convertido);
  }
  for (const ordem of ordens) {
    if (!ordem.data) continue;
    const convertido: ItemRelatorioPlanejamento = {
      id: `os:${ordem.id}`,
      clienteId: ordem.clienteId,
      clienteNome: ordem.clienteNome,
      tecnicoId: ordem.tecnicoId,
      tecnicoNome: ordem.tecnicoNome ?? "Sem técnico",
      data: ordem.data,
      horaInicio: null,
      descricao: ordem.titulo,
      origem: "os",
    };
    const anterior = porChave.get(chave(convertido));
    porChave.set(chave(convertido), {
      ...convertido,
      horaInicio: anterior?.horaInicio ?? convertido.horaInicio,
    });
  }
  return [...porChave.values()].sort(
    (a, b) =>
      (a.horaInicio ?? "99:99").localeCompare(b.horaInicio ?? "99:99") ||
      a.descricao.localeCompare(b.descricao, "pt-BR"),
  );
}
