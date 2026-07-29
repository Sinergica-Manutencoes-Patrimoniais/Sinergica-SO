// E01-S108: um modal chama isso com seu estado inicial (capturado uma vez, no mount) e seu estado
// atual a cada render — enquanto montado, fica registrado no NavGuardContext; a navegação do PCM
// consulta esse registro antes de trocar de tela.
import { useEffect, useRef } from "react";
import { formularioMudou } from "./nav-guard";
import { useNavGuard } from "./nav-guard-context";

// `chaveReset` (opcional) recaptura a linha de base quando muda — cobre modais cujo valor inicial
// só fica pronto depois de um carregamento assíncrono (ex.: AlocarFerramentaModal, cujo default
// vem do 1º item de uma lista buscada no mount): passe a flag `carregando` como chave, para não
// marcar sujo o valor auto-selecionado ao terminar de carregar.
export function useFormularioSujo<T extends Record<string, unknown>>(
  estadoInicial: T,
  estadoAtual: T,
  chaveReset?: unknown,
) {
  const { registrarFormularioSujo } = useNavGuard();
  const estadoInicialRef = useRef(estadoInicial);
  const chaveResetRef = useRef(chaveReset);
  if (chaveReset !== undefined && chaveReset !== chaveResetRef.current) {
    chaveResetRef.current = chaveReset;
    estadoInicialRef.current = estadoInicial;
  }
  const estadoAtualRef = useRef(estadoAtual);
  estadoAtualRef.current = estadoAtual;

  useEffect(
    () =>
      registrarFormularioSujo(() =>
        formularioMudou(estadoInicialRef.current, estadoAtualRef.current),
      ),
    [registrarFormularioSujo],
  );
}
