// application/ativos-cliente-queries.ts — E01-S155: dado de servidor do cadastro de ativos
// (posição, categoria, identificador) via TanStack Query, nunca useEffect+carregar() manual
// (regra do CLAUDE.md). Cada hook recebe o gateway por parâmetro (mesmo padrão de
// operacao-queries.ts/resumo-inicio-queries.ts) — quem chama injeta o adapter singleton.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { montarArvoreAtivos } from "../domain/arvore-ativos";
import { criarCatalogoSimples, listarCatalogoSimples } from "./catalogos-simples";
import type { CatalogosSimplesGateway } from "./catalogos-simples-gateway";
import {
  criarEquipamento,
  desativarEquipamento,
  editarEquipamento,
  listarEquipamentosPorCliente,
} from "./equipamentos";
import type {
  DesativarEquipamentoCommand,
  EditarEquipamentoCommand,
  EquipamentoCommand,
  EquipamentosGateway,
} from "./equipamentos-gateway";
import {
  alocarFerramenta,
  devolverFerramenta,
  listarAlocacoesCliente,
  listarFerramentasDisponiveis,
} from "./ferramenta-alocacao-cliente";
import type { FerramentaAlocacaoClienteGateway } from "./ferramenta-alocacao-cliente-gateway";
import type { HierarquiaGateway } from "./hierarquia-gateway";
import { previsualizarIdentificador } from "./identificador-ativo";
import type { EntradaIdentificadorAtivo, SiglaInformada } from "./identificador-ativo";
import type { IdentificadorAtivoGateway } from "./identificador-ativo-gateway";
import {
  criarSistema,
  desativarSistema,
  editarSistema,
  listarMembrosSistemasDoCliente,
  listarSistemas,
} from "./sistemas";
import type { EditarSistemaCommand, SistemaCommand, SistemasGateway } from "./sistemas-gateway";

export const ativosClienteQueryKeys = {
  areas: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "areas"] as const,
  locais: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "locais"] as const,
  categorias: () => ["pcm", "ativos", "categorias"] as const,
  componentes: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "componentes"] as const,
  sistemas: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "sistemas"] as const,
  membrosSistemas: (clienteId: string) =>
    ["pcm", "ativos-cliente", clienteId, "membros-sistemas"] as const,
  ferramentasAlocadas: (clienteId: string) =>
    ["pcm", "ativos-cliente", clienteId, "ferramentas-alocadas"] as const,
  ferramentasDisponiveis: () => ["pcm", "ativos-cliente", "ferramentas-disponiveis"] as const,
  previaIdentificador: (
    input: EntradaIdentificadorAtivo | null,
    siglasInformadas: readonly SiglaInformada[],
  ) =>
    [
      "pcm",
      "ativos",
      "previa-identificador",
      input?.clienteId ?? "",
      input?.areaId ?? "",
      input?.localId ?? "",
      input?.categoriaId ?? "",
      input?.nomeAtivo ?? "",
      siglasInformadas
        .map((sigla) => `${sigla.nivel}:${sigla.id}:${sigla.sigla}`)
        .sort()
        .join("|"),
    ] as const,
};

export function useAreasDoCliente(gateway: HierarquiaGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.areas(clienteId ?? ""),
    queryFn: () => gateway.listarAreas(clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

export function useCategoriasAtivo(gateway: CatalogosSimplesGateway) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.categorias(),
    queryFn: () => listarCatalogoSimples(gateway, "equipamento_categorias"),
  });
}

export function useCriarCategoriaAtivo(gateway: CatalogosSimplesGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      descricao,
      sigla,
      userId,
    }: { descricao: string; sigla: string; userId: string }) =>
      criarCatalogoSimples(gateway, { tipo: "equipamento_categorias", descricao, sigla, userId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ativosClienteQueryKeys.categorias() }),
  });
}

