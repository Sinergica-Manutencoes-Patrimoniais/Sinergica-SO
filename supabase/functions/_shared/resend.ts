// _shared/resend.ts — extraído de `pmoc-generate-pdf/index.ts` (função `tentarEnviarEmail`, E01-S05)
// pra ser reusado por outros disparos transacionais (E04-S08). Config/credencial via
// `config.integracoes` (chave='email', E00-S12) — ver `config.fn_obter_segredo_integracao_interno`.

// biome-ignore-start lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
export async function enviarEmailResend(
  db: any,
  params: { to: string; subject: string; html: string; attachments?: { filename: string; content: string }[] },
): Promise<{ sent: boolean; skippedReason?: string }> {
  const { data: integracao } = await db
    .schema("config")
    .from("integracoes")
    .select("ativo, provedor, config_publico")
    .eq("chave", "email")
    .maybeSingle();
  if (!integracao?.ativo) {
    return { sent: false, skippedReason: "integração de e-mail não está ativa (Config > Integrações)" };
  }

  const { data: apiKey } = await db.schema("config").rpc("fn_obter_segredo_integracao_interno", { p_chave: "email" });
  if (!apiKey) {
    return { sent: false, skippedReason: "chave da integração de e-mail não configurada" };
  }

  const fromEmail = integracao.config_publico?.fromEmail ?? "nao-responda@sinergica.com.br";
  const fromName = integracao.config_publico?.fromName ?? "Sinérgica Manutenções";

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.attachments ? { attachments: params.attachments } : {}),
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.error(JSON.stringify({ nivel: "error", msg: "falha ao enviar e-mail via Resend", status: resp.status, detail }));
    return { sent: false, skippedReason: `falha no envio (HTTP ${resp.status})` };
  }
  return { sent: true };
}
// biome-ignore-end lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
