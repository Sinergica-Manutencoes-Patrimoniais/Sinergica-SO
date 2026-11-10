import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { definirConcessao, definirPerfil, definirVinculoPerfil } from "./capacidades-sso";
import type {
  CapacidadesSsoGateway,
  DefinirConcessaoCommand,
  DefinirPerfilCommand,
  DefinirVinculoPerfilCommand,
  PaginaCapacidade,
} from "./capacidades-sso-gateway";

const LIMITE = 50;
export const capacidadesSsoQueryKeys = {
  raiz: (userId: string) => ["capacidades-sso", userId] as const,
  lista: (userId: string, tipo: string) => [...capacidadesSsoQueryKeys.raiz(userId), tipo] as const,
};

function useLista<T>(
  userId: string,
  tipo: string,
  listar: (pagina: PaginaCapacidade) => Promise<T[]>,
) {
  return useInfiniteQuery({
    queryKey: capacidadesSsoQueryKeys.lista(userId, tipo),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listar({ inicio: pageParam, limite: LIMITE }),
    getNextPageParam: (ultima, todas) =>
      ultima.length === LIMITE ? todas.length * LIMITE : undefined,
    enabled: Boolean(userId),
    gcTime: 0,
  });
}

export function useConfiguracaoCapacidades(gateway: CapacidadesSsoGateway, userId: string) {
  const perfis = useLista(userId, "perfis", gateway.listarPerfis);
  const vinculos = useLista(userId, "vinculos", gateway.listarVinculos);
  const concessoes = useLista(userId, "concessoes", gateway.listarConcessoes);
  const usuarios = useLista(userId, "usuarios", gateway.listarUsuarios);
  const clientes = useLista(userId, "clientes", gateway.listarClientes);
  const queryClient = useQueryClient();
  const atualizar = () =>
    queryClient.invalidateQueries({ queryKey: capacidadesSsoQueryKeys.raiz(userId) });
  const perfil = useMutation({
    mutationFn: (c: DefinirPerfilCommand) => definirPerfil(gateway, c),
    onSuccess: atualizar,
  });
  const vinculo = useMutation({
    mutationFn: (c: DefinirVinculoPerfilCommand) => definirVinculoPerfil(gateway, c),
    onSuccess: atualizar,
  });
  const concessao = useMutation({
    mutationFn: (c: DefinirConcessaoCommand) => definirConcessao(gateway, c),
    onSuccess: atualizar,
  });
  return { perfis, vinculos, concessoes, usuarios, clientes, perfil, vinculo, concessao };
}
