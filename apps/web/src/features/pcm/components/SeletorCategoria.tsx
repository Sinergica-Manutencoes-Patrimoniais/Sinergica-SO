import { Button } from "@sinergica/ui";
import { useState } from "react";
import { useCategoriasAtivo, useCriarCategoriaAtivo } from "../application/ativos-cliente-queries";
import { sugerirSiglaUnica, validarSigla } from "../domain/siglas";
import { supabaseCatalogosSimplesAdapter } from "../infrastructure/supabase-catalogos-simples-adapter";

export function SeletorCategoria({
  value,
  onChange,
  textoLegado = null,
  userId = "",
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  textoLegado?: string | null;
  userId?: string;
  disabled?: boolean;
}) {
  const categoriasQuery = useCategoriasAtivo(supabaseCatalogosSimplesAdapter);
  const criarCategoria = useCriarCategoriaAtivo(supabaseCatalogosSimplesAdapter);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const categorias = categoriasQuery.data ?? [];

  async function criar() {
    try {
      setErro(null);
      const nova = await criarCategoria.mutateAsync({
        descricao: nome.trim(),
        sigla: validarSigla(sigla),
        userId,
      });
      onChange(nova.id);
      setCriando(false);
      setNome("");
      setSigla("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar categoria.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {textoLegado && !value && (
        <p className="text-caption text-warning">
          Categoria atual (fora do catálogo): «{textoLegado}»
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-caption font-semibold text-ink-3">Categoria *</span>
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className="input w-full"
          disabled={disabled}
        >
          <option value="">Selecione…</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.descricao}
              {categoria.sigla ? ` (${categoria.sigla})` : ""}
            </option>
          ))}
        </select>
      </label>
      {!criando ? (
        <Button
          variant="ghost"
          className="w-fit text-orange"
          onClick={() => setCriando(true)}
          disabled={disabled || !userId}
        >
          + Nova categoria
        </Button>
      ) : (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-line-soft p-3 md:grid-cols-[1fr_120px_auto]">
          <label>
            <span className="sr-only">Nome *</span>
            <input
              aria-label="Nome *"
              className="input w-full"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              onBlur={() => {
                if (!nome.trim()) return;
                const emUso = new Set(
                  categorias.flatMap((categoria) => (categoria.sigla ? [categoria.sigla] : [])),
                );
                setSigla(sugerirSiglaUnica(nome, emUso, { manterNumero: true }));
              }}
            />
          </label>
          <label>
            <span className="sr-only">Sigla *</span>
            <input
              aria-label="Sigla *"
              className="input w-full"
              value={sigla}
              onChange={(event) => setSigla(event.target.value.toUpperCase())}
            />
          </label>
          <Button
            variant="primary"
            onClick={criar}
            disabled={criarCategoria.isPending || !nome.trim() || !sigla.trim()}
          >
            Criar
          </Button>
          {erro && <p className="md:col-span-3 text-caption text-danger">{erro}</p>}
        </div>
      )}
    </div>
  );
}
