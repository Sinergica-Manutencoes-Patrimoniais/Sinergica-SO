// domain/localizacao-auvo.ts — E01-S85 AC-1.
// O Auvo não entende hierarquia — só um campo de localização plano. Esta função pura concatena a
// cadeia Área→Local→Sublocal (já resolvida em nomes, não ids — quem caminha o `parent_id` é o
// banco, ver migration 0131 `pcm.fn_montar_localizacao_hierarquica`; aqui é só o espelho TS
// testável dessa mesma lógica de concatenação/ordem, usado pra preview na UI de config).

export interface PreferenciaLocalizacaoAuvo {
  separador: string;
  ordem: "area_primeiro" | "area_por_ultimo";
}

export const PREFERENCIA_LOCALIZACAO_PADRAO: PreferenciaLocalizacaoAuvo = {
  separador: " · ",
  ordem: "area_primeiro",
};

/** `nomeArea` é sempre o primeiro nível (Área é obrigatória em `pcm.locais`/`pcm.areas`);
 * `nomesLocais` vai do mais externo pro mais interno (Local, depois Sublocal, ...). Filtra vazios
 * (ex.: sublocal ausente) e aplica separador/ordem configuráveis. */
export function montarLocalizacaoAuvo(
  nomeArea: string | null | undefined,
  nomesLocais: Array<string | null | undefined> = [],
  preferencia: PreferenciaLocalizacaoAuvo = PREFERENCIA_LOCALIZACAO_PADRAO,
): string {
  const area = nomeArea?.trim();
  const locais = nomesLocais
    .map((nome) => nome?.trim())
    .filter((nome): nome is string => Boolean(nome));
  if (!area) return "";
  const ordenado = preferencia.ordem === "area_por_ultimo" ? [...locais, area] : [area, ...locais];
  return ordenado.join(preferencia.separador);
}
