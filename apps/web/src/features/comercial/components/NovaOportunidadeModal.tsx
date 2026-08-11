/** Criação de oportunidade para uma Conta (E03-S01, AC-4). */

import { Button, Field, Input, Modal, Select, Textarea } from "@sinergica/ui";
import { useState } from "react";
import { useCriarOportunidade } from "../application/comercial-queries";
import type { Etapa } from "../domain/funil";
import { etapaPadrao, etapasVisiveis } from "../domain/funil";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";

/** Aceita "1.234,56", "1234,56" ou "1234.56" e devolve centavos inteiros. Conversão por string
 * (nunca `parseFloat` direto no valor em reais) — mesma regra do Financeiro: float acumula erro
 * de centavo. */
export function reaisParaCentavos(entrada: string): number | null {
  const limpo = entrada.trim();
  if (!limpo) return null;
  const normalizado = limpo.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) throw new Error("Valor estimado inválido.");
  return Math.round(numero * 100);
}

export function NovaOportunidadeModal({
  conta,
  etapas,
  onFechar,
  onCriada,
}: {
  /** Só id e nome — o modal não precisa da Conta inteira, e pedir menos deixa a Visão 360
   * montar o modal sem carregar a Conta de novo. */
  conta: { id: string; nome: string };
  etapas: Etapa[];
  onFechar: () => void;
  onCriada: () => void;
}) {
  const visiveis = etapasVisiveis(etapas);
  // Etapas terminais não aparecem: oportunidade não nasce ganha nem perdida.
  const abertas = visiveis.filter((e) => e.tipo === "aberta");
  const padrao = abertas[0];

  // Estado de formulário continua em `useState` — é estado local de UI, não dado de servidor
  // (`CLAUDE.md` § Data fetching). Só a escrita passa pela mutation.
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [etapaId, setEtapaId] = useState(padrao?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const criar = useCriarOportunidade(supabaseComercialAdapter);

  async function salvar() {
    setErro(null);
    try {
      // `etapaPadrao` lança mensagem clara se o funil não tiver etapa aberta — melhor do que
      // deixar o banco devolver violação de FK.
      const etapa = etapaId ? visiveis.find((e) => e.id === etapaId) : etapaPadrao(etapas);
      await criar.mutateAsync({
        clienteId: conta.id,
        titulo,
        descricao: descricao.trim() || null,
        valorEstimadoCentavos: reaisParaCentavos(valor),
        etapaId: etapa?.id ?? null,
      });
      // A lista e a aba da Conta se atualizam pela invalidação de chave da mutation.
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar oportunidade.");
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
      titulo={`Nova oportunidade — ${conta.nome}`}
    >
      <div className="space-y-3">
        <Field label="Título" required>
          {(props) => (
            <Input
              {...props}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Contrato de manutenção predial"
            />
          )}
        </Field>

        <Field label="Valor estimado (R$)">
          {(props) => (
            <Input
              {...props}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex.: 4.500,00"
              inputMode="decimal"
            />
          )}
        </Field>

        <Field label="Etapa inicial">
          {(props) => (
            <Select {...props} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
              {abertas.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Descrição">
          {(props) => (
            <Textarea
              {...props}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Contexto da negociação, o que o cliente pediu…"
            />
          )}
        </Field>

        {abertas.length === 0 && (
          <p className="text-sm text-danger">
            O funil não tem nenhuma etapa aberta ativa. Configure uma antes de criar oportunidades.
          </p>
        )}

        {erro && <p className="text-sm text-danger">{erro}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={criar.isPending || !titulo.trim() || abertas.length === 0}
          >
            {criar.isPending ? "Criando…" : "Criar oportunidade"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
