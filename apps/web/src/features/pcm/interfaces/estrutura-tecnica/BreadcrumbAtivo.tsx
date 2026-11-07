import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

export function BreadcrumbAtivo({
  userId,
  clienteId,
  ativoId,
  localId,
}: { userId: string; clienteId: string; ativoId: string; localId: string | null }) {
  const habilitado = import.meta.env.VITE_SSO_BREADCRUMB_ATIVO_ENABLED === "true";
  const consulta = useQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, ativoId, localId, "breadcrumb-ativo"],
    enabled: habilitado,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const conferir = async () => {
        const s = await supabase.auth.getUser();
        if (s.error || s.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
      };
      await conferir();
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_breadcrumb_ativo", {
          p_ator: userId,
          p_cliente: clienteId,
          p_ativo: ativoId,
          p_local_esperado: localId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          clienteId: z.string().guid(),
          ativoId: z.string().guid(),
          estado: z.enum(["disponivel", "sem_posicao", "indisponivel", "ciclo", "limite"]),
          caminho: z.array(z.string()).max(66),
        })
        .strict()
        .parse(data);
      if (
        r.clienteId !== clienteId ||
        r.ativoId !== ativoId ||
        (r.estado === "disponivel" && r.caminho.length < 2) ||
        (r.estado !== "disponivel" && r.caminho.length !== 0)
      )
        throw new Error("Caminho divergente.");
      await conferir();
      return r;
    },
  });
  if (!habilitado) return null;
  if (consulta.isFetching || consulta.isPending) return <p>Consultando caminho físico…</p>;
  if (consulta.isError)
    return (
      <p role="alert">
        Caminho indisponível ou sem acesso.{" "}
        <button type="button" onClick={() => void consulta.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (consulta.data.estado !== "disponivel")
    return <p role="alert">Caminho não confirmado ({consulta.data.estado}).</p>;
  return (
    <p>
      Caminho físico: {consulta.data.caminho.join(" › ")}. Consultado neste momento; alterações
      posteriores não são refletidas automaticamente.
    </p>
  );
}
