# ADR-0170 — Revisão e publicação de proposta sem oportunidade

**Estado:** preparação fechada; sem implantação, envio ou comunicação real.

O rascunho operacional avança pelas mesmas transições de Comercial: revisão, aprovação e publicação. Cada transição exige versão e estado esperados, autorização atual, snapshot e idempotência. Na publicação, o operador revisa texto público explícito; o preço é derivado da proposta canônica, nunca de custo, e uma projeção pública imutável por versão é criada na mesma transação. Mudar status para enviada apenas a torna consultável pelo Portal: não envia mensagem, não cria OS nem contratos ou cobrança. A consulta do Portal usa essa projeção aprovada para propostas sem oportunidade; o caminho legado continua com projeção anterior.

Comandos revogados e gate desligado. Antes de habilitar, revisar política de aprovação/preço e exceções, acessos a snapshots e arquivos, revogação concorrente, imutabilidade, histórico, invalidação, conteúdo textual e caminhos legados; executar testes e revisão adversarial. A publicação não prova entrega ao destinatário. Não automatizar integração externa ou contrato financeiro.
