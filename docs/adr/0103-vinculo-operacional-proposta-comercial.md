# ADR-0103 — Vínculo operacional na proposta Comercial existente

## Estado

Proposta para análise, não aprovação de arquitetura de produção. Nenhuma migration, emissão operacional ou alteração de `oportunidade_id` foi executada. Depende de E01-S179, E01-S170 e proteção E01-S184.

## Contexto

`comercial.propostas` já possui versões e vínculo obrigatório com oportunidade; a RPC de criação existente aceita somente essa origem. Algumas leituras e decisões do Portal usam `INNER JOIN` por oportunidade. A lista de materiais canônica E01-S179 ainda não está persistida. Não fabricar oportunidade para contornar essas restrições, nem copiar um orçamento para outro modelo, apagar `pcm.orcamentos_servico` ou presumir que uma OS pertence a determinado Cliente com base no navegador.

## Direção proposta

Evoluir proposta/versões existentes com vínculo operacional comprovável: origem OS e lista pertencentes ao mesmo Cliente e mutuamente coerentes. A lista deve existir como objeto canônico e seu contrato de estabilidade estar fechado; enquanto isso a criação permanece indisponível. Não alterar a identidade, os vínculos, os snapshots ou as decisões das propostas comerciais anteriores.

A migração deve seguir expansão, adaptação de consumidores e verificação antes de qualquer relaxamento de `oportunidade_id NOT NULL`. Definir dois tipos de origem mutuamente exclusivos somente depois de inventariar todos os registros; oportunidade comercial continua obrigatória para o fluxo legado. Se houver coexistência válida de origem operacional com oportunidade, essa possibilidade exige decisão explícita e teste próprio antes de impor XOR. Não usar UUID sintético nem criar oportunidade vazia. A nova RPC deve derivar o Cliente da OS e da lista, conferir capacidade atual, escopo, estado e revisão dentro da transação, e preservar requestId/identidade para repetição.

Na aprovação, decisão e snapshot devem referenciar a versão enviada, sem editar a versão já aprovada. Quando uma proposta operacional já referencia OS, a decisão preserva exatamente essa OS; somente o fluxo comprovadamente anterior à criação de OS pode originar uma nova, uma vez. Não migrar ou reemitir orçamento histórico sem mapa auditável e unicidade por ID legado. Alterar escopo após aprovação exige nova versão ou complemento rastreável; dispensa exige motivo ou regra vigente, não torna o serviço gratuito.

As projeções públicas continuam por allowlist independente; custo de aquisição, margem, markup, nota e outros detalhes privados nunca compõem resposta ou PDF de Cliente. Adaptar `comercial.portal_propostas`, `comercial.portal_decidir_proposta` e demais consumidores atualmente baseados em oportunidade antes de disponibilizar origem sem oportunidade. Não presumir que a mudança na UI garanta isolamento; RLS, chamadas diretas, cache e PDFs precisam ser testados no servidor. A restrição do custo em E01-S184 e a verificação de preço mínimo permanecem obrigatórias.

## Testes necessários antes de migration

- Gerar fixtures de oportunidade legada, OS e lista canônicas de dois Clientes; provar que a proposta operacional reutiliza o mesmo registro Comercial e não cria oportunidade, OS, cobrança ou proposta duplicada ao repetir requestId.
- Negar lista de outro Cliente, lista vinculada a outra OS, OS inexistente, permissão revogada, vínculo alterado durante operação e revisão antiga; verificar rollback de vínculo, versão, comando e auditoria.
- Aprovar, recusar, expirar e complementar: preservar snapshot enviado, vincular decisão à versão correta e rejeitar conteúdo obsoleto; duas sessões não criam segunda OS.
- Testar Portal com dados internos conhecidos e verificar ausência no payload, PDF, consultas diretas, cache e troca de identidade; provar que o legado segue legível e decisões pré-OS não duplicam efeitos.
- Executar testes de contrato das leituras e RPCs legadas, medir migração e concorrência, e só então avaliar alteração de constraint em migration aditiva. CI com db-tests e revisão adversarial são gates; sem banco local não há evidência de execução.

## Pendências de segurança relacionadas

O adapter legado atualiza `assessment_id` diretamente, e o contrato documenta conferência de Conta no seletor. A FK inicial demonstra existência da inspeção, não igualdade de Cliente. Investigar autorização e vínculo no servidor antes de reaproveitar esse caminho; esta observação não comprova exploração nem é correção aplicada.
