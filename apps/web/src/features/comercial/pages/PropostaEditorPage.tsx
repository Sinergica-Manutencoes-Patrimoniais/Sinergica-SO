/** Editor de proposta (E03-S04): lista de propostas de uma oportunidade + composição de itens
 * com cálculo ao vivo + ciclo de status + versionamento.
 *
 * "Ao vivo" (AC-3) é client-side puro: a cada mudança nos itens, `calcularPrecificacao` (domínio)
 * roda na hora, sem round-trip — só ao clicar "Salvar" é que `useSalvarComposicao` persiste via
 * RPC. O preview e o salvo podem divergir por um instante (parâmetros mudaram enquanto editava);
 * isso é aceitável porque salvar sempre recalcula de novo no servidor com os valores atuais. */

import { Badge, Button, Card, EmptyState, Field, Input, Select } from "@sinergica/ui";
import { ArrowLeft, Download, FileSearch, Plus, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import { useCriarContrato } from "../application/contrato-queries";
import { useItensLevantamento, useLevantamentosDaConta } from "../application/levantamento-queries";
import {
  useAliquotaVigente,
  useNiveisTecnico,
  useParametrosPreco,
} from "../application/precificacao-queries";
import { montarItensImportadosDoLevantamento } from "../application/proposta";
import type { ItemCommand } from "../application/proposta-gateway";
import {
  useCriarProposta,
  useDuplicarProposta,
  useForcarPrecoAbaixoPiso,
  useMudarStatusProposta,
  usePropostaItens,
  usePropostaVersoes,
  usePropostasDaOportunidade,
  useSalvarComposicao,
  useVincularAssessment,
} from "../application/proposta-queries";
import { calcularPrecificacao, precoAbaixoDoPiso } from "../domain/precificacao";
import {
  type Proposta,
  type PropostaStatus,
  calcularTotalItem,
  estaExpirada,
  podeAvancarParaRevisao,
  podeEditar,
  somarCustoItens,
  transicaoStatusInvalida,
} from "../domain/proposta";
import { type PropostaPdfPayload, formatarTextoProposta } from "../domain/proposta-pdf";
import { supabaseContratoAdapter } from "../infrastructure/supabase-contrato-adapter";
import { supabaseLevantamentoAdapter } from "../infrastructure/supabase-levantamento-adapter";
import { supabasePrecificacaoAdapter } from "../infrastructure/supabase-precificacao-adapter";
import { supabasePropostaAdapter } from "../infrastructure/supabase-proposta-adapter";

const TIPO_LABEL: Record<Proposta["tipo"], string> = {
  levantamento: "Levantamento",
  volante: "Volante",
  residente: "Residente",
  simples: "Simples",
};

const STATUS_LABEL: Record<PropostaStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

const STATUS_TOM: Record<PropostaStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  rascunho: "neutral",
  em_revisao: "info",
  aprovada: "info",
  enviada: "warning",
  aceita: "success",
  recusada: "danger",
  cancelada: "neutral",
};

