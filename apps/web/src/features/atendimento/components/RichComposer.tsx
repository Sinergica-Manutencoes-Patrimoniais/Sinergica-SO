import { FileUp, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import type { WaTemplateItem } from "../domain/canais-externos";
import type { MensagemRicaInput } from "../domain/mensagens";

export function RichComposer({
  templates,
  disabled,
  onEnviar,
}: {
  templates: WaTemplateItem[];
  disabled: boolean;
  onEnviar: (input: MensagemRicaInput) => Promise<void>;
}) {
  const [modo, setModo] = useState<"midia" | "template" | "interativa" | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [templateNome, setTemplateNome] = useState("");
  const [botoes, setBotoes] = useState("");
  const [parametros, setParametros] = useState("");
  const [gravando, setGravando] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function gravar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setArquivo(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type }));
        setModo("midia");
        for (const track of stream.getTracks()) track.stop();
      };
      recorder.start();
      recorderRef.current = recorder;
      setGravando(true);
    } catch {
      document.getElementById("inbox-rich-file")?.click();
    }
  }

  async function enviar() {
    if (modo === "midia" && arquivo) {
      await onEnviar({
        tipo: arquivo.type.startsWith("audio/") ? "audio" : "midia",
        arquivo,
        texto,
      });
    } else if (modo === "template") {
      const template = templates.find((item) => item.id === templateNome);
      await onEnviar({
        tipo: "template",
        templateNome: template?.nome,
        templateIdioma: template?.idioma,
        parametros: parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    } else if (modo === "interativa") {
      await onEnviar({
        tipo: "interativa",
        texto,
        botoes: botoes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    }
    setModo(null);
    setArquivo(null);
    setTexto("");
    setBotoes("");
    setParametros("");
  }

  return (
    <div className="border-t border-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="inbox-rich-file"
          type="file"
          className="hidden"
          accept="audio/*,image/*,.pdf,.doc,.docx"
          onChange={(event) => {
            setArquivo(event.target.files?.[0] ?? null);
            setModo("midia");
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => document.getElementById("inbox-rich-file")?.click()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2"
        >
          <FileUp className="h-4 w-4" /> Mídia
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={
            gravando
              ? () => {
                  recorderRef.current?.stop();
                  setGravando(false);
                }
              : gravar
          }
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2"
        >
          {gravando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{" "}
          {gravando ? "Parar" : "Áudio"}
        </button>
        <button
          type="button"
          disabled={disabled || templates.length === 0}
          onClick={() => setModo("template")}
          className="text-xs font-semibold text-ink-2 disabled:opacity-40"
        >
          Template
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setModo("interativa")}
          className="text-xs font-semibold text-ink-2"
        >
          Botões
        </button>
      </div>
      {modo && (
        <div className="mt-2 flex flex-wrap gap-2">
          {modo === "template" ? (
            <>
              <select
                value={templateNome}
                onChange={(event) => setTemplateNome(event.target.value)}
                className="input flex-1 text-sm"
              >
                <option value="">Selecione template aprovado</option>
                {templates
                  .filter((item) => item.status === "approved")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
              </select>
              <input
                value={parametros}
                onChange={(event) => setParametros(event.target.value)}
                placeholder="Valores dos placeholders, separados por vírgula"
                className="input flex-1 text-sm"
              />
            </>
          ) : (
            <input
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder={arquivo?.name ?? "Texto da mensagem"}
              className="input flex-1 text-sm"
            />
          )}
          {modo === "interativa" && (
            <input
              value={botoes}
              onChange={(event) => setBotoes(event.target.value)}
              placeholder="Botões separados por vírgula"
              className="input flex-1 text-sm"
            />
          )}
          <button
            type="button"
            onClick={enviar}
            className="rounded-[6px] bg-orange px-3 py-1.5 text-xs font-semibold text-white"
          >
            Enviar
          </button>
          <button type="button" onClick={() => setModo(null)} className="text-xs text-ink-3">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
