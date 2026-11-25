// interfaces/plano-manutencao/ContratosPmocSemPlano.tsx — E01-S203.
//
// A porta de entrada da decisão (b) da ADR-1698: dentro de Planos de Manutenção, a lista dos
// Contratos PMOC do Cliente que ainda NÃO têm Plano, com a ação de criar o Plano um a um.
// Atrás de `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED`, desligada por padrão.
//
// Regra de alcance (E00-S28): desligado, gate fechado, sem permissão, "nenhum contrato pendente"
// e "este Cliente não faz PMOC" são CINCO estados com CINCO frases diferentes. Nenhum
// `return null` silencioso — foi exatamente o que escondeu regra pronta em produção antes.
import { AvisoCarregando, Button } from "@sinergica/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { flagLigada } from "../../../../config/flags-sso";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { planoPmocQueryKeys } from "../../application/plano-pmoc-queries";
import {
  type ContratoPmocSemPlano as Contrato,
  FRASE_CLIENTE_SEM_PMOC,
  FRASE_NENHUM_CONTRATO_PENDENTE,
  FRASE_PMOC_INDISPONIVEL,
  mensagemDeErroDeCriacao,
  motivoDoErroPmoc,
  nomeSugeridoDoPlano,
  percentualConvertido,
} from "../../domain/plano-pmoc-manual";
import {
  criarPlanoDoContratoPmoc,
  listarContratosPmocSemPlano,
  resumirCoberturaPlanoPmoc,
} from "../../infrastructure/supabase-plano-pmoc-adapter";

export function ContratosPmocSemPlano({
  userId,
  clienteId,
}: { userId: string; clienteId: string }) {
  const ligada = flagLigada("VITE_SSO_PLANO_PMOC_MANUAL_ENABLED");
  const queryClient = useQueryClient();
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState<string | null>(null);

  const pendentes = useQuery({
    queryKey: planoPmocQueryKeys.pendentes(clienteId),
    enabled: ligada,
    // Gate fechado e falta de capacidade são recusas PERMANENTES: repetir só atrasa a frase certa.
    retry: false,
    queryFn: ({ signal }) => listarContratosPmocSemPlano(clienteId, signal),
  });
  const cobertura = useQuery({
    queryKey: planoPmocQueryKeys.cobertura(clienteId),
    enabled: ligada,
    retry: false,
    queryFn: ({ signal }) => resumirCoberturaPlanoPmoc(clienteId, signal),
  });

  const criar = useMutation({
    mutationFn: (contrato: Contrato) =>
      criarPlanoDoContratoPmoc({
        requestId: crypto.randomUUID(),
        clienteId,
        contratoPmocId: contrato.contratoId,
        nome: nomeSugeridoDoPlano(contrato),
      }),
    onSuccess: async () => {
      setErro("");
      setCriando(null);
      // O indicador de progresso é o ponto da story: ele precisa andar no mesmo clique.
      await queryClient.invalidateQueries({ queryKey: planoPmocQueryKeys.pendentes(clienteId) });
      await queryClient.invalidateQueries({ queryKey: planoPmocQueryKeys.cobertura(clienteId) });
      // O Plano recém-criado precisa aparecer na lista de Planos da MESMA tela.
      await queryClient.invalidateQueries({
        queryKey: planoManutencaoKeys.raiz(userId, clienteId),
      });
    },
    onError: (e) => {
      setCriando(null);
      setErro(mensagemDeErroDeCriacao(e));
    },
  });

  if (!ligada)
    return (
      <section aria-label="Contratos PMOC sem Plano">
        <p className="text-caption text-ink-3">{FRASE_PMOC_INDISPONIVEL["flag-desligada"]}</p>
      </section>
    );

  if (pendentes.isPending || cobertura.isPending)
    return (
      <section aria-label="Contratos PMOC sem Plano">
        {/* E00-S29 — a moldura da seção fica montada; só o aviso passa pelo anti-flash, então
            uma consulta rápida não pisca um texto que ninguém chega a ler. */}
        <AvisoCarregando>Consultando Contratos PMOC sem Plano…</AvisoCarregando>
      </section>
    );

  if (pendentes.isError || cobertura.isError)
    return (
      <section aria-label="Contratos PMOC sem Plano">
        <p role="alert" className="text-caption text-ink-3">
          {FRASE_PMOC_INDISPONIVEL[motivoDoErroPmoc(pendentes.error ?? cobertura.error)]}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void pendentes.refetch();
            void cobertura.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </section>
    );

  const lista = pendentes.data;
  const resumo = cobertura.data;

  return (
    <section
      aria-label="Contratos PMOC sem Plano"
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h3 className="text-body font-semibold text-ink">Contratos PMOC sem Plano de Manutenção</h3>
      <p className="text-caption text-ink-3">
        O Plano PMOC é criado à mão, um Contrato por vez (ADR-1698). Criar o Plano não altera, não
        move e não encerra o Contrato PMOC: ele continua sendo a execução legal, com a ART e o
        cronograma que já tem.
      </p>
      <p className="text-caption text-ink-3">
        {resumo.contratosComPlano} de {resumo.contratosTotal} Contratos PMOC deste Cliente já têm
        Plano ({percentualConvertido(resumo)}%).
        {resumo.contratosSemCliente > 0 && (
          <>
            {" "}
            Fora deste recorte, {resumo.contratosSemCliente} Contrato(s) PMOC estão em imóveis sem
            Cliente vinculado e precisam ser corrigidos no módulo PMOC antes de virarem Plano.
          </>
        )}
      </p>
      {erro && <p role="alert">{erro}</p>}

      {resumo.contratosTotal === 0 && (
        <p className="text-caption text-ink-3">{FRASE_CLIENTE_SEM_PMOC}</p>
      )}
      {resumo.contratosTotal > 0 && lista.length === 0 && (
        <p className="text-caption text-ink-3">{FRASE_NENHUM_CONTRATO_PENDENTE}</p>
      )}

      <ul>
        {lista.map((contrato) => (
          <li key={contrato.contratoId}>
            <strong>{contrato.imovelNome}</strong>
            {contrato.imovelCidade ? ` — ${contrato.imovelCidade}` : ""}
            {" · "}
            {contrato.artNumero ? `ART ${contrato.artNumero}` : "sem ART registrada"}
            {" · "}
            vigência {contrato.vigenciaInicio} a {contrato.vigenciaFim} ({contrato.status}){" · "}
            {contrato.equipamentosAtivos} equipamento(s) ativo(s), {contrato.agendamentos} visita(s)
            {contrato.periodicidades.length > 0
              ? ` (${contrato.periodicidades.join(", ")})`
              : " (sem cronograma)"}
            {criando === contrato.contratoId ? (
              <>
                <p>
                  Criar o Plano “{nomeSugeridoDoPlano(contrato)}” para este Contrato PMOC? O
                  Contrato não é alterado e nenhuma Rotina é gerada.
                </p>
                <Button
                  disabled={criar.isPending}
                  onClick={() => {
                    setErro("");
                    criar.mutate(contrato);
                  }}
                >
                  {criar.isPending ? "Criando…" : "Confirmar criação do Plano"}
                </Button>
                <Button variant="secondary" onClick={() => setCriando(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                disabled={criar.isPending}
                aria-label={`Criar Plano de Manutenção para o Contrato PMOC de ${contrato.imovelNome}`}
                onClick={() => {
                  setErro("");
                  setCriando(contrato.contratoId);
                }}
              >
                Criar Plano para este Contrato
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