function formatarValor(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ItemRascunho extends ItemCommand {
  chave: string;
}

export function PropostaEditorPage({
  oportunidadeId,
  clienteId,
  clienteNome,
  onVoltar,
}: {
  oportunidadeId: string;
  /** E03-S05: a Conta da oportunidade — só pra listar os levantamentos DELA (AC-4 exige "mesma
   * Conta"; a RPC também reforça isso no banco, este prop é só o filtro do picker). */
  clienteId: string;
  /** E03-S06 AC-1: só pro cabeçalho do PDF — a proposta em si não sabe o nome da Conta. */
  clienteNome?: string;
  onVoltar: () => void;
}) {
  const { podeAcessar } = usePermissoes();
  const temEscrita = podeAcessar("comercial", "escrita");
  const superadmin = podeAcessar("comercial", "escrita"); // gate real de força é no banco; UI só oferece

  const propostasQuery = usePropostasDaOportunidade(supabasePropostaAdapter, oportunidadeId);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoTipo, setNovoTipo] = useState<Proposta["tipo"]>("simples");

  const criar = useCriarProposta(supabasePropostaAdapter);

  const itensQuery = usePropostaItens(supabasePropostaAdapter, propostaId);
  const versoesQuery = usePropostaVersoes(supabasePropostaAdapter, propostaId);
  const parametrosQuery = useParametrosPreco(supabasePrecificacaoAdapter);
  const aliquotaQuery = useAliquotaVigente(supabasePrecificacaoAdapter);
  const niveisQuery = useNiveisTecnico(supabasePrecificacaoAdapter);

  const salvar = useSalvarComposicao(supabasePropostaAdapter);
  const mudarStatus = useMudarStatusProposta(supabasePropostaAdapter);
  const forcarPreco = useForcarPrecoAbaixoPiso(supabasePropostaAdapter);
  const duplicar = useDuplicarProposta(supabasePropostaAdapter);
  const vincularAssessment = useVincularAssessment(supabasePropostaAdapter);
  const criarContrato = useCriarContrato(supabaseContratoAdapter);
  const [contratoGerado, setContratoGerado] = useState<string | null>(null);

  // E03-S05, AC-4/AC-7: levantamentos da mesma Conta — alimenta o seletor de vínculo e também
  // mostra se o levantamento vinculado está "em andamento" (AC-6) ou indisponível (edge case).
  const levantamentosQuery = useLevantamentosDaConta(supabaseLevantamentoAdapter, clienteId);
  const [levantamentoEscolhido, setLevantamentoEscolhido] = useState("");
  const [importandoLevantamento, setImportandoLevantamento] = useState(false);
  const [avisoImportacao, setAvisoImportacao] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [itensRascunho, setItensRascunho] = useState<ItemRascunho[] | null>(null);
  const [precoManual, setPrecoManual] = useState("");

  const propostaSelecionada = (propostasQuery.data ?? []).find((p) => p.id === propostaId) ?? null;

  // AC-6: o levantamento vinculado pode não estar na lista (excluído/arquivado depois de
  // vinculado) — `undefined` aqui é o sinal de "vínculo indisponível", tratado sem quebrar a tela.
  const levantamentoVinculado = (levantamentosQuery.data ?? []).find(
    (l) => l.id === propostaSelecionada?.assessmentId,
  );
  const itensLevantamentoQuery = useItensLevantamento(
    supabaseLevantamentoAdapter,
    propostaSelecionada?.assessmentId ?? null,
    clienteId,
    importandoLevantamento,
  );

  const itensAtuais =
    itensRascunho ??
    (itensQuery.data ?? []).map((item, i) => ({
      chave: `${item.id}-${i}`,
      tipo: item.tipo,
      descricao: item.descricao,
      nivelId: item.nivelId,
      materialId: item.materialId,
      quantidade: item.quantidade,
      custoUnitarioCentavos: item.custoUnitarioCentavos,
    }));

  const preview = useMemo(() => {
    if (!parametrosQuery.data || !aliquotaQuery.data) return null;
    const custoTotalCentavos = somarCustoItens(
      itensAtuais.map((item) => ({
        totalCentavos: calcularTotalItem(item.quantidade, item.custoUnitarioCentavos),
      })),
    );
    try {
      const resultado = calcularPrecificacao({
        custoTotalCentavos,
        margem: parametrosQuery.data.margemAlvoPct / 100,
        aliquota: aliquotaQuery.data.aliquotaEfetiva,
      });
      return resultado;
    } catch {
      return null;
    }
  }, [itensAtuais, parametrosQuery.data, aliquotaQuery.data]);

  function iniciarEdicao() {
    setItensRascunho(
      (itensQuery.data ?? []).map((item, i) => ({
        chave: `${item.id}-${i}`,
        tipo: item.tipo,
        descricao: item.descricao,
        nivelId: item.nivelId,
        materialId: item.materialId,
        quantidade: item.quantidade,
        custoUnitarioCentavos: item.custoUnitarioCentavos,
      })),
    );
  }

  function adicionarItem() {
    setItensRascunho([
      ...itensAtuais,
      {
        chave: `novo-${Date.now()}`,
        tipo: "outro",
        descricao: "",
        nivelId: null,
        materialId: null,
        quantidade: 1,
        custoUnitarioCentavos: 0,
      },
    ]);
  }

  function atualizarItem(chave: string, patch: Partial<ItemRascunho>) {
    setItensRascunho(
      itensAtuais.map((item) => (item.chave === chave ? { ...item, ...patch } : item)),
    );
  }

  function removerItem(chave: string) {
    setItensRascunho(itensAtuais.filter((item) => item.chave !== chave));
  }

  async function vincularLevantamento() {
    if (!propostaSelecionada || !levantamentoEscolhido) return;
    setErro(null);
    try {
      await vincularAssessment.mutateAsync({
        propostaId: propostaSelecionada.id,
        assessmentId: levantamentoEscolhido,
      });
      setLevantamentoEscolhido("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao vincular levantamento.");
    }
  }

  // AC-4/AC-5: converte (domínio filtra achados) e ACRESCENTA aos itens atuais — nunca troca o que
  // já existia. `itensAtuais` já resolve pro rascunho em edição se houver um, senão pros itens
  // salvos — então importar entra automaticamente em modo de edição.
  function importarItensDoLevantamento() {
    if (!itensLevantamentoQuery.data) return;
    const resultado = montarItensImportadosDoLevantamento(itensLevantamentoQuery.data);
    if (resultado.itens.length === 0) {
      setAvisoImportacao(
        "Nenhum item deste levantamento virou item de composição (só achados entram).",
      );
    } else {
      setItensRascunho([
        ...itensAtuais,
        ...resultado.itens.map((item, i) => ({
          ...item,
          chave: `importado-${Date.now()}-${i}`,
        })),
      ]);
      setAvisoImportacao(
        `${resultado.itens.length} ${resultado.itens.length === 1 ? "item importado" : "itens importados"}.`,
      );
    }
    setImportandoLevantamento(false);
  }

  async function salvarComposicao() {
    if (!propostaSelecionada || !parametrosQuery.data || !aliquotaQuery.data) return;
    setErro(null);
    try {
      const precoFinal = precoManual
        ? Math.round(Number(precoManual.replace(",", ".")) * 100)
        : null;
      await salvar.mutateAsync({
        propostaId: propostaSelecionada.id,
        itens: itensAtuais.map(({ chave: _chave, ...item }) => item),
        margem: parametrosQuery.data.margemAlvoPct / 100,
        aliquota: aliquotaQuery.data.aliquotaEfetiva,
        precoFinalCentavos: precoFinal,
      });
      setItensRascunho(null);
      setPrecoManual("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar composição.");
    }
  }

  // E03-S06, AC-1/AC-2: sempre a partir do SNAPSHOT da versão vigente (`proposta_versoes`), nunca
  // dos itens ao vivo na tela — reflete exatamente o que foi salvo, mesmo que a composição em
  // edição tenha mudanças ainda não persistidas. `versoesQuery` já vem ordenada desc (versao),
  // então o índice 0 é sempre a mais recente.
  async function baixarPdf() {
    if (!propostaSelecionada) return;
    const versao = (versoesQuery.data ?? [])[0];
    if (!versao) {
      setErro("Nenhuma versão salva ainda — salve a composição antes de gerar o PDF.");
      return;
    }
    setGerandoPdf(true);
    setErro(null);
    try {
      const pdf = await criarRelatorioPdf({
        titulo: "Proposta Comercial",
        subtitulo: `${clienteNome ?? "Conta"} · v${versao.versao}`,
      });
      pdf.escreverTexto(
        formatarTextoProposta(versao.payload as PropostaPdfPayload, clienteNome ?? "Conta"),
      );
      const bytes = await pdf.finalizar();
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `proposta-${(clienteNome ?? "conta").toLowerCase().replaceAll(/[^a-z0-9]+/gi, "-")}-v${versao.versao}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível gerar o PDF da proposta.");
    } finally {
      setGerandoPdf(false);
    }
  }

  // AC-1/AC-3, task 5: a ORDEM importa — gera o PDF primeiro; só muda o status se a geração
  // funcionar. "Publicar no portal" não é um passo à parte: `comercial.portal_propostas` (0188) é
  // uma view filtrada por status, então virar 'enviada' já É a publicação.
  async function enviarProposta() {
    if (!propostaSelecionada) return;
    setErro(null);
    setEnviando(true);
    try {
      const versao = (versoesQuery.data ?? [])[0];
      if (!versao) {
        throw new Error("Salve a composição antes de enviar — nenhuma versão encontrada.");
      }
      const pdf = await criarRelatorioPdf({
        titulo: "Proposta Comercial",
        subtitulo: `${clienteNome ?? "Conta"} · v${versao.versao}`,
      });
      pdf.escreverTexto(
        formatarTextoProposta(versao.payload as PropostaPdfPayload, clienteNome ?? "Conta"),
      );
      await pdf.finalizar(); // se isto lançar, o catch abaixo pega — mudarStatus nunca roda.
      await mudarStatus.mutateAsync({ propostaId: propostaSelecionada.id, status: "enviada" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a proposta.");
    } finally {
      setEnviando(false);
    }
  }

  async function mudar(status: PropostaStatus) {
    if (!propostaSelecionada) return;
    const problema = transicaoStatusInvalida(propostaSelecionada.status, status);
    if (problema) {
      setErro(problema);
      return;
    }
    if (status === "em_revisao" && !podeAvancarParaRevisao(itensQuery.data?.length ?? 0)) {
      setErro("Adicione ao menos um item antes de enviar para revisão.");
      return;
    }
    setErro(null);
    try {
      await mudarStatus.mutateAsync({ propostaId: propostaSelecionada.id, status });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao mudar status.");
    }
  }

  if (!propostaId) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={onVoltar}>
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </Button>

        {erro && (
          <Card>
            <p className="p-3 text-body text-danger">{erro}</p>
          </Card>
        )}

        {(propostasQuery.data ?? []).length === 0 ? (
          <EmptyState titulo="Nenhuma proposta ainda">
            Crie a primeira proposta desta oportunidade.
          </EmptyState>
        ) : (
          <Card>
            <ul className="divide-y divide-line/60">
              {(propostasQuery.data ?? []).map((proposta) => (
                <li key={proposta.id} className="p-3">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setPropostaId(proposta.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-semibold text-ink">
                        {TIPO_LABEL[proposta.tipo]} · v{proposta.versaoAtual}
                      </span>
                      <Badge tone={STATUS_TOM[proposta.status]}>
                        {STATUS_LABEL[proposta.status]}
                      </Badge>
                      {estaExpirada(proposta.validoAte) && <Badge tone="danger">Expirada</Badge>}
                    </div>
                    <p className="text-caption text-ink-2">
                      {formatarValor(proposta.precoCentavos)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {temEscrita && (
          <Card>
            <div className="flex items-end gap-2 p-3">
              <div className="flex-1">
                <Field label="Tipo da proposta">
                  {(props) => (
                    <Select
                      {...props}
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value as Proposta["tipo"])}
                    >
                      <option value="simples">Simples</option>
                      <option value="volante">Volante</option>
                      <option value="residente">Residente</option>
                      <option value="levantamento">Levantamento</option>
                    </Select>
                  )}
                </Field>
              </div>
              <Button
                onClick={async () => {
                  setErro(null);
                  try {
                    const nova = await criar.mutateAsync({ oportunidadeId, tipo: novoTipo });
                    setPropostaId(nova.id);
                  } catch (e) {
                    setErro(e instanceof Error ? e.message : "Falha ao criar proposta.");
                  }
                }}
              >
                <Plus className="size-4" aria-hidden />
                Nova proposta
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (!propostaSelecionada) return null;
  const editavel = temEscrita && podeEditar(propostaSelecionada.status);
  const custoAtual = somarCustoItens(
    itensAtuais.map((item) => ({
      totalCentavos: calcularTotalItem(item.quantidade, item.custoUnitarioCentavos),
    })),
  );

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => setPropostaId(null)}>
        <ArrowLeft className="size-4" aria-hidden />
        Voltar às propostas
      </Button>

      {erro && (
        <Card>
          <p className="p-3 text-body text-danger">{erro}</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <h1 className="flex-1 font-semibold text-ink">
            {TIPO_LABEL[propostaSelecionada.tipo]} · v{propostaSelecionada.versaoAtual}
          </h1>
          <Badge tone={STATUS_TOM[propostaSelecionada.status]}>
            {STATUS_LABEL[propostaSelecionada.status]}
          </Badge>
          {estaExpirada(propostaSelecionada.validoAte) && <Badge tone="danger">Expirada</Badge>}
        </div>

        {/* Contrato — E03-S07, AC-2. Só proposta ACEITA gera contrato (guarda real é a RPC
            fn_criar_contrato) — o resto do fluxo (editar campos, ativar, encerrar) mora em
            ContratosPage, não aqui, pra não duplicar a tela de gestão do contrato. */}
        {temEscrita && propostaSelecionada.status === "aceita" && (
          <div className="border-b border-line p-3">
            {contratoGerado ? (
              <p className="text-caption text-ink-2">
                Contrato criado. Vá em Comercial → Contratos pra editar e ativar.
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={criarContrato.isPending}
                onClick={async () => {
                  setErro(null);
                  try {
                    const contrato = await criarContrato.mutateAsync(propostaSelecionada.id);
                    setContratoGerado(contrato.id);
                  } catch (e) {
                    setErro(e instanceof Error ? e.message : "Falha ao gerar contrato.");
                  }
                }}
              >
                {criarContrato.isPending ? "Gerando…" : "Gerar contrato"}
              </Button>
            )}
          </div>
        )}

        {/* Levantamento — E03-S05, AC-4/AC-6. Só proposta tipo "levantamento" oferece o vínculo:
            é o tipo que existe justamente para consumir o Assessment de pré-venda. */}
        {propostaSelecionada.tipo === "levantamento" && (
          <div className="border-b border-line p-3">
            <h3 className="mb-2 text-body font-semibold text-ink">Levantamento</h3>
            {propostaSelecionada.assessmentId ? (
              levantamentoVinculado ? (
                <div className="space-y-2">
                  <p className="text-body text-ink">
                    {levantamentoVinculado.titulo}
                    {levantamentoVinculado.status !== "concluida" && (
                      <Badge tone="warning">Em andamento</Badge>
                    )}
                  </p>
                  <p className="text-caption text-ink-2">
                    {levantamentoVinculado.itensNaoConformes + levantamentoVinculado.itensAtencao}{" "}
                    achado(s) de {levantamentoVinculado.totalItens} item(ns) no levantamento
                  </p>
                  {editavel && !importandoLevantamento && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportandoLevantamento(true)}
                    >
                      <FileSearch className="size-4" aria-hidden />
                      Importar itens do levantamento
                    </Button>
                  )}
                  {importandoLevantamento && (
                    <div className="space-y-2 rounded-md border border-line-soft p-2">
                      {itensLevantamentoQuery.isPending ? (
                        <p className="text-caption text-ink-2">Carregando itens do levantamento…</p>
                      ) : itensLevantamentoQuery.error ? (
                        <p className="text-caption text-danger">
                          Falha ao carregar itens do levantamento.
                        </p>
                      ) : (
                        <p className="text-caption text-ink-2">
                          {itensLevantamentoQuery.data?.length ?? 0} item(ns) no levantamento —
                          achados (não conforme/atenção) entram na composição, acrescentados aos
                          itens já existentes.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={importarItensDoLevantamento}>
                          Confirmar importação
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setImportandoLevantamento(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  {avisoImportacao && <p className="text-caption text-ink-2">{avisoImportacao}</p>}
                </div>
              ) : (
                // AC edge case: Assessment excluído/arquivado depois de vinculado — os itens já
                // importados continuam na composição (foram copiados), só o vínculo fica indisponível.
                <p className="text-caption text-ink-3">
                  Levantamento vinculado está indisponível (excluído ou arquivado). Os itens já
                  importados continuam na composição normalmente.
                </p>
              )
            ) : editavel ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Vincular levantamento desta Conta">
                    {(props) => (
                      <Select
                        {...props}
                        value={levantamentoEscolhido}
                        onChange={(e) => setLevantamentoEscolhido(e.target.value)}
                      >
                        <option value="">Selecione…</option>
                        {(levantamentosQuery.data ?? []).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.titulo}
                            {l.status !== "concluida" ? " (em andamento)" : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <Button
                  size="sm"
                  disabled={!levantamentoEscolhido || vincularAssessment.isPending}
                  onClick={vincularLevantamento}
                >
                  Vincular
                </Button>
              </div>
            ) : (
              <p className="text-caption text-ink-3">Nenhum levantamento vinculado.</p>
            )}
            {(levantamentosQuery.data ?? []).length === 0 && !propostaSelecionada.assessmentId && (
              <p className="mt-1 text-caption text-ink-3">Nenhum levantamento nesta Conta ainda.</p>
            )}
          </div>
        )}

        {/* Painel de cálculo ao vivo — AC-3 */}
        <div className="grid grid-cols-2 gap-3 border-b border-line p-3 sm:grid-cols-4">
          <div>
            <p className="text-caption text-ink-2">Custo</p>
            <p className="font-semibold tabular-nums text-ink">{formatarValor(custoAtual)}</p>
          </div>
          <div>
            <p className="text-caption text-ink-2">Piso</p>
            <p className="font-semibold tabular-nums text-ink">
              {preview ? formatarValor(preview.pisoCentavos) : "—"}
            </p>
          </div>
          <div>
            <p className="text-caption text-ink-2">Preço sugerido</p>
            <p className="font-semibold tabular-nums text-ink">
              {preview ? formatarValor(preview.precoCentavos) : "—"}
            </p>
          </div>
          <div>
            <p className="text-caption text-ink-2">Desconto máx.</p>
            <p className="font-semibold tabular-nums text-ink">
              {preview ? `${(preview.descontoMaximo * 100).toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>

        {/* Composição */}
        <div className="border-b border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-body font-semibold text-ink">Composição</h3>
            {editavel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={itensRascunho ? adicionarItem : iniciarEdicao}
              >
                <Plus className="size-4" aria-hidden />
                {itensRascunho ? "Adicionar item" : "Editar"}
              </Button>
            )}
          </div>

          {itensAtuais.length === 0 && !itensRascunho && (
            <p className="py-4 text-center text-caption text-ink-3">Nenhum item ainda.</p>
          )}

          <ul className="space-y-2">
            {itensAtuais.map((item) => (
              <li
                key={item.chave}
                className="flex items-end gap-2 rounded-md border border-line-soft p-2"
              >
                {itensRascunho ? (
                  <>
                    <div className="w-24">
                      <Field label="Tipo">
                        {(props) => (
                          <Select
                            {...props}
                            value={item.tipo}
                            onChange={(e) =>
                              atualizarItem(item.chave, {
                                tipo: e.target.value as ItemCommand["tipo"],
                              })
                            }
                          >
                            <option value="mo">MO</option>
                            <option value="material">Material</option>
                            <option value="veiculo">Veículo</option>
                            <option value="outro">Outro</option>
                          </Select>
                        )}
                      </Field>
                    </div>
                    {item.tipo === "mo" && (
                      <div className="w-40">
                        <Field label="Nível (custo/hora automático)">
                          {(props) => (
                            <Select
                              {...props}
                              value={item.nivelId ?? ""}
                              onChange={async (e) => {
                                const nivelId = e.target.value || null;
                                const nivel = (niveisQuery.data ?? []).find(
                                  (n) => n.id === nivelId,
                                );
                                if (!nivel) {
                                  atualizarItem(item.chave, { nivelId: null });
                                  return;
                                }
                                // AC-3/AC-8: custo/hora vem do motor (Financeiro ou fallback,
                                // já resolvido/testado na S03) — nunca digitado à mão pro MO.
                                const custo =
                                  await supabasePrecificacaoAdapter.obterCustoHoraNivel(nivel);
                                atualizarItem(item.chave, {
                                  nivelId,
                                  descricao: item.descricao || nivel.nome,
                                  custoUnitarioCentavos: custo.custoHoraCentavos,
                                });
                              }}
                            >
                              <option value="">Selecione…</option>
                              {(niveisQuery.data ?? [])
                                .filter((n) => n.ativo)
                                .map((nivel) => (
                                  <option key={nivel.id} value={nivel.id}>
                                    {nivel.nome}
                                  </option>
                                ))}
                            </Select>
                          )}
                        </Field>
                      </div>
                    )}
                    <div className="flex-1">
                      <Field label="Descrição">
                        {(props) => (
                          <Input
                            {...props}
                            value={item.descricao}
                            onChange={(e) =>
                              atualizarItem(item.chave, { descricao: e.target.value })
                            }
                          />
                        )}
                      </Field>
                    </div>
                    <div className="w-20">
                      <Field label={item.tipo === "mo" ? "Horas" : "Qtd."}>
                        {(props) => (
                          <Input
                            {...props}
                            type="number"
                            value={item.quantidade}
                            onChange={(e) =>
                              atualizarItem(item.chave, { quantidade: Number(e.target.value) || 0 })
                            }
                          />
                        )}
                      </Field>
                    </div>
                    <div className="w-28">
                      <Field label={item.tipo === "mo" ? "Custo/hora (auto)" : "Custo unit. (R$)"}>
                        {(props) => (
                          <Input
                            {...props}
                            type="number"
                            step="0.01"
                            // MO vem do nível (obterCustoHoraNivel) — editável só se não houver
                            // nível selecionado, senão o número deixaria de bater com o motor.
                            disabled={item.tipo === "mo" && item.nivelId !== null}
                            value={item.custoUnitarioCentavos / 100}
                            onChange={(e) =>
                              atualizarItem(item.chave, {
                                custoUnitarioCentavos:
                                  Math.round(Number(e.target.value) * 100) || 0,
                              })
                            }
                          />
                        )}
                      </Field>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removerItem(item.chave)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </>
                ) : (
                  <div className="flex-1">
                    <p className="text-body text-ink">
                      {item.descricao || <span className="text-ink-3">(sem descrição)</span>}
                    </p>
                    <p className="text-caption text-ink-2">
                      {item.tipo} · {item.quantidade} × {formatarValor(item.custoUnitarioCentavos)}{" "}
                      ={" "}
                      {formatarValor(
                        calcularTotalItem(item.quantidade, item.custoUnitarioCentavos),
                      )}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {itensRascunho && (
            <div className="mt-3 flex items-end gap-2">
              <div className="w-40">
                <Field label="Preço final (R$) — opcional">
                  {(props) => (
                    <Input
                      {...props}
                      value={precoManual}
                      onChange={(e) => setPrecoManual(e.target.value)}
                      placeholder={preview ? (preview.precoCentavos / 100).toFixed(2) : ""}
                    />
                  )}
                </Field>
              </div>
              <Button onClick={salvarComposicao} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando…" : "Salvar composição"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setItensRascunho(null);
                  setPrecoManual("");
                }}
              >
                Cancelar
              </Button>
            </div>
          )}

          {preview &&
            precoManual &&
            precoAbaixoDoPiso(
              Math.round(Number(precoManual.replace(",", ".")) * 100) || 0,
              preview.pisoCentavos,
            ) && (
              <p className="mt-2 text-caption text-danger">
                Preço abaixo do piso — será recusado ao salvar. Só superadmin pode forçar, com
                justificativa.
              </p>
            )}
        </div>

        {/* PDF — E03-S06 AC-1/AC-2. Disponível sempre que existir ao menos uma versão salva,
            independente do status: quem decide se está pronto pra baixar é quem trabalha nela. */}
        {(versoesQuery.data ?? []).length > 0 && (
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Button variant="ghost" size="sm" onClick={baixarPdf} disabled={gerandoPdf}>
              <Download className="size-4" aria-hidden />
              {gerandoPdf ? "Gerando PDF…" : "Baixar PDF"}
            </Button>
          </div>
        )}

        {/* Status */}
        {temEscrita && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <span className="text-caption font-semibold text-ink-2">Mudar status:</span>
            {(
              [
                "rascunho",
                "em_revisao",
                "aprovada",
                "enviada",
                "aceita",
                "recusada",
                "cancelada",
              ] as PropostaStatus[]
            )
              .filter(
                (s) =>
                  transicaoStatusInvalida(propostaSelecionada.status, s) === null &&
                  s !== propostaSelecionada.status,
              )
              .map((status) =>
                // AC-1/AC-3, task 5: "enviada" tem caminho próprio — gera o PDF ANTES de mudar o
                // status (mudarStatus genérico não faz isso, mudaria o status mesmo se o PDF
                // falhasse). Os outros status continuam pelo caminho genérico de sempre.
                status === "enviada" ? (
                  <Button
                    key={status}
                    variant="ghost"
                    size="sm"
                    onClick={enviarProposta}
                    disabled={enviando}
                  >
                    <Send className="size-4" aria-hidden />
                    {enviando ? "Enviando…" : "Enviar (gera PDF + publica no portal)"}
                  </Button>
                ) : (
                  <Button key={status} variant="ghost" size="sm" onClick={() => mudar(status)}>
                    {STATUS_LABEL[status]}
                  </Button>
                ),
              )}
            {!podeEditar(propostaSelecionada.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const nova = await duplicar.mutateAsync(propostaSelecionada.id);
                  setPropostaId(nova.id);
                }}
              >
                Duplicar para editar
              </Button>
            )}
          </div>
        )}

        {/* Força de preço abaixo do piso — a UI oferece, o banco decide (guarda real é lá) */}
        {superadmin && preview && (
          <div className="border-b border-line p-3">
            <details>
              <summary className="cursor-pointer text-caption font-semibold text-ink-2">
                Forçar preço abaixo do piso (superadmin)
              </summary>
              <ForcarPisoForm
                pisoCentavos={propostaSelecionada.pisoCentavos}
                onForcar={async (preco, motivo) => {
                  setErro(null);
                  try {
                    await forcarPreco.mutateAsync({
                      propostaId: propostaSelecionada.id,
                      precoCentavos: preco,
                      motivo,
                    });
                  } catch (e) {
                    setErro(e instanceof Error ? e.message : "Falha ao forçar preço.");
                  }
                }}
              />
            </details>
          </div>
        )}

        {/* Histórico de versões */}
        <div className="p-3">
          <h3 className="mb-2 text-body font-semibold text-ink">Histórico de versões</h3>
          <ul className="space-y-1 text-caption text-ink-2">
            {(versoesQuery.data ?? []).map((versao) => (
              <li key={versao.id}>
                v{versao.versao} — {new Date(versao.criadoEm).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function ForcarPisoForm({
  pisoCentavos,
  onForcar,
}: {
  pisoCentavos: number;
  onForcar: (precoCentavos: number, motivo: string) => void;
}) {
  const [preco, setPreco] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <div className="mt-2 space-y-2">
      <p className="text-caption text-ink-2">Piso atual: {formatarValor(pisoCentavos)}</p>
      <Field label="Novo preço (R$)">
        {(props) => <Input {...props} value={preco} onChange={(e) => setPreco(e.target.value)} />}
      </Field>
      <Field label="Motivo (obrigatório)">
        {(props) => <Input {...props} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </Field>
      <Button
        variant="ghost"
        size="sm"
        disabled={!preco || !motivo.trim()}
        onClick={() => onForcar(Math.round(Number(preco.replace(",", ".")) * 100), motivo)}
      >
        Confirmar exceção
      </Button>
    </div>
  );
}
