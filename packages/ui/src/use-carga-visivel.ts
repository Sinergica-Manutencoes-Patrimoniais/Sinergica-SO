import { useEffect, useRef, useState } from "react";

const ATRASO_MS = 200;
const MINIMO_MS = 400;

// E00-S17 AC-2 — esqueleto não pisca em requisição rápida (< 200ms não mostra nada) e, uma vez
// exibido, fica visível pelo menos 400ms (evita o flash de aparecer-e-sumir). `carregando` é o
// estado real do chamador; o hook devolve quando de fato *mostrar* o skeleton.
export function useCargaVisivel(carregando: boolean): boolean {
  const [visivel, setVisivel] = useState(false);
  const mostradoEm = useRef<number | null>(null);

  useEffect(() => {
    if (!carregando) {
      if (mostradoEm.current === null) {
        setVisivel(false);
        return;
      }
      const decorrido = Date.now() - mostradoEm.current;
      const restante = Math.max(0, MINIMO_MS - decorrido);
      const t = setTimeout(() => {
        setVisivel(false);
        mostradoEm.current = null;
      }, restante);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      mostradoEm.current = Date.now();
      setVisivel(true);
    }, ATRASO_MS);
    return () => clearTimeout(t);
  }, [carregando]);

  return visivel;
}
