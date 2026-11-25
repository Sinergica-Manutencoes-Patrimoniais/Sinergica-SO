import { Plug, Plus } from "lucide-react";
import { useState } from "react";
import { flagLigada } from "../../../config/flags-sso";
import type {
  CanalExternoFormData,
  CanalExternoItem,
  ConexaoMetaFormData,
  TipoCanalExterno,
} from "../domain/canais-externos";

const LABEL_IDENTIFICADOR: Record<TipoCanalExterno, string> = {
  meta_wa: "Phone Number ID",
  instagram: "IG Business Account ID",
  messenger: "Page ID",
  evolution: "Instance ID",
};

const CORES_STATUS: Record<CanalExternoItem["statusConexao"], string> = {
  conectado: "bg-success-soft text-success",
  desconectado: "bg-line-soft text-ink-3",
  erro: "bg-danger-soft text-danger",
};

const CONEXAO_VAZIA = {
  contaExternaId: "",
  accessToken: "",
  appSecret: "",
  verifyToken: "",
};

export function CanalExternoTab({
  tipo,
  titulo,
  canais,
  temEscrita,
  onCriar,
  onDesativar,
  onConectar,
  onVerificar,
}: {
  tipo: TipoCanalExterno;
  titulo: string;
  canais: CanalExternoItem[];
  temEscrita: boolean;
  onCriar: (form: CanalExternoFormData) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
  /** E02-S16/ADR-1700 — leva os segredos direto para o Vault pela Edge Function e devolve a URL
   * de callback que o operador cola na Meta. */
  onConectar?: (form: ConexaoMetaFormData) => Promise<{ callbackUrl: string }>;
  onVerificar?: (canalId: string) => Promise<void>;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    label: "",
    identificadorExterno: "",
    identificadorSecundario: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [conectandoCanalId, setConectandoCanalId] = useState<string | null>(null);
  const [conexao, setConexao] = useState(CONEXAO_VAZIA);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [ocupadoConexao, setOcupadoConexao] = useState(false);

  // Recurso desligado se ANUNCIA, não some: sem a flag, a aba continua aqui dizendo o que falta.
  const instagramLigado = flagLigada("VITE_SSO_INSTAGRAM_DIRECT_ENABLED");
  if (tipo === "instagram" && !instagramLigado) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-body text-ink-2">
        <p className="font-semibold">Instagram Direct está desligado neste ambiente.</p>
        <p className="mt-1 text-ink-3">
          O recurso existe e está pronto: conversa de Direct aparece no Inbox junto com as de
          WhatsApp. Para ligar, peça a alguém com acesso ao deploy para definir
          <code className="mx-1 rounded bg-line-soft px-1">VITE_SSO_INSTAGRAM_DIRECT_ENABLED</code>
          como <code className="rounded bg-line-soft px-1">true</code>. Canal já conectado continua
          recebendo mensagem mesmo com a flag desligada.
        </p>
      </div>
    );
  }

  const canalMeta = tipo !== "evolution";

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({ tipo, ...form });
      setForm({ label: "", identificadorExterno: "", identificadorSecundario: "" });
      setMostrarForm(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function conectar(canalId: string) {
    if (!onConectar) return;
    setOcupadoConexao(true);
    setErroConexao(null);
    try {
      const { callbackUrl: url } = await onConectar({ canalId, ...conexao });
      setCallbackUrl(url);
      setConexao(CONEXAO_VAZIA);
    } catch (error) {
      setErroConexao(error instanceof Error ? error.message : "Não foi possível conectar.");
    } finally {
      setOcupadoConexao(false);
    }
  }

  async function verificar(canalId: string) {
    if (!onVerificar) return;
    setOcupadoConexao(true);
    setErroConexao(null);
    try {
      await onVerificar(canalId);
    } catch (error) {
      setErroConexao(error instanceof Error ? error.message : "A Meta recusou a credencial.");
    } finally {
      setOcupadoConexao(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-body text-ink-3">
          {canais.length} conexão(ões) de {titulo}.
        </p>
        {temEscrita && !mostrarForm && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-body font-semibold text-white hover:bg-navy-deep"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        )}
      </div>

      {canais.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center text-body text-ink-3">
          Nenhuma conexão de {titulo} configurada ainda.
        </div>
      ) : (
        <div className="divide-y divide-line-soft rounded-xl border border-line bg-card">
          {canais.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body font-medium text-ink-2">{c.label}</p>
                  <p className="text-caption text-ink-3">
                    {LABEL_IDENTIFICADOR[tipo]}: {c.identificadorExterno ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-micro font-semibold ${CORES_STATUS[c.statusConexao]}`}
                  >
                    {c.statusConexao}
                  </span>
                  {temEscrita && canalMeta && onConectar && (
                    <button
                      type="button"
                      onClick={() => {
                        setCallbackUrl(null);
                        setErroConexao(null);
                        setConectandoCanalId(conectandoCanalId === c.id ? null : c.id);
                      }}
                      className="inline-flex items-center gap-1 text-caption font-semibold text-navy hover:underline"
                    >
                      <Plug className="h-3.5 w-3.5" />
                      {c.statusConexao === "conectado" ? "Reconectar" : "Conectar"}
                    </button>
                  )}
                  {temEscrita && canalMeta && onVerificar && c.statusConexao === "conectado" && (
                    <button
                      type="button"
                      onClick={() => verificar(c.id)}
                      disabled={ocupadoConexao}
                      className="text-caption text-ink-2 hover:underline disabled:opacity-60"
                    >
                      Testar conexão
                    </button>
                  )}
                  {temEscrita && (
                    <button
                      type="button"
                      onClick={() => onDesativar(c.id)}
                      className="text-caption text-danger hover:underline"
                    >
                      Desativar
                    </button>
                  )}
                </div>
              </div>

              {conectandoCanalId === c.id && onConectar && (
                <div className="rounded-lg border border-line bg-line-soft/40 p-3">
                  <p className="text-caption text-ink-3">
                    Os três valores abaixo vão direto para o cofre do servidor. Eles não ficam
                    salvos no navegador nem voltam para esta tela depois de gravados.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      value={conexao.contaExternaId}
                      onChange={(e) =>
                        setConexao((v) => ({ ...v, contaExternaId: e.target.value }))
                      }
                      placeholder={LABEL_IDENTIFICADOR[tipo]}
                      className="rounded-md border border-line p-2 text-body"
                    />
                    <input
                      type="password"
                      autoComplete="off"
                      value={conexao.accessToken}
                      onChange={(e) => setConexao((v) => ({ ...v, accessToken: e.target.value }))}
                      placeholder="Token de acesso da conta"
                      className="rounded-md border border-line p-2 text-body"
                    />
                    <input
                      type="password"
                      autoComplete="off"
                      value={conexao.appSecret}
                      onChange={(e) => setConexao((v) => ({ ...v, appSecret: e.target.value }))}
                      placeholder="App secret do aplicativo da Meta"
                      className="rounded-md border border-line p-2 text-body"
                    />
                    <input
                      type="password"
                      autoComplete="off"
                      value={conexao.verifyToken}
                      onChange={(e) => setConexao((v) => ({ ...v, verifyToken: e.target.value }))}
                      placeholder="Token de verificação (você escolhe)"
                      className="rounded-md border border-line p-2 text-body"
                    />
                  </div>
                  {erroConexao && (
                    <div className="mt-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
                      {erroConexao}
                    </div>
                  )}
                  {callbackUrl && (
                    <div className="mt-2 rounded-md border border-success-line bg-success-soft px-3 py-2 text-body text-ink-2">
                      <p className="font-semibold">Canal conectado.</p>
                      <p className="mt-1 text-caption">
                        Agora cole esta URL de callback na Meta (Webhooks → Callback URL), com o
                        mesmo token de verificação que você escolheu acima:
                      </p>
                      <code className="mt-1 block break-all rounded bg-card px-2 py-1 text-caption">
                        {callbackUrl}
                      </code>
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => conectar(c.id)}
                      disabled={ocupadoConexao}
                      className="rounded-md bg-navy px-4 py-2 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                    >
                      {ocupadoConexao ? "Conectando…" : "Conectar à Meta"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Nome da conta"
              className="rounded-md border border-line p-2 text-body"
            />
            <input
              value={form.identificadorExterno}
              onChange={(e) => setForm((f) => ({ ...f, identificadorExterno: e.target.value }))}
              placeholder={LABEL_IDENTIFICADOR[tipo]}
              className="rounded-md border border-line p-2 text-body"
            />
            {tipo === "meta_wa" && (
              <input
                value={form.identificadorSecundario}
                onChange={(e) =>
                  setForm((f) => ({ ...f, identificadorSecundario: e.target.value }))
                }
                placeholder="WhatsApp Business Account ID (WABA)"
                className="col-span-2 rounded-md border border-line p-2 text-body"
              />
            )}
          </div>
          <p className="mt-2 text-micro text-ink-3">
            Criar a conexão não a conecta. Depois de salvar, use “Conectar” para informar token, app
            secret e token de verificação — eles vão para o cofre do servidor, nunca para esta
            tabela.
          </p>
          {erro && (
            <div className="mt-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
              {erro}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="rounded-md bg-navy px-4 py-2 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="rounded-md border border-line px-4 py-2 text-body font-semibold text-ink-2 hover:bg-line-soft"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
