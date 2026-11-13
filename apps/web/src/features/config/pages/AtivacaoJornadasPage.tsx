import { DataTable } from "@sinergica/ui";
// E01-S188 — tela de consulta de ativação. Responde "esta jornada está utilizável? se não, o
// que falta?" sem SQL manual (AC-4). Mesmo padrão de DiagnosticoExecutorFila.tsx: supabase direto
// na página (não é CRUD, é consulta administrativa), TanStack Query, zod validando a resposta.
//
// Abrir/retornar exigem digitar o código da jornada e um motivo — a mesma fricção deliberada que
// o projeto já usa em ações irreversíveis (ver padrão de confirmação em outras telas de PCM).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const jornadaSchema = z
  .object({
    codigo: z.string().min(1),
    titulo: z.string().min(1),
    descricao: z.string(),
    ativavel: z.boolean(),
  })
  .strict();
const itemDiagnosticoSchema = z
  .object({
    camada: z.enum(["gate", "flag", "grant"]),
    identificador: z.string().min(1),
    papel: z.enum(["ativacao", "mecanismo"]),
    estadoAlvo: z.boolean(),
    estado: z.enum(["atendido", "pendente", "inexistente", "declarado"]),
    ordem: z.number().int(),
    motivo: z.string(),
  })
  .strict();
const diagnosticoSchema = z
  .object({
    jornada: z.string().min(1),
    titulo: z.string().min(1),
    utilizavel: z.boolean(),
    faltando: z.array(itemDiagnosticoSchema),
    itens: z.array(itemDiagnosticoSchema),
  })
  .strict();
const resultadoAberturaSchema = z
  .object({
    requestId: z.string().guid(),
    jornada: z.string(),
    reutilizado: z.boolean(),
    etapas: z.array(z.string()).optional(),
  })
  .strict();

const ROTULO_CAMADA: Record<string, string> = {
  gate: "Interruptor de banco",
  flag: "Flag de build",
  grant: "Permissão de execução",
};
const ROTULO_ESTADO: Record<string, string> = {
  atendido: "Pronto",
  pendente: "Falta liberar",
  inexistente: "Não existe — registro aponta para o vazio",
  declarado: "Suposição (sem publicação registrada)",
};

