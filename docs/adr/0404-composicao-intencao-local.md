# ADR-0404 — composição conferida na intenção local

Status: proposto; não aplicado nem homologado.

A intenção local só é registrada se a composição atual e sua época/geração corresponderem a uma conferência anterior à confirmação da Visita. As fontes e o contador são protegidos durante a operação; a autorização e os gates permanecem verificados no servidor. Retentativas do mesmo pedido continuam recuperáveis. O registro não autoriza envio, nem substitui a validação integral de conteúdo.

Gatilhos de composição concorrentes podem levar a espera ou deadlock abortado; inserções de novos vínculos com transações em andamento ainda requerem protocolo comum de serialização e testes adversariais. O envio permanece expressamente bloqueado, inclusive se esta conferência passar. A ativação do gate requer drenagem, conforme ADR-0401.
