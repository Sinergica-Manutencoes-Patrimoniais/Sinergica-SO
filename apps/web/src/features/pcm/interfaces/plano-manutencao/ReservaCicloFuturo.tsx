import { conflitoReserva } from "./conflito-reserva";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { CompararVisitaLegado } from "./CompararVisitaLegado";
const fotoSchema = z.record(z.string(), z.unknown());
const pedidoSchema = z
  .object({
    request: z.string().uuid(),
    cliente: z.string().uuid(),
    plano: z.string().uuid(),
    versao: z.string().uuid(),
    rotina: z.string().uuid(),
    legado: z.string().uuid(),
    modo: z.enum(["calendario", "visita"]),
    rascunho: z.boolean(),
    data: z.string(),
    visita: z.string(),
    indiceSso: z.number().int().nonnegative().max(3660000),
    indice: z.number().int().nonnegative().max(3660000),
    revisaoPlano: z.number().int().positive(),
    revisaoReserva: z.number().int().nonnegative(),
    decisao: z.enum(["somente_sso", "somente_legado", "integrar_ponte"]),
    motivo: z.string().min(1).max(2000),
    foto: fotoSchema,
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  legadoId: string;
  revision: number;
  rascunho?: boolean;
};
export function ReservaCicloFuturo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.versaoId,
        props.rotinaId,
        props.legadoId,
        props.rascunho,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  legadoId,
  revision,
  rascunho = false,
}: Props) {
  const chave = `sso-reserva-futuro:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId, legadoId])}`;
  const trava = useRef(false);
  const [serie, setSerie] = useState("");
  const [inicioVisita, setInicioVisita] = useState("");
  const [fimVisita, setFimVisita] = useState("");
  const [modo, setModo] = useState<Pedido["modo"]>("calendario");
  const [indiceSso, setIndiceSso] = useState("");
  const [data, setData] = useState("");
  const [visita, setVisita] = useState("");
  const [indice, setIndice] = useState("");
  const [decisao, setDecisao] = useState<Pedido["decisao"]>("somente_sso");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.cliente === clienteId &&
        p.plano === planoId &&
        p.versao === versaoId &&
        p.rotina === rotinaId &&
        p.legado === legadoId
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const vinculos = useInfiniteQuery({
    queryKey: ["reserva-futuro-series", userId, clienteId, planoId, rotinaId],
    enabled: modo === "visita",
    initialPageParam: null as string | null,
    retry: false,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data: r, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_series_reserva_visita", {
          p_ator: userId,
          p_cliente: clienteId,
          p_plano: planoId,
          p_rotina: rotinaId,
          p_apos: pageParam,
          p_limite: 50,
        })
        .abortSignal(signal);
      if (error) throw error;
      const rows = z.array(z.object({ serie_id: z.string().uuid() }).passthrough()).parse(r);
      await conferirSessaoDiagnostico(userId, signal);
      return rows;
    },
    getNextPageParam: (p) => (p.length === 50 ? p.at(-1)?.serie_id : undefined),
  });
  const visitas = useInfiniteQuery({
    queryKey: [
      "reserva-futuro-visitas",
      userId,
      clienteId,
      planoId,
      versaoId,
      rotinaId,
      rascunho,
      serie,
      inicioVisita,
      fimVisita,
    ],
    enabled:
      modo === "visita" && !!serie && !!inicioVisita && !!fimVisita && fimVisita >= inicioVisita,
    initialPageParam: null as string | null,
    retry: false,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data: r, error } = await supabase
        .schema("pcm")
        .rpc(
          rascunho ? "sso_listar_visitas_reserva_rascunho" : "sso_prever_visitas_rotina",
          rascunho
            ? {
                p_ator: userId,
                p_cliente: clienteId,
                p_plano: planoId,
                p_rascunho: versaoId,
                p_rotina: rotinaId,
                p_serie: serie,
                p_inicio: inicioVisita,
                p_fim: fimVisita,
                p_apos: pageParam,
                p_limite: 30,
              }
            : {
                p_plano_id: planoId,
                p_versao_id: versaoId,
                p_rotina_id: rotinaId,
                p_serie_id: serie,
                p_inicio: inicioVisita,
                p_fim: fimVisita,
                p_apos: pageParam,
                p_limite: 30,
              },
        )
        .abortSignal(signal);
      if (error) throw error;
      const rows = z
        .array(
          z
            .object({
              visita_id: z.string().uuid(),
              semana_origem: z.string(),
              vencimento_original: z.string(),
              estado_visita: z.string(),
              feriado_declarado: z.boolean(),
              vigencia_declarada: z.boolean(),
              ocorrencia_preparada: z.boolean(),
            })
            .passthrough(),
        )
        .parse(r);
      await conferirSessaoDiagnostico(userId, signal);
      return rows;
    },
    getNextPageParam: (p) => (p.length === 30 ? p.at(-1)?.visita_id : undefined),
  });
  const visitaSelecionada = visitas.data?.pages.flat().find((v) => v.visita_id === visita);
  const nSso = indiceSso === "" ? NaN : Number(indiceSso);
  const n = indice === "" ? NaN : Number(indice);
  const visitaValida =
    !!visitaSelecionada &&
    !visitaSelecionada.feriado_declarado &&
    visitaSelecionada.vigencia_declarada &&
    !visitaSelecionada.ocorrencia_preparada;
  const previa = useQuery({
    queryKey: [
      "reserva-futuro",
      userId,
      clienteId,
      planoId,
      versaoId,
      rotinaId,
      legadoId,
      revision,
      modo,
      rascunho,
      data,
      visita,
      indice,
      indiceSso,
    ],
    enabled:
      !pendente &&
      Number.isSafeInteger(n) &&
      n >= 0 &&
      n <= 3660000 &&
      (modo === "calendario"
        ? rascunho
          ? Number.isSafeInteger(nSso) && nSso >= 0 && nSso <= 3660000
          : !!data
        : visitaValida),
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const comum = {
        p_ator: userId,
        p_cliente: clienteId,
        p_plano: planoId,
        p_versao: versaoId,
        p_rotina: rotinaId,
        p_legado: legadoId,
        p_indice_legado: n,
        p_revisao_plano: revision,
      };
      const { data: r, error } = await supabase
        .schema("pcm")
        .rpc(
          rascunho
            ? modo === "calendario"
              ? "sso_prever_reserva_calendario_rascunho"
              : "sso_prever_reserva_visita_rascunho"
            : modo === "calendario"
              ? "sso_prever_reserva_calendario_futuro"
              : "sso_prever_reserva_visita_futura",
          rascunho
            ? modo === "calendario"
              ? {
                  p_ator: userId,
                  p_cliente: clienteId,
                  p_plano: planoId,
                  p_rascunho: versaoId,
                  p_rotina: rotinaId,
                  p_indice_sso: nSso,
                  p_legado: legadoId,
                  p_indice_legado: n,
                  p_revisao_plano: revision,
                }
              : {
                  p_ator: userId,
                  p_cliente: clienteId,
                  p_plano: planoId,
                  p_rascunho: versaoId,
                  p_rotina: rotinaId,
                  p_visita: visita,
                  p_legado: legadoId,
                  p_indice: n,
                  p_revisao: revision,
                }
            : modo === "calendario"
              ? { ...comum, p_data: data }
              : { ...comum, p_visita: visita },
        )
        .abortSignal(signal);
      if (error) throw error;
      const parsed =
        rascunho && modo === "calendario"
          ? (() => {
              const x = z
                .object({
                  foto: fotoSchema,
                  equivalenciaComprovada: z.literal(false),
                  efeitoOperacional: z.literal(false),
                })
                .passthrough()
                .parse(r);
              return {
                ...x,
                efeitos: {
                  reservaConflitante: x.foto.reservaOperacionalConflitante,
                  reservaRevisao: x.foto.escolhaRevisao,
                },
              };
            })()
          : z
              .object({
                foto: fotoSchema,
                equivalenciaComprovada: z.literal(false),
                ocorrenciaCriada: z.literal(false),
                osCriada: z.literal(false),
                tarefaAuvoCriada: z.literal(false),
                efeitos: z.record(z.string(), z.unknown()),
              })
              .passthrough()
              .parse(r);
      await conferirSessaoDiagnostico(userId, signal);
      return parsed;
    },
  });
  const fotoEfeitos =
    previa.data?.foto.efeitos && typeof previa.data.foto.efeitos === "object"
      ? (previa.data.foto.efeitos as Record<string, unknown>)
      : {};
  const efeitoConhecido =
    previa.data?.foto.efeitoLegado === true ||
    previa.data?.foto.efeitoSso === true ||
    fotoEfeitos.efeitoLegado === true ||
    fotoEfeitos.osLegada === true;
  const assinatura =
    previa.data &&
    !efeitoConhecido &&
    previa.data.efeitos.reservaConflitante === false &&
    typeof previa.data.efeitos.reservaRevisao === "number" &&
    Number.isSafeInteger(previa.data.efeitos.reservaRevisao) &&
    !previa.isFetching &&
    !previa.isError
      ? JSON.stringify([
          clienteId,
          planoId,
          versaoId,
          rotinaId,
          legadoId,
          revision,
          modo,
          rascunho,
          data,
          visita,
          nSso,
          n,
          decisao,
          motivo.trim(),
          previa.data,
        ])
      : null;
  const enviar = async (p: Pedido, nova = false) => {
    if (trava.current) return;
    trava.current = true;
    setEnviando(true);
    try {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
      const comum = {
        p_ator: userId,
        p_request: p.request,
        p_cliente: p.cliente,
        p_plano: p.plano,
        p_versao: p.versao,
        p_rotina: p.rotina,
        p_legado: p.legado,
        p_indice_legado: p.indice,
        p_revisao_plano: p.revisaoPlano,
        p_revisao_reserva: p.revisaoReserva,
        p_decisao: p.decisao,
        p_confirmado: true,
        p_motivo: p.motivo,
        p_foto_esperada: p.foto,
      };
      const { data: r, error } = await supabase.schema("pcm").rpc(
        p.rascunho
          ? p.modo === "calendario"
            ? "sso_escolher_reserva_calendario_rascunho"
            : "sso_decidir_reserva_visita_rascunho"
          : p.modo === "calendario"
            ? "sso_decidir_reserva_calendario_futuro"
            : "sso_decidir_reserva_visita_futura",
        p.rascunho
          ? p.modo === "calendario"
            ? {
                p_ator: userId,
                p_request: p.request,
                p_cliente: p.cliente,
                p_plano: p.plano,
                p_rascunho: p.versao,
                p_rotina: p.rotina,
                p_indice_sso: p.indiceSso,
                p_legado: p.legado,
                p_indice_legado: p.indice,
                p_revisao_plano: p.revisaoPlano,
                p_revisao_escolha: p.revisaoReserva,
                p_decisao: p.decisao,
                p_confirmado: true,
                p_motivo: p.motivo,
                p_foto_esperada: p.foto,
              }
            : {
                p_ator: userId,
                p_request: p.request,
                p_cliente: p.cliente,
                p_plano: p.plano,
                p_rascunho: p.versao,
                p_rotina: p.rotina,
                p_visita: p.visita,
                p_legado: p.legado,
                p_indice: p.indice,
                p_revisao_plano: p.revisaoPlano,
                p_revisao_escolha: p.revisaoReserva,
                p_decisao: p.decisao,
                p_confirmado: true,
                p_motivo: p.motivo,
                p_foto_esperada: p.foto,
              }
          : p.modo === "calendario"
            ? { ...comum, p_data: p.data }
            : { ...comum, p_visita: p.visita },
      );
      if (error) throw error;
      const base = z.object({
        requestId: z.string().uuid(),
        revisao: z.number().int().positive(),
        decisao: z.string(),
        ocorrenciaCriada: z.literal(false),
        osCriada: z.literal(false),
        tarefaAuvoCriada: z.literal(false),
      });
      const result = (
        p.rascunho && p.modo === "calendario"
          ? z.object({
              requestId: z.string().uuid(),
              revisao: z.number().int().positive(),
              decisao: z.string(),
              selada: z.literal(false),
              efeitoOperacional: z.literal(false),
              osCriada: z.literal(false),
              tarefaAuvoCriada: z.literal(false),
            })
          : p.rascunho
            ? base.extend({ rascunhoNaoAprovado: z.literal(true) })
            : base.extend({
                reservaId: z.string().uuid(),
                cicloId: z.string().uuid(),
                replay: z.boolean(),
              })
      )
        .strict()
        .parse(r);
      if (
        result.requestId !== p.request ||
        result.decisao !== p.decisao ||
        result.revisao !== p.revisaoReserva + 1
      )
        throw new Error();
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConfirmado(null);
      setAviso(
        p.rascunho
          ? "Escolha registrada para revisão; ainda depende de aprovação e vigência."
          : "Reserva registrada para o par selecionado, sem criar ocorrência ou OS.",
      );
      await previa.refetch();
    } catch (error) {
      setConfirmado(null);
      if (nova && conflitoReserva(error)) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setAviso("A reserva mudou. Atualize e confira novamente.");
          await previa.refetch();
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
        }
      } else setAviso("Resultado não confirmado; repita a mesma tentativa ou procure suporte.");
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  };
  const iniciar = () => {
    if (!assinatura || confirmado !== assinatura || !previa.data || pendente || enviando) return;
    try {
      const p = pedidoSchema.parse({
        request: crypto.randomUUID(),
        cliente: clienteId,
        plano: planoId,
        versao: versaoId,
        rotina: rotinaId,
        legado: legadoId,
        modo,
        rascunho,
        data,
        visita,
        indiceSso: modo === "calendario" && rascunho ? nSso : 0,
        indice: n,
        revisaoPlano: revision,
        revisaoReserva: previa.data.efeitos.reservaRevisao,
        decisao,
        motivo: motivo.trim(),
        foto: previa.data.foto,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p));
      setPendente(p);
      void enviar(p, true);
    } catch {
      setAviso("Tentativa não pôde ser guardada; nada foi enviado.");
    }
  };
  return (
    <section aria-label="Reserva de ciclo futuro">
      <h5>Reservar ciclo futuro</h5>
      <p>
        Selecione explicitamente o ciclo e o índice do Plano legado. A prévia não comprova
        equivalência geral nem cobre outros ciclos. Visita deve ser regular e já existente.
      </p>
      <fieldset disabled={!!pendente || enviando}>
        <label>
          Modo{" "}
          <select
            value={modo}
            onChange={(e) => {
              setModo(e.target.value as Pedido["modo"]);
              setConfirmado(null);
            }}
          >
            <option value="calendario">Calendário</option>
            <option value="visita">Visita</option>
          </select>
        </label>
        {modo === "calendario" ? (
          rascunho ? (
            <label>
              Índice do ciclo SSO{" "}
              <input
                type="number"
                min="0"
                max="3660000"
                step="1"
                value={indiceSso}
                onChange={(e) => {
                  setIndiceSso(e.target.value);
                  setConfirmado(null);
                }}
              />
            </label>
          ) : (
            <label>
              Data do ciclo SSO{" "}
              <input
                type="date"
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                  setConfirmado(null);
                }}
              />
            </label>
          )
        ) : (
          <>
            <label>
              Série contratual{" "}
              <select
                value={serie}
                onChange={(e) => {
                  setSerie(e.target.value);
                  setVisita("");
                  setConfirmado(null);
                }}
              >
                <option value="">Selecione</option>
                {vinculos.data?.pages.flat().map((v) => (
                  <option key={v.serie_id} value={v.serie_id}>
                    {v.serie_id}
                  </option>
                ))}
              </select>
            </label>
            {vinculos.hasNextPage && (
              <button type="button" onClick={() => void vinculos.fetchNextPage()}>
                Mais séries
              </button>
            )}
            <label>
              Início das Visitas{" "}
              <input
                type="date"
                value={inicioVisita}
                onChange={(e) => {
                  setInicioVisita(e.target.value);
                  setVisita("");
                  setConfirmado(null);
                }}
              />
            </label>
            <label>
              Fim das Visitas{" "}
              <input
                type="date"
                value={fimVisita}
                onChange={(e) => {
                  setFimVisita(e.target.value);
                  setVisita("");
                  setConfirmado(null);
                }}
              />
            </label>
            {visitas.isError && (
              <p role="alert">Visitas indisponíveis; confira série e janela de até 366 dias.</p>
            )}
            <label>
              Visita existente{" "}
              <select
                value={visita}
                onChange={(e) => {
                  setVisita(e.target.value);
                  setConfirmado(null);
                }}
              >
                <option value="">Selecione</option>
                {visitas.data?.pages.flat().map((v) => (
                  <option
                    key={v.visita_id}
                    value={v.visita_id}
                    disabled={
                      v.feriado_declarado || !v.vigencia_declarada || v.ocorrencia_preparada
                    }
                  >
                    {v.vencimento_original} · semana {v.semana_origem} · {v.estado_visita} ·{" "}
                    {v.visita_id}
                    {v.feriado_declarado ? " · feriado declarado" : ""}
                    {!v.vigencia_declarada ? " · fora da vigência" : ""}
                    {v.ocorrencia_preparada ? " · já preparada" : ""}
                  </option>
                ))}
              </select>
            </label>
            {visitas.hasNextPage && (
              <button type="button" onClick={() => void visitas.fetchNextPage()}>
                Mais Visitas
              </button>
            )}
          </>
        )}
        <label>
          Índice legado{" "}
          <input
            type="number"
            min="0"
            max="3660000"
            step="1"
            value={indice}
            onChange={(e) => {
              setIndice(e.target.value);
              setConfirmado(null);
            }}
          />
        </label>
        {previa.isFetching && <p>Consultando candidato…</p>}
        {previa.isError && (
          <p role="alert">Candidato indisponível. Confira versão, Rotina, Visita e período.</p>
        )}
        {previa.data && (
          <>
            {efeitoConhecido && (
              <p role="alert">
                Há efeito já identificado, como uma avaliação recebida; o ciclo exige reconciliação.
              </p>
            )}
            {previa.data.efeitos.reservaConflitante === true && (
              <p role="alert">Existe reserva conflitante; procure reconciliação.</p>
            )}
            {modo === "visita" && (
              <CompararVisitaLegado foto={previa.data.foto} efeitos={previa.data.efeitos} />
            )}
            <p>
              Confira a fotografia integral do candidato e as fontes observadas antes de decidir.
            </p>
            <pre aria-label="Dados do candidato">{JSON.stringify(previa.data.foto, null, 2)}</pre>
            <p>Fontes externas e feriados podem estar incompletos.</p>
          </>
        )}
        <label>
          Origem{" "}
          <select
            value={decisao}
            onChange={(e) => {
              setDecisao(e.target.value as Pedido["decisao"]);
              setConfirmado(null);
            }}
          >
            <option value="somente_sso">Somente SSO</option>
            <option value="somente_legado">Somente legado</option>
            <option value="integrar_ponte">Ponte após conferência</option>
          </select>
        </label>
        <label>
          Motivo{" "}
          <textarea
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
            checked={!!assinatura && confirmado === assinatura}
            disabled={!assinatura || !motivo.trim()}
            onChange={(e) => setConfirmado(e.target.checked ? assinatura : null)}
          />{" "}
          Conferi data, alvo, origem e os efeitos observados
        </label>
        <button
          type="button"
          disabled={!assinatura || confirmado !== assinatura || !motivo.trim()}
          onClick={iniciar}
        >
          Registrar reserva
        </button>
      </fieldset>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={enviando} onClick={() => void enviar(pendente)}>
          Repetir mesma tentativa
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
