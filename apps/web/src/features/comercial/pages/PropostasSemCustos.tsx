import { Button, Card } from "@sinergica/ui";
import { usePropostasSemCustos } from "../application/propostas-sem-custos-queries";
import { supabasePropostasSemCustosAdapter } from "../infrastructure/supabase-propostas-sem-custos-adapter";
import { CustosProposta } from "../../pcm/interfaces/reconciliacao/CustosProposta";

export function PropostasSemCustos({
  userId,
  clienteId,
  oportunidadeId,
  onVoltar,
}: {
  userId: string;
  clienteId: string;
  oportunidadeId: string;
  onVoltar: () => void;
}) {
  const query = usePropostasSemCustos(
    supabasePropostasSemCustosAdapter,
    userId,
    clienteId,
    oportunidadeId,
  );
  return (
    <section className="space-y-4">
      <Button type="button" onClick={onVoltar}>
        Voltar
      </Button>
      <h1 className="text-xl font-semibold">Propostas</h1>
      <p>A composição de custos é restrita a usuários autorizados.</p>
      {query.isPending && <output>Carregando propostas…</output>}
      {query.isError && <p role="alert">Não foi possível carregar as propostas.</p>}
      {query.isSuccess && query.data.length === 0 && <p>Nenhuma proposta encontrada.</p>}
      {query.isSuccess &&
        query.data.map((proposta) => (
          <Card key={proposta.id}>
            <p className="font-semibold">
              {proposta.tipo} · versão {proposta.versao}
            </p>
            <p>Status: {proposta.status}</p>
            {proposta.escopo && <p>{proposta.escopo}</p>}
            <p>
              Valor:{" "}
              {(proposta.precoCentavos / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
            {import.meta.env.VITE_SSO_CUSTOS_PROPOSTA_ESCOPADOS_ENABLED === "true" && <CustosProposta key={`${userId}:${clienteId}:${proposta.id}`} userId={userId} clienteId={clienteId} propostaId={proposta.id} />}
          </Card>
        ))}
    </section>
  );
}
