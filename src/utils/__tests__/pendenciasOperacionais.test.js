import { describe, expect, it } from "vitest";
import { obterUnidadesEquipamentosAtivos } from "../equipamentosAtivos";
import {
  aplicarVinculoPatrimonialPosterior,
  atividadeTemPatrimonioPendente,
  obterAtividadesAnterioresAoVinculo,
  obterCandidatosVinculoPatrimonial,
} from "../pendenciasOperacionais";
import { obterMovimentosLocacao } from "../locacaoFinanceira";
import { fixtureJoseRochaCardsDuplicados } from "./fixtures/locacaoFixtures";

const obra = {
  id: "obra-rio-branco",
  nome: "Rio Branco",
  construtora: "JOSE ROCHA",
};

const entrada = ({
  id = "entrada",
  quantidade = 1,
  tipoBalancinho = "Eletrico",
  itensEquipamentos,
} = {}) => ({
  id,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho,
  servico: "Instalação",
  iniciaLocacao: true,
  encerraLocacao: false,
  dataLiberacao: "2026-07-01",
  quantidade,
  ...(itensEquipamentos ? { itensEquipamentos } : {}),
});

const encerramentoPendente = ({
  id = "saida",
  servico = "Remoção",
  tipoBalancinho = "Eletrico",
  quantidade = 1,
} = {}) => ({
  id,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho,
  servico,
  iniciaLocacao: false,
  encerraLocacao: true,
  dataLiberacao: "2026-07-15",
  quantidade,
  pendenteVinculoPatrimonio: true,
  statusVinculoPatrimonio: "PENDENTE",
  itensEquipamentos: Array.from({ length: quantidade }, (_, indice) => ({
    idItem: `pendente-${indice}`,
    equipamento: "Balancinho",
    tipoBalancinho,
    numeroPatrimonio: "",
    idEquipamento: "",
  })),
});

const operacaoPendente = ({
  id = "200",
  servico = "Deslocamento",
  tipoBalancinho = "Eletrico",
  quantidade = 1,
  dataLiberacao = "2026-07-15",
  criadoEm,
} = {}) => ({
  ...encerramentoPendente({ id, servico, tipoBalancinho, quantidade }),
  encerraLocacao: ["Remoção", "Somente recolhimento"].includes(servico),
  dataLiberacao,
  ...(criadoEm ? { criadoEm } : {}),
  tamanhoAnterior: "3",
  tamanhoNovo: "6",
});

const entradaIndividual = ({
  id = "100",
  patrimonios = ["0100"],
  tipoBalancinho = "Eletrico",
  dataLiberacao = "2026-07-01",
  criadoEm,
} = {}) => ({
  ...entrada({
    id,
    tipoBalancinho,
    itensEquipamentos: patrimonios.map((patrimonio) => ({
      idItem: `item-${patrimonio}`,
      idEquipamento: `equipamento-${patrimonio}`,
      equipamento: "Balancinho",
      tipoBalancinho,
      numeroPatrimonio: patrimonio,
    })),
  }),
  dataLiberacao,
  ...(criadoEm ? { criadoEm } : {}),
});

const contexto = (atividades) => ({
  atividades,
  obras: [obra],
  registrosPatrimonio: [],
  equipamentosMestres: [],
});

