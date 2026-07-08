import { useEffect, useState } from "react";
import type { EspecialistaItem, LicaoItem } from "../domain/operacao";
import type { PersonaItem } from "../domain/personas";

interface FormState {
  toolUseEnabled: boolean;
  ragEnabled: boolean;
  vendasEnabled: boolean;
  consultaPedidosEnabled: boolean;
  limiteDiarioMensagens: string;
  transferirAposNRespostas: string;
  palavrasTransferencia: string[];
  orcamentoMensalUsd: string;
}

function formFromPersona(p: PersonaItem | null): FormState {
  return {
    toolUseEnabled: p?.toolUseEnabled ?? false,
    ragEnabled: p?.ragEnabled ?? false,
    vendasEnabled: p?.vendasEnabled ?? false,
    consultaPedidosEnabled: p?.consultaPedidosEnabled ?? false,
    limiteDiarioMensagens: p?.limiteDiarioMensagens?.toString() ?? "",
    transferirAposNRespostas: p?.transferirAposNRespostas?.toString() ?? "",
    palavrasTransferencia: p?.palavrasTransferencia ?? [],
    orcamentoMensalUsd: p?.orcamentoMensalUsd?.toString() ?? "",
  };
}

export function OperacaoTab({
  personas,
  temEscrita,
  licoes,
  especialistas,
  onSelecionarPersona,
  onSalvar,
  onCriarLicao,
  onDesativarLicao,
  onCriarEspecialista,
  onDesativarEspecialista,
}: {
  personas: PersonaItem[];
  temEscrita: boolean;
  licoes: LicaoItem[];
  especialistas: EspecialistaItem[];
  onSelecionarPersona: (personaId: string) => void;
  onSalvar: (personaId: string, form: FormState) => Promise<void>;
  onCriarLicao: (
    personaId: string,
    contexto: string,
    respostaErrada: string,
    respostaCerta: string,
  ) => Promise<void>;
  onDesativarLicao: (id: string) => Promise<void>;
  onCriarEspecialista: (personaId: string, nome: string, quandoChamar: string) => Promise<void>;
  onDesativarEspecialista: (id: string) => Promise<void>;
}) {
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const persona = personas.find((p) => p.id === personaId) ?? null;
  const [form, setForm] = useState<FormState>(formFromPersona(persona));
  const [palavraNova, setPalavraNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [licaoForm, setLicaoForm] = useState({
    contexto: "",
    respostaErrada: "",
    respostaCerta: "",
  });
  const [especialistaForm, setEspecialistaForm] = useState({ nome: "", quandoChamar: "" });

  useEffect(() => {
    setForm(formFromPersona(persona));
    setSalvo(false);
  }, [persona]);

  useEffect(() => {
    if (personaId) onSelecionarPersona(personaId);
  }, [personaId, onSelecionarPersona]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await onSalvar(personaId, form);
      setSalvo(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (personas.length === 0) {
    return (
      <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
        Crie uma persona na aba "Personas" antes de configurar a operação.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={personaId}
        onChange={(e) => setPersonaId(e.target.value)}
        className="w-full max-w-xs rounded-[6px] border border-line p-2 text-sm text-ink"
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      <section className="rounded-[10px] border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-ink">Inteligência</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Os motores do agente. Cada um mostra o que precisa para funcionar.
        </p>
        <div className="mt-4 divide-y divide-line-soft">
          <Toggle
            label="Ferramentas (tool use)"
            descricao="Permite consultar catálogo, pedidos e especialistas durante a resposta."
            checked={form.toolUseEnabled}
            disabled={!temEscrita}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                toolUseEnabled: v,
                vendasEnabled: v ? f.vendasEnabled : false,
              }))
            }
          />
          <Toggle
            label="Busca por relevância (RAG)"
            descricao="O conhecimento entra por relevância à pergunta, não por prioridade fixa."
            checked={form.ragEnabled}
            disabled={!temEscrita}
            onChange={(v) => setForm((f) => ({ ...f, ragEnabled: v }))}
          />
          <Toggle
            label="Modo vendas"
            descricao="Recomenda produtos e confirma preço/estoque. Requer Ferramentas ligado."
            checked={form.vendasEnabled}
            disabled={!temEscrita || !form.toolUseEnabled}
            onChange={(v) => setForm((f) => ({ ...f, vendasEnabled: v }))}
          />
          <Toggle
            label="Consulta de pedidos"
            descricao="Status e rastreio, somente para o titular da conversa."
            checked={form.consultaPedidosEnabled}
            disabled={!temEscrita}
            onChange={(v) => setForm((f) => ({ ...f, consultaPedidosEnabled: v }))}
          />
        </div>
      </section>

      <section className="rounded-[10px] border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-ink">Regras de atendimento</h3>
        <p className="mt-0.5 text-xs text-ink-3">Quando o agente para, transfere ou se contém.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-2" htmlFor="op-limite-diario">
              Limite diário de mensagens
            </label>
            <input
              id="op-limite-diario"
              value={form.limiteDiarioMensagens}
              onChange={(e) => setForm((f) => ({ ...f, limiteDiarioMensagens: e.target.value }))}
              disabled={!temEscrita}
              placeholder="sem limite"
              className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm text-ink disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-2" htmlFor="op-transferir-n">
              Transferir após N respostas
            </label>
            <input
              id="op-transferir-n"
              value={form.transferirAposNRespostas}
              onChange={(e) => setForm((f) => ({ ...f, transferirAposNRespostas: e.target.value }))}
              disabled={!temEscrita}
              placeholder="sem limite"
              className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm text-ink disabled:opacity-60"
            />
          </div>
        </div>
        <label
          htmlFor="op-palavra-transferencia"
          className="mt-3 block text-xs font-semibold text-ink-2"
        >
          Palavras que transferem
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {form.palavrasTransferencia.map((palavra) => (
            <span
              key={palavra}
              className="inline-flex items-center gap-1 rounded-full bg-line-soft px-2.5 py-1 text-xs text-ink-2"
            >
              {palavra}
              {temEscrita && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      palavrasTransferencia: f.palavrasTransferencia.filter((p) => p !== palavra),
                    }))
                  }
                  className="text-ink-3 hover:text-ink"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {temEscrita && (
          <div className="mt-2 flex gap-2">
            <input
              id="op-palavra-transferencia"
              value={palavraNova}
              onChange={(e) => setPalavraNova(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && palavraNova.trim()) {
                  e.preventDefault();
                  setForm((f) => ({
                    ...f,
                    palavrasTransferencia: [...f.palavrasTransferencia, palavraNova.trim()],
                  }));
                  setPalavraNova("");
                }
              }}
              placeholder="ex.: cancelar, reclamação"
              className="flex-1 rounded-[6px] border border-line p-2 text-sm text-ink"
            />
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-ink">Orçamento do mês</h3>
        <input
          value={form.orcamentoMensalUsd}
          onChange={(e) => setForm((f) => ({ ...f, orcamentoMensalUsd: e.target.value }))}
          disabled={!temEscrita}
          placeholder="sem teto (USD)"
          className="mt-2 w-48 rounded-[6px] border border-line p-2 text-sm text-ink disabled:opacity-60"
        />
      </section>

      {erro && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}
      {salvo && !erro && <p className="text-sm font-medium text-[#1E8E45]">Configuração salva.</p>}
      {temEscrita && (
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="w-fit rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar operação"}
        </button>
      )}

      <section className="rounded-[10px] border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-ink">Lições aprendidas</h3>
        <div className="mt-3 space-y-2">
          {licoes.length === 0 ? (
            <p className="text-sm text-ink-3">Nenhuma lição registrada ainda.</p>
          ) : (
            licoes.map((l) => (
              <div key={l.id} className="rounded-[6px] border border-line-soft p-3 text-sm">
                <p className="font-medium text-ink-2">{l.contexto}</p>
                <p className="mt-1 text-ink-3">Errado: {l.respostaErrada}</p>
                <p className="text-ink-2">Certo: {l.respostaCerta}</p>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => onDesativarLicao(l.id)}
                    className="mt-1 text-xs text-[#A12D24] hover:underline"
                  >
                    Desativar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        {temEscrita && (
          <div className="mt-3 space-y-2">
            <input
              value={licaoForm.contexto}
              onChange={(e) => setLicaoForm((f) => ({ ...f, contexto: e.target.value }))}
              placeholder="Quando (contexto)"
              className="w-full rounded-[6px] border border-line p-2 text-sm"
            />
            <textarea
              value={licaoForm.respostaErrada}
              onChange={(e) => setLicaoForm((f) => ({ ...f, respostaErrada: e.target.value }))}
              placeholder="O que estava errado"
              className="w-full rounded-[6px] border border-line p-2 text-sm"
              rows={2}
            />
            <textarea
              value={licaoForm.respostaCerta}
              onChange={(e) => setLicaoForm((f) => ({ ...f, respostaCerta: e.target.value }))}
              placeholder="O certo a fazer"
              className="w-full rounded-[6px] border border-line p-2 text-sm"
              rows={2}
            />
            <button
              type="button"
              onClick={async () => {
                await onCriarLicao(
                  personaId,
                  licaoForm.contexto,
                  licaoForm.respostaErrada,
                  licaoForm.respostaCerta,
                );
                setLicaoForm({ contexto: "", respostaErrada: "", respostaCerta: "" });
              }}
              className="rounded-[6px] border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-line-soft"
            >
              Adicionar lição
            </button>
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-ink">Especialistas</h3>
        <div className="mt-3 space-y-2">
          {especialistas.length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum especialista vinculado ainda.</p>
          ) : (
            especialistas.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-[6px] border border-line-soft p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-ink-2">{e.nome}</p>
                  <p className="text-ink-3">{e.quandoChamar}</p>
                </div>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => onDesativarEspecialista(e.id)}
                    className="text-xs text-[#A12D24] hover:underline"
                  >
                    Desativar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        {temEscrita && (
          <div className="mt-3 flex gap-2">
            <input
              value={especialistaForm.nome}
              onChange={(ev) => setEspecialistaForm((f) => ({ ...f, nome: ev.target.value }))}
              placeholder="Nome"
              className="w-40 rounded-[6px] border border-line p-2 text-sm"
            />
            <input
              value={especialistaForm.quandoChamar}
              onChange={(ev) =>
                setEspecialistaForm((f) => ({ ...f, quandoChamar: ev.target.value }))
              }
              placeholder="Quando chamar"
              className="flex-1 rounded-[6px] border border-line p-2 text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                await onCriarEspecialista(
                  personaId,
                  especialistaForm.nome,
                  especialistaForm.quandoChamar,
                );
                setEspecialistaForm({ nome: "", quandoChamar: "" });
              }}
              className="rounded-[6px] border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-line-soft"
            >
              Adicionar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Toggle({
  label,
  descricao,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  descricao: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <p className="text-xs text-ink-3">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-navy" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
