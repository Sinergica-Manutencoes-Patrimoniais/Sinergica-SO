export function conflitoPreparacaoVisita(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    ((error.code === "P0016" &&
      (error.message === "revisao_obsoleta" ||
        error.message === "revisao_ou_plano_indisponivel")) ||
      (error.code === "P0020" && error.message === "visita_candidata_alterada"))
  );
}
