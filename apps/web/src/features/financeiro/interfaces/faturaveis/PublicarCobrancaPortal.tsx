import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../../lib/mensagem-ativacao";
import { supabase } from "../../../../lib/supabase-client";
import type { LancamentoItem } from "../../domain/lancamento";
import { VincularDocumentoCobranca } from "./VincularDocumentoCobranca";

const schema = z
  .object({
    requestId: z.string().guid(),
    lancamentoId: z.string().guid(),
    osId: z.string().guid(),
    descricao: z.string().trim().min(1).max(1000),
    valorCentavos: z.number().int().positive(),
    competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    vencimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict();
type Pedido = z.infer<typeof schema>;
export function PublicarCobrancaPortal({
  usuario,
  lancamento,
}: { usuario: string; lancamento: LancamentoItem }) {
  if (
    import.meta.env.VITE_SSO_PUBLICAR_COBRANCA_OS_ENABLED !== "true" ||
    lancamento.tipo !== "entrada" ||
    !lancamento.osId ||
    !lancamento.clienteId
  )
    return null;
  return (
    <Conteudo
      key={JSON.stringify([usuario, lancamento.clienteId, lancamento.id])}
      usuario={usuario}
      lancamento={lancamento}
    />
  );
}
function Conteudo({ usuario, lancamento }: { usuario: string; lancamento: LancamentoItem }) {
  const chave = `sso-publicar-cobranca:${usuario}:${lancamento.clienteId}:${lancamento.id}`;
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = schema.parse(JSON.parse(salvo));
      return pedido.lancamentoId === lancamento.id && pedido.osId === lancamento.osId
        ? pedido
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const enviar = useMutation({
    mutationFn: async (p: Pedido) => {
      const { data, error } = await supabase
        .schema("financeiro")
        .rpc("sso_publicar_cobranca_os_mediada", {
          p_request_id: p.requestId,
          p_lancamento_id: p.lancamentoId,
          p_os_id: p.osId,
          p_descricao_publica: p.descricao,
          p_valor_esperado: p.valorCentavos,
          p_competencia_esperada: p.competencia,
          p_vencimento_esperado: p.vencimento,
        });
      if (error) throw error;
      if (
        !data ||
        data.lancamentoId !== p.lancamentoId ||
        data.requestId !== p.requestId ||
        typeof data.publicacaoId !== "string"
      )
        throw new Error("Resposta inválida.");
    },
    onSuccess: () => {
      try {
        sessionStorage.removeItem(chave);
      } catch {
        setMensagem("Publicação salva; procure suporte para limpar tentativa local.");
        return;
      }
      setPendente(null);
      setDescricao("");
      setConfirmado(false);
      setMensagem("Cobrança publicada. Nenhum lançamento ou cobrança foi criado.");
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
        "Resultado não confirmado. Repita a mesma tentativa antes de publicar novamente.",
      );
    },
  });
  function registrar(p: Pedido) {
    try {
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setMensagem("Não foi possível guardar tentativa; publicação não enviada.");
      return;
    }
    setPendente(p);
    setMensagem("");
    enviar.mutate(p);
  }
  return (
    <div>
      <button type="button" onClick={() => setAberto(!aberto)}>
        {aberto ? "Fechar publicação" : "Publicar cobrança na OS"}
      </button>
      {aberto && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pendente || enviar.isPending || !confirmado) return;
            try {
              registrar(
                schema.parse({
                  requestId: crypto.randomUUID(),
                  lancamentoId: lancamento.id,
                  osId: lancamento.osId,
                  descricao,
                  valorCentavos: lancamento.valorCentavos,
                  competencia: lancamento.dataCompetencia,
                  vencimento: lancamento.dataVencimento,
                }),
              );
            } catch {
              setMensagem("Confira a descrição e os dados do lançamento.");
            }
          }}
        >
          <p>
            Valor: {lancamento.valorCentavos} centavos · Competência: {lancamento.dataCompetencia} ·
            Vencimento: {lancamento.dataVencimento ?? "não informado"}.
          </p>
          <p>
            Descreva somente informação pública. Não inclua custos, fornecedores ou comprovantes
            internos.
          </p>
          <fieldset disabled={!!pendente || enviar.isPending}>
            <label>
              Descrição pública{" "}
              <input
                maxLength={1000}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
              />{" "}
              Revisei os dados para publicação.
            </label>
            <button type="submit" disabled={!confirmado}>
              Publicar cobrança existente
            </button>
          </fieldset>
        </form>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>
          Repetir tentativa
        </button>
      )}
      {mensagem && <output>{mensagem}</output>}
      {lancamento.clienteId && (
        <VincularDocumentoCobranca
          usuario={usuario}
          cliente={lancamento.clienteId}
          lancamento={lancamento.id}
        />
      )}
    </div>
  );
}
