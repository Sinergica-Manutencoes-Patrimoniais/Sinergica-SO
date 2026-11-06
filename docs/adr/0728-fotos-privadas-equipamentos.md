---
name: "docs-adr-0728-fotos-privadas-equipamentos-md"
description: "Documento Sinérgica SO: ADR 0728 — Fotos privadas de Equipamentos no levantamento"
alwaysApply: false
---

# ADR 0728 — Fotos privadas de Equipamentos no levantamento

## Contexto

S176 prevê a estrutura de Equipamentos e S178 recebe fotografias em levantamento para validação pelo PCM. O suporte temporário existente de fotos em `sso_foto_staging_ativo` foi limitado a Sistema e Componente: sua constraint, comando de vínculo, destino, listagem, resolução de caminho e schemas da interface não aceitam Equipamento. A visão por Local também não apresenta essa fonte para Equipamentos. A incorporação e a atualização em 0721 e 0767 registram Equipamento em `sso_levantamento_incorporacoes` por lote e linha; esse registro não deve ser confundido automaticamente com prova de criação de um cadastro novo.

## Decisão

Preparar uma extensão aditiva e coordenada para o tipo `equipamento`, sob gate específico desligado por padrão e mantendo também os gates existentes de foto, vínculo e mediação. Não ativar o gate até concluir testes, revisão de segurança, reconciliação de versões implantadas e homologação. A decisão não é implementação nem autorização para deploy ou tarefas Auvo.

O vínculo deve exigir foto do mesmo lote e linha do efeito oficial registrado, Cliente idêntico, cadastro ativo cujo tipo real seja `equipamento`, última decisão de foto aceita e revisão conferida. As verificações de capacidade vigentes, autorização por Cliente, locks, idempotência por requestId e auditoria devem preservar as garantias do comando existente. A correção deve distinguir criação, atualização e vínculo a cadastro existente quando essa distinção for relevante; ausência de prova não será interpretada como criação nem como permissão para criar outro cadastro. Não copiar ou substituir o conteúdo nem modificar os campos legados de fotos do cadastro.

O vínculo continua temporário e privado. Resolução de caminho cabe exclusivamente ao serviço mediador, sem retorno de caminho ou URL pública ao navegador. O serviço deve validar identidade e permissão atuais, conferir tipo/Cliente/estado do destino e decisão vigente antes de obter o conteúdo e novamente antes de devolvê-lo. Preservar as regras de inadequação e retirada já existentes; uma reavaliação não prova que o arquivo seja seguro ou autêntico. Não ampliar o privilégio de funções internas diretamente a `authenticated` nem transmitir segredo de serviço ao cliente.

## Compatibilidade e rollout

- Manter a semântica e as assinaturas dos contratos existentes para Sistema e Componente, inclusive versões antigas de JSON e repetição de comandos já registrados. Usar contratos versionados quando um enum ou resposta nova puder quebrar consumidores estritos; não trocar silenciosamente o formato de um contrato já publicado.
- Ampliar a constraint de tipo de forma aditiva após verificar dados e dependências. Atualizar coordenadamente vínculo e consulta de destino de 0541/0944/0947, listagem de 0546/0945/0948, caminho sob a proteção de 0551 e seus mediadores 0943, além dos tipos e validações da interface. A alteração deve preservar a filtragem de foto inadequada antes da paginação.
- A interface só oferece Equipamento quando o gate e contratos correspondentes estiverem disponíveis. A falha de consulta ou permissão deve ocultar os resultados antigos e não afirmar ausência de foto. Informar que a associação é temporária e não equivale a publicação oficial.
- Antes da aplicação, identificar as versões efetivamente implantadas e a ordem de 0943–0948, bem como os consumidores intermediários cujo schema estrito não aceita o novo tipo. Planejar implantação de banco e clientes em ordem compatível, manutenção de gates fechados e recuo sem apagar fotos, vínculos ou histórico. Não presumir que migrations locais ainda não tenham sido aplicadas em algum ambiente.

## Verificação obrigatória

Em banco isolado com dados sintéticos e rollback: autorização e isolamento de dois Clientes; tipo real de Equipamento versus Componente; registro inexistente, inativo ou de outro Cliente; origem na mesma linha; criação e atualização comprovadas; decisões aceitas, rejeitadas, inadequadas, reavaliadas e retiradas; concorrência de decisão e vínculo; replay idêntico e payload divergente; revogação antes e durante download; gate fechado; privilégio negado para funções internas e acesso mediado de serviço; bucket privado; paginação com foto inadequada anterior ao limite e cursor. Verificar que nenhum caminho, segredo ou conteúdo privado aparece em respostas ou logs de erro.

No frontend e na rota mediada, testar flags, identidade alterada, loading/erro, dados desatualizados, abertura e revogação da URL de objeto, MIME e tamanho, retry e compatibilidade dos schemas antigos. Os testes com mocks não substituem RLS/Storage reais, corrida entre sessões, revisão adversarial nem verificação de rollout. A integração com fotos oficiais fora do staging permanece uma reconciliação futura, não uma publicação automática.
