# ADR 1623: conflitos definitivos em proposta e decisão PMOC

Revisão divergente e mudança do Plano são conflitos de negócio nas operações mediadas de proposta PMOC, não erros transitórios de serialização. Recebem códigos específicos; replay prévio e erros reais de serialização permanecem inalterados. A interface permite nova conferência apenas após rejeição definitiva na primeira chamada, preservando pedidos incertos.
