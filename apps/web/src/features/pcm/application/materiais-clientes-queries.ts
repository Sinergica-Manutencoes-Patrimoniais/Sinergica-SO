import { useQuery } from "@tanstack/react-query";
export interface MateriaisClientesGateway {
  listar(usuario: string, signal?: AbortSignal): Promise<Array<{ id: string; nome: string }>>;
}
export function useClientesMateriais(gateway: MateriaisClientesGateway, usuario: string) {
  return useQuery({
    queryKey: ["materiais-clientes", usuario],
    queryFn: ({ signal }) => gateway.listar(usuario, signal),
    enabled: Boolean(usuario),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
