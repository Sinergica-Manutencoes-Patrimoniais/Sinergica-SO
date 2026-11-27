const rotulos = {
  disponibilidade: "Disponibilidade",
  excecao: "Exceção",
  aquisicao: "Aquisição",
  dispensa: "Dispensa",
  conclusao: "Conclusão",
} as const;

const dataHoraLocal = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function ResumoEventoMaterial({
  evento,
  usuario,
}: {
  evento: {
    revisao: number;
    tipo: keyof typeof rotulos;
    ator_id: string;
    criado_em: string;
  };
  usuario: string;
}) {
  return (
    <p>
      Revisão {evento.revisao} · {rotulos[evento.tipo]} ·{" "}
      {evento.ator_id === usuario ? "Registrado por você" : "Nome do responsável indisponível"} ·{" "}
      <time dateTime={evento.criado_em}>{dataHoraLocal.format(new Date(evento.criado_em))}</time>
    </p>
  );
}
