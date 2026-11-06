# ADR 0768 — Mediação privada da ingestão de fotos

## Decisão

A integração só pode usar a reserva e confirmação da 0968 por mediador de serviço que recebe identidade previamente verificada na borda. O ator e o papel devem ser revalidados no banco; nenhuma chave de serviço ou nome de objeto é entregue ao navegador. Upload usa exclusivamente nome da reserva, sem sobrescrita; o servidor relê os bytes e compara SHA-256 antes de confirmar. Em cada leitura da nova trilha, a referência e autorização precisam ser rechecadas e os bytes comparados ao digest protegido. A 0970 impede usar leitura legada para fotos confirmadas nessa trilha. Gates permanecem desligados.

## Limitações

O banco não verifica bytes e a credencial de serviço é uma fronteira privilegiada: acesso indevido a ela permite invocar mediação ou alterar Storage. Storage e banco não compartilham transação; mudança privilegiada entre releitura e confirmação é possível e a comparação em cada leitura detecta a divergência, não impede a alteração. Upload incerto deixa reserva pendente/objeto órfão, sem reenvio ou exclusão automáticos. Não ativar antes de testar concorrência, revisar segurança, confirmar isolamento de todos os caminhos e implantar leitura verificada integralmente.

Os entrypoints preparados dependem adicionalmente de `SSO_FOTO_INGESTAO_HABILITADA=true`; ausente ou diferente de `true` fica desligado. Os handlers usam o limitador existente por usuário, com falha fechada: 20 ingestões e 60 leituras por 60 segundos, valores sujeitos a homologação operacional. Os testes com mocks não confirmam comportamento real do Storage, dos acessos privilegiados ou do limitador em produção; ainda são necessários teste integrado e revisão adversarial. Nada foi publicado ou ativado.
