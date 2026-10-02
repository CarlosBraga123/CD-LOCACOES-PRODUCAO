import { describe, expect, it } from "vitest";
import {
  atividadeEhServicoFaturavel,
  obterValorEfetivoServico,
} from "../financeiroAtividades";
import { consolidarFechamentoMensal } from "../fechamentoMensal";

const atividade = (servico, totalServico = 100) => ({
  id: `${servico}-${totalServico}`,
  obraId: "obra-1",
  construtora: "Construtora",
  obra: "Obra",
  equipamento: "Balancinho",
  servico,
  quantidade: 1,
  valoresCongelados: { totalServico },
});

describe("serviços faturáveis do fechamento mensal", () => {
  it("exclui Manutenção com valor efetivo zero", () => {
    expect(atividadeEhServicoFaturavel(atividade("Manutenção", 0))).toBe(false);
  });

  it("inclui Manutenção com valor efetivo maior que zero", () => {
    expect(atividadeEhServicoFaturavel(atividade("Manutenção", 150))).toBe(true);
  });

  it("exclui Somente aluguel", () => {
    expect(atividadeEhServicoFaturavel(atividade("Somente aluguel", 150))).toBe(false);
  });

  it("exclui Somente recolhimento", () => {
    expect(atividadeEhServicoFaturavel(atividade("Somente recolhimento", 150))).toBe(false);
  });

  it.each(["Instalação", "Deslocamento", "Ascensão", "Remoção"])(
    "mantém %s como serviço faturável",
    (servico) => {
      expect(atividadeEhServicoFaturavel(atividade(servico))).toBe(true);
    }
  );

  it("respeita valor congelado zero sem recorrer ao fallback", () => {
    const manutencao = atividade("Manutenção", 0);
    expect(
      obterValorEfetivoServico(manutencao, {
        valoresServicos: { "Balancinho-Manutenção": 500 },
      }).valor
    ).toBe(0);
  });
});

describe("consolidação do fechamento mensal", () => {
  it("calcula total geral como serviços mais locações", () => {
    const instalacao = atividade("Instalação", 300);
    const resultado = consolidarFechamentoMensal({
      atividadesServicos: [instalacao],
      periodosLocacao: [
        {
          chaveObra: "obraId:obra-1",
          obraId: "obra-1",
          construtora: "Construtora",
          obra: "Obra",
          valorProporcional: 700,
        },
      ],
      obras: [
        { id: "obra-1", nome: "Obra", construtora: "Construtora" },
      ],
      obterValorServico: (item) => obterValorEfetivoServico(item),
    });

    expect(resultado.totais).toEqual({
      totalServicos: 300,
      totalLocacoes: 700,
      totalGeral: 1000,
    });
    expect(resultado.obras[0].totalGeral).toBe(
      resultado.obras[0].totalServicos + resultado.obras[0].totalLocacoes
    );
  });
});
