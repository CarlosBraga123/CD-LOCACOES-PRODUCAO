export const CHAVE_CONTROLE_KIT_CONTRAPESO = "controleKitContrapeso";

const estruturaVazia = () => ({ quantidadeTotal: 0, historico: [] });

export const obterControleKitContrapeso = () => {
  try {
    const dados = JSON.parse(
      localStorage.getItem(CHAVE_CONTROLE_KIT_CONTRAPESO) || "null"
    );
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return estruturaVazia();
    }
    return {
      quantidadeTotal: Math.max(0, Number(dados.quantidadeTotal) || 0),
      historico: Array.isArray(dados.historico) ? dados.historico : [],
    };
  } catch {
    return estruturaVazia();
  }
};

export const salvarControleKitContrapeso = (controle) => {
  localStorage.setItem(
    CHAVE_CONTROLE_KIT_CONTRAPESO,
    JSON.stringify({
      quantidadeTotal: Math.max(0, Number(controle?.quantidadeTotal) || 0),
      historico: Array.isArray(controle?.historico) ? controle.historico : [],
    })
  );
};

export const ajustarQuantidadeKitContrapeso = ({
  controle,
  quantidadeNova,
  data,
  motivo,
  observacao,
}) => {
  const quantidade = Number(quantidadeNova);
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    throw new Error("Informe uma quantidade total inteira e não negativa.");
  }
  if (!String(motivo || "").trim()) {
    throw new Error("Informe o motivo do ajuste.");
  }
  const atual = controle || estruturaVazia();
  const atualizado = {
    quantidadeTotal: quantidade,
    historico: [
      ...(atual.historico || []),
      {
        id:
          globalThis.crypto?.randomUUID?.() ||
          `kit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        data: data || new Date().toISOString().slice(0, 10),
        quantidadeAnterior: Math.max(0, Number(atual.quantidadeTotal) || 0),
        quantidadeNova: quantidade,
        motivo: String(motivo).trim(),
        observacao: String(observacao || "").trim(),
      },
    ],
  };
  salvarControleKitContrapeso(atualizado);
  return atualizado;
};
