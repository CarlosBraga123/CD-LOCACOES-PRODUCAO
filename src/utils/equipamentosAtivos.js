import { atividadePertenceObra } from "./obras";
import {
  atividadeEncerraLocacao,
  atividadeIniciaLocacao,
  obterMovimentosLocacao,
} from "./locacaoFinanceira";
import { compararTextoPtBr } from "./ordenacao";
import {
  criarUnidadesDaEntrada,
  localizarIndiceUnidade,
  unidadeCompativelComAtividade,
} from "./unidadesEquipamentos";
import {
  aplicarPatrimoniosAdministrativos,
  obterRegistrosPatrimonio,
} from "./patrimoniosEquipamentos";
import {
  aplicarSubstituicoesEquipamentosAtivos,
  obterEquipamentosPatrimonio,
  obterIdEquipamentoDoItem,
} from "./equipamentosPatrimonio";
import { itemPossuiVinculoPatrimonial } from "./pendenciasOperacionais";
import {
  ajustePertenceUnidade,
  aplicarAjusteConfiguracaoNaUnidade,
  obterAjustesConfiguracaoEquipamentos,
} from "./ajustesConfiguracaoEquipamentos";

const ordemBalancinho = ["Balancinho Elétrico", "Balancinho Manual", "Kit Contrapeso"];
const ordemMiniGrua = ["Mini Grua 500kg", "Mini Grua 1T", "Mini Grua"];
const ordemResumo = [...ordemBalancinho, ...ordemMiniGrua];

const ordenarResumo = (itens) =>
  itens.sort((a, b) => {
    const posicaoA = ordemResumo.indexOf(a.grupo);
    const posicaoB = ordemResumo.indexOf(b.grupo);

    if (posicaoA === -1 && posicaoB === -1) return compararTextoPtBr(a.grupo, b.grupo);
    if (posicaoA === -1) return 1;
    if (posicaoB === -1) return -1;
    return posicaoA - posicaoB;
  });

export const formatarGrupoBalancinhoAtivo = (atividade) => {
  if (atividade?.usaContrapeso) return "Kit Contrapeso";
  return atividade?.tipoBalancinho === "Manual" ? "Balancinho Manual" : "Balancinho Elétrico";
};

export const formatarGrupoMiniGruaAtiva = (atividade) =>
  atividade?.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";

export const calcularEquipamentosAtivosDaObra = (obra, atividades = []) => {
  const totais = {};

  atividades
    .filter((atividade) => atividadePertenceObra(atividade, obra) && atividade.dataLiberacao)
    .map((atividade) => {
      if (
        atividade.pendenteVinculoPatrimonio !== true ||
        atividadeIniciaLocacao(atividade) ||
        atividadeEncerraLocacao(atividade)
      ) {
        return atividade;
      }
      const vinculados = (atividade.itensEquipamentos || []).filter(
        itemPossuiVinculoPatrimonial
      ).length;
      return vinculados > 0 ? { ...atividade, quantidade: vinculados } : null;
    })
    .filter(Boolean)
    .flatMap((atividade) => obterMovimentosLocacao(atividade))
    .forEach((atividade) => {
      const quantidade = Number(atividade.quantidade) || 1;
      const iniciaLocacao = atividadeIniciaLocacao(atividade);
      const encerraLocacao = atividadeEncerraLocacao(atividade);
      let grupo = "";

      if (atividade.equipamento === "Balancinho") {
        grupo = formatarGrupoBalancinhoAtivo(atividade);
      } else if (atividade.equipamento === "Mini Grua") {
        grupo = formatarGrupoMiniGruaAtiva(atividade);
      } else {
        grupo = atividade.equipamento || "Equipamento";
      }

      if (!grupo) return;
      if (!totais[grupo]) totais[grupo] = 0;
      if (iniciaLocacao) totais[grupo] += quantidade;
      if (encerraLocacao) totais[grupo] -= quantidade;
    });

  return totais;
};

