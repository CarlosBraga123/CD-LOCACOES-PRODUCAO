import { obterUnidadesEquipamentosAtivos } from "./equipamentosAtivos";
import { obterIdentidadeCanonicaUnidade } from "./unidadesEquipamentos";

const texto = (valor) => String(valor ?? "").trim();

const formatarEquipamento = (unidade) => {
  if (unidade.equipamento === "Balancinho") {
    return unidade.tipoBalancinho === "Manual"
      ? "Balancinho Manual"
      : "Balancinho Elétrico";
  }
  if (unidade.equipamento === "Mini Grua") {
    if (unidade.tipoMiniGrua === "500kg") return "Mini Grua 500 kg";
    if (unidade.tipoMiniGrua === "1T") return "Mini Grua 1 T";
    return unidade.tipoMiniGrua
      ? `Mini Grua ${unidade.tipoMiniGrua}`
      : "Mini Grua";
  }
  return texto(unidade.equipamento) || "Equipamento";
};

const ordemEquipamento = (equipamento) => {
  const ordem = [
    "Balancinho Elétrico",
    "Balancinho Manual",
    "Mini Grua 500 kg",
    "Mini Grua 1 T",
  ];
  const indice = ordem.indexOf(equipamento);
  return indice < 0 ? ordem.length : indice;
};

const compararPatrimonio = (a, b) => {
  if (a === "-" && b !== "-") return 1;
  if (a !== "-" && b === "-") return -1;
  const numeroA = Number(a);
  const numeroB = Number(b);
  if (Number.isFinite(numeroA) && Number.isFinite(numeroB) && numeroA !== numeroB) {
    return numeroA - numeroB;
  }
  return a.localeCompare(b, "pt-BR", { numeric: true });
};

const criarResumo = (linhas) => {
  const resumo = {
    eletricos: linhas.filter((linha) => linha.equipamento === "Balancinho Elétrico").length,
    manuais: linhas.filter((linha) => linha.equipamento === "Balancinho Manual").length,
    miniGruas500: linhas.filter((linha) => linha.equipamento === "Mini Grua 500 kg").length,
    miniGruas1T: linhas.filter((linha) => linha.equipamento === "Mini Grua 1 T").length,
    kitsContrapeso: linhas.filter((linha) => linha.usaContrapeso).length,
  };
  const categorias = [
    { chave: "eletricos", rotulo: "Balancinhos Elétricos", quantidade: resumo.eletricos },
    { chave: "manuais", rotulo: "Balancinhos Manuais", quantidade: resumo.manuais },
    { chave: "miniGruas500", rotulo: "Mini Gruas 500 kg", quantidade: resumo.miniGruas500 },
    { chave: "miniGruas1T", rotulo: "Mini Gruas 1 T", quantidade: resumo.miniGruas1T },
    { chave: "kitsContrapeso", rotulo: "Kits Contrapeso", quantidade: resumo.kitsContrapeso },
  ].filter((categoria) => categoria.quantidade > 0);
  return {
    ...resumo,
    categorias,
    totalEquipamentos: linhas.length,
    totalGeral: linhas.length + resumo.kitsContrapeso,
  };
};

export const montarEquipamentosPorObra = ({
  obra,
  atividades = [],
  registrosPatrimonio = [],
  equipamentosMestres = [],
}) => {
  if (!obra) return { linhas: [], totalEquipamentos: 0, totalKitsContrapeso: 0 };

  const unidades = obterUnidadesEquipamentosAtivos(
    obra,
    atividades,
    registrosPatrimonio,
    equipamentosMestres
  );
  const identidades = new Set();
  const linhas = unidades
    .filter((unidade, indice) => {
      const identidade = obterIdentidadeCanonicaUnidade(unidade, `unidade:${indice}`);
      if (identidades.has(identidade)) return false;
      identidades.add(identidade);
      return true;
    })
    .map((unidade) => {
      return {
        identidade: obterIdentidadeCanonicaUnidade(unidade),
        equipamento: formatarEquipamento(unidade),
        patrimonio: texto(unidade.numeroPatrimonio) || "-",
        usaContrapeso:
          unidade.equipamento === "Balancinho" && unidade.usaContrapeso === true,
      };
    })
    .sort((a, b) => {
      const grupo = ordemEquipamento(a.equipamento) - ordemEquipamento(b.equipamento);
      if (grupo) return grupo;
      const patrimonio = compararPatrimonio(a.patrimonio, b.patrimonio);
      if (patrimonio) return patrimonio;
      return a.identidade.localeCompare(b.identidade, "pt-BR", { numeric: true });
    });

  const resumo = criarResumo(linhas);
  return { linhas, resumo, ...resumo, totalKitsContrapeso: resumo.kitsContrapeso };
};

const normalizar = (valor) => texto(valor).toLocaleLowerCase("pt-BR");

const obraPertenceConstrutora = (obra, construtora) =>
  obra?.construtoraId
    ? String(obra.construtoraId) === String(construtora?.id)
    : normalizar(obra?.construtora) === normalizar(construtora?.nome);

export const montarRelatorioGeralEquipamentos = ({
  construtoras = [],
  obras = [],
  atividades = [],
  registrosPatrimonio = [],
  equipamentosMestres = [],
}) => {
  const grupos = construtoras
    .map((construtora) => ({
      construtora,
      obras: obras
        .filter((obra) => obraPertenceConstrutora(obra, construtora))
        .map((obra) => ({
          obra,
          ...montarEquipamentosPorObra({
            obra,
            atividades,
            registrosPatrimonio,
            equipamentosMestres,
          }),
        }))
        .filter((item) => item.linhas.length > 0),
    }))
    .filter((grupo) => grupo.obras.length > 0);

  const todasLinhas = grupos.flatMap((grupo) =>
    grupo.obras.flatMap((item) => item.linhas)
  );
  return { grupos, resumoGeral: criarResumo(todasLinhas) };
};