describe("pendências patrimoniais vinculáveis", () => {
  it("não classifica remoção de obra totalmente legada e preserva a saída quantitativa", () => {
    const instalacao = entrada({ quantidade: 5 });
    const remocao = {
      ...encerramentoPendente(),
      pendenteVinculoPatrimonio: false,
      statusVinculoPatrimonio: "NAO_APLICAVEL",
      itensEquipamentos: undefined,
    };
    expect(
      atividadeTemPatrimonioPendente(
        encerramentoPendente(),
        contexto([instalacao, encerramentoPendente()])
      )
    ).toBe(false);
    expect(
      obterUnidadesEquipamentosAtivos(
        obra,
        [instalacao, remocao],
        [],
        []
      )
    ).toHaveLength(4);
  });

  it("mantém pendência quando existe unidade individualizada compatível", () => {
    const instalacao = entrada({
      itensEquipamentos: [
        {
          idItem: "item-0100",
          idEquipamento: "equipamento-0100",
          equipamento: "Balancinho",
          tipoBalancinho: "Eletrico",
          numeroPatrimonio: "0100",
        },
      ],
    });
    const remocao = encerramentoPendente();
    const dados = contexto([instalacao, remocao]);
    expect(obterCandidatosVinculoPatrimonial({ atividade: remocao, ...dados }))
      .toHaveLength(1);
    expect(atividadeTemPatrimonioPendente(remocao, dados)).toBe(true);
  });

  it("em obra mista considera somente candidatos compatíveis", () => {
    const legadoEletrico = entrada({ id: "legado-eletrico", quantidade: 2 });
    const manualIndividual = entrada({
      id: "manual-individual",
      tipoBalancinho: "Manual",
      itensEquipamentos: [
        {
          idItem: "item-manual",
          idEquipamento: "equipamento-manual",
          equipamento: "Balancinho",
          tipoBalancinho: "Manual",
          numeroPatrimonio: "0200",
        },
      ],
    });
    const remocaoEletrica = encerramentoPendente();
    const dados = contexto([legadoEletrico, manualIndividual, remocaoEletrica]);
    expect(obterCandidatosVinculoPatrimonial({ atividade: remocaoEletrica, ...dados }))
      .toHaveLength(0);
    expect(atividadeTemPatrimonioPendente(remocaoEletrica, dados)).toBe(false);
  });

  it("não classifica Somente recolhimento legado sem candidato", () => {
    const instalacao = entrada({ quantidade: 3 });
    const recolhimento = encerramentoPendente({ servico: "Somente recolhimento" });
    expect(
      atividadeTemPatrimonioPendente(
        recolhimento,
        contexto([instalacao, recolhimento])
      )
    ).toBe(false);
  });

  it("preserva pendência existente quando o patrimônio continua vinculável", () => {
    const instalacao = entrada({
      itensEquipamentos: [
        {
          idItem: "item-0101",
          idEquipamento: "equipamento-0101",
          equipamento: "Balancinho",
          tipoBalancinho: "Eletrico",
          numeroPatrimonio: "0101",
        },
      ],
    });
    const remocao = encerramentoPendente();
    expect(
      atividadeTemPatrimonioPendente(
        remocao,
        contexto([instalacao, remocao])
      )
    ).toBe(true);
  });

  it("José Rocha / Rio Branco não aparece como pendência no fluxo puramente legado", () => {
    const remocaoJoseRocha = fixtureJoseRochaCardsDuplicados.atividades.find(
      (atividade) => atividade.id === "saida-agosto-pendente"
    );
    expect(
      atividadeTemPatrimonioPendente(
        remocaoJoseRocha,
        {
          atividades: fixtureJoseRochaCardsDuplicados.atividades,
          obras: fixtureJoseRochaCardsDuplicados.obras,
          registrosPatrimonio: [],
          equipamentosMestres: [],
        }
      )
    ).toBe(false);
  });

  it("Therezinha: Deslocamento legado não gera pendência nem candidatos", () => {
    const instalacao = entrada({ id: "therezinha-entrada", quantidade: 3 });
    const deslocamento = operacaoPendente({ id: "therezinha-deslocamento" });
    const dados = contexto([instalacao, deslocamento]);

    expect(obterCandidatosVinculoPatrimonial({ atividade: deslocamento, ...dados }))
      .toHaveLength(0);
    expect(atividadeTemPatrimonioPendente(deslocamento, dados)).toBe(false);
  });

  it("Infinity: Deslocamento individualizado lista as três unidades anteriores", () => {
    const instalacao = entradaIndividual({ patrimonios: ["0100", "0101", "0102"] });
    const deslocamento = operacaoPendente();
    const dados = contexto([instalacao, deslocamento]);
    const candidatos = obterCandidatosVinculoPatrimonial({
      atividade: deslocamento,
      ...dados,
    });

    expect(candidatos.map((item) => item.numeroPatrimonio).sort()).toEqual([
      "0100",
      "0101",
      "0102",
    ]);
    expect(atividadeTemPatrimonioPendente(deslocamento, dados)).toBe(true);
  });

  it("exclui a própria atividade pendente da reconstrução anterior", () => {
    const instalacao = entradaIndividual({ patrimonios: ["0100", "0101", "0102"] });
    const deslocamento = operacaoPendente();
    const atividades = [instalacao, deslocamento];

    expect(obterAtividadesAnterioresAoVinculo(atividades, deslocamento))
      .toEqual([instalacao]);
    expect(
      obterCandidatosVinculoPatrimonial({
        atividade: deslocamento,
        ...contexto(atividades),
      })
    ).toHaveLength(3);
  });

  it("ordena atividades do mesmo dia por timestamp e usa o ID como desempate", () => {
    const entradaAntes = entradaIndividual({
      id: "900",
      dataLiberacao: "2026-07-15",
      criadoEm: "2026-07-15T08:00:00.000Z",
    });
    const deslocamento = operacaoPendente({
      id: "100",
      dataLiberacao: "2026-07-15",
      criadoEm: "2026-07-15T09:00:00.000Z",
    });
    const posterior = operacaoPendente({
      id: "050",
      dataLiberacao: "2026-07-15",
      criadoEm: "2026-07-15T10:00:00.000Z",
    });
    const semTimestampAntes = entrada({ id: "2", dataLiberacao: "2026-07-16" });
    const semTimestampReferencia = operacaoPendente({ id: "10", dataLiberacao: "2026-07-16" });

    expect(
      obterAtividadesAnterioresAoVinculo(
        [entradaAntes, deslocamento, posterior],
        deslocamento
      )
    ).toEqual([entradaAntes]);
    expect(
      obterAtividadesAnterioresAoVinculo(
        [semTimestampReferencia, semTimestampAntes],
        semTimestampReferencia
      )
    ).toEqual([semTimestampAntes]);
  });

  it.each(["Manutenção", "Remoção", "Somente recolhimento"])(
    "%s: diferencia fluxo legado do individualizado",
    (servico) => {
      const legado = entrada({ quantidade: 2 });
      const individual = entradaIndividual({ patrimonios: ["0300", "0301"] });
      const operacaoLegada = operacaoPendente({ id: `legado-${servico}`, servico });
      const operacaoIndividual = operacaoPendente({ id: `individual-${servico}`, servico });

      expect(
        atividadeTemPatrimonioPendente(
          operacaoLegada,
          contexto([legado, operacaoLegada])
        )
      ).toBe(false);
      expect(
        obterCandidatosVinculoPatrimonial({
          atividade: operacaoIndividual,
          ...contexto([individual, operacaoIndividual]),
        })
      ).toHaveLength(2);
      expect(
        atividadeTemPatrimonioPendente(
          operacaoIndividual,
          contexto([individual, operacaoIndividual])
        )
      ).toBe(true);
    }
  );

  it("vínculo posterior remove a pendência sem criar movimento financeiro", () => {
    const instalacao = entradaIndividual({ patrimonios: ["0400"] });
    const deslocamento = operacaoPendente();
    const atividades = [instalacao, deslocamento];
    const [candidato] = obterCandidatosVinculoPatrimonial({
      atividade: deslocamento,
      ...contexto(atividades),
    });
    const movimentosAntes = obterMovimentosLocacao(deslocamento);
    const atualizadas = aplicarVinculoPatrimonialPosterior({
      atividades,
      atividadeId: deslocamento.id,
      unidade: candidato,
    });
    const deslocamentoVinculado = atualizadas.find(
      (atividade) => atividade.id === deslocamento.id
    );

    expect(atividadeTemPatrimonioPendente(deslocamentoVinculado)).toBe(false);
    expect(obterMovimentosLocacao(deslocamentoVinculado)).toEqual(movimentosAntes);
  });
});
