# ADR-0767 — Preparação isolada de ingestão de comprovantes

Status: protótipo isolado, não integrado e não homologado. Nenhuma permissão, migration ou gate foi alterado.

O caminho experimental limita bytes a 10 MiB, valida assinatura simples PDF/JPEG/PNG, calcula SHA-256, exige reserva de identidade e caminho por Cliente/despesa, revalida autorização e compara bytes lidos da versão imutável antes de confirmar. Repetição pendente ou divergente falha sem segundo upload. Essas verificações não validam completamente o formato dos arquivos.

Não existe implementação comprovada de Storage com versão imutável, nem reserva/confirmador server-side transacionais para esta feature. O código não tem endpoint, provider, autorização, persistência ou interface conectados. As dependências simuladas **não** comprovam que a versão é realmente imutável. Verificar gate e reautorizar antes/depois não elimina a corrida de revogação entre banco e Storage; confirmação deve revalidar sob protocolo de concorrência próprio e objetos órfãos precisam de política segura separada. Enquanto isso, não implantar, integrar, habilitar ou afirmar suporte a recuperação de upload incerto.
