# ADR-1514 — Vincular decisão de impacto à comparação conferida

## Contexto
A comparação da ADR-1511 pode mudar entre leitura e gravação. Sem conferência transacional, o PCM pode registrar decisão baseada em dados diferentes dos exibidos.

## Decisão
Sob gate fechado por padrão, o comando comparado recebe a comparação integral exibida, revalida permissão, revisão, vínculo e fotografia na mesma transação sob travas, e recusa divergência antes de registrar decisão. O recibo armazena a comparação vinculada à identidade do pedido, para repetição idêntica; pedido reaproveitado com comparação diferente falha. O endpoint histórico, quando o gate está ligado, aceita somente replay de decisão anterior, preservando recuperação sem permitir nova decisão sem comparação. Com o gate desligado, o comportamento histórico é mantido. A interface envia a comparação e conserva tentativas anteriores até reconciliação.

## Consequências
A comparação é parcial e não certifica todas as OS, fontes ou questionários. A gravação da decisão continua fotografando efeitos; a guarda 1045, demais gates, aprovação e deploy permanecem bloqueados. Travas de tabela e protocolo precisam de testes de concorrência, desempenho e revisão adversarial. Ativação deve coordenar migration, servidor e tela; sem Auvo.
