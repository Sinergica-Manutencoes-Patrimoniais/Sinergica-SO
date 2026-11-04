# ADR-0493 — seleção local de faturável para documento

Status: proposto; não aplicado nem homologado. A seleção registra uma intenção interna imutável para item conferido, sob permissão `faturavel.efetivar`, revisão esperada, competência aberta e saldo obtido da fonte oficial. Não recebe valor do cliente, não emite documento, não cria lançamento, não aloca nem cobra. A unicidade por item e revisão impede duas seleções para a mesma versão; retry usa mesmo requestId. O comando existente de alocação 0404 atua sobre documento e lançamento já existentes e precisa de revisão adversarial antes de uso.

Essa seleção não reserva saldo contra outras rotas nem substitui a efetivação transacional; pode tornar-se obsoleta depois de registrada. Um fluxo de emissão real e seus requisitos legais, documentos e integração financeira ainda exigem definição e testes. Gate e grants ficam fechados, inclusive para evitar operação financeira real nesta etapa.
