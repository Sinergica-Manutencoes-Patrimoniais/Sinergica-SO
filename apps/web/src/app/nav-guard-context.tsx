// E01-S108: qualquer modal do PCM aberto sobre uma página que pode desmontar (troca de `pcmView`
// ou de módulo) registra aqui sua função de "estou sujo?"; a navegação consulta antes de trocar de
// tela, em vez de destruir o formulário em silêncio.
import { type ReactNode, createContext, useCallback, useContext, useMemo, useRef } from "react";

type VerificadorSujo = () => boolean;

interface NavGuardContextValue {
  registrarFormularioSujo: (verificar: VerificadorSujo) => () => void;
  confirmarSaida: () => boolean;
}

const NavGuardContext = createContext<NavGuardContextValue | null>(null);

export function NavGuardProvider({ children }: { children: ReactNode }) {
  // Escopo do AC-1 é "1 modal por vez" — um único slot é suficiente (ver spec.md, fora de escopo).
  const verificadorRef = useRef<VerificadorSujo | null>(null);

  const registrarFormularioSujo = useCallback((verificar: VerificadorSujo) => {
    verificadorRef.current = verificar;
    return () => {
      if (verificadorRef.current === verificar) {
        verificadorRef.current = null;
      }
    };
  }, []);

  const confirmarSaida = useCallback(() => {
    const verificar = verificadorRef.current;
    if (!verificar || !verificar()) return true;
    return window.confirm("Você tem alterações não salvas. Sair mesmo assim?");
  }, []);

  // Sem memo aqui, o objeto do `value` nasce novo a cada render do Provider — qualquer re-render
  // do App (tema, auth, permissões) força TODO consumidor de `useNavGuard()` a re-renderizar, e
  // o efeito de `useFormularioSujo` (depende de `registrarFormularioSujo`) re-executa à toa em
  // todo modal aberto. `registrarFormularioSujo`/`confirmarSaida` já são estáveis (useCallback com
  // deps `[]`), então o memo é seguro: identidade do value só muda se o Provider remontar.
  const value = useMemo(
    () => ({ registrarFormularioSujo, confirmarSaida }),
    [registrarFormularioSujo, confirmarSaida],
  );

  return <NavGuardContext.Provider value={value}>{children}</NavGuardContext.Provider>;
}

export function useNavGuard(): NavGuardContextValue {
  const contexto = useContext(NavGuardContext);
  if (!contexto) throw new Error("useNavGuard deve ser usado dentro de NavGuardProvider");
  return contexto;
}
