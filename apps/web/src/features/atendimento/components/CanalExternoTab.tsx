import { Plus } from "lucide-react";
import { useState } from "react";
import type {
  CanalExternoFormData,
  CanalExternoItem,
  TipoCanalExterno,
} from "../domain/canais-externos";

const LABEL_IDENTIFICADOR: Record<TipoCanalExterno, string> = {
  meta_wa: "Phone Number ID",
  instagram: "IG Business Account ID",
  messenger: "Page ID",
  evolution: "Instance ID",
};

const CORES_STATUS: Record<CanalExternoItem["statusConexao"], string> = {
  conectado: "bg-[#E7F5EC] text-[#1E8E45]",
  desconectado: "bg-line-soft text-ink-3",
  erro: "bg-[#FFF4F2] text-[#A12D24]",
};

export function CanalExternoTab({
  tipo,
  titulo,
  canais,
  temEscrita,
  onCriar,
  onDesativar,
}: {
  tipo: TipoCanalExterno;
  titulo: string;
  canais: CanalExternoItem[];
  temEscrita: boolean;
  onCriar: (form: CanalExternoFormData) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    label: "",
    identificadorExterno: "",
    identificadorSecundario: "",
    verifyToken: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({ tipo, ...form });
      setForm({
        label: "",
        identificadorExterno: "",
        identificadorSecundario: "",
        verifyToken: "",
      });
      setMostrarForm(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {canais.length} conexão(ões) de {titulo}.
        </p>
        {temEscrita && !mostrarForm && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        )}
      </div>

      {canais.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
          Nenhuma conexão de {titulo} configurada ainda.
        </div>
      ) : (
        <div className="divide-y divide-line-soft rounded-[10px] border border-line bg-card">
          {canais.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-2">{c.label}</p>
                <p className="text-xs text-ink-3">
                  {LABEL_IDENTIFICADOR[tipo]}: {c.identificadorExterno ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CORES_STATUS[c.statusConexao]}`}
                >
                  {c.statusConexao}
                </span>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => onDesativar(c.id)}
                    className="text-xs text-[#A12D24] hover:underline"
                  >
                    Desativar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <div className="rounded-[10px] border border-line bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Nome da conta"
              className="rounded-[6px] border border-line p-2 text-sm"
            />
            <input
              value={form.identificadorExterno}
              onChange={(e) => setForm((f) => ({ ...f, identificadorExterno: e.target.value }))}
              placeholder={LABEL_IDENTIFICADOR[tipo]}
              className="rounded-[6px] border border-line p-2 text-sm"
            />
            <input
              value={form.verifyToken}
              onChange={(e) => setForm((f) => ({ ...f, verifyToken: e.target.value }))}
              placeholder="Verify Token"
              className="col-span-2 rounded-[6px] border border-line p-2 text-sm"
            />
            {tipo === "meta_wa" && (
              <input
                value={form.identificadorSecundario}
                onChange={(e) =>
                  setForm((f) => ({ ...f, identificadorSecundario: e.target.value }))
                }
                placeholder="WhatsApp Business Account ID (WABA)"
                className="col-span-2 rounded-[6px] border border-line p-2 text-sm"
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Token de acesso (secreto) é configurado fora daqui, no Vault/secrets — nunca digitado no
            navegador.
          </p>
          {erro && (
            <div className="mt-2 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
              {erro}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
