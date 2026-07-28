import { atividadePertenceObra } from "./obras";
import { obterResumoEquipamentosAtivos } from "./equipamentosAtivos";

export const formatarDataDetalhesObra = (data) => {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
};

export const obterResumoBalancinhosAtivos = (obra, atividades = []) =>
  obterResumoEquipamentosAtivos(obra, atividades).filter((item) =>
    ["Balancinho El\u00e9trico", "Balancinho Manual", "Kit Contrapeso"].includes(
      item.grupo
    )
  );

export const obterResumoMiniGruasAtivas = (obra, atividades = []) =>
  obterResumoEquipamentosAtivos(obra, atividades).filter((item) =>
    String(item.grupo || "").startsWith("Mini Grua")
  );

export const calcularTotalAtivosPorEquipamento = (
  obra,
  equipamento,
  atividades = []
) => {
  const resumo =
    equipamento === "Balancinho"
      ? obterResumoBalancinhosAtivos(obra, atividades).filter(
          (item) => item.grupo !== "Kit Contrapeso"
        )
      : obterResumoMiniGruasAtivas(obra, atividades);

  return resumo.reduce(
    (total, item) => total + Number(item.total || 0),
    0
  );
};

export const contarServicosObra = (
  obra,
  equipamento,
  servicos,
  atividades = []
) => {
  const servicosValidos = Array.isArray(servicos) ? servicos : [servicos];

  return atividades
    .filter(
      (atividade) =>
        atividadePertenceObra(atividade, obra) &&
        atividade.equipamento === equipamento &&
        servicosValidos.includes(atividade.servico) &&
        atividade.dataLiberacao
    )
    .reduce(
      (total, atividade) => total + (Number(atividade.quantidade) || 1),
      0
    );
};

export const obterServicosExecutadosObra = (obra, atividades = []) =>
  atividades
    .filter(
      (atividade) =>
        atividadePertenceObra(atividade, obra) && atividade.dataLiberacao
    )
    .sort(
      (atividadeA, atividadeB) =>
        new Date(atividadeB.dataLiberacao) - new Date(atividadeA.dataLiberacao)
    );

export const obterHistoricoAtividadesObra = (obra, atividades = []) =>
  atividades
    .filter((atividade) => atividadePertenceObra(atividade, obra))
    .sort((atividadeA, atividadeB) => {
      const dataA =
        atividadeA.dataLiberacao || atividadeA.dataAgendamento || "";
      const dataB =
        atividadeB.dataLiberacao || atividadeB.dataAgendamento || "";
      return dataB.localeCompare(dataA);
    });

export const formatarEquipamentoDetalhesObra = (atividade) => {
  if (atividade.equipamento === "Mini Grua") {
    return atividade.tipoMiniGrua
      ? `Mini Grua ${atividade.tipoMiniGrua}`
      : "Mini Grua";
  }

  if (atividade.equipamento !== "Balancinho") {
    return atividade.equipamento;
  }

  const tipo =
    atividade.tipoBalancinho === "Manual" ? "Manual" : "El\u00e9trico";
  return `Balancinho ${tipo}`;
};
