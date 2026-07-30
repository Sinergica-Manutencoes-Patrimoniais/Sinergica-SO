// SeletorLocal.tsx — E01-S107. Local do Chamado/OS: seleção da lista de Locais do cliente
// (Estrutura, E01-S76) + opção "Outro" com texto livre. O valor gravado é sempre texto (nome do
// Local escolhido, ou o texto livre de "Outro") — sem mudança de schema em `chamados.local`/
// `ordens_servico.local_descricao`.
import { useEffect, useRef, useState } from "react";
import { listarLocaisDoCliente } from "../application/hierarquia";
import type { Local } from "../domain/hierarquia";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";

const OUTRO = "__outro__";

export function SeletorLocal({
  clienteId,
  value,
  onChange,
  label = "Local",
}: {
  clienteId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setLocais([]);
      return;
    }
    setCarregando(true);
    listarLocaisDoCliente(supabaseHierarquiaAdapter, clienteId)
      .then(setLocais)
      .finally(() => setCarregando(false));
  }, [clienteId]);

  // AC-5: troca de cliente reseta a seleção (evita gravar Local de outro cliente por engano) —
  // mas não no primeiro render (edição de registro existente já vem com clienteId+value prontos).
  // `onChangeRef` evita que a identidade de `onChange` (recriada a cada render do pai) dispare
  // este efeito à toa — ele só deve reagir a mudança real de `clienteId`.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const clienteAnterior = useRef(clienteId);
  useEffect(() => {
    if (clienteAnterior.current !== clienteId) {
      clienteAnterior.current = clienteId;
      onChangeRef.current("");
    }
  }, [clienteId]);

  const nomesLocais = new Set(locais.map((l) => l.nome));
  // AC-3: cliente sem Locais cadastrados mostra só "Outro" pré-selecionado.
  const semLocaisCadastrados = !carregando && locais.length === 0;
  const emOutro = (value !== "" && !nomesLocais.has(value)) || semLocaisCadastrados;
  const selecionado = emOutro ? OUTRO : value;

  function selecionar(novoValor: string) {
    onChange(novoValor === OUTRO ? "" : novoValor);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
        <select
          value={selecionado}
          onChange={(e) => selecionar(e.target.value)}
          disabled={!clienteId || carregando}
          className="input w-full"
        >
          {!semLocaisCadastrados && (
            <option value="">{carregando ? "Carregando…" : "Selecione…"}</option>
          )}
          {locais.map((local) => (
            <option key={local.id} value={local.nome}>
              {local.nome}
            </option>
          ))}
          <option value={OUTRO}>Outro</option>
        </select>
      </label>
      {selecionado === OUTRO && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Descreva o local"
          className="input w-full"
        />
      )}
    </div>
  );
}
