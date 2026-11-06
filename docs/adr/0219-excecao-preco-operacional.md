# ADR-0219 — Exceção auditada de preço operacional

**Estado:** preparação bloqueada, sem homologação nem implantação.

Exceção é decisão explícita vinculada à versão de proposta, preço final e piso em centavos, com motivo e autor. Exige administrador ativo e concessão individual específica além da autorização operacional da Conta. Só rascunho pode ser alterado; preço excepcional deve ser menor que o piso e não negativo. Reutiliza o comando de força de preço do Comercial, cria nova versão e snapshot e registra auditoria na mesma transação. Não envia proposta nem cria OS ou cobrança.

Gate e RPCs permanecem fechados. A transição operacional só pode aceitar preço abaixo do piso se houver exceção da versão e do preço exatos; atualizar preço/composição exige nova análise. O trigger legado de piso usa configuração transacional e o comando legado permanece acessível a administrador, portanto seu bypass, escrita paralela, isolamento, versões, descontos, concorrência e efeitos em todas as demais rotas exigem reconciliação e revisão adversarial antes de liberar. Não habilitar parcialmente; decisão de exceção não é aprovação comercial nem publicação.
