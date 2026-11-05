import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import type { RegraContratualResumo } from "../../application/calendario-contratual-gateway";
import {
  alterarDiaContratual,
  type PedidoAlterarDia,
} from "../../infrastructure/supabase-calendario-contratual-adapter";
import { PreviaMudancaDia } from "./PreviaMudancaDia";
import { AlterarDiaComVisitas } from "./AlterarDiaComVisitas";

type Props = { userId: string; clienteId: string; regra: RegraContratualResumo };
export function AlterarDiaContratual(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.regra.serieId])} {...props} />;
}
function Conteudo({ userId, clienteId, regra }: Props) {
  const chave = `sso-calendario-alteracao:${JSON.stringify([userId, clienteId, regra.serieId])}`;
  const cache = useQueryClient();
  const [dia, setDia] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [mostrarPrevia, setMostrarPrevia] = useState(false);
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  const identidade = JSON.stringify([regra.serieId, regra.numero, regra.diaSemana, dia, vigencia]);
  const [pedido, setPedido] = useState<PedidoAlterarDia | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const valor = JSON.parse(salvo) as PedidoAlterarDia;
      if (
        valor &&
        valor.serieId === regra.serieId &&
        typeof valor.requestId === "string" &&
        typeof valor.regraNovaId === "string" &&
        Number.isSafeInteger(valor.expectedRevision) &&
        Number.isSafeInteger(valor.diaSemana) &&
        typeof valor.vigencia === "string"
      )
        return valor;
      return "invalido";
    } catch {
      return "invalido";
    }
  });
  const operacao = useMutation({
    mutationFn: async (p: PedidoAlterarDia) => {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      await alterarDiaContratual(p);
      await conferirSessao();
    },
    onSuccess: async (_resposta, confirmado) => {
      try {
        await cache.invalidateQueries({ queryKey: ["calendario-contratual", userId, clienteId], refetchType: "none" });
        await conferirSessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(confirmado)) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
        setPedido(null);
        setMensagem("Nova regra registrada. Nenhuma Visita ou tarefa foi criada.");
        void cache.refetchQueries({ queryKey: ["calendario-contratual", userId, clienteId], type: "active" });
      } catch {
        if (montado.current) setMensagem("Alteração confirmada, mas tentativa não foi removida. Procure suporte.");
      }
    },
    onError: () => { if (montado.current) setMensagem("Alteração não confirmada. Repita o mesmo pedido ou procure suporte antes de iniciar outro."); },
    onSettled: () => { trava.current = false; },
  });
  function enviar(novo: PedidoAlterarDia) {
    if (trava.current) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(novo))
        throw new Error("Tentativa alterada.");
      trava.current = true;
      operacao.mutate(novo);
    } catch {
      setMensagem("Tentativa guardada indisponível ou alterada. Procure suporte.");
    }
  }
  return (
    <section aria-label="Alteração de dia contratual">
      <p>
        A mudança exige vigência futura. Visitas confirmadas e exceções precisam ser preservadas.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const novoDia = Number(dia);
          if (
            import.meta.env.VITE_SSO_MUDANCA_DIA_ATOMICA_ENABLED === "true" ||
            pedido ||
            trava.current ||
            confirmacao !== identidade ||
            !Number.isInteger(novoDia) ||
            novoDia < 1 ||
            novoDia > 7 ||
            novoDia === regra.diaSemana ||
            !vigencia
          ) {
            setMensagem("Escolha outro dia e informe a vigência.");
            return;
          }
          const novo: PedidoAlterarDia = {
            requestId: crypto.randomUUID(),
            serieId: regra.serieId,
            regraNovaId: crypto.randomUUID(),
            expectedRevision: regra.numero,
            diaSemana: novoDia,
            vigencia,
          };
          try {
            if (sessionStorage.getItem(chave) !== null) {
              setMensagem("Há pedido anterior; reabra para recuperar.");
              return;
            }
            sessionStorage.setItem(chave, JSON.stringify(novo));
          } catch {
            setMensagem("Não foi possível guardar tentativa. Nada foi enviado.");
            return;
          }
          setPedido(novo);
          enviar(novo);
        }}
      >
        <fieldset disabled={!!pedido || operacao.isPending}>
          <label>
            Novo dia{" "}
            <select
              required
              value={dia}
              onChange={(e) => {
                setDia(e.target.value);
                setConfirmacao(null);
              }}
            >
              <option value="">Selecione</option>
              {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map(
                (nome, i) => (
                  <option key={nome} value={i + 1}>
                    {nome}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Vigência{" "}
            <input
              required
              type="date"
              value={vigencia}
              onChange={(e) => {
                setVigencia(e.target.value);
                setConfirmacao(null);
              }}
            />
          </label>
          <p>
            Regra atual: revisão {regra.numero} · dia {regra.diaSemana}. A confirmação vale somente
            para os dados exibidos.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmacao === identidade}
              disabled={!dia || !vigencia}
              onChange={(e) => setConfirmacao(e.target.checked ? identidade : null)}
            />{" "}
            Conferi a regra atual, novo dia e vigência
          </label>
          <button
            type="submit"
            disabled={
              confirmacao !== identidade ||
              import.meta.env.VITE_SSO_MUDANCA_DIA_ATOMICA_ENABLED === "true"
            }
          >
            Confirmar alteração sem Visitas
          </button>
        </fieldset>
      </form>
      {import.meta.env.VITE_SSO_MUDANCA_DIA_ATOMICA_ENABLED === "true" && (
        <AlterarDiaComVisitas
          userId={userId}
          clienteId={clienteId}
          serieId={regra.serieId}
          revisao={regra.numero}
          dia={Number(dia)}
          vigencia={vigencia}
          bloqueado={!!pedido || dia === String(regra.diaSemana)}
        />
      )}
      {import.meta.env.VITE_SSO_PREVIA_MUDANCA_DIA_ENABLED === "true" && (
        <>
          <button
            type="button"
            disabled={
              !vigencia || !Number.isInteger(Number(dia)) || Number(dia) < 1 || Number(dia) > 7
            }
            onClick={() => setMostrarPrevia((v) => !v)}
          >
            {mostrarPrevia ? "Fechar prévia de impacto" : "Consultar impacto nas Visitas"}
          </button>
          {mostrarPrevia && vigencia && Number(dia) >= 1 && Number(dia) <= 7 && (
            <PreviaMudancaDia
              key={JSON.stringify([userId, clienteId, regra.serieId, regra.numero, vigencia, dia])}
              userId={userId}
              clienteId={clienteId}
              serieId={regra.serieId}
              revisao={regra.numero}
              vigencia={vigencia}
              dia={Number(dia)}
            />
          )}
        </>
      )}
      {pedido === "invalido" && <p role="alert">Pedido guardado ilegível. Procure suporte.</p>}
      {pedido && pedido !== "invalido" && (
        <button type="button" disabled={operacao.isPending} onClick={() => enviar(pedido)}>
          Repetir mesmo pedido
        </button>
      )}
      {mensagem && <output>{mensagem}</output>}
    </section>
  );
}
