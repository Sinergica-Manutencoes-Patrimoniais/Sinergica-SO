/** Lista de Contas (E03-S01, AC-7).
 *
 * A diferença para a Lista de Clientes do PCM é o que esta tela NÃO faz: não filtra por `ativo`.
 * O PCM mostra quem está em operação; o Comercial precisa ver lead, prospecto, cliente ativo e
 * cliente antigo na mesma lista — é a "visão 360 de todo mundo" que motivou o ADR-0020. */

import { Badge, Button, Card, EmptyState, Field, Input, Select } from "@sinergica/ui";
import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { ContaComFunil, FiltroSituacaoConta } from "../application/comercial-gateway";
import { NovaOportunidadeModal } from "../components/NovaOportunidadeModal";
import type { Etapa } from "../domain/funil";
import { etapasVisiveis } from "../domain/funil";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; contas: ContaComFunil[]; etapas: Etapa[] };

function formatarValor(centavos: number | null): string {
  if (centavos === null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ContasPage({
  onAbrirConta,
}: {
  onAbrirConta?: (clienteId: string) => void;
}) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [texto, setTexto] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacaoConta>("todas");
  const [etapaId, setEtapaId] = useState<string>("");
  const [contaParaOportunidade, setContaParaOportunidade] = useState<ContaComFunil | null>(null);

  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [contas, etapas] = await Promise.all([
        supabaseComercialAdapter.listarContas({
          texto: texto || undefined,
          situacao,
          etapaId: etapaId || null,
        }),
        supabaseComercialAdapter.listarEtapas(),
      ]);
      setEstado({ fase: "pronto", contas, etapas });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar contas.",
      });
    }
  }, [texto, situacao, etapaId]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const etapasParaFiltro = useMemo(
    () => (estado.fase === "pronto" ? etapasVisiveis(estado.etapas) : []),
    [estado],
  );

  if (permissoesCarregando) return null;

  if (!temLeitura) {
    return (
      <EmptyState titulo="Sem acesso ao Comercial">
        Seu usuário não tem permissão no módulo Comercial. Fale com quem administra o sistema.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-xl font-bold text-ink">Contas</h1>
          <p className="text-sm text-ink-2">
            Todas as contas — lead, prospecto, cliente ativo e antigo. O PCM mostra só as ativas.
          </p>
        </div>
        <Button variant="ghost" onClick={carregar}>
          <RefreshCw className="size-4" aria-hidden />
          Atualizar
        </Button>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-52 flex-1">
            <Field label="Buscar">
              {(props) => (
                <Input
                  {...props}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Nome ou CNPJ"
                />
              )}
            </Field>
          </div>
          <Field label="Situação">
            {(props) => (
              <Select
                {...props}
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as FiltroSituacaoConta)}
              >
                <option value="todas">Todas</option>
                <option value="ativas">Ativas</option>
                <option value="inativas">Inativas</option>
              </Select>
            )}
          </Field>
          <Field label="Etapa do funil">
            {(props) => (
              <Select {...props} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                <option value="">Todas</option>
                {etapasParaFiltro.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>
                    {etapa.nome}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {estado.fase === "carregando" && <p className="text-sm text-ink-2">Carregando contas…</p>}

      {estado.fase === "erro" && (
        <Card>
          <p className="p-4 text-sm text-danger">{estado.mensagem}</p>
        </Card>
      )}

      {estado.fase === "pronto" && estado.contas.length === 0 && (
        // `filtrado` e não `vazio`: existem 105 contas em produção, então lista vazia aqui é
        // sempre resultado de filtro — a E00-S17 exige que as duas telas não se pareçam.
        <EmptyState titulo="Nenhuma conta encontrada" variante="filtrado">
          Ajuste os filtros de busca, situação ou etapa do funil.
        </EmptyState>
      )}

      {estado.fase === "pronto" && estado.contas.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-ink-2">
                <tr>
                  <th className="p-3 font-semibold">Conta</th>
                  <th className="p-3 font-semibold">Situação</th>
                  <th className="p-3 font-semibold">Etapa do funil</th>
                  <th className="p-3 font-semibold">Contato</th>
                  <th className="p-3 font-semibold">Local</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {estado.contas.map((conta) => (
                  <tr key={conta.id} className="border-b border-line/60 last:border-0">
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-left font-semibold text-ink hover:underline"
                        onClick={() => onAbrirConta?.(conta.id)}
                      >
                        {conta.nome}
                      </button>
                      {conta.cnpj && <p className="text-xs text-ink-2">{conta.cnpj}</p>}
                    </td>
                    <td className="p-3">
                      <Badge tone={conta.ativo ? "success" : "neutral"}>
                        {conta.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {conta.etapa ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: conta.etapa.cor }}
                          />
                          {conta.etapa.nome}
                          {conta.oportunidadesAbertas > 1 && (
                            <span className="text-xs text-ink-2">
                              +{conta.oportunidadesAbertas - 1}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-2">Sem oportunidade</span>
                      )}
                    </td>
                    <td className="p-3 text-ink-2">
                      {conta.contatoNome ?? conta.contatoTelefone ?? "—"}
                    </td>
                    <td className="p-3 text-ink-2">
                      {[conta.cidade, conta.estado].filter(Boolean).join("/") || "—"}
                    </td>
                    <td className="p-3 text-right">
                      {temEscrita && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setContaParaOportunidade(conta)}
                        >
                          <Plus className="size-4" aria-hidden />
                          Oportunidade
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {contaParaOportunidade && estado.fase === "pronto" && (
        <NovaOportunidadeModal
          conta={contaParaOportunidade}
          etapas={estado.etapas}
          onFechar={() => setContaParaOportunidade(null)}
          onCriada={() => {
            setContaParaOportunidade(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

export { formatarValor };
