import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../../lib/mensagem-ativacao";
import { supabase } from "../../../../lib/supabase-client";
import {
  type AlterarPrevisao,
  type DespesaVisitaListada,
  alterarPrevisao,
  validarAlterarPrevisao,
} from "../../infrastructure/supabase-despesas-visita-adapter";

type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };
export function EditarPrevisao(props: Props) {
  if (import.meta.env.VITE_SSO_EDITAR_DESPESAS_VISITA_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-editar-despesa:${JSON.stringify([userId, clienteId, visitaId, despesa.id])}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      const pedido = salvo ? validarAlterarPrevisao(JSON.parse(salvo)) : null;
      if (pedido && (pedido.despesaId !== despesa.id || pedido.visitaId !== visitaId))
        throw new Error("Contexto divergente.");
      return { pedido, falhou: false };
    } catch {
      return { pedido: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.pedido);
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(despesa.data);
  const [descricao, setDescricao] = useState(despesa.descricao);
  const [valor, setValor] = useState(String(despesa.previstoCentavos));
  const [motivo, setMotivo] = useState("");
  const fotografiaAtual = JSON.stringify([
    despesa.revisao,
    despesa.data,
    despesa.descricao,
    despesa.previstoCentavos,
    despesa.status,
    despesa.realizadoCentavos,
  ]);
  const [fotografiaEditada, setFotografiaEditada] = useState(fotografiaAtual);
  const desatualizada = fotografiaEditada !== fotografiaAtual;
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const client = useQueryClient();
  async function enviar(pedido: AlterarPrevisao) {
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setErro("");
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) {
        setErro("Tentativa local alterada ou indisponível. Procure suporte antes de repetir.");
        return;
      }
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(pedido)
      )
        throw new Error("Sessão alterada.");
      await alterarPrevisao(pedido);
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["despesas-visita", userId, clienteId, visitaId],
          refetchType: "none",
        }),
        client.invalidateQueries({
          queryKey: ["relatorio-despesas-cliente", userId, clienteId],
          refetchType: "none",
        }),
      ]);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) {
        setErro(
          "Operação confirmada, mas a tentativa local mudou. Procure suporte; o registro foi preservado.",
        );
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null);
      setAberto(false);
      void client.refetchQueries({
        queryKey: ["despesas-visita", userId, clienteId, visitaId],
        type: "active",
      });
      void client.refetchQueries({
        queryKey: ["relatorio-despesas-cliente", userId, clienteId],
        type: "active",
      });
    } catch (erro) {
      // E01-S189 AC-5: "não liberado"/"sem permissão" não se resolvem repetindo os mesmos dados.
      const falha = mensagemFalhaAtivacao(erro);
      if (falha) {
        try {
          sessionStorage.removeItem(chave);
        } catch {
          /* best-effort */
        }
        setPendente(null);
        setErro(TEXTO_FALHA_ATIVACAO[falha]);
        return;
      }
      setErro("Resultado não confirmado. Repita os mesmos dados ou consulte o suporte.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  function iniciar(acao: "alterar" | "cancelar") {
    if (
      pendente ||
      recuperacao.falhou ||
      enviando.current ||
      desatualizada ||
      despesa.status !== "ativa" ||
      despesa.realizadoCentavos !== null
    )
      return;
    try {
      const pedido = validarAlterarPrevisao({
        requestId: crypto.randomUUID(),
        despesaId: despesa.id,
        visitaId,
        expectedRevision: despesa.revisao,
        acao,
        data: acao === "alterar" ? data : null,
        descricao: acao === "alterar" ? descricao : null,
        previstoCentavos: acao === "alterar" && /^\d+$/.test(valor) ? Number(valor) : null,
        motivo,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Operação pendente.");
      sessionStorage.setItem(chave, JSON.stringify(pedido));
      setPendente(pedido);
      void enviar(pedido);
    } catch {
      setErro("Confira data, descrição, valor em centavos e motivo.");
    }
  }
  if (
    !pendente &&
    !recuperacao.falhou &&
    (despesa.status !== "ativa" || despesa.realizadoCentavos !== null)
  )
    return null;
  return (
    <section aria-label={`Alterar previsão ${despesa.id}`}>
      {recuperacao.falhou && <p role="alert">Operação guardada inválida. Consulte o suporte.</p>}
      {erro && <p role="alert">{erro}</p>}
      {pendente ? (
        <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>
          Repetir operação
        </button>
      ) : (
        !recuperacao.falhou &&
        (!aberto ? (
          <button type="button" onClick={() => setAberto(true)}>
            Alterar ou cancelar previsão
          </button>
        ) : (
          <>
            <p>Sem alteração de lançamento financeiro. Despesa realizada exige fluxo próprio.</p>
            {desatualizada && (
              <p role="alert">
                A despesa mudou enquanto você editava. Os campos foram preservados.{" "}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => {
                    setData(despesa.data);
                    setDescricao(despesa.descricao);
                    setValor(String(despesa.previstoCentavos));
                    setFotografiaEditada(fotografiaAtual);
                  }}
                >
                  Substituir campos pelos dados atuais
                </button>
              </p>
            )}
            <label>
              Data <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label>
              Descrição{" "}
              <input
                maxLength={10000}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </label>
            <label>
              Valor previsto em centavos{" "}
              <input inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} />
            </label>
            <label>
              Motivo{" "}
              <textarea
                required
                maxLength={2000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={ocupado || desatualizada}
              onClick={() => iniciar("alterar")}
            >
              Salvar previsão
            </button>
            <button
              type="button"
              disabled={ocupado || desatualizada}
              onClick={() => iniciar("cancelar")}
            >
              Cancelar previsão
            </button>
            <button type="button" onClick={() => setAberto(false)}>
              Fechar edição
            </button>
          </>
        ))
      )}
    </section>
  );
}
