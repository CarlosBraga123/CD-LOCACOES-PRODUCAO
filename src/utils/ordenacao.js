const textoOrdenavel = (valor) => String(valor || "").trim();

const situacaoInativa = (obra) => {
  const situacao = textoOrdenavel(obra?.situacao).toLocaleLowerCase("pt-BR");
  return ["concluida", "concluída", "inativa"].includes(situacao);
};

export const compararTextoPtBr = (a, b) =>
  textoOrdenavel(a).localeCompare(textoOrdenavel(b), "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });

export const ordenarPorTexto = (lista = [], seletor = (item) => item) =>
  [...lista].sort((a, b) => compararTextoPtBr(seletor(a), seletor(b)));

export const ordenarPatrimoniosNumerados = (
  lista = [],
  obterPatrimonio = (item) => item?.numeroPatrimonio || item?.numeroPatrimonioAtual
) => {
  const obterNumero = (item) => {
    const texto = String(obterPatrimonio(item) || "").trim();
    return /^\d+$/.test(texto) ? Number(texto) : null;
  };
  const numerados = lista
    .map((item, ordemOriginal) => ({ item, ordemOriginal, numero: obterNumero(item) }))
    .filter(({ numero }) => numero !== null)
    .sort(
      (a, b) =>
        a.numero - b.numero || a.ordemOriginal - b.ordemOriginal
    )
    .map(({ item }) => item);
  let indiceNumerado = 0;

  return lista.map((item) =>
    obterNumero(item) === null ? item : numerados[indiceNumerado++]
  );
};

export const ordenarConstrutoras = (construtoras = []) =>
  ordenarPorTexto(construtoras, (construtora) => construtora?.nome);

export const ordenarObrasPorNome = (obras = []) =>
  ordenarPorTexto(obras, (obra) => obra?.nome);

export const ordenarObrasPorConstrutoraENome = (obras = []) =>
  [...obras].sort((a, b) => {
    const porConstrutora = compararTextoPtBr(a?.construtora, b?.construtora);
    if (porConstrutora !== 0) return porConstrutora;
    return compararTextoPtBr(a?.nome, b?.nome);
  });

export const ordenarObrasPorEquipamentosAtivos = (obras = [], obterQuantidadeAtiva = () => 0) =>
  [...obras].sort((a, b) => {
    const aInativa = situacaoInativa(a);
    const bInativa = situacaoInativa(b);
    if (aInativa !== bInativa) return aInativa ? 1 : -1;

    const ativosA = Number(obterQuantidadeAtiva(a)) || 0;
    const ativosB = Number(obterQuantidadeAtiva(b)) || 0;
    const aZerada = ativosA <= 0;
    const bZerada = ativosB <= 0;

    if (aZerada !== bZerada) return aZerada ? 1 : -1;
    if (ativosA !== ativosB) return ativosB - ativosA;

    return compararTextoPtBr(a?.nome, b?.nome);
  });
