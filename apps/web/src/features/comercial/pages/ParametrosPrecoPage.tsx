/** Parâmetros de precificação, níveis de técnico e catálogo de materiais (E03-S03).
 *
 * Três blocos numa página só — cadastro simples, sem fluxo próprio entre eles. A alíquota mostrada
 * no topo é a mesma que o motor de preço vai usar em qualquer proposta (AC-5); o aviso de "não
 * confirmada" (AC-6) e a explicação do INSS patronal (AC-9) ficam ao lado, não escondidos. */

import { Badge, Button, Card, Field, Input } from "@sinergica/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { NivelTecnico } from "../application/precificacao-gateway";
import {
  useAliquotaVigente,
  useCargosPcm,
  useCriarMaterial,
  useCriarNivelTecnico,
  useEditarMaterial,
  useEditarNivelTecnico,
  useEditarParametrosPreco,
  useMateriais,
  useNiveisTecnico,
  useParametrosPreco,
} from "../application/precificacao-queries";
import { supabasePrecificacaoAdapter } from "../infrastructure/supabase-precificacao-adapter";

function formatarPct(fracao: number): string {
  return `${(fracao * 100).toFixed(2)}%`;
}

function formatarValor(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ParametrosPrecoPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");
  const habilitado = !permissoesCarregando && temLeitura;

  const parametrosQuery = useParametrosPreco(supabasePrecificacaoAdapter, habilitado);
  const aliquotaQuery = useAliquotaVigente(supabasePrecificacaoAdapter, habilitado);
  const niveisQuery = useNiveisTecnico(supabasePrecificacaoAdapter, habilitado);
  const materiaisQuery = useMateriais(supabasePrecificacaoAdapter, habilitado);
  const cargosQuery = useCargosPcm(supabasePrecificacaoAdapter, habilitado);

  const editarParametros = useEditarParametrosPreco(supabasePrecificacaoAdapter);
  const criarNivel = useCriarNivelTecnico(supabasePrecificacaoAdapter);
  const editarNivel = useEditarNivelTecnico(supabasePrecificacaoAdapter);
  const criarMaterial = useCriarMaterial(supabasePrecificacaoAdapter);
  const editarMaterial = useEditarMaterial(supabasePrecificacaoAdapter);

  const [erro, setErro] = useState<string | null>(null);
  const [novoNivelNome, setNovoNivelNome] = useState("");
  const [novoNivelCusto, setNovoNivelCusto] = useState("");
  const [novoMaterialNome, setNovoMaterialNome] = useState("");
  const [novoMaterialUnidade, setNovoMaterialUnidade] = useState("");
  const [novoMaterialCusto, setNovoMaterialCusto] = useState("");

  if (permissoesCarregando) return null;
  if (!temLeitura) return null;

  const parametros = parametrosQuery.data;
  const aliquota = aliquotaQuery.data;
  const niveis = niveisQuery.data ?? [];
  const materiais = materiaisQuery.data ?? [];
  const cargos = cargosQuery.data ?? [];

  async function salvarParametro(campo: string, valor: number | boolean) {
    setErro(null);
    try {
      await editarParametros.mutateAsync({ [campo]: valor });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar parâmetro.");
    }
  }

  async function adicionarNivel() {
    const nome = novoNivelNome.trim();
    const custo = Math.round(Number(novoNivelCusto.replace(",", ".")) * 100);
    if (!nome || !Number.isFinite(custo) || custo < 0) return;
    setErro(null);
    try {
      await criarNivel.mutateAsync({ nome, custoMensalReferenciaCentavos: custo });
      setNovoNivelNome("");
      setNovoNivelCusto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar nível.");
    }
  }

  async function adicionarMaterial() {
    const nome = novoMaterialNome.trim();
    const unidade = novoMaterialUnidade.trim();
    const custo = Math.round(Number(novoMaterialCusto.replace(",", ".")) * 100);
    if (!nome || !unidade || !Number.isFinite(custo) || custo < 0) return;
    setErro(null);
    try {
      await criarMaterial.mutateAsync({ nome, unidade, custoReferenciaCentavos: custo });
      setNovoMaterialNome("");
      setNovoMaterialUnidade("");
      setNovoMaterialCusto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar material.");
    }
  }

  async function vincularCargo(nivel: NivelTecnico, cargoPcm: string) {
    setErro(null);
    try {
      await editarNivel.mutateAsync({ id: nivel.id, cargoPcm: cargoPcm || null });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao vincular cargo.");
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-brand text-xl font-bold text-ink">Precificação</h1>
        <p className="text-sm text-ink-2">
          Parâmetros do motor de preço, níveis de técnico e catálogo de materiais.
        </p>
      </header>

      {erro && (
        <Card>
          <p className="p-3 text-sm text-danger">{erro}</p>
        </Card>
      )}

      {/* Alíquota — sempre do Financeiro, nunca constante no código (AC-5/AC-6). */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-semibold text-ink">Alíquota vigente:</span>
          {aliquotaQuery.isPending ? (
            <span className="text-sm text-ink-2">carregando…</span>
          ) : aliquota ? (
            <>
              <Badge tone={aliquota.confirmada ? "success" : "warning"}>
                {formatarPct(aliquota.aliquotaEfetiva)} ·{" "}
                {aliquota.tipo === "fixa" ? "fixa" : "faixa RBT12"}
              </Badge>
              {!aliquota.confirmada && (
                <span className="text-xs text-warning">
                  Configuração de impostos ainda não foi confirmada por ninguém — vem do seed.
                  Confirme em Financeiro → Impostos antes de usar em proposta real.
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-danger">Não foi possível carregar.</span>
          )}
        </div>
      </Card>

      {parametros && (
        <Card>
          <div className="border-b border-line p-3">
            <h2 className="font-semibold text-ink">Parâmetros</h2>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["margemAlvoPct", "Margem alvo (%)", parametros.margemAlvoPct],
                ["overheadPct", "Overhead (%)", parametros.overheadPct],
                ["beneficiosPct", "Benefícios (%)", parametros.beneficiosPct],
                ["suportePct", "Suporte (%)", parametros.suportePct],
                [
                  "markupMaterialPadraoPct",
                  "Markup padrão de material (%)",
                  parametros.markupMaterialPadraoPct,
                ],
              ] as const
            ).map(([campo, label, valor]) => (
              <Field key={campo} label={label}>
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    step="0.01"
                    defaultValue={valor}
                    disabled={!temEscrita}
                    onBlur={(e) => {
                      const numero = Number(e.target.value);
                      if (Number.isFinite(numero) && numero !== valor)
                        salvarParametro(campo, numero);
                    }}
                  />
                )}
              </Field>
            ))}
            <Field label="Veículo mensal (R$)">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  step="0.01"
                  defaultValue={parametros.veiculoMensalCentavos / 100}
                  disabled={!temEscrita}
                  onBlur={(e) => {
                    const centavos = Math.round(Number(e.target.value) * 100);
                    if (Number.isFinite(centavos))
                      salvarParametro("veiculoMensalCentavos", centavos);
                  }}
                />
              )}
            </Field>
          </div>
          <div className="border-t border-line p-3">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 accent-orange"
                checked={parametros.moIncluiInssPatronal}
                disabled={!temEscrita}
                onChange={(e) => salvarParametro("moIncluiInssPatronal", e.target.checked)}
              />
              <span>
                O custo cadastrado por funcionário já inclui INSS patronal (CPP)
                <span className="mt-1 block text-xs text-ink-2">
                  No Anexo IV do Simples, o CPP fica FORA do DAS (recolhido à parte); no Anexo III
                  fica DENTRO. Se estiver marcado e a empresa for Anexo III, o encargo pode estar
                  sendo contado duas vezes — confirme uma vez com o contador (AC-9).
                </span>
              </span>
            </label>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line p-3">
            <h2 className="font-semibold text-ink">Níveis de técnico</h2>
          </div>
          <ul className="divide-y divide-line/60">
            {niveis.map((nivel) => (
              <li key={nivel.id} className="space-y-1.5 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-semibold text-ink">{nivel.nome}</span>
                  {!nivel.ativo && <Badge tone="neutral">Desativado</Badge>}
                  {temEscrita && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editarNivel.mutateAsync({ id: nivel.id, ativo: !nivel.ativo })}
                    >
                      {nivel.ativo ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-ink-2">
                  Referência: {formatarValor(nivel.custoMensalReferenciaCentavos)}/mês ·{" "}
                  {nivel.horasMesReferencia}h
                </p>
                {temEscrita ? (
                  <select
                    className="w-full rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink"
                    value={nivel.cargoPcm ?? ""}
                    onChange={(e) => vincularCargo(nivel, e.target.value)}
                  >
                    <option value="">
                      Sem cargo vinculado — usa a referência (custo estimado)
                    </option>
                    {cargos.map((cargo) => (
                      <option key={cargo} value={cargo}>
                        {cargo}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-ink-3">
                    Cargo: {nivel.cargoPcm ?? "nenhum (custo estimado)"}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {temEscrita && (
            <div className="space-y-2 border-t border-line p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Nome do nível">
                    {(props) => (
                      <Input
                        {...props}
                        value={novoNivelNome}
                        onChange={(e) => setNovoNivelNome(e.target.value)}
                        placeholder="Ex.: Técnico pleno"
                      />
                    )}
                  </Field>
                </div>
                <div className="w-32">
                  <Field label="Ref. mensal (R$)">
                    {(props) => (
                      <Input
                        {...props}
                        value={novoNivelCusto}
                        onChange={(e) => setNovoNivelCusto(e.target.value)}
                        placeholder="4.400,00"
                      />
                    )}
                  </Field>
                </div>
              </div>
              <Button onClick={adicionarNivel} disabled={!novoNivelNome.trim()}>
                <Plus className="size-4" aria-hidden />
                Adicionar nível
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-line p-3">
            <h2 className="font-semibold text-ink">Catálogo de materiais</h2>
          </div>
          <ul className="divide-y divide-line/60">
            {materiais.map((material) => (
              <li key={material.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{material.nome}</p>
                  <p className="text-xs text-ink-2">
                    {formatarValor(material.custoReferenciaCentavos)}/{material.unidade} · markup{" "}
                    {material.markupPct !== null ? `${material.markupPct}%` : "padrão"}
                  </p>
                </div>
                {!material.ativo && <Badge tone="neutral">Desativado</Badge>}
                {temEscrita && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      editarMaterial.mutateAsync({ id: material.id, ativo: !material.ativo })
                    }
                  >
                    {material.ativo ? "Desativar" : "Reativar"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {temEscrita && (
            <div className="space-y-2 border-t border-line p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Material">
                    {(props) => (
                      <Input
                        {...props}
                        value={novoMaterialNome}
                        onChange={(e) => setNovoMaterialNome(e.target.value)}
                        placeholder="Ex.: Compressor 1/3 HP"
                      />
                    )}
                  </Field>
                </div>
                <div className="w-20">
                  <Field label="Unid.">
                    {(props) => (
                      <Input
                        {...props}
                        value={novoMaterialUnidade}
                        onChange={(e) => setNovoMaterialUnidade(e.target.value)}
                        placeholder="un"
                      />
                    )}
                  </Field>
                </div>
                <div className="w-32">
                  <Field label="Custo (R$)">
                    {(props) => (
                      <Input
                        {...props}
                        value={novoMaterialCusto}
                        onChange={(e) => setNovoMaterialCusto(e.target.value)}
                        placeholder="120,00"
                      />
                    )}
                  </Field>
                </div>
              </div>
              <Button onClick={adicionarMaterial} disabled={!novoMaterialNome.trim()}>
                <Plus className="size-4" aria-hidden />
                Adicionar material
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
