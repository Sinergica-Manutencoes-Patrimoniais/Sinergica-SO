# ADR-1660 — Leitura segura de fotos cadastrais de Grupo

## Estado

Proposta E01-S176; não aplicada nem homologada.

## Decisão

Separar fotos cadastrais de Grupo dos atestados de ocorrência. Mediadores exclusivos exigem ator, Cliente, Grupo e foto, capacidade atual de cadastro, gate privado fechado e protocolo compartilhado de autorização. A listagem não expõe caminhos; um resolvedor exclusivo ao serviço retorna identidade do objeto e caminho privado apenas à Edge Function própria. A função autentica, limita, lê bytes do bucket privado, revalida autorização e objeto e devolve somente imagem limitada. A rota de atestados permanece intacta.

## Limites

Ativação depende de revisão de segurança, testes integrados de autenticação, Storage, concorrência e configuração das funções. A revalidação não cria transação entre banco e Storage. Nenhuma função é implantada nesta etapa.