export function useLocaisDoCliente(gateway: HierarquiaGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.locais(clienteId ?? ""),
    queryFn: () => gateway.listarLocaisDoCliente(clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

export function useComponentesDoCliente(gateway: EquipamentosGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.componentes(clienteId ?? ""),
    queryFn: () => listarEquipamentosPorCliente(gateway, clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

export function useSistemasDoCliente(gateway: SistemasGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.sistemas(clienteId ?? ""),
    queryFn: () => listarSistemas(gateway, clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

export function useMembrosSistemasDoCliente(gateway: SistemasGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.membrosSistemas(clienteId ?? ""),
    queryFn: () => listarMembrosSistemasDoCliente(gateway, clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

/** E01-S160: compõe queries existentes; nenhuma request adicional para árvore. */
export function useArvoreAtivos({
  cliente,
  hierarquia,
  equipamentos,
  sistemas,
}: {
  cliente: { id: string; nome: string } | null;
  hierarquia: HierarquiaGateway;
  equipamentos: EquipamentosGateway;
  sistemas: SistemasGateway;
}) {
  const areas = useAreasDoCliente(hierarquia, cliente?.id ?? null);
  const locais = useLocaisDoCliente(hierarquia, cliente?.id ?? null);
  const componentes = useComponentesDoCliente(equipamentos, cliente?.id ?? null);
  const sistemasQuery = useSistemasDoCliente(sistemas, cliente?.id ?? null);
  const membros = useMembrosSistemasDoCliente(sistemas, cliente?.id ?? null);
  const data = useMemo(() => {
    if (
      !cliente ||
      !areas.data ||
      !locais.data ||
      !componentes.data ||
      !sistemasQuery.data ||
      !membros.data
    )
      return undefined;
    return montarArvoreAtivos({
      cliente,
      areas: areas.data,
      locais: locais.data,
      componentes: componentes.data,
      sistemas: sistemasQuery.data,
      membros: membros.data,
    });
  }, [cliente, areas.data, locais.data, componentes.data, sistemasQuery.data, membros.data]);
  return {
    data,
    isLoading:
      areas.isLoading ||
      locais.isLoading ||
      componentes.isLoading ||
      sistemasQuery.isLoading ||
      membros.isLoading,
    error: areas.error ?? locais.error ?? componentes.error ?? sistemasQuery.error ?? membros.error,
    refetch: () =>
      Promise.all([
        areas.refetch(),
        locais.refetch(),
        componentes.refetch(),
        sistemasQuery.refetch(),
        membros.refetch(),
      ]),
  };
}

export function useFerramentasAlocadas(
  gateway: FerramentaAlocacaoClienteGateway,
  clienteId: string | null,
) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.ferramentasAlocadas(clienteId ?? ""),
    queryFn: () => listarAlocacoesCliente(gateway, clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

export function useFerramentasDisponiveis(gateway: FerramentaAlocacaoClienteGateway) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.ferramentasDisponiveis(),
    queryFn: () => listarFerramentasDisponiveis(gateway),
  });
}

function invalidarComponentes(queryClient: ReturnType<typeof useQueryClient>, clienteId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ativosClienteQueryKeys.componentes(clienteId) }),
    queryClient.invalidateQueries({ queryKey: ativosClienteQueryKeys.membrosSistemas(clienteId) }),
  ]);
}

function invalidarSistemas(queryClient: ReturnType<typeof useQueryClient>, clienteId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ativosClienteQueryKeys.sistemas(clienteId) }),
    queryClient.invalidateQueries({ queryKey: ativosClienteQueryKeys.membrosSistemas(clienteId) }),
  ]);
}

export function useCriarComponente(
  gateway: EquipamentosGateway,
  identificador?: IdentificadorAtivoGateway,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EquipamentoCommand) =>
      criarEquipamento(
        gateway,
        input,
        identificador
          ? {
              identificador,
              siglasInformadas: input.siglasInformadas ?? [],
              identificadorManual: input.alterarIdentificador
                ? (input.identificadorManual ?? null)
                : null,
            }
          : undefined,
      ),
    onSuccess: (_resultado, input) => invalidarComponentes(queryClient, input.clientId ?? ""),
  });
}

