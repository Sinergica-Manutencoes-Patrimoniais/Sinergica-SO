# ADR-0893 — Transporte controlado do staging legado de cronogramas

Data: 2026-10-30 · Status: preparação, gate fechado, não homologado.

## Decisão

Preparar comando transacional por lote legado para o staging canônico S178, sem execução automática. Identidade, matriz, autor e data de criação do lote e IDs, autores, datas e conteúdo das revisões são preservados; linhas utilizam a mesma representação do receptor unificado. Comandos antigos inequívocos conservam request ID, ator, payload, resultado e data no ledger canônico, além dos originais. Não prometem replay pelo contrato novo: payloads antigos e novos diferem e uma reutilização conflitante deve falhar.

O comando exige usuário atual, capacidades `plano.gerir` e `cadastro.aprovar`, gate específico desligado por padrão, isolamento READ COMMITTED e serialização da autorização. Valida revisão esperada, limites do receptor, atores no cadastro, referências das anotações, colisões de identificadores, origem e comandos; falha integral em caso de divergência. O motivo da operação e correlação são auditados. Não altera ou remove o staging legado, não aprova cadastros nem gera tarefas externas.

## Compatibilidade e retorno

Enquanto o gate permanecer fechado, nenhum transporte é possível. A 0361 deve revogar os antigos escritores antes de qualquer habilitação; em ambiente com versões misturadas ou escritor privilegiado externo, não executar. Após inserção, desligar gate impede novas operações, mas não desfaz os lotes já transportados: correção deve ser planejada sem apagar histórico. Não ativar sem diagnóstico, revisão adversarial, testes oficiais de isolamento e concorrência, e plano operacional coordenado. Lotes inválidos ou comandos sem associação inequívoca requerem investigação, não correção automática.
