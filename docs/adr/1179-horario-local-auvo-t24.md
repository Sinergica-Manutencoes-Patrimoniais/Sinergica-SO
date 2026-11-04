# ADR-1179 — Conversão explícita de horário T−24

Status: proposta local, não conectada nem homologada.

Preparar conversão entre instante com offset e horário civil do fornecedor usando fuso IANA explicitamente fornecido pelo contrato validado. Nunca remover sufixo UTC por corte de texto. Se instante tiver milissegundos não representáveis, data inválida, fuso inválido, horário civil inexistente ou ambíguo, falhar fechado. Não assumir que a configuração da Visita define automaticamente o fuso do Auvo.

O código não define qual fuso ou formato o fornecedor aceita e não faz rede. Validar contrato real, horário de verão histórico, horários ambíguos, limites de data, custo e runtime antes de conectar ou ativar. Não altera os caminhos legados.
