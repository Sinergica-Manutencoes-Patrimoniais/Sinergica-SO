import type { ReactNode } from "react";
import { useCargaVisivel } from "./use-carga-visivel";

// E00-S29 — o aviso de carregamento que NÃO pisca.
//
// O projeto tinha ~200 `return <output>Carregando…</output>` soltos. Em requisição rápida (cache
// quente, rede boa) eles aparecem e somem no mesmo piscar de olhos: o usuário não lê nada, só vê
// a tela tremer. A regra certa já existia em `use-carga-visivel.ts` desde E00-S17 e só o
// `DataTable` usava.
//
// Aqui o atraso de 200ms vem de graça: este componente só é montado enquanto a consulta está
// pendente, então `useCargaVisivel(true)` conta a partir da montagem. Se a resposta chegar antes
// dos 200ms, o componente desmonta sem nunca ter pintado nada — que é exatamente o objetivo.
//
// `<output>` é o elemento semântico com `role="status"`: leitor de tela anuncia a mudança sem
// precisar de `aria-live` manual. É o mesmo que as telas novas já usam.
export function AvisoCarregando({ children }: { children: ReactNode }) {
  const visivel = useCargaVisivel(true);
  if (!visivel) return null;
  return <output>{children}</output>;
}