export function useEditarComponente(
  gateway: EquipamentosGateway,
  identificador?: IdentificadorAtivoGateway,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarEquipamentoCommand) =>
      editarEquipamento(
        gateway,
        input,
        identificador && input.alterarIdentificador && input.identificadorManual === null
          ? {
              identificador,
              siglasInformadas: input.siglasInformadas ?? [],
              identificadorManual: null,
            }
          : undefined,
      ),
    onSuccess: (_resultado, input) => invalidarComponentes(queryClient, input.clientId ?? ""),
  });
}

export function useDesativarComponente(gateway: EquipamentosGateway, clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DesativarEquipamentoCommand) => desativarEquipamento(gateway, input),
    onSuccess: () => invalidarComponentes(queryClient, clienteId),
  });
}

export function useCriarSistema(
  gateway: SistemasGateway,
  identificador?: IdentificadorAtivoGateway,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SistemaCommand) =>
      criarSistema(
        gateway,
        input,
        identificador
          ? {
              identificador,
              siglasInformadas: input.siglasInformadas ?? [],
              identificadorManual: input.alterarIdentificador
                ? (input.identificadorManual ?? null)
                : null,
            }
          : undefined,
      ),
    onSuccess: (_resultado, input) => invalidarSistemas(queryClient, input.clienteId),
  });
}

export function useEditarSistema(
  gateway: SistemasGateway,
  identificador?: IdentificadorAtivoGateway,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarSistemaCommand) =>
      editarSistema(
        gateway,
        input,
        identificador && input.alterarIdentificador && input.identificadorManual === null
          ? {
              identificador,
              siglasInformadas: input.siglasInformadas ?? [],
              identificadorManual: null,
            }
          : undefined,
      ),
    onSuccess: (_resultado, input) => invalidarSistemas(queryClient, input.clienteId),
  });
}

export function useDesativarSistema(gateway: SistemasGateway, clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      desativarSistema(gateway, id, userId),
    onSuccess: () => invalidarSistemas(queryClient, clienteId),
  });
}

export function useAlocarFerramenta(gateway: FerramentaAlocacaoClienteGateway, clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ferramentaId, userId }: { ferramentaId: string; userId: string }) =>
      alocarFerramenta(gateway, ferramentaId, clienteId, userId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ativosClienteQueryKeys.ferramentasAlocadas(clienteId),
        }),
        queryClient.invalidateQueries({
          queryKey: ativosClienteQueryKeys.ferramentasDisponiveis(),
        }),
      ]),
  });
}

export function useDevolverFerramenta(
  gateway: FerramentaAlocacaoClienteGateway,
  clienteId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alocacaoId, userId }: { alocacaoId: string; userId: string }) =>
      devolverFerramenta(gateway, alocacaoId, userId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ativosClienteQueryKeys.ferramentasAlocadas(clienteId),
        }),
        queryClient.invalidateQueries({
          queryKey: ativosClienteQueryKeys.ferramentasDisponiveis(),
        }),
      ]),
  });
}

/** Preview somente no servidor de dados: a UI mantém o último resultado enquanto o usuário edita. */
export function usePreviaIdentificador(
  gateway: IdentificadorAtivoGateway,
  input: EntradaIdentificadorAtivo | null,
  siglasInformadas: readonly SiglaInformada[] = [],
) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.previaIdentificador(input, siglasInformadas),
    queryFn: () => {
      if (!input) throw new Error("Dados insuficientes para gerar o identificador.");
      return previsualizarIdentificador(gateway, input, siglasInformadas);
    },
    enabled: Boolean(input?.clienteId && input.categoriaId && input.nomeAtivo.trim()),
    placeholderData: keepPreviousData,
  });
}
