import { obterPatrimonioAtual } from "./patrimoniosEquipamentos";

export const CHAVE_AJUSTES_CONFIGURACAO = "ajustesConfiguracaoEquipamentos";

export const obterAjustesConfiguracaoEquipamentos = () => {
  try {
    const ajustes = JSON.parse(
      localStorage.getItem(CHAVE_AJUSTES_CONFIGURACAO) || "[]"
    );
    return Array.isArray(ajustes) ? ajustes : [];
  } catch {
    return [];
  }
};

export const salvarAjustesConfiguracaoEquipamentos = (ajustes) => {
  localStorage.setItem(
    CHAVE_AJUSTES_CONFIGURACAO,
    JSON.stringify(Array.isArray(ajustes) ? ajustes : [])
  );
};

export const obterIdentidadeAjusteConfiguracao = (item = {}) =>
  String(
    item.idItem ||
      item.idUnidade ||
      item.idItemOrigem ||
      item.idEquipamento ||
      ""
  ).trim();

export const ajustePertenceUnidade = (ajuste, unidade) => {
  const identidades = new Set(
    [
      unidade?.idUnidade,
      unidade?.idItem,
      unidade?.idItemOrigem,
      unidade?.idEquipamento,
    ]
      .map((valor) => String(valor || "").trim())
      .filter(Boolean)
  );
  return [
    ajuste?.idUnidade,
    ajuste?.idItem,
    ajuste?.idEquipamento,
  ].some((valor) => identidades.has(String(valor || "").trim()));
};

export const obterAjustesDaUnidade = (item, ajustes = []) =>
  ajustes
    .filter((ajuste) => ajustePertenceUnidade(ajuste, item))
    .sort((a, b) =>
      String(a.data || "").localeCompare(String(b.data || "")) ||
      String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
    );

export const obterUltimoAjusteConfiguracao = (
  item,
  ajustes = [],
  dataReferencia = "9999-12-31"
) =>
  obterAjustesDaUnidade(item, ajustes)
    .filter((ajuste) => !ajuste.data || ajuste.data <= dataReferencia)
    .at(-1) || null;

export const aplicarAjusteConfiguracaoNaUnidade = (unidade, ajuste) => ({
  ...unidade,
  ...(Object.prototype.hasOwnProperty.call(ajuste, "tamanho")
    ? { tamanho: String(ajuste.tamanho ?? "") }
    : {}),
  ...(Object.prototype.hasOwnProperty.call(ajuste, "ancoragem")
    ? { ancoragem: ajuste.ancoragem || "" }
    : {}),
  ...(typeof ajuste.usaContrapeso === "boolean"
    ? { usaContrapeso: ajuste.usaContrapeso }
    : {}),
  contrapesoConferido: typeof ajuste.usaContrapeso === "boolean",
  usaContrapesoConferido:
    typeof ajuste.usaContrapeso === "boolean" ? ajuste.usaContrapeso : null,
  origemConfiguracao: "CONFERENCIA_CADASTRAL",
  dataUltimaConferencia: ajuste.data || "",
  ultimoAjusteConfiguracaoId: ajuste.id,
});

export const criarAjusteConfiguracao = ({
  item,
  obraId,
  data,
  tamanho,
  ancoragem,
  usaContrapeso,
  observacao,
}) => ({
  id:
    globalThis.crypto?.randomUUID?.() ||
    `ajuste-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  idItem: obterIdentidadeAjusteConfiguracao(item),
  idEquipamento: item.idEquipamento || "",
  idUnidade: item.idUnidade || item.idItem || "",
  obraId: obraId || item.obraId || "",
  data,
  tamanho: tamanho === "" ? "" : String(tamanho ?? ""),
  ancoragem: ancoragem || "",
  usaContrapeso:
    usaContrapeso === true || usaContrapeso === false
      ? usaContrapeso
      : null,
  observacao: String(observacao || "").trim(),
  origem: "CONFERENCIA_CADASTRAL",
  criadoEm: new Date().toISOString(),
});

export const obterSituacaoConferenciaUnidade = (
  item,
  registrosPatrimonio = [],
  ajustes = obterAjustesConfiguracaoEquipamentos()
) => {
  const conferencias = obterAjustesDaUnidade(
    item,
    Array.isArray(ajustes) ? ajustes : []
  );
  const ultimaConferencia = conferencias.at(-1) || null;
  const patrimonio = obterPatrimonioAtual(
    item,
    Array.isArray(registrosPatrimonio) ? registrosPatrimonio : []
  );
  const faltantes = [];
  if (!patrimonio) faltantes.push("patrimônio");

  if (item?.equipamento === "Balancinho") {
    const tamanhoAtual = ultimaConferencia
      ? String(ultimaConferencia.tamanho ?? "")
      : String(item.tamanho || "");
    if (!tamanhoAtual) faltantes.push("tamanho");
    const contrapesoConhecido =
      ultimaConferencia
        ? typeof ultimaConferencia.usaContrapeso === "boolean"
        : item.usaContrapeso === true;
    if (!contrapesoConhecido) faltantes.push("contrapeso");
  }

  if (item?.equipamento === "Mini Grua" && !item.tipoMiniGrua) {
    faltantes.push("tipo");
  }

  const status =
    faltantes.length === 0
      ? "conferido"
      : !patrimonio || faltantes.length > 1
        ? "pendente"
        : "parcial";
  return {
    status,
    faltantes,
    patrimonio,
    tamanho: ultimaConferencia
      ? String(ultimaConferencia.tamanho ?? "")
      : item?.tamanho || "",
    ancoragem: ultimaConferencia
      ? ultimaConferencia.ancoragem || ""
      : item?.ancoragem || "",
    usaContrapeso:
      ultimaConferencia
        ? typeof ultimaConferencia.usaContrapeso === "boolean"
          ? ultimaConferencia.usaContrapeso
          : null
        : item?.usaContrapeso,
    ultimaConferencia: item?.dataUltimaConferencia || ultimaConferencia?.data || "",
  };
};