export const obterResumoEquipamentosAtivos = (obra, atividades = []) =>
  ordenarResumo(
    Object.entries(calcularEquipamentosAtivosDaObra(obra, atividades))
      .filter(([, total]) => total !== 0)
      .map(([grupo, total]) => ({ grupo, total }))
  );

export const obterTotalEquipamentosAtivos = (obra, atividades = []) =>
  obterResumoEquipamentosAtivos(obra, atividades).reduce(
    (total, item) => total + Math.max(0, Number(item.total) || 0),
    0
  );

const aplicarDeslocamentoNaUnidade = (unidade, item, atividade) => {
  const alteracao = String(item.alteracaoContrapeso || "nenhuma")
    .trim()
    .toLowerCase();

  return {
    ...unidade,
    tamanho: String(item.tamanhoNovo ?? unidade.tamanho ?? ""),
    ancoragem: item.ancoragem || unidade.ancoragem || "",
    usaContrapeso:
      alteracao === "adicionar"
        ? true
        : alteracao === "remover"
          ? false
          : unidade.usaContrapeso,
    ultimaAtividadeId: atividade?.id || unidade.ultimaAtividadeId,
    ultimoDeslocamentoId: atividade?.id || unidade.ultimoDeslocamentoId,
  };
};

export const obterUnidadesEquipamentosAtivos = (
  obra,
  atividades = [],
  registrosPatrimonio = obterRegistrosPatrimonio(),
  equipamentosMestres = obterEquipamentosPatrimonio()
) => {
  const unidades = [];
  const ajustes = obterAjustesConfiguracaoEquipamentos()
    .filter(
      (ajuste) =>
        !ajuste.obraId || String(ajuste.obraId) === String(obra?.id || "")
    )
    .sort((a, b) =>
      String(a.data || "").localeCompare(String(b.data || "")) ||
      String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
    );
  let indiceAjuste = 0;
  const aplicarAjustesAte = (dataLimite, incluirDataLimite = true) => {
    while (
      indiceAjuste < ajustes.length &&
      (incluirDataLimite
        ? String(ajustes[indiceAjuste].data || "") <= dataLimite
        : String(ajustes[indiceAjuste].data || "") < dataLimite)
    ) {
      const ajuste = ajustes[indiceAjuste];
      const indiceUnidade = unidades.findIndex((unidade) =>
        ajustePertenceUnidade(ajuste, unidade)
      );
      if (indiceUnidade >= 0) {
        unidades[indiceUnidade] = aplicarAjusteConfiguracaoNaUnidade(
          unidades[indiceUnidade],
          ajuste
        );
      }
      indiceAjuste += 1;
    }
  };

  atividades
    .filter(
      (atividade) =>
        atividadePertenceObra(atividade, obra) &&
        atividade.dataLiberacao &&
        (atividade.pendenteVinculoPatrimonio !== true ||
          atividadeIniciaLocacao(atividade) ||
          atividadeEncerraLocacao(atividade) ||
          (atividade.itensEquipamentos || []).some(itemPossuiVinculoPatrimonial))
    )
    .sort((a, b) => {
      const porData = String(a.dataLiberacao).localeCompare(
        String(b.dataLiberacao)
      );
      if (porData !== 0) return porData;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    })
    .forEach((atividade) => {
      const dataAtividade = String(atividade.dataLiberacao || "");
      aplicarAjustesAte(dataAtividade, false);
      try {
      const iniciaLocacao = atividadeIniciaLocacao(atividade);
      const encerraLocacao = atividadeEncerraLocacao(atividade);
      const itens = Array.isArray(atividade.itensEquipamentos)
        ? atividade.itensEquipamentos
        : [];

      if (iniciaLocacao) {
        unidades.push(...criarUnidadesDaEntrada(atividade));
        return;
      }

      if (itens.length > 0) {
        let unidadesEncerradas = 0;
        itens.forEach((item) => {
          const indice = localizarIndiceUnidade(unidades, item);
          if (indice < 0) return;

          if (encerraLocacao) {
            unidades.splice(indice, 1);
            unidadesEncerradas += 1;
            return;
          }

          if (atividade.servico === "Deslocamento") {
            unidades[indice] = aplicarDeslocamentoNaUnidade(
              unidades[indice],
              item,
              atividade
            );
          }
        });
        if (
          encerraLocacao &&
          atividade.pendenteVinculoPatrimonio === true
        ) {
          let quantidadeRestante =
            Math.max(1, Number(atividade.quantidade) || 1) - unidadesEncerradas;
          for (
            let indice = unidades.length - 1;
            indice >= 0 && quantidadeRestante > 0;
            indice -= 1
          ) {
            if (!unidadeCompativelComAtividade(unidades[indice], atividade)) continue;
            unidades.splice(indice, 1);
            quantidadeRestante -= 1;
          }
        }
        return;
      }

      if (atividade.servico === "Deslocamento") {
        let quantidadeRestante = Math.max(
          1,
          Number(atividade.quantidade) || 1
        );

        for (
          let indice = unidades.length - 1;
          indice >= 0 && quantidadeRestante > 0;
          indice -= 1
        ) {
          if (!unidadeCompativelComAtividade(unidades[indice], atividade)) continue;
          unidades[indice] = aplicarDeslocamentoNaUnidade(
            unidades[indice],
            {
              tamanhoNovo: atividade.tamanhoNovo || atividade.tamanho,
              ancoragem: atividade.ancoragem,
              alteracaoContrapeso: atividade.alteracaoContrapeso,
            },
            atividade
          );
          quantidadeRestante -= 1;
        }
      }

      if (encerraLocacao) {
        let quantidadeRestante = Math.max(
          1,
          Number(atividade.quantidade) || 1
        );

        for (
          let indice = unidades.length - 1;
          indice >= 0 && quantidadeRestante > 0;
          indice -= 1
        ) {
          if (!unidadeCompativelComAtividade(unidades[indice], atividade)) continue;
          unidades.splice(indice, 1);
          quantidadeRestante -= 1;
        }
      }
      } finally {
        aplicarAjustesAte(dataAtividade);
      }
    });

  aplicarAjustesAte("9999-12-31");

  const unidadesComIdentidade = aplicarPatrimoniosAdministrativos(
    unidades,
    registrosPatrimonio
  ).map((item) => ({
      ...item,
      idEquipamento: obterIdEquipamentoDoItem(item, equipamentosMestres),
    }));
  return aplicarSubstituicoesEquipamentosAtivos(
    unidadesComIdentidade,
    equipamentosMestres
  );
};

