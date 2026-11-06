# ADR-1330 — Serialização de autorização na aprovação do Plano

Status: preparado, gate desligado.

A aprovação direta continua exigindo `plano.gerir`, cuja concessão é
individual. Quando habilitada a guarda, a aprovação toma sem espera a trava
compartilhada de autorização antes de ler a permissão; alterações que usam a
trava exclusiva não podem ser confirmadas simultaneamente. O comando exige
READ COMMITTED para não consultar fotografia antiga. Em contenção, falha sem
aprovar; repetição usa o request original.

A mudança não abre permissões nem substitui a conferência de todos os
escritores de usuários, concessões, perfis, módulos e Clientes. Antes de
habilitar, drenar aprovações iniciadas sem a guarda, comprovar ambas as ordens
de concorrência, privilégios, caminhos alternativos e revisão adversarial.
Rollback desliga o gate antes de restaurar a definição anterior; não altera
concessões nem histórico aprovado.
