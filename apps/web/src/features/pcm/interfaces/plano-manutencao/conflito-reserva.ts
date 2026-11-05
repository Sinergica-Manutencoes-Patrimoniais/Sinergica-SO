/** Identifica somente rejeições definitivas emitidas pelas guardas de reserva. */
export function conflitoReserva(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || !("message" in error)) return false;
  return error.code === "P0013" && typeof error.message === "string" && ["revisao_obsoleta", "plano_ou_revisao_indisponivel", "fotografia_obsoleta", "reserva_obsoleta", "escolha_obsoleta"].includes(error.message);
}
