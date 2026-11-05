export function conflitoPreparacaoVisita(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P0016" && "message" in error && (error.message === "revisao_obsoleta" || error.message === "revisao_ou_plano_indisponivel");
}
