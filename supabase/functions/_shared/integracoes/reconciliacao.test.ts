// Testes puros; não acessam rede, serviços externos ou banco.
import { projetarReconciliacao, type FatosReconciliacao } from "./projecao.ts";
import { avaliarCandidatos, type ConsultaCandidatos } from "./reconciliar.ts";
import { avaliarEvento, type ComparacaoEvento } from "./conflitos.ts";

function igual(recebido: unknown, esperado: unknown) {
  if (JSON.stringify(recebido) !== JSON.stringify(esperado)) throw new Error("Resultado divergente.");
}
function rejeita(acao: () => unknown) {
  let rejeitou = false; try { acao(); } catch { rejeitou = true; }
  if (!rejeitou) throw new Error("Entrada inválida aceita.");
}

Deno.test("falha com efeito remoto desconhecido nunca autoriza recuperação direta", () => {
  const base: FatosReconciliacao = { estadoLocal: "falha", efeitoRemoto: "desconhecido", classificacaoFalha: "transitoria", lease: "nao_aplicavel" };
  igual(projetarReconciliacao(base), { estado: "incerto", acao: "consultar_origem_destino", exigeValidacaoProprietario: true });
  igual(projetarReconciliacao({ ...base, estadoLocal: "processando", lease: "expirado" }).estado, "incerto");
  igual(projetarReconciliacao({ ...base, estadoLocal: "processando", lease: "vigente" }).estado, "processando");
  igual(projetarReconciliacao({ ...base, efeitoRemoto: "confirmado", estadoLocal: "concluido" }).estado, "resolvido");
  igual(projetarReconciliacao({ ...base, efeitoRemoto: "confirmado" }).estado, "conflito");
});

Deno.test("candidatos exigem consulta completa e prova de identidade", () => {
  const esperado = { origemId: "origem", versaoOrigem: 2 };
  const base: ConsultaCandidatos = { ...esperado, consultaCompleta: true, identidadeConsultada: true, ausenciaComprovada: false, candidatos: [] };
  igual(avaliarCandidatos(esperado, base).situacao, "consulta_inconclusiva");
  igual(avaliarCandidatos(esperado, { ...base, ausenciaComprovada: true }).situacao, "ausencia_comprovada");
  igual(avaliarCandidatos(esperado, { ...base, consultaCompleta: false, ausenciaComprovada: true }).situacao, "consulta_inconclusiva");
  igual(avaliarCandidatos(esperado, { ...base, candidatos: [{ id: "remoto-1", correspondeOrigem: true }] }).situacao, "candidato_unico");
  igual(avaliarCandidatos(esperado, { ...base, candidatos: [{ id: "remoto-1", correspondeOrigem: true }, { id: "remoto-2", correspondeOrigem: false }] }).situacao, "conflito");
  rejeita(() => avaliarCandidatos(esperado, { ...base, versaoOrigem: 3 }));
  rejeita(() => avaliarCandidatos(esperado, { ...base, ausenciaComprovada: true, candidatos: [{ id: "remoto-1", correspondeOrigem: true }] }));
});

Deno.test("evento antigo, reentrega e decisões protegidas não geram transição direta", () => {
  const base: ComparacaoEvento = { objetoId: "objeto", objetoIdEvento: "objeto", eventoId: "evento", eventoJaRegistrado: false,
    revisaoAtual: 3, revisaoEsperada: 3, ordemComprovada: "atual", decisaoProtegida: false, alteraDecisaoProtegida: false };
  igual(avaliarEvento({ ...base, ordemComprovada: "anterior" }).situacao, "obsoleto");
  igual(avaliarEvento({ ...base, eventoJaRegistrado: true }).situacao, "reentrega");
  igual(avaliarEvento({ ...base, decisaoProtegida: true, alteraDecisaoProtegida: true }).situacao, "conflito");
  igual(avaliarEvento({ ...base, ordemComprovada: "desconhecida" }).situacao, "indeterminado");
  igual(avaliarEvento({ ...base, revisaoEsperada: 2 }).situacao, "indeterminado");
  igual(avaliarEvento(base).acao, "delegar_ao_proprietario");
  rejeita(() => avaliarEvento({ ...base, objetoIdEvento: "outro" }));
});
