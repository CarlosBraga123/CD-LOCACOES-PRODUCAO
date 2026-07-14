export const formatarMoeda = (valor) => {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const formatarNumeroParaEdicao = (valor) => {
  if (valor === undefined || valor === null || valor === "") return "";
  return String(valor).replace(".", ",");
};

export const converterMoedaParaNumero = (valorDigitado) => {
  if (typeof valorDigitado === "number") return Number.isFinite(valorDigitado) ? valorDigitado : null;

  const texto = String(valorDigitado || "")
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!texto) return null;

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};

export const normalizarValoresMonetarios = (valores = {}) => {
  return Object.entries(valores).reduce((acc, [chave, valor]) => {
    const numero = converterMoedaParaNumero(valor);
    acc[chave] = numero === null ? 0 : numero;
    return acc;
  }, {});
};
