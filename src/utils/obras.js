export const normalizarTexto = (valor) => String(valor || "").trim().toLowerCase();

export const atividadePertenceObra = (atividade, obra) => {
  if (atividade?.obraId) {
    return String(atividade.obraId) === String(obra?.id);
  }

  return (
    normalizarTexto(atividade?.construtora) === normalizarTexto(obra?.construtora) &&
    normalizarTexto(atividade?.obra) === normalizarTexto(obra?.nome)
  );
};

export const obterObraDaAtividade = (atividade, obras = []) => {
  if (atividade?.obraId) {
    return obras.find((obra) => String(obra.id) === String(atividade.obraId));
  }

  return obras.find(
    (obra) =>
      normalizarTexto(obra?.nome) === normalizarTexto(atividade?.obra) &&
      normalizarTexto(obra?.construtora) === normalizarTexto(atividade?.construtora)
  );
};

export const obterChaveObra = (atividade) => {
  if (atividade?.obraId) return `obraId:${atividade.obraId}`;
  return `nome:${normalizarTexto(atividade?.construtora)}||${normalizarTexto(atividade?.obra)}`;
};
