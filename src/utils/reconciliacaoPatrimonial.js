import { obterUnidadesEquipamentosAtivos } from "./equipamentosAtivos";
import { atividadeEncerraLocacao } from "./locacaoFinanceira";
import {
  obterEquipamentosPatrimonio,
  reconciliarSituacoesEquipamentos,
  salvarEquipamentosPatrimonio,
} from "./equipamentosPatrimonio";
import { obterRegistrosPatrimonio } from "./patrimoniosEquipamentos";
import { itemPossuiVinculoPatrimonial } from "./unidadesEquipamentos";

const prepararAtividadesParaSituacaoPatrimonial = (atividades) =>
  atividades
    .map((atividade) => {
      if (
        !atividadeEncerraLocacao(atividade) ||
        atividade.pendenteVinculoPatrimonio !== true
      ) {
        return atividade;
      }

      const itensVinculados = (atividade.itensEquipamentos || []).filter(
        itemPossuiVinculoPatrimonial
      );
      if (itensVinculados.length === 0) return null;

      return {
        ...atividade,
        quantidade: itensVinculados.length,
        itensEquipamentos: itensVinculados,
        pendenteVinculoPatrimonio: false,
      };
    })
    .filter(Boolean);

export const reconciliarPatrimonioAposAtividades = ({
  atividades = [],
  obras = [],
  equipamentos = obterEquipamentosPatrimonio(),
  registrosPatrimonio = obterRegistrosPatrimonio(),
  data = new Date().toISOString().slice(0, 10),
  obraOrigemId = "",
  persistir = true,
} = {}) => {
  const atividadesParaSituacao = prepararAtividadesParaSituacaoPatrimonial(
    atividades
  );
  const equipamentosAtivos = obras.flatMap((obra) =>
    obterUnidadesEquipamentosAtivos(
      obra,
      atividadesParaSituacao,
      registrosPatrimonio,
      equipamentos
    )
  );
  const reconciliacao = reconciliarSituacoesEquipamentos({
    equipamentos,
    equipamentosAtivos,
    data,
    obraOrigemId,
  });

  if (persistir && reconciliacao.alterado) {
    salvarEquipamentosPatrimonio(reconciliacao.equipamentos);
  }

  return {
    ...reconciliacao,
    equipamentosAtivos,
  };
};
