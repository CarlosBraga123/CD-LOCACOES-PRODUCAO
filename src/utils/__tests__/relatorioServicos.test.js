import { describe, expect, it } from "vitest";
import { consolidarRelatorioServicos } from "../relatorioServicos";

const criarAtividade = (servico, valor = 100, extras = {}) => ({
  id: `${servico}-${valor}`,
  servico,
  equipamento: "Balancinho",
  quantidade: 1,
  dataLiberacao: "2026-08-10",
  valoresCongelados: { totalServico: valor },
  ...extras,
});

describe("Relatório de Serviços", () => {
  it.each(["Instalação", "Deslocamento", "Ascensão", "Remoção"])(
    "inclui e soma %s",
    (servico) => {
      const relatorio = consolidarRelatorioServicos({
        atividades: [criarAtividade(servico, 250, { quantidade: 2 })],
      });
      expect(relatorio.resumo[0]).toMatchObject({
        servico,
        quantidade: 2,
        valor: 250,
      });
      expect(relatorio.totalServicos).toBe(250);
    }
  );

  it("inclui Manutenção com valor efetivo maior que zero", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [criarAtividade("Manutenção", 450)],
    });
    expect(relatorio.detalhes).toHaveLength(1);
    expect(relatorio.totalServicos).toBe(450);
  });

  it("exclui Manutenção com valor efetivo zero", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [criarAtividade("Manutenção", 0)],
    });
    expect(relatorio.detalhes).toHaveLength(0);
  });

  it.each(["Somente aluguel", "Somente recolhimento"])(
    "exclui %s",
    (servico) => {
      const relatorio = consolidarRelatorioServicos({
        atividades: [criarAtividade(servico, 500)],
      });
      expect(relatorio.detalhes).toHaveLength(0);
    }
  );

  it("mantém o total do resumo igual à soma do detalhamento", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [
        criarAtividade("Instalação", 100),
        criarAtividade("Deslocamento", 200),
        criarAtividade("Manutenção", 300),
      ],
    });
    const totalResumo = relatorio.resumo.reduce(
      (total, item) => total + item.valor,
      0
    );
    const totalDetalhes = relatorio.detalhes.reduce(
      (total, item) => total + item.valor,
      0
    );
    expect(totalResumo).toBe(totalDetalhes);
    expect(relatorio.totalServicos).toBe(totalDetalhes);
  });

  it("usa o mesmo valor efetivo congelado utilizado pelo Fechamento Mensal", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [criarAtividade("Instalação", 835)],
      valoresServicos: { "Balancinho-Instalação": 9999 },
    });
    expect(relatorio.totalServicos).toBe(835);
    expect(relatorio.detalhes[0].origemValor).toBe("Congelado");
  });

  it("aceita OS de campo e patrimônio ausentes sem erro", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [criarAtividade("Instalação", 100)],
    });
    expect(relatorio.detalhes[0].numeroOsCampo).toBe("");
    expect(relatorio.detalhes[0].patrimonios).toEqual([]);
  });

  it("preserva múltiplos patrimônios e detalhes de deslocamento", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [
        criarAtividade("Deslocamento", 200, {
          quantidade: 2,
          itensEquipamentos: [
            { numeroPatrimonio: "0102", tamanhoAnterior: "3", tamanhoNovo: "5" },
            { numeroPatrimonio: "0103", tamanhoAnterior: "6", tamanhoNovo: "8" },
          ],
        }),
      ],
    });
    expect(relatorio.detalhes[0].patrimonios).toEqual(["0102", "0103"]);
    expect(relatorio.detalhes[0].detalhes).toEqual(["3 m → 5 m", "6 m → 8 m"]);
  });

  it("preserva tamanho anterior e novo no deslocamento legado", () => {
    const relatorio = consolidarRelatorioServicos({
      atividades: [
        criarAtividade("Deslocamento", 200, {
          tamanho: "5",
          tamanhoAnterior: "3",
          tamanhoNovo: "5",
        }),
      ],
    });
    expect(relatorio.detalhes[0].detalhes).toEqual(["3 m → 5 m"]);
  });
});
