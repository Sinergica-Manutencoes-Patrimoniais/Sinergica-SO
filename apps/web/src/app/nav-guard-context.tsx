// E01-S108: qualquer modal do PCM aberto sobre uma página que pode desmontar (troca de `pcmView`
// ou de módulo) registra aqui sua função de "estou sujo?"; a navegação consulta antes de trocar de
// tela, em vez de destruir o formulário em silêncio.
import { type ReactNode, createContext, useCallback, useContext, useRef } from "react";

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

  return (
    <NavGuardContext.Provider value={{ registrarFormularioSujo, confirmarSaida }}>
      {children}
    </NavGuardContext.Provider>
  );
}

export function useNavGuard(): NavGuardContextValue {
  const contexto = useContext(NavGuardContext);
  if (!contexto) throw new Error("useNavGuard deve ser usado dentro de NavGuardProvider");
  return contexto;
}
