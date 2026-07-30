export function resolverUrlPortal(urlConfigurada: string | undefined, origemAtual: string): string {
  const configurada = urlConfigurada?.trim();
  return configurada || origemAtual;
}

export function usaDeploySeparado(
  urlConfigurada: string | undefined,
  origemAtual: string,
): boolean {
  const configurada = urlConfigurada?.trim();
  return Boolean(configurada && configurada !== origemAtual);
}
