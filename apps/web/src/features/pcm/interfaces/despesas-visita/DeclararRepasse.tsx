import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../../lib/mensagem-ativacao";
import { supabase } from "../../../../lib/supabase-client";
import {
  type DespesaVisitaListada,
  type DeclararRepasse as Pedido,
  declararRepasse,
  validarDeclararRepasse,
} from "../../infrastructure/supabase-despesas-visita-adapter";

type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };

export function DeclararRepasse(props: Props) {
  if (import.meta.env.VITE_SSO_REPASSE_DESPESAS_VISITA_ENABLED !== "true") return null;
  if (props.despesa.status !== "ativa" || props.despesa.realizadoCentavos === null) return null;
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])}
      {...props}
    />
  );
}

function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-repasse-despesa:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const queryClient = useQueryClient();
  const [mes, setMes] = useState("");
  const [regra, setRegra] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = validarDeclararRepasse(JSON.parse(salvo));
      return pedido.despesaId === despesa.id ? pedido : "invalido";
    } catch {
      return "invalido";
    }
  });
  const fotografia = JSON.stringify([
    userId,
    clienteId,
    visitaId,
    despesa.id,
    despesa.revisao,
    despesa.realizadoCentavos,
    mes,
    regra,
    motivo,
  ]);
  const confirmado = confirmacao === fotografia;
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  const enviar = useMutation({
    mutationFn: async (pedido: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido))
        throw new Error("Tentativa divergente.");
      const resultado = await declararRepasse(pedido);
      await conferirSessao();
      return resultado;
    },
    onSuccess: async (_resultado, pedido) => {
      try {
        await queryClient.invalidateQueries({
          queryKey: ["despesas-visita", userId, clienteId, visitaId, "lista"],
          refetchType: "none",
        });
        await conferirSessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido))
          throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(chave);
      } catch {
        setMensagem(
          "Repasse registrado, mas tentativa local não pôde ser removida. Contate suporte.",
        );
        return;
      }
      setPendente(null);
      setConfirmacao(null);
      setMensagem("Repasse enviado para conferência; nenhuma cobrança foi gerada.");
      void queryClient.refetchQueries({
        queryKey: ["despesas-visita", userId, clienteId, visitaId, "lista"],
        type: "active",
      });
    },
    onError: (erro) => {
      // E01-S189 AC-5: "não liberado"/"sem permissão" não se resolvem repetindo a tentativa.
      const falha = mensagemFalhaAtivacao(erro);
      if (falha) {
        setPendente(null);
        try {
          sessionStorage.removeItem(chave);
        } catch {
          /* best-effort */
        }
        setMensagem(TEXTO_FALHA_ATIVACAO[falha]);
        return;
      }
      setMensagem(
        "Resultado não confirmado. Repita a mesma tentativa; não crie outra para este fato.",
      );
    },
    onSettled: () => {
      trava.current = false;
    },
  });
  function submeter(pedido: Pedido) {
    if (trava.current) return;
    try {
      const salvo = sessionStorage.getItem(chave);
      if ((salvo !== null && salvo !== JSON.stringify(pedido)) || (salvo === null && pendente))
        throw new Error("Tentativa divergente.");
      if (salvo === null) sessionStorage.setItem(chave, JSON.stringify(pedido));
    } catch {
      setMensagem("Não foi possível guardar a tentativa; repasse não enviado.");
      return;
    }
    trava.current = true;
    setPendente(pedido);
    setMensagem("");
    enviar.mutate(pedido);
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pendente || enviar.isPending || trava.current || !confirmado) return;
        try {
          submeter(
            validarDeclararRepasse({
              requestId: crypto.randomUUID(),
              despesaId: despesa.id,
              expectedRevision: despesa.revisao,
              competencia: `${mes}-01`,
              regraContratual: regra,
              justificativa: motivo,
            }),
          );
        } catch {
          setMensagem("Confira competência, regra contratual e justificativa.");
        }
      }}
    >
      <h5>Enviar despesa para conferência de repasse</h5>
      <p>Não gera cobrança ou recebível automaticamente.</p>
      <fieldset disabled={!!pendente || enviar.isPending}>
        <label>
          Competência{" "}
          <input required type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </label>
        <label>
          Regra contratual{" "}
          <input
            required
            maxLength={500}
            value={regra}
            onChange={(e) => setRegra(e.target.value)}
          />
        </label>
        <label>
          Justificativa{" "}
          <textarea
            required
            maxLength={2000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
          />{" "}
          Conferi despesa, valor, competência, regra e justificativa.
        </label>
        <button type="submit" disabled={!confirmado}>
          Enviar para conferência
        </button>
      </fieldset>
      {pendente === "invalido" && (
        <p role="alert">Tentativa local ilegível. Contate suporte antes de repetir.</p>
      )}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={enviar.isPending} onClick={() => submeter(pendente)}>
          Repetir tentativa
        </button>
      )}
      {mensagem && <output>{mensagem}</output>}
    </form>
  );
}
