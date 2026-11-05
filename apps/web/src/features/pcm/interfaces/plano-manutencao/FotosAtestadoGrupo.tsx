import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { useFotosGrupo } from "./useFotosGrupo";
export function FotosAtestadoGrupo({
  userId,
  clienteId,
  ocorrenciaId,
}: { userId: string; clienteId: string; ocorrenciaId: string }) {
  const [baixando, setBaixando] = useState(false);
  const [aviso, setAviso] = useState("");
  const fotos = useFotosGrupo(userId, clienteId, ocorrenciaId);
  const itens = fotos.data?.pages.flat() ?? [];
  const consistentes =
    new Set(itens.map((i) => i.id)).size === itens.length &&
    itens.every((i, n) => n === 0 || itens[n - 1]!.revisao > i.revisao);
  const baixar = async (id: string) => {
    if (
      baixando ||
      fotos.isFetching ||
      fotos.isError ||
      !consistentes ||
      !itens.some((i) => i.id === id)
    )
      return;
    setBaixando(true);
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error();
      const { data, error } = await supabase.functions.invoke<Blob>("pcm-foto-grupo-segura", {
        body: { lancamentoId: id },
      });
      if (error || !(data instanceof Blob)) throw new Error();
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error();
      const endereco = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = endereco;
      link.download = "foto-grupo";
      link.click();
      setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    } catch {
      setAviso("Foto indisponível ou acesso não autorizado.");
    } finally {
      setBaixando(false);
    }
  };
  return (
    <section aria-label="Fotos privadas do Grupo">
      <h5>Fotos registradas no atestado</h5>
      <p>
        Foto privada disponível para revisão; seu conteúdo e autoria não são comprovados
        automaticamente.
      </p>
      {(fotos.isError || !consistentes) && (
        <p role="alert">
          Fotos indisponíveis ou divergentes.{" "}
          <button type="button" onClick={() => void fotos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {fotos.data && !fotos.isFetching && !fotos.isError && consistentes && (
        <ul>
          {itens.map((f) => (
            <li key={f.id}>
              Revisão {f.revisao} · atestado {f.atestado_request_id} · nota {f.nota_id} ·{" "}
              {f.justificativa} · {f.criado_em}{" "}
              <button type="button" disabled={baixando} onClick={() => void baixar(f.id)}>
                Baixar para revisão
              </button>
            </li>
          ))}
        </ul>
      )}
      {fotos.hasNextPage && (
        <button
          type="button"
          disabled={fotos.isFetching}
          onClick={() => void fotos.fetchNextPage()}
        >
          Mais fotos
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
