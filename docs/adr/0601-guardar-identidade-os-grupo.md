# ADR-0601 — Proteção da identidade da OS vinculada ao Grupo

Sob gate desligado por padrão, a OS com vínculo declarado imutável da ADR-0598 não pode ser excluída nem sofrer alteração de ID, Cliente, origem, referência de origem, vínculo de Chamado, ocorrência preventiva ou exclusão lógica. Outros campos continuam sujeitos às regras legadas; fora do gate o comportamento não muda. Nenhuma permissão ou gate é ativado.

Esta proteção não prova serialização entre declaração e alteração simultânea da OS nem adapta seus consumidores. Ela não é autorização para execução ou envio ao Auvo; revisão de concorrência, testes e homologação permanecem necessários.
