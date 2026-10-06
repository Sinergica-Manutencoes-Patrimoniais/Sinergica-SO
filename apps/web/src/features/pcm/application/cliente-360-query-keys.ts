/** Chaves locais do cockpit; o cliente sempre faz parte da identidade de leitura. */
export const cliente360QueryKeys = {
  raiz: (clienteId: string) => ["pcm", "cliente-360", clienteId] as const,
  detalheOs: (clienteId: string, osId: string) =>
    [...cliente360QueryKeys.raiz(clienteId), "os", osId] as const,
  detalhePreventiva: (clienteId: string, ocorrenciaId: string) =>
    [...cliente360QueryKeys.raiz(clienteId), "ocorrencia-preventiva", ocorrenciaId] as const,
};
