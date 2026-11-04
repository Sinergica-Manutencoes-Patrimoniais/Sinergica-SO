import { Button } from "@sinergica/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import {
  aprovarPlano,
  iniciarRevisao,
  transicionarRevisao,
  validarAprovacaoPlano,
  validarInicioRevisao,
  validarTransicaoRevisao,
} from "../../application/plano-manutencao";
import type {
  AprovarPlanoCommand,
  IniciarRevisaoPlanoCommand,
  PlanoResumo,
  ResultadoPlano,
  TransicionarRevisaoCommand,
} from "../../application/plano-manutencao-gateway";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { aprovarRevisaoPreparada, supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { DiagnosticoFusoVigencia } from "./DiagnosticoFusoVigencia";
import { PreflightAprovacaoRevisao } from "./PreflightAprovacaoRevisao";

type Operacao =
  | { tipo: "transicao"; comando: TransicionarRevisaoCommand }
  | { tipo: "aprovacao"; comando: AprovarPlanoCommand }
  | { tipo: "aprovacao_revisao"; comando: AprovarPlanoCommand }
  | { tipo: "inicio"; comando: IniciarRevisaoPlanoCommand };

function validarOperacao(valor: unknown, planoId: string): Operacao {
  if (!valor || typeof valor !== "object" || !("tipo" in valor) || !("comando" in valor))
    throw new Error("Operação inválida");
  const comando =
    valor.tipo === "transicao"
      ? validarTransicaoRevisao(valor.comando as TransicionarRevisaoCommand)
      : valor.tipo === "aprovacao" || valor.tipo === "aprovacao_revisao"
        ? validarAprovacaoPlano(valor.comando as AprovarPlanoCommand)
        : valor.tipo === "inicio"
          ? validarInicioRevisao(valor.comando as IniciarRevisaoPlanoCommand)
          : null;
  if (!comando || comando.planoId !== planoId) throw new Error("Plano divergente");
  return valor.tipo === "transicao"
    ? { tipo: "transicao", comando: comando as TransicionarRevisaoCommand }
    : valor.tipo === "inicio"
      ? { tipo: "inicio", comando: comando as IniciarRevisaoPlanoCommand }
      : { tipo: valor.tipo === "aprovacao_revisao" ? "aprovacao_revisao" : "aprovacao", comando: comando as AprovarPlanoCommand };
}

const descricao: Record<string, string> = {
  tempo_a_validar: "tempo a validar",
  tipo_tempo: "referência do tempo a validar",
  recorrencia: "recorrência não informada",
  data_base: "data-base não informada",
  instrucao_ou_questionario: "instrução ou questionário não informado",
  alvo_indisponivel: "alvo indisponível",
  questionario_indisponivel: "questionário indisponível",
};
type Aviso = { rotinaId: string; pendencias: string[] };
function lerDetalhes(erro: unknown): Aviso[] {
  try {
    if (
      !erro ||
      typeof erro !== "object" ||
      !("details" in erro) ||
      typeof erro.details !== "string"
    )
      return [];
    const dados: unknown = JSON.parse(erro.details);
    if (!Array.isArray(dados)) return [];
    return dados.filter(
      (item): item is Aviso =>
        typeof item?.rotinaId === "string" &&
        Array.isArray(item?.pendencias) &&
        item.pendencias.every((p: unknown) => typeof p === "string"),
    );
  } catch {
    return [];
  }
}

export function AcoesRevisaoPlano({
  userId,
  clienteId,
  plano,
  bloqueado,
}: { userId: string; clienteId: string; plano: PlanoResumo; bloqueado: boolean }) {
  const chave = `sso-plano-revisao:${userId}:${clienteId}:${plano.id}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      return {
        operacao: salvo ? validarOperacao(JSON.parse(salvo), plano.id) : null,
        falhou: false,
      };
    } catch {
      return { operacao: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState<Operacao | null>(recuperacao.operacao);
  const trava = useRef(false);
  const [escolha, alterarEscolha] = useState<
    "submeter" | "devolver" | "aprovar" | "aprovar_revisao" | "iniciar" | null
  >(null);
  const [revisaoEscolha, setRevisaoEscolha] = useState<number | null>(null);
  function setEscolha(valor: typeof escolha) {
    setRevisaoEscolha(valor === null ? null : plano.revisao);
    alterarEscolha(valor);
  }
  const revisaoMudou = escolha !== null && revisaoEscolha !== plano.revisao;
  const [vigencia, setVigencia] = useState("");
  const [erro, setErro] = useState("");
  const [detalhes, setDetalhes] = useState<Aviso[]>([]);
  const [avisos, setAvisos] = useState<ResultadoPlano["warnings"]>([]);
  const queryClient = useQueryClient();
  async function exigirAtor() {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  const operacao = useMutation({
    mutationFn: (pedido: Operacao) =>
      pedido.tipo === "aprovacao_revisao"
        ? aprovarRevisaoPreparada(validarAprovacaoPlano(pedido.comando), { userId, clienteId })
        : pedido.tipo === "aprovacao"
        ? aprovarPlano(supabasePlanoManutencaoAdapter, pedido.comando)
        : pedido.tipo === "inicio"
          ? iniciarRevisao(supabasePlanoManutencaoAdapter, pedido.comando)
          : transicionarRevisao(supabasePlanoManutencaoAdapter, pedido.comando),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) }),
  });
  async function enviar(pedido: Operacao, primeiraTentativa = false) {
    if (trava.current) return;
    setErro("");
    setDetalhes([]);
    if (pedido.tipo === "aprovacao_revisao" && import.meta.env.VITE_SSO_APROVAR_REVISAO_ENABLED !== "true") {
      setErro("A aprovação de revisão está desativada. O pedido permanece guardado para conferência.");
      return;
    }
    trava.current = true;
    try {
      await exigirAtor();
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Tentativa alterada.");
      const resultado = await operacao.mutateAsync(pedido);
      await exigirAtor();
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) {
        setErro("Operação confirmada, mas o pedido local mudou. Reabra e reconcilie antes de continuar.");
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null);
      setEscolha(null);
      setAvisos(resultado.warnings);
    } catch (falha) {
      const codigo =
        typeof falha === "object" && falha !== null && "code" in falha ? String(falha.code) : "";
      if (primeiraTentativa && ["22023", "23514", "40001"].includes(codigo)) {
        try {
          await exigirAtor();
          if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) {
            setErro("O pedido local mudou durante a operação. Reabra e reconcilie antes de continuar.");
            return;
          }
          sessionStorage.removeItem(chave);
          setPendente(null);
          setEscolha(null);
          setDetalhes(lerDetalhes(falha));
          setErro(
            codigo === "23514" &&
              typeof falha === "object" &&
              falha !== null &&
              "message" in falha &&
              falha.message === "revisao_sem_vigencia_segura"
              ? "A aprovação de nova versão está bloqueada até concluir a conferência de vigências e impactos. A versão aprovada permanece preservada."
              : codigo === "40001"
                ? "O Plano mudou. Confira os dados atualizados antes de tentar novamente."
                : "O servidor recusou a operação. Confira os dados do Plano e das Rotinas.",
          );
          await queryClient.invalidateQueries({
            queryKey: planoManutencaoKeys.raiz(userId, clienteId),
          });
          return;
        } catch {
          /* Mantém o pedido quando a limpeza não pode ser confirmada. */
        }
      }
      setErro(
        codigo === "42501"
          ? "Permissão indisponível. O pedido permanece pendente para conferência."
          : codigo === "55P03" && typeof falha === "object" && falha !== null && "message" in falha && falha.message === "autorizacao_em_alteracao"
          ? "As permissões estão sendo atualizadas. Aguarde e repita o mesmo pedido."
          : "Não foi possível confirmar a operação. Tente novamente com os mesmos dados.",
      );
    } finally {
      trava.current = false;
    }
  }
  function confirmar() {
    if (!escolha || revisaoMudou || bloqueado || operacao.isPending || trava.current) return;
    const base = {
      requestId: crypto.randomUUID(),
      expectedRevision: plano.revisao,
      planoId: plano.id,
    };
    try {
      if (sessionStorage.getItem(chave) !== null) {
        setErro(
          "Existe uma operação pendente neste Plano. Confira o pedido anterior antes de continuar.",
        );
        return;
      }
      const sufixo = `:${userId}:${clienteId}:${plano.id}`;
      for (let i = 0; i < sessionStorage.length; i++) {
        const item = sessionStorage.key(i);
        if (item?.startsWith("sso-rotina-") && item.endsWith(sufixo)) {
          setErro("Resolva o salvamento pendente da Rotina antes de continuar.");
          return;
        }
      }
      const pedido: Operacao =
        escolha === "aprovar" || escolha === "aprovar_revisao"
          ? { tipo: escolha === "aprovar" ? "aprovacao" : "aprovacao_revisao", comando: validarAprovacaoPlano({ ...base, vigencia }) }
          : escolha === "iniciar"
            ? {
                tipo: "inicio",
                comando: validarInicioRevisao({ ...base, novaVersaoId: crypto.randomUUID() }),
              }
            : { tipo: "transicao", comando: validarTransicaoRevisao({ ...base, acao: escolha }) };
      sessionStorage.setItem(chave, JSON.stringify(pedido));
      setPendente(pedido);
      void enviar(pedido, true);
    } catch {
      setErro("Confira a vigência e o armazenamento antes de confirmar.");
    }
  }
  return (
    <section aria-label={`Revisão de ${plano.nome}`}>
      {bloqueado && (plano.estado === "rascunho" || plano.estado === "em_revisao") && (
        <p>Conclua ou cancele a edição aberta antes de alterar a revisão do Plano.</p>
      )}
      {recuperacao.falhou && (
        <p role="alert">
          Não foi possível recuperar operação anterior. Consulte o suporte antes de continuar.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {revisaoMudou && !pendente && (
        <p role="alert">
          O Plano mudou enquanto esta ação estava aberta. Cancele, confira os dados atuais e tente
          novamente.
        </p>
      )}
      {detalhes.map((item) => (
        <p key={item.rotinaId}>
          Rotina {item.rotinaId}: {item.pendencias.map((p) => descricao[p] ?? p).join(", ")}
        </p>
      ))}
      {avisos.map((item, i) => (
        <p key={typeof item === "string" ? item : item.rotinaId}>
          {typeof item === "string"
            ? (descricao[item] ?? item)
            : `Rotina ${item.rotinaId}: ${item.pendencias.map((p) => descricao[p] ?? p).join(", ")}`}
        </p>
      ))}
      {pendente && (
        <Button
          variant="secondary"
          disabled={operacao.isPending}
          aria-label={`Tentar operação de ${plano.nome} novamente`}
          onClick={() => void enviar(pendente)}
        >
          Tentar novamente
        </Button>
      )}
      {!pendente && !recuperacao.falhou && !escolha && plano.estado === "rascunho" && (
        <Button
          variant="secondary"
          aria-label={`Enviar ${plano.nome} para revisão`}
          disabled={bloqueado}
          onClick={() => setEscolha("submeter")}
        >
          Enviar para revisão
        </Button>
      )}
      {!pendente && !recuperacao.falhou && !escolha && plano.estado === "aprovado" && (
        <Button
          variant="secondary"
          aria-label={`Iniciar revisão de ${plano.nome}`}
          disabled={bloqueado}
          onClick={() => setEscolha("iniciar")}
        >
          Iniciar revisão
        </Button>
      )}
      {!pendente && !recuperacao.falhou && !escolha && plano.estado === "em_revisao" && (
        <>
          <Button
            variant="secondary"
            aria-label={`Devolver ${plano.nome} para rascunho`}
            disabled={bloqueado}
            onClick={() => setEscolha("devolver")}
          >
            Devolver para rascunho
          </Button>
          <Button
            variant="secondary"
            aria-label={`Aprovar ${plano.nome}`}
            disabled={bloqueado}
            onClick={() => setEscolha("aprovar")}
          >
            Aprovar
          </Button>
          {import.meta.env.VITE_SSO_APROVAR_REVISAO_ENABLED === "true" && (
            <Button variant="secondary" disabled={bloqueado} onClick={() => setEscolha("aprovar_revisao")}>
              Aprovar revisão de versão
            </Button>
          )}
        </>
      )}
      {escolha && !pendente && (
        <div>
          <p>
            {escolha === "iniciar"
              ? "A nova versão será um rascunho e não será aprovada até a conferência completa de impactos. A versão aprovada será preservada."
              : escolha === "aprovar_revisao"
                ? "A nova vigência encerra a versão anterior no dia anterior. Confira impactos antes da aprovação. Nenhuma tarefa é criada."
              : escolha === "aprovar"
                ? "A aprovação congela esta versão, sem criar tarefas."
                : escolha === "submeter"
                  ? "Enviar este Plano para revisão?"
                  : "Devolver este Plano para correção?"}
          </p>
          {(escolha === "aprovar" || escolha === "aprovar_revisao") && (
            <label>
              Início da vigência
              <input
                className="input"
                type="date"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            </label>
          )}
          {escolha === "aprovar_revisao" && import.meta.env.VITE_SSO_DIAGNOSTICO_FUSO_VIGENCIA_ENABLED === "true" && <DiagnosticoFusoVigencia userId={userId} clienteId={clienteId} planoId={plano.id} revisao={plano.revisao} />}
          {escolha === "aprovar_revisao" && import.meta.env.VITE_SSO_PREFLIGHT_APROVACAO_REVISAO_ENABLED === "true" && <PreflightAprovacaoRevisao userId={userId} clienteId={clienteId} planoId={plano.id} revisao={plano.revisao} vigencia={vigencia} />}
          {escolha === "aprovar_revisao" && <p role="status">A aprovação permanece bloqueada até comprovar integralmente os impactos.</p>}
          <Button disabled={operacao.isPending || bloqueado || revisaoMudou || escolha === "aprovar_revisao"} onClick={confirmar}>
            {escolha === "iniciar"
              ? "Confirmar início da revisão"
              : escolha === "aprovar" || escolha === "aprovar_revisao"
                ? "Confirmar aprovação"
                : escolha === "submeter"
                  ? "Confirmar envio para revisão"
                  : "Confirmar devolução"}
          </Button>
          <Button variant="secondary" onClick={() => setEscolha(null)}>
            Cancelar
          </Button>
        </div>
      )}
    </section>
  );
}
