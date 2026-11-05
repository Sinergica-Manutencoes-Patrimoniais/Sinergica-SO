import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { FilaAposPreparacao } from "./FilaAposPreparacao";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
type Candidato = {
  preparada_id: string;
  vencimento_original: string;
  alvo_tipo: string;
  alvo_id: string;
};
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  legadoId: string;
  relacaoId: string;
  revision: number;
  preparadas: string[];
  motivo: string;
};

export function LoteCiclosLegados(props: Parameters<typeof Conteudo>[0]) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.legadoId,
        props.relacaoId,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  legadoId,
  relacaoId,
  revision,
  candidatos,
  consultando,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  legadoId: string;
  relacaoId: string;
  revision: number;
  candidatos: Candidato[];
  consultando: boolean;
}) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const chave = `sso-lote-ciclos-legados:${JSON.stringify([userId, clienteId, planoId, legadoId])}`;
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [integradas, setIntegradas] = useState<string[]>([]);
  const trava = useRef(false);
  const [inicioJanela, setInicioJanela] = useState("");
  const [fimJanela, setFimJanela] = useState("");
  const janelaInvalida = Boolean(inicioJanela && fimJanela && inicioJanela > fimJanela);
  const candidatosJanela = candidatos.filter(
    (c) =>
      (!inicioJanela || c.vencimento_original >= inicioJanela) &&
      (!fimJanela || c.vencimento_original <= fimJanela),
  );
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.legadoId === legadoId &&
        typeof p.requestId === "string" &&
        typeof p.relacaoId === "string" &&
        Number.isSafeInteger(p.revision) &&
        Array.isArray(p.preparadas) &&
        p.preparadas.every((id) => typeof id === "string") &&
        typeof p.motivo === "string"
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_lote_legado_mediado", {
        p_ator_id: userId,
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_plano_id: p.planoId,
        p_plano_legado_id: p.legadoId,
        p_relacao_request_id: p.relacaoId,
        p_expected_revision: p.revision,
        p_preparadas: p.preparadas,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().uuid(),
          total: z.number().int().min(1).max(25),
          criadas: z.number().int().nonnegative(),
          itens: z
            .array(
              z
                .object({
                  preparadaId: z.string().uuid(),
                  legadaId: z.string().uuid(),
                  cicloId: z.string().uuid(),
                  criada: z.boolean(),
                })
                .strict(),
            )
            .min(1)
            .max(25),
          atomico: z.literal(true),
          osCriada: z.literal(false),
          tarefaAuvoCriada: z.literal(false),
          equivalenciaGeralComprovada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.total !== p.preparadas.length ||
        r.itens.length !== r.total ||
        r.criadas !== r.itens.filter((i) => i.criada).length ||
        JSON.stringify(r.itens.map((i) => i.preparadaId).sort()) !==
          JSON.stringify([...p.preparadas].sort())
      )
        throw new Error("Resultado inválido.");
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      return r;
    },
    onSuccess: async (r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (!montado.current) throw new Error("Tela desmontada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa não removida; procure suporte.");
        return;
      }
      setPendente(null);
      setSelecionadas([]);
      setConfirmado(null);
      setIntegradas(r.itens.map((i) => i.preparadaId));
      setAviso(`Lote registrado: ${r.total} ciclo(s), ${r.criadas} criado(s); sem OS/Auvo.`);
      await cache.invalidateQueries({
        queryKey: ["ciclos-integracao-legado", userId, clienteId, planoId, legadoId],
      });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou algum ciclo falhou; repita a mesma tentativa e procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    trava.current = true;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      trava.current = false;
      setAviso("Não foi possível guardar tentativa; nada enviado.");
      return;
    }
    if (!pendente) setIntegradas([]);
    setPendente(p);
    envio.mutate(p);
  };
  const itensSelecionados = [...selecionadas]
    .sort()
    .map((id) => candidatos.find((c) => c.preparada_id === id));
  const assinatura =
    itensSelecionados.length > 0 && itensSelecionados.every(Boolean)
      ? JSON.stringify([
          clienteId,
          planoId,
          legadoId,
          relacaoId,
          revision,
          itensSelecionados,
          motivo.trim(),
        ])
      : null;
  const confirmacaoAtual = assinatura !== null && confirmado === assinatura;
  return (
    <section aria-label="Lote de ciclos legados">
      <h5>Integrar lote legado</h5>
      <p>
        Selecione até 25 ciclos das páginas carregadas. O lote é atômico: qualquer falha reverte
        todos; a relação declarada não comprova equivalência geral. Não cria OS/Auvo, e fonte/fuso,
        concorrência e homologação ainda precisam revisão.
      </p>
      <label>
        Início da janela{" "}
        <input
          type="date"
          value={inicioJanela}
          onChange={(e) => {
            setInicioJanela(e.target.value);
            setSelecionadas([]);
            setConfirmado(null);
          }}
        />
      </label>
      <label>
        Fim da janela{" "}
        <input
          type="date"
          value={fimJanela}
          onChange={(e) => {
            setFimJanela(e.target.value);
            setSelecionadas([]);
            setConfirmado(null);
          }}
        />
      </label>
      {janelaInvalida ? (
        <p role="alert">A data inicial deve ser anterior ou igual à final.</p>
      ) : (
        <p>
          {candidatosJanela.length} ciclo(s) nas páginas carregadas nesta janela. A lista não
          comprova cobertura de ciclos ainda não preparados ou de páginas não carregadas.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            pendente ||
            consultando ||
            janelaInvalida ||
            !confirmacaoAtual ||
            !motivo.trim() ||
            selecionadas.length < 1 ||
            selecionadas.length > 25
          )
            return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            planoId,
            legadoId,
            relacaoId,
            revision,
            preparadas: [...selecionadas].sort(),
            motivo: motivo.trim(),
          });
        }}
      >
        <fieldset disabled={!!pendente || envio.isPending || consultando}>
          <legend>Ciclos selecionados: {selecionadas.length}/25</legend>
          {(janelaInvalida ? [] : candidatosJanela).map((c) => (
            <label key={c.preparada_id}>
              <input
                type="checkbox"
                checked={selecionadas.includes(c.preparada_id)}
                disabled={!selecionadas.includes(c.preparada_id) && selecionadas.length >= 25}
                onChange={(e) => {
                  setConfirmado(null);
                  setSelecionadas((a) =>
                    e.target.checked
                      ? [...a, c.preparada_id]
                      : a.filter((id) => id !== c.preparada_id),
                  );
                }}
              />{" "}
              {c.vencimento_original} · {c.alvo_tipo} {c.alvo_id}{" "}
            </label>
          ))}
          <label>
            Motivo{" "}
            <textarea
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setConfirmado(null);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmacaoAtual}
              disabled={!assinatura}
              onChange={(e) => setConfirmado(e.target.checked ? assinatura : null)}
            />{" "}
            Conferi os ciclos e a atomicidade
          </label>
          <button
            type="submit"
            disabled={janelaInvalida || !confirmacaoAtual || selecionadas.length === 0}
          >
            Processar lote
          </button>
        </fieldset>
      </form>
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
      {integradas.length > 0 && (
        <section aria-label="Filas dos ciclos integrados">
          <p>Ocorrências integradas; cada fila exige conferência independente.</p>
          <ul>
            {integradas.map((id) => (
              <li key={id}>
                Ocorrência {id}{" "}
                <FilaAposPreparacao
                  userId={userId}
                  clienteId={clienteId}
                  planoId={planoId}
                  preparadaId={id}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