export const obterResumoUnidadesEquipamentosAtivos = (
  obra,
  atividades = []
) => {
  const totais = {};

  obterUnidadesEquipamentosAtivos(obra, atividades).forEach((unidade) => {
    let grupo = unidade.equipamento || "Equipamento";

    if (unidade.equipamento === "Balancinho") {
      grupo =
        unidade.tipoBalancinho === "Manual"
          ? "Balancinho Manual"
          : "Balancinho Elétrico";
    } else if (unidade.equipamento === "Mini Grua") {
      grupo = unidade.tipoMiniGrua
        ? `Mini Grua ${unidade.tipoMiniGrua}`
        : "Mini Grua";
    }

    totais[grupo] = (totais[grupo] || 0) + 1;

    if (unidade.equipamento === "Balancinho" && unidade.usaContrapeso) {
      totais["Kit Contrapeso"] = (totais["Kit Contrapeso"] || 0) + 1;
    }
  });

  return ordenarResumo(
    Object.entries(totais).map(([grupo, total]) => ({ grupo, total }))
  );
};

export const obterTotalUnidadesEquipamentosAtivos = (
  obra,
  atividades = []
) =>
  obterResumoUnidadesEquipamentosAtivos(obra, atividades).reduce(
    (total, item) => total + item.total,
    0
  );
