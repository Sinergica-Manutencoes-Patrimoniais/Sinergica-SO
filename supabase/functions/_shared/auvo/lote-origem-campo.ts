type Candidato = { envelope_id: string; task_id: string; recebido_em: string };
type Resposta = { data: unknown; error: unknown };
type Dependencias = {
  listar: (apos: string | null, limite: number) => PromiseLike<Resposta>;
  selecionarContrato: (candidato: Candidato) => Promise<string | null>;
  processar: (envelopeId: string, contratoId: string) => Promise<unknown>;
  agora: () => number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uma página por chamada, sem claim ou prova de cobertura; sempre reiniciar varreduras futuras. */
export async function processarPaginaOrigemCampo(
  entrada: { apos: string | null; limite: number; prazoMs: number },
  d: Dependencias,
) {
  if (!(entrada.apos === null || uuid.test(entrada.apos)) || !Number.isSafeInteger(entrada.limite) || entrada.limite < 1 || entrada.limite > 50 ||
    !Number.isSafeInteger(entrada.prazoMs) || entrada.prazoMs < 1_000 || entrada.prazoMs > 60_000) throw new Error("Parâmetros inválidos.");
  const inicio = d.agora(); if (!Number.isFinite(inicio)) throw new Error("Relógio inválido.");
  const { data, error } = await d.listar(entrada.apos, entrada.limite);
  if (error || !Array.isArray(data) || data.length > entrada.limite) throw new Error("Lista indisponível.");
  let anterior = entrada.apos?.toLowerCase() ?? null;
  for (const item of data as Candidato[]) {
    if (!item || typeof item.envelope_id !== "string" || !uuid.test(item.envelope_id) ||
      typeof item.task_id !== "string" || !/^[1-9]\d{0,17}$/.test(item.task_id) ||
      typeof item.recebido_em !== "string" || !Number.isFinite(Date.parse(item.recebido_em)) ||
      (anterior !== null && item.envelope_id.toLowerCase() <= anterior)) throw new Error("Página inválida.");
    anterior = item.envelope_id.toLowerCase();
  }
  let considerados = 0, processados = 0, pendentes = 0;
  const resultados: { envelopeId: string; estado: "processado" | "pendente"; motivo: string | null }[] = [];
  // Preserva causas operacionais emitidas pelo projetor sem expor payload bruto.
  const motivosConhecidos = new Set([
    "contrato_indisponivel", "contrato_nao_comprovado", "cliente_desconhecido", "cliente_nao_resolvido",
    "cliente_atual_divergente", "referencias_incompativeis", "os_existente_exige_triagem",
    "chamado_existente_indisponivel", "identidade_os_exige_triagem", "os_preexistente_exige_conferencia",
    "projecao_invalida", "contrato_invalido", "envelope_invalido", "tarefa_divergente",
    "ordem_nao_comprovada", "cliente_divergente", "campos_incompativeis", "status_nao_mapeado",
    "tecnico_invalido", "horario_invalido", "detalhes_invalidos", "limite_excedido",
  ]);
  let ultimo: string | null = entrada.apos;
  for (const item of data as Candidato[]) {
    const agora = d.agora();
    if (!Number.isFinite(agora) || agora < inicio || agora - inicio >= entrada.prazoMs)
      return { considerados, processados, pendentes, resultados, proximo: ultimo, parada: "prazo", coberturaComprovada: false };
    try {
      const contratoId = await d.selecionarContrato(item);
      if (contratoId === null) {
        pendentes++;
        resultados.push({ envelopeId: item.envelope_id, estado: "pendente", motivo: "contrato_nao_selecionado" });
      }
      else {
        if (!uuid.test(contratoId)) throw new Error("Contrato inválido.");
        const resultado = await d.processar(item.envelope_id, contratoId);
        if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) throw new Error("Recibo inválido.");
        const r = resultado as Record<string, unknown>;
        if (r.envelopeId !== item.envelope_id || !["processado", "pendente"].includes(String(r.estado))) throw new Error("Recibo inválido.");
        const evento = r.evento && typeof r.evento === "object" && !Array.isArray(r.evento) ? r.evento as Record<string, unknown> : null;
        if (r.estado === "processado") {
          // O comando inicial cria a OS; entregas posteriores apenas registram
          // o evento e não alteram a OS. Nunca confundir registro com aplicação.
          if (typeof r.reutilizado !== "boolean" || typeof r.eventoAplicado !== "boolean" ||
            r.eventoAplicado !== !r.reutilizado) throw new Error("Recibo inválido.");
          if (!r.reutilizado) {
            processados++;
            resultados.push({ envelopeId: item.envelope_id, estado: "processado", motivo: null });
          } else {
            if (!evento || !["aceito", "atrasado", "conflito", "conflito_regressao"].includes(String(evento.estado)))
              throw new Error("Recibo do evento inválido.");
            const aplicacao = r.aplicacao && typeof r.aplicacao === "object" && !Array.isArray(r.aplicacao)
              ? r.aplicacao as Record<string, unknown> : null;
            if (evento.estado === "atrasado") {
              processados++;
              resultados.push({ envelopeId: item.envelope_id, estado: "processado", motivo: "evento_atrasado_ignorado" });
            } else if (evento.estado === "aceito" && (aplicacao?.estado === "aplicado" || aplicacao?.estado === "ja_contemplado")) {
              processados++;
              resultados.push({ envelopeId: item.envelope_id, estado: "processado", motivo:
                aplicacao.estado === "aplicado" ? "evento_aplicado_sem_validacao_pcm" : "evento_inicial_ja_contemplado" });
            } else {
              pendentes++;
              const motivosAplicacao = new Set(["os_ou_cliente_divergente", "cliente_externo_divergente", "evento_nao_aceito", "contrato_desabilitado", "contrato_alterado_exige_conferencia", "evento_desatualizado", "os_preexistente_ou_sem_fotografia", "os_preexistente_exige_conferencia", "evento_ja_contemplado", "os_alterada_exige_conferencia", "tecnico_ambiguo"]);
              const motivo = evento.estado !== "aceito" ? String(evento.estado)
                : aplicacao?.estado === "pendente" && typeof aplicacao.motivo === "string" && motivosAplicacao.has(aplicacao.motivo)
                  ? aplicacao.motivo : "evento_registrado_sem_atualizacao";
              resultados.push({ envelopeId: item.envelope_id, estado: "pendente", motivo });
            }
          }
        } else {
          pendentes++;
          const motivo = typeof r.motivo === "string" && motivosConhecidos.has(r.motivo) ? r.motivo : "conferencia_necessaria";
          resultados.push({ envelopeId: item.envelope_id, estado: "pendente", motivo });
        }
      }
      considerados++; ultimo = item.envelope_id;
    } catch {
      // O resultado da escrita pode ser incerto; não avançar após o item em erro.
      return { considerados, processados, pendentes, resultados, envelopeNaoConfirmado: item.envelope_id, proximo: ultimo, parada: "nao_confirmado", coberturaComprovada: false };
    }
  }
  return { considerados, processados, pendentes, resultados, proximo: data.length === entrada.limite ? ultimo : null,
    parada: "pagina", coberturaComprovada: false };
}
