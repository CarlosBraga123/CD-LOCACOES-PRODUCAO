export const obterIdentidadeUnidadeEntrada = (atividade, item, indice) => {
  if (item?.idItem) return String(item.idItem);

  const patrimonio = String(
    item?.numeroPatrimonio ??
      atividade?.numerosPatrimonio?.[indice] ??
      ""
  ).trim();
  if (patrimonio) {
    return `patrimonio:${atividade.equipamento}:${patrimonio}:${atividade.id ?? "sem-id"}`;
  }

  return `legado:${atividade.id ?? "sem-id"}:${indice}`;
};

export const criarUnidadesDaEntrada = (atividade) => {
  const itens = Array.isArray(atividade.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  const quantidade =
    itens.length || Math.max(1, Number(atividade.quantidade) || 1);

  return Array.from({ length: quantidade }, (_, indice) => {
    const item = itens[indice] || {};
    const idUnidade = obterIdentidadeUnidadeEntrada(atividade, item, indice);

    return {
      idUnidade,
      idItemOrigem: item.idItem || idUnidade,
      atividadeOrigemId: atividade.id,
      indiceUnidade: indice + 1,
      unidadeLegada: itens.length === 0,
      dataEntrada: atividade.dataLiberacao || "",
      equipamento: item.equipamento || atividade.equipamento,
      tipoBalancinho:
        item.tipoBalancinho || atividade.tipoBalancinho || "",
      tipoMiniGrua: item.tipoMiniGrua || atividade.tipoMiniGrua || "",
      tamanho: String(item.tamanho ?? atividade.tamanho ?? ""),
      ancoragem: item.ancoragem || atividade.ancoragem || "",
      numeroPatrimonio: String(
        item.numeroPatrimonio ??
          atividade.numerosPatrimonio?.[indice] ??
          ""
      ).trim(),
      usaContrapeso:
        item.usaContrapeso !== undefined
          ? item.usaContrapeso === true
          : atividade.usaContrapeso === true,
      obraId: atividade.obraId || "",
      construtora: atividade.construtora || "",
      obra: atividade.obra || "",
    };
  });
};

export const localizarIndiceUnidade = (unidades, item) => {
  const identidade = String(item?.idItemOrigem || "").trim();
  if (identidade) {
    const indice = unidades.findIndex(
      (unidade) =>
        unidade.idUnidade === identidade ||
        unidade.idItemOrigem === identidade
    );
    if (indice >= 0) return indice;
  }

  const patrimonio = String(item?.numeroPatrimonio || "").trim();
  if (patrimonio) {
    return unidades.findIndex(
      (unidade) =>
        unidade.equipamento === item.equipamento &&
        unidade.numeroPatrimonio === patrimonio
    );
  }

  return -1;
};
