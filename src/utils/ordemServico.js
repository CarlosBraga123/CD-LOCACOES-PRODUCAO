export const gerarProximoNumeroOS = (atividades = [], dataLiberacao) => {
  const [anoCompleto, mes] = String(dataLiberacao || "").split("-");
  if (!anoCompleto || !mes) return "";

  const ano = anoCompleto.slice(-2);
  const padraoNumeroOS = new RegExp(`^OS${ano}\\d{2}(\\d{4})$`);
  const maiorSequencia = atividades.reduce((maior, atividade) => {
    const numeroOS = String(atividade?.numeroOS || "").trim();
    const resultado = numeroOS.match(padraoNumeroOS);
    if (!resultado) return maior;

    const sequencia = Number(resultado[1]);
    return Number.isFinite(sequencia) && sequencia > maior ? sequencia : maior;
  }, 0);

  const proximaSequencia = String(maiorSequencia + 1).padStart(4, "0");
  return `OS${ano}${mes.padStart(2, "0")}${proximaSequencia}`;
};

export const obterStatusOrdemServico = (atividade) =>
  atividade?.dataLiberacao ? "Executada" : "Agendada";

export const formatarDataOrdemServico = (data) => {
  if (!data) return "";
  const [ano, mes, dia] = String(data).split("-");
  if (!ano || !mes || !dia) return String(data);
  return `${dia}/${mes}/${ano}`;
};

export const formatarEquipamentoOrdemServico = (atividade) => {
  if (!atividade) return "";

  if (atividade.equipamento === "Balancinho") {
    const tipo = atividade.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
    return `Balancinho ${tipo}`;
  }

  if (atividade.equipamento === "Mini Grua") {
    if (atividade.tipoMiniGrua === "1T") return "Mini Grua 1 T";
    if (atividade.tipoMiniGrua === "500kg") return "Mini Grua 500 kg";
    return "Mini Grua";
  }

  return atividade.equipamento || "";
};

const obterQuantidadeOrdemServico = (atividade) => {
  const itens = Array.isArray(atividade?.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];
  if (itens.length > 0) return itens.length;
  return Number(atividade?.quantidade) || 1;
};

export const montarDescricaoOrdemServico = (atividade, obra) => {
  const quantidade = obterQuantidadeOrdemServico(atividade);
  const equipamento = formatarEquipamentoOrdemServico(atividade).toLowerCase();
  const servico = String(atividade?.servico || "servico").toLowerCase();
  const partes = [`Executar ${servico} de ${quantidade} ${equipamento || "equipamento"}`];

  if (atividade?.tamanho) partes.push(`de ${atividade.tamanho} metros`);
  if (atividade?.usaContrapeso) partes.push("com contrapeso");
  if (atividade?.ancoragem) partes.push(`com ancoragem em ${String(atividade.ancoragem).toLowerCase()}`);
  if (obra?.nome || atividade?.obra) partes.push(`na obra ${obra?.nome || atividade.obra}`);
  if (atividade?.dataAgendamento) {
    partes.push(`com data agendada para ${formatarDataOrdemServico(atividade.dataAgendamento)}`);
  }

  return `${partes.join(", ")}.`;
};

export const montarPayloadOrdemServico = ({ atividade, obra, construtora }) => {
  const linhas = [
    ["CD LOCACOES"],
    ["ORDEM DE SERVICO", atividade?.numeroOS],
    ["STATUS", obterStatusOrdemServico(atividade)],
    ["CONSTRUTORA", construtora?.nome || obra?.construtora || atividade?.construtora],
    ["OBRA", obra?.nome || atividade?.obra],
    ["SERVICO", atividade?.servico],
    ["EQUIPAMENTO", formatarEquipamentoOrdemServico(atividade)],
    ["QUANTIDADE", obterQuantidadeOrdemServico(atividade)],
    ["DATA AGENDADA", formatarDataOrdemServico(atividade?.dataAgendamento)],
    ["DATA DE LIBERACAO", formatarDataOrdemServico(atividade?.dataLiberacao)],
  ];

  return linhas
    .filter(([label, valor]) => label === "CD LOCACOES" || (valor !== undefined && valor !== null && String(valor).trim()))
    .map(([label, valor]) => (label === "CD LOCACOES" ? label : `${label}: ${valor}`))
    .join("\n");
};
