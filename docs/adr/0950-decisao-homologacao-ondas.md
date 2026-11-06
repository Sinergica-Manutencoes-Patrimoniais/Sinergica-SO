# ADR-0950 — Decisão explícita de onda sobre fotografia de evidências

Status: preparação local; não homologada nem autorizada para produção.

## Decisão

Preparar comando transacional de aceite funcional por Cliente, onda, versão e ambiente, em gate próprio inicialmente fechado. A decisão guarda revisão da fotografia, referências das últimas declarações dos cenários exigidos e declarações nominadas das demais conferências. Cenário sem declaração completa ou cuja última declaração na fotografia falhou/bloqueou impede aceite. A onda 2 exige aceite anterior da onda 1 no mesmo Cliente, versão e ambiente. Escrita, recibo por requestId e auditoria são atômicos; replay idêntico não gera novo aceite. Não muda qualquer gate operacional, não retira planilhas e não autoriza Auvo.

Referências e verificações são declarações humanas, não conferência automática de autenticidade, conteúdo, CI, segurança ou estabilidade. CT-030 e liberação global permanecem pendentes; decisões de ondas não constituem aceite final do programa. Evidências posteriores não apagam a decisão anterior e exigem nova análise; nenhum consumidor deve inferir que decisão passada cobre revisão posterior.

## Limites de rollout

Tabela e RPC privadas, FORCE RLS, sem EXECUTE para papéis da aplicação. Revisar proprietário e políticas do definer, mapeamento das ondas com a matriz, política de múltiplas decisões, identidade e escopo, concorrência de revogação/gates, paginação e auditoria. Validar em ambiente isolado antes de qualquer concessão ou integração à tela. Não aplicar ou habilitar operacionalmente antes da revisão adversarial.
