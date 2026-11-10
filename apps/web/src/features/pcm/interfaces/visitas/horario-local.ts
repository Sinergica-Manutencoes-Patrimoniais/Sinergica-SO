/** Horários de formulário são interpretados no fuso do dispositivo. */
export function horarioNoDispositivo(valor: string) {
  const data = new Date(valor);
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function converterHorarioLocal(valor: string) {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime()) || horarioNoDispositivo(data.toISOString()) !== valor)
    throw new RangeError("Horário local inexistente ou inválido.");
  const offsets = new Set([-172800000, 0, 172800000].map((delta) => new Date(data.getTime() + delta).getTimezoneOffset()));
  for (const offset of offsets) {
    const alternativo = data.getTime() + (offset - data.getTimezoneOffset()) * 60000;
    if (alternativo !== data.getTime() && horarioNoDispositivo(new Date(alternativo).toISOString()) === valor)
      throw new RangeError("Horário local ambíguo.");
  }
  return data.toISOString();
}
