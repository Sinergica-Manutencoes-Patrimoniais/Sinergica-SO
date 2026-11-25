/** Link rastreado — a ponte entre o anúncio e o lead (E06-S01, AC-13/AC-14).
 *
 * O token identifica **o link**, e o link identifica o anúncio. Guardar o id do anúncio na URL
 * exporia a estrutura da conta de anúncios para qualquer um que olhasse o endereço, e quebraria
 * no dia em que a peça fosse recriada com outro id. O token é opaco e estável.
 *
 * Regra de ouro do AC-14: **na dúvida, sem origem.** Nunca chutar um anúncio. Uma atribuição
 * errada é pior que nenhuma: ela sobrevive no relatório e ninguém descobre. */

export const FORMATO_DO_TOKEN = /^[a-z0-9]{12}$/;

/** Nome do parâmetro aceito quando o token não vem no caminho. */
export const PARAMETRO_DE_RASTREIO = "rastreio";

/** O que colar no campo "parâmetros de URL" do anúncio, no Gerenciador da Meta. Os valores entre
 * chaves são substituídos pela própria Meta no clique. Nesta entrega os parâmetros são exibidos
 * para cópia e viajam junto do link; consumi-los automaticamente depende do endpoint público de
 * clique, que é story seguinte. */
export const MODELO_DE_PARAMETROS_META =
  "utm_source=meta&utm_medium=pago&campanha_id={{campaign.id}}&conjunto_id={{adset.id}}&anuncio_id={{ad.id}}";

export function tokenValido(token: string | null | undefined): token is string {
  return typeof token === "string" && FORMATO_DO_TOKEN.test(token);
}

/** Monta o endereço publicável. `origem` é a raiz do site (sem barra no fim obrigatória). */
export function montarLinkRastreado(origem: string, token: string): string {
  if (!tokenValido(token)) throw new Error("token_invalido");
  return `${origem.replace(/\/+$/, "")}/e/${token}`;
}

/** Lê o token de uma URL de chegada. Aceita `/e/<token>` e `?rastreio=<token>`; qualquer outra
 * coisa — inclusive URL malformada — devolve `null`, e quem chamou registra entrada sem origem. */
export function interpretarLinkRastreado(url: string): string | null {
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }

  const doCaminho = endereco.pathname.match(/\/e\/([a-z0-9]{12})\/?$/);
  if (doCaminho?.[1]) return doCaminho[1];

  const doParametro = endereco.searchParams.get(PARAMETRO_DE_RASTREIO);
  return tokenValido(doParametro) ? doParametro : null;
}
