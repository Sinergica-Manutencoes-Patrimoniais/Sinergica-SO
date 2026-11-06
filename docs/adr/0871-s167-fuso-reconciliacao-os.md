# ADR 0871 — Fuso da fotografia de OS na conciliação

## Contexto

A fotografia privada da migration 1057 converte a linha da OS em JSON. Datas com fuso são serializadas conforme `TimeZone` da sessão. Duas criações válidas em sessões com fusos diferentes podem, por isso, produzir conflito falso mesmo quando a OS não mudou.

## Decisão

Executar a função de conversão integral e o verificador privado com `TimeZone = 'UTC'` definido na configuração de cada função PostgreSQL. A configuração da sessão chamadora é restaurada automaticamente ao sair. O formato e os dados públicos não mudam; a decisão não habilita o gate nem resolve a divergência de especificação registrada na ADR 0870.

## Limites

A fotografia integral e `xmin` ainda precisam de revisão de privacidade, estabilidade após manutenção/restauração e compatibilidade. Fontes de escopo, todos os escritores, ACL real e testes concorrentes completos continuam pendentes; não homologar ou implantar com base neste ajuste isolado.
