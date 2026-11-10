import { Button } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { supabase } from "../../../../lib/supabase-client";

export function QuestionarioAprovado({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
}) {
  const consulta = useQuery({
    queryKey: [
      ...planoManutencaoKeys.raiz(userId, clienteId),
      "questionario-aprovado",
      planoId,
      versaoId,
      rotinaId,
    ],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const resultado = await supabasePlanoManutencaoAdapter.consultarQuestionarioAprovado(
        planoId,
        versaoId,
        rotinaId,
        signal,
      );
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
    gcTime: 0,
    retry: false,
  });
  if (consulta.isFetching) return <output>Carregando questionário histórico…</output>;
  if (consulta.isError)
    return (
      <div role="alert">
        Não foi possível consultar o questionário histórico.{" "}
        <Button variant="secondary" onClick={() => void consulta.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const questionario = consulta.data?.questionario;
  if (!questionario) return <p>Nenhum questionário vinculado nesta versão.</p>;
  const textos = questionario.perguntas.map((pergunta) => {
    if (
      pergunta &&
      typeof pergunta === "object" &&
      "texto" in pergunta &&
      typeof pergunta.texto === "string" &&
      pergunta.texto.trim()
    )
      return pergunta.texto;
    return null;
  });
  const desconhecidos = textos.filter((texto) => texto === null).length;
  const repeticoes = new Map<string | null, number>();
  const itens = textos.map((texto) => {
    const ocorrencia = (repeticoes.get(texto) ?? 0) + 1;
    repeticoes.set(texto, ocorrencia);
    return { texto, chave: JSON.stringify([texto, ocorrencia]) };
  });
  return (
    <section aria-label="Questionário histórico">
      <p>Textos registrados na aprovação desta versão. Esta projeção não apresenta necessariamente opções, obrigatoriedade ou todos os campos do questionário; confira a fotografia completa antes de utilizá-lo.</p>
      <strong>{questionario.nome}</strong>
      {questionario.cabecalho && <p>{questionario.cabecalho}</p>}
      <ol>
        {itens.map((item) => (
          <li key={item.chave}>{item.texto ?? "Conteúdo não reconhecido; consulte a fotografia completa."}</li>
        ))}
      </ol>
      {desconhecidos > 0 && (
        <p>
          {desconhecidos}{" "}
          {desconhecidos === 1 ? "item sem texto reconhecido" : "itens sem texto reconhecido"}.
          Consulte a origem antes de usar este conteúdo.
        </p>
      )}
      {questionario.rodape && <p>{questionario.rodape}</p>}
    </section>
  );
}
