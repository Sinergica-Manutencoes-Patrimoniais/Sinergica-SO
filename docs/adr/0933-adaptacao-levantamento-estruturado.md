# ADR-0933 — Preparação estruturada de levantamento de campo

Status: preparação local; não conectada a Auvo, staging ou rede.

## Decisão

Preparar adaptador puro que recebe um contrato normalizado explicitamente versionado e um mapeamento explícito de IDs de perguntas para atributos aceitos no staging S178. Um contrato desconhecido, pergunta não mapeada, tipo incompatível, dados incompletos ou chave repetida retorna pendência; não se extrai estrutura de observações ou prosa. IDs de fotos são apenas referências opacas por linha, sem download, vínculo ou afirmação de autenticidade. Identidades de tarefa, OS e questionário são mantidas no resultado, sem declarar comprovada sua relação.

O formato normalizado é interno e não é uma alegação sobre o contrato do Auvo. Necessita adapter do fornecedor e configuração verificada, validação de proveniência/autorização, recebimento idempotente transacional no staging, ingestão segura de fotos e provas integradas antes de ativação. Um resultado preparado não é lote persistido nem cadastro aprovado. Não alterar ou chamar o fluxo existente até essas dependências e revisão adversarial.
