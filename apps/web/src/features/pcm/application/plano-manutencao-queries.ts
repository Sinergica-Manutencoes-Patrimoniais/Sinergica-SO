import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adicionarRotina,
  adicionarRotinaCompleta,
  editarRotina,
  salvarPlanoRascunho,
} from "./plano-manutencao";
import type {
  AdicionarRotinaCompletaGateway,
  AdicionarRotinaGateway,
  ConsultarPlanosGateway,
  ConsultarRotinasGateway,
  ConsultarVersoesGateway,
  EditarRotinaCommand,
  EditarRotinaGateway,
  RotinaCommand,
  SalvarPlanoCommand,
  SalvarPlanoGateway,
} from "./plano-manutencao-gateway";

type Gateway = SalvarPlanoGateway &
  AdicionarRotinaGateway &
  EditarRotinaGateway &
  ConsultarPlanosGateway &
  ConsultarVersoesGateway &
  ConsultarRotinasGateway;
const LIMITE = 50;
export const planoManutencaoKeys = {
  raiz: (usuario: string, cliente: string) => ["plano-manutencao", usuario, cliente] as const,
  planos: (usuario: string, cliente: string) =>
    [...planoManutencaoKeys.raiz(usuario, cliente), "planos"] as const,
  versoes: (usuario: string, cliente: string, plano: string) =>
    [...planoManutencaoKeys.raiz(usuario, cliente), "versoes", plano] as const,
  rotinas: (usuario: string, cliente: string, plano: string, versao: string) =>
    [...planoManutencaoKeys.raiz(usuario, cliente), "rotinas", plano, versao] as const,
};
const proximo = <T extends { id: string }>(pagina: T[]) =>
  pagina.length === LIMITE ? pagina.at(-1)?.id : undefined;

export function usePlanosManutencao(
  gateway: Gateway,
  usuario: string,
  cliente: string,
  permitido: boolean,
) {
  const queryClient = useQueryClient();
  const planos = useInfiniteQuery({
    queryKey: planoManutencaoKeys.planos(usuario, cliente),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => gateway.listarPlanos(cliente, LIMITE, pageParam, signal),
    getNextPageParam: proximo,
    enabled: Boolean(usuario && cliente && permitido),
    gcTime: 0,
  });
  const escopo = () => ({ usuario, cliente });
  const atualizar = async (
    _resultado: unknown,
    _comando: unknown,
    contexto: ReturnType<typeof escopo> | undefined,
  ) => {
    if (contexto)
      await queryClient.invalidateQueries({
        queryKey: planoManutencaoKeys.raiz(contexto.usuario, contexto.cliente),
      });
  };
  const salvar = useMutation({
    mutationFn: (c: SalvarPlanoCommand) => {
      if (c.clienteId !== cliente) throw new Error("Cliente diferente do contexto atual.");
      return salvarPlanoRascunho(gateway, c);
    },
    onMutate: escopo,
    onSuccess: atualizar,
  });
  const adicionar = useMutation({
    mutationFn: (c: RotinaCommand) => adicionarRotina(gateway, c),
    onMutate: escopo,
    onSuccess: atualizar,
  });
  const editar = useMutation({
    mutationFn: (c: EditarRotinaCommand) => editarRotina(gateway, c),
    onMutate: escopo,
    onSuccess: atualizar,
  });
  return { planos, salvar, adicionar, editar };
}

export function useAdicionarRotinaCompleta(
  gateway: AdicionarRotinaCompletaGateway,
  usuario: string,
  cliente: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (c: EditarRotinaCommand) => adicionarRotinaCompleta(gateway, c),
    onMutate: () => ({ usuario, cliente }),
    onSuccess: async (_resultado, _comando, contexto) => {
      if (contexto)
        await queryClient.invalidateQueries({
          queryKey: planoManutencaoKeys.raiz(contexto.usuario, contexto.cliente),
        });
    },
  });
}
export function useEditarRotina(gateway: EditarRotinaGateway, usuario: string, cliente: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (c: EditarRotinaCommand) => editarRotina(gateway, c),
    onMutate: () => ({ usuario, cliente }),
    onSuccess: async (_resultado, _comando, contexto) => {
      if (contexto)
        await queryClient.invalidateQueries({
          queryKey: planoManutencaoKeys.raiz(contexto.usuario, contexto.cliente),
        });
    },
  });
}

export function useVersoesPlano(
  gateway: ConsultarVersoesGateway,
  usuario: string,
  cliente: string,
  plano: string,
  permitido: boolean,
) {
  return useInfiniteQuery({
    queryKey: planoManutencaoKeys.versoes(usuario, cliente, plano),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => gateway.listarVersoes(plano, LIMITE, pageParam, signal),
    getNextPageParam: proximo,
    enabled: Boolean(usuario && cliente && plano && permitido),
    gcTime: 0,
  });
}
export function useRotinasPlano(
  gateway: ConsultarRotinasGateway,
  usuario: string,
  cliente: string,
  plano: string,
  versao: string,
  permitido: boolean,
) {
  return useInfiniteQuery({
    queryKey: planoManutencaoKeys.rotinas(usuario, cliente, plano, versao),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      gateway.listarRotinas(plano, versao, LIMITE, pageParam, signal),
    getNextPageParam: proximo,
    enabled: Boolean(usuario && cliente && plano && versao && permitido),
    gcTime: 0,
  });
}
