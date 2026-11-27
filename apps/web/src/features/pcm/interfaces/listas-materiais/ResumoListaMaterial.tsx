const estados: Readonly<Partial<Record<string, string>>> = {
  levantada: "Levantada",
  informada_disponivel: "Disponibilidade informada",
  parcial: "Parcial",
  indisponivel: "Indisponível",
  aguardando_aquisicao: "Aguardando aquisição",
  dispensada: "Dispensada",
  concluida: "Concluída",
};

export function rotuloEstadoListaMaterial(estado: string): string {
  return Object.hasOwn(estados, estado)
    ? (estados[estado] ?? "Estado indisponível")
    : "Estado indisponível";
}

/** O número deve vir dos resultados autorizados da mesma Central e ser associado pelo ID da OS. */
export function ResumoListaMaterial({
  estado,
  responsavel,
  revisao,
  numeroOs,
}: {
  estado: string;
  responsavel: "cliente" | "sinergica";
  revisao: number;
  numeroOs?: string | null;
}) {
  return (
    <>
      {numeroOs?.trim() ? `OS ${numeroOs}` : "Número da OS indisponível"} ·{" "}
      {responsavel === "cliente" ? "Cliente" : "Sinérgica"} · {rotuloEstadoListaMaterial(estado)} ·
      revisão {revisao}
    </>
  );
}
