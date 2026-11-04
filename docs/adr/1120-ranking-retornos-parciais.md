# ADR-1120 — Retorno parcial no ranking de Backlog

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar ranking único de composições ainda não promovidas, retornos integrais e retornos parciais aguardando. O parcial mantém sua identidade, Pendência, composição e revisão próprias; usa os fatores GUTD da composição de origem, sem afirmar nova avaliação. Cursor mantém score decimal exato e assinatura de alterações observáveis nos registros que alimentam a lista. Não cria Chamado, OS, decisão ou efeito remoto.

## Limites

Assinatura não é fotografia transacional entre páginas; alterações revertidas podem passar despercebidas. A leitura exige gates e capacidades dos caminhos existentes, e deve permanecer desligada até integração de ações, verificação de reservas de escopo, paginação concorrente, privacidade, desempenho, RLS e revisão adversarial. Outros caminhos ou itens sem identidade reconciliada continuam fora; ranking não comprova execução ou parada remota.
