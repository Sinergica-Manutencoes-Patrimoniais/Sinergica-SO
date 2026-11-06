# ADR-0406 — guarda da concorrência de composição

Status: proposto; não aplicado nem homologado.

As RPCs de intenção seguem pedido, escopos de ciência (Cliente, contrato, Visita), Visita, vínculos e fontes, geração. A conferência de composição segue pedido, Visita e vínculos/fontes. A conferência de conteúdo e a revisão do vínculo seguem pedido, Visita, OS e fontes da Rotina. A retificação do vínculo segue pedido, OS e fontes, sem adquirir Visita. Essa descrição não prova uma ordem global: modificações legadas e gatilhos podem adquirir linhas antes da geração; consultas com `FOR SHARE` em joins não garantem ordem física entre tabelas.

Uma inserção concorrente de vínculo pode não aparecer na leitura protegida das linhas existentes; esperar na geração depois da inserção não constitui bloqueio de predicado. Há também possibilidade de deadlock abortado entre gatilhos e consumidores, principalmente entre Visitas que compartilham funcionário ou OS. A época de gate não substitui drenagem de transações na ativação.

A intenção local recebe uma guarda adicional desligada, sem grants. Sua liberação depende de protocolo comum de serialização de todos os escritores, testes de concorrência e revisão adversarial. Não basta ligar a flag existente. Não há despacho externo, nem alteração do comportamento legado enquanto o gate de composição está desligado.