export function AtivacaoJornadasPage({ userId }: { userId: string }) {
  const [codigoSelecionado, setCodigoSelecionado] = useState<string | null>(null);
  const client = useQueryClient();

  const jornadas = useQuery({
    queryKey: ["config-jornadas", userId],
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("config")
        .rpc("sso_listar_jornadas")
        .abortSignal(signal);
      if (error) throw error;
      const r = z.array(jornadaSchema).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return r;
    },
  });

  const diagnostico = useQuery({
    queryKey: ["config-jornada-diagnostico", userId, codigoSelecionado],
    enabled: codigoSelecionado !== null,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("config")
        .rpc("sso_diagnosticar_jornada", { p_codigo: codigoSelecionado })
        .abortSignal(signal);
      if (error) throw error;
      const r = diagnosticoSchema.parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return r;
    },
  });

  const [motivo, setMotivo] = useState("");
  const [confirmacaoCodigo, setConfirmacaoCodigo] = useState("");

  async function chamarProcedimento(direcao: "abrir" | "retornar") {
    if (!codigoSelecionado) return;
    const requestId = crypto.randomUUID();
    const funcao = direcao === "abrir" ? "sso_abrir_jornada" : "sso_retornar_jornada";
    const { data, error } = await supabase
      .schema("config")
      .rpc(funcao, { p_request_id: requestId, p_codigo: codigoSelecionado, p_motivo: motivo });
    if (error) throw error;
    const resultado = resultadoAberturaSchema.parse(data);
    if (resultado.jornada !== codigoSelecionado) throw new Error("Resposta inconsistente.");
    return resultado;
  }

  const abrir = useMutation({
    mutationFn: () => chamarProcedimento("abrir"),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["config-jornada-diagnostico", userId, codigoSelecionado],
      });
      setMotivo("");
      setConfirmacaoCodigo("");
    },
  });
  const retornar = useMutation({
    mutationFn: () => chamarProcedimento("retornar"),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["config-jornada-diagnostico", userId, codigoSelecionado],
      });
      setMotivo("");
      setConfirmacaoCodigo("");
    },
  });

  const d = !diagnostico.isFetching && !diagnostico.isError ? diagnostico.data : undefined;
  const confirmacaoValida =
    codigoSelecionado !== null &&
    confirmacaoCodigo === codigoSelecionado &&
    motivo.trim().length > 0;

  return (
    <section aria-label="Ativação de jornadas">
      <h2>Ativação de jornadas</h2>
      <p>
        Uma jornada só fica utilizável quando três camadas coincidem: permissão na função,
        interruptor aberto no banco e flag ligada no build. Esta tela responde se cada jornada está
        pronta — e, se não estiver, exatamente o que falta.
      </p>

      {jornadas.isFetching && <output>Consultando jornadas declaradas…</output>}
      {jornadas.isError && (
        <p role="alert">
          Não foi possível consultar as jornadas.{" "}
          <button type="button" onClick={() => void jornadas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!jornadas.isFetching && !jornadas.isError && jornadas.data?.length === 0 && (
        <p>Nenhuma jornada declarada ainda.</p>
      )}

      {!jornadas.isFetching && !jornadas.isError && jornadas.data && jornadas.data.length > 0 && (
        <ul aria-label="Jornadas declaradas">
          {jornadas.data.map((j) => (
            <li key={j.codigo}>
              <button
                type="button"
                aria-pressed={codigoSelecionado === j.codigo}
                onClick={() => {
                  setCodigoSelecionado(j.codigo);
                  setMotivo("");
                  setConfirmacaoCodigo("");
                }}
              >
                {j.titulo}
              </button>{" "}
              <code>{j.codigo}</code>
            </li>
          ))}
        </ul>
      )}

      {codigoSelecionado && (
        <div aria-label="Diagnóstico da jornada selecionada">
          {diagnostico.isFetching && <output>Consultando diagnóstico…</output>}
          {diagnostico.isError && (
            <p role="alert">
              Diagnóstico indisponível.{" "}
              <button type="button" onClick={() => void diagnostico.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}

          {d && (
            <>
              <h3>{d.titulo}</h3>
              <p>
                {d.utilizavel
                  ? "Utilizável: as três camadas estão prontas para esta jornada."
                  : `Não utilizável: falta ${d.faltando.length} ite${d.faltando.length === 1 ? "m" : "ns"}.`}
              </p>

              <DataTable
                colunas={[
                  {
                    chave: "camada",
                    cabecalho: "Camada",
                    render: (item) =>
                      `${ROTULO_CAMADA[item.camada]}${item.papel === "mecanismo" ? " (mecanismo — não desligar)" : ""}`,
                  },
                  {
                    chave: "identificador",
                    cabecalho: "Identificador",
                    render: (item) => <code>{item.identificador}</code>,
                  },
                  {
                    chave: "estado",
                    cabecalho: "Estado",
                    render: (item) => ROTULO_ESTADO[item.estado],
                  },
                  { chave: "motivo", cabecalho: "Por quê", render: (item) => item.motivo },
                ]}
                itens={d.itens}
                chaveLinha={(item) => `${item.camada}:${item.identificador}`}
                vazio="Nenhum requisito declarado para esta jornada."
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <label>
                  Motivo (fica registrado na auditoria)
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
                </label>
                <label>
                  Digite <code>{codigoSelecionado}</code> para confirmar
                  <input
                    type="text"
                    value={confirmacaoCodigo}
                    onChange={(e) => setConfirmacaoCodigo(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={!confirmacaoValida || abrir.isPending}
                  onClick={() => abrir.mutate()}
                >
                  Abrir jornada
                </button>
                <button
                  type="button"
                  disabled={!confirmacaoValida || retornar.isPending}
                  onClick={() => retornar.mutate()}
                >
                  Retornar jornada
                </button>
                {abrir.isError && (
                  <p role="alert">
                    Não foi possível abrir. {String((abrir.error as Error)?.message ?? "")}
                  </p>
                )}
                {retornar.isError && (
                  <p role="alert">
                    Não foi possível retornar. {String((retornar.error as Error)?.message ?? "")}
                  </p>
                )}
                {abrir.data && !abrir.data.reutilizado && <output>Jornada aberta.</output>}
                {retornar.data && !retornar.data.reutilizado && (
                  <output>Jornada retornada ao estado anterior.</output>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
