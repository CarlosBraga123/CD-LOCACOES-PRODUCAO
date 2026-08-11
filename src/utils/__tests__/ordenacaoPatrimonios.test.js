import { describe, expect, it } from "vitest";
import { ordenarPatrimoniosNumerados } from "../ordenacao";

describe("ordenação visual de patrimônios", () => {
  it("ordena numericamente e preserva os zeros à esquerda", () => {
    const itens = ["0100", "0009", "0101", "0010", "0099"].map(
      (numeroPatrimonio) => ({ numeroPatrimonio })
    );

    expect(
      ordenarPatrimoniosNumerados(itens).map((item) => item.numeroPatrimonio)
    ).toEqual(["0009", "0010", "0099", "0100", "0101"]);
  });

  it("mantém itens sem patrimônio em suas posições atuais", () => {
    const semPatrimonio = { id: "legado", numeroPatrimonio: "" };
    const itens = [
      { numeroPatrimonio: "0100" },
      semPatrimonio,
      { numeroPatrimonio: "0007" },
    ];
    const ordenados = ordenarPatrimoniosNumerados(itens);

    expect(ordenados[1]).toBe(semPatrimonio);
    expect(ordenados.map((item) => item.numeroPatrimonio)).toEqual([
      "0007",
      "",
      "0100",
    ]);
  });
});
