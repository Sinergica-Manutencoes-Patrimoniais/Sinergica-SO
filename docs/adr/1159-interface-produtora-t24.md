# ADR-1159 — Acesso à preparação T−24 preventiva

Status: proposta local, não aplicada nem homologada.

Permitir à tela de Visita solicitar preparação da candidata preventiva por entrada autenticada, condicionada aos gates de produtor e intenção existentes e a flag de interface desligada. O pedido local preserva qual protocolo foi escolhido; repetir uma tentativa não pode trocar entre intenção local e produtor. A preparação não autoriza envio nem garante que nenhuma tarefa externa já exista.

A permissão de execução não abre o gate. O produtor ainda cobre somente parte das categorias e requer validação do contrato Auvo, das fontes e da concorrência, além de revisão adversarial. A recuperação pela consulta antiga da intenção local não comprova a criação da candidata e não deve limpar tentativa do produtor. Nenhuma operação externa é executada.
