import { describe, expect, it } from "vitest";
import {
  aplicarVinculoPatrimonialPosterior,
  atividadeTemPatrimonioPendente,
  obterPendenciasOperacionais,
  obterQuantidadeVinculosPendentes,
  obterResumoVinculoPatrimonial,
} from "../pendenciasOperacionais";
import { obterMovimentosLocacao } from "../locacaoFinanceira";

const obra = { id: "obra-a", nome: "Obra A", construtora: "Construtora A" };

const entradaPendente = ({
  id = "entrada-1",
  servico = "Somente aluguel",
  quantidade = 1,
  itensEquipamentos,
} = {}) => ({
  id,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  servico,
  iniciaLocacao: true,
  encerraLocacao: false,
  dataAgendamento: "2026-09-01",
  dataLiberacao: "2026-09-01",
  quantidade,
  numerosPatrimonio: Array.from({ length: quantidade }, () => ""),
  pendenteVinculoPatrimonio: true,
  statusVinculoPatrimonio: "PENDENTE",
  ...(itensEquipamentos ? { itensEquipamentos } : {}),
});

const itemPendente = (idItem) => ({
  idItem,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  numeroPatrimonio: "",
  idEquipamento: "",
  statusVinculoPatrimonio: "PENDENTE",
});

const registro = (idItem, numeroPatrimonioAtual, historico = []) => ({
  idItem,
  numeroPatrimonioAtual,
  historico,
});

const contexto = (atividades, registrosPatrimonio = []) => ({
  atividades,
  obras: [obra],
  registrosPatrimonio,
  equipamentosMestres: [],
});

const saida = (servico = "Remoção") => ({
  id: `saida-${servico}`,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  servico,
  iniciaLocacao: false,
  encerraLocacao: true,
  dataLiberacao: "2026-09-15",
  quantidade: 1,
  pendenteVinculoPatrimonio: false,
  statusVinculoPatrimonio: "NAO_APLICAVEL",
});

const operacaoPendente = (servico) => ({
  id: `operacao-${servico}`,
  obraId: obra.id,
  obra: obra.nome,
  construtora: obra.construtora,
  equipamento: "Balancinho",
  tipoBalancinho: "Eletrico",
  servico,
  iniciaLocacao: false,
  encerraLocacao: ["Remoção", "Somente recolhimento"].includes(servico),
  dataLiberacao: "2026-09-10",
  quantidade: 1,
  pendenteVinculoPatrimonio: true,
  statusVinculoPatrimonio: "PENDENTE",
  itensEquipamentos: [itemPendente(`pendente-${servico}`)],
});

const entradaIndividual = () => ({
  ...entradaPendente({
    id: "entrada-individual",
    servico: "Instalação",
    itensEquipamentos: [{
      idItem: "item-0100",
      idEquipamento: "equipamento-0100",
      equipamento: "Balancinho",
      tipoBalancinho: "Eletrico",
      numeroPatrimonio: "0100",
      statusVinculoPatrimonio: "VINCULADO",
    }],
  }),
  pendenteVinculoPatrimonio: false,
  statusVinculoPatrimonio: "VINCULADO",
  numerosPatrimonio: ["0100"],
});

describe("Pendências Operacionais pelo estado patrimonial atual", () => {
  it("mantém pendente uma entrada ativa sem patrimônio", () => {
    const entrada = entradaPendente();
    expect(atividadeTemPatrimonioPendente(entrada, contexto([entrada]))).toBe(true);
  });

  it("vínculo posterior pela Pendência elimina a pendência", () => {
    const entrada = entradaPendente({ itensEquipamentos: [itemPendente("item-pendente")] });
    const atualizadas = aplicarVinculoPatrimonialPosterior({
      atividades: [entrada],
      atividadeId: entrada.id,
      idItem: "item-pendente",
      unidade: {
        idUnidade: "origem-0142",
        idEquipamento: "equipamento-0142",
        numeroPatrimonio: "0142",
        equipamento: "Balancinho",
        tipoBalancinho: "Eletrico",
      },
    });
    expect(atividadeTemPatrimonioPendente(atualizadas[0], contexto(atualizadas))).toBe(false);
  });

  it("vínculo exclusivo da Conferência elimina a pendência", () => {
    const entrada = entradaPendente({ itensEquipamentos: [itemPendente("item-pendente")] });
    const dados = contexto([entrada], [registro("item-pendente", "0142")]);
    expect(atividadeTemPatrimonioPendente(entrada, dados)).toBe(false);
  });

  it("reconhece identidade legada registrada pela Conferência", () => {
    const entrada = entradaPendente({ id: "atividade-123" });
    const dados = contexto([entrada], [registro("legado:atividade-123:0", "0142")]);
    expect(atividadeTemPatrimonioPendente(entrada, dados)).toBe(false);
  });

  it("patrimônio de outra unidade da mesma obra não resolve a pendência", () => {
    const entrada = entradaPendente({ id: "atividade-123" });
    const dados = contexto([entrada], [registro("legado:outra-atividade:0", "0142")]);
    expect(atividadeTemPatrimonioPendente(entrada, dados)).toBe(true);
  });

  it("mantém parcial atividade com duas unidades e somente uma conferida", () => {
    const entrada = entradaPendente({ id: "dupla", quantidade: 2 });
    const resumo = obterResumoVinculoPatrimonial(
      entrada,
      contexto([entrada], [registro("legado:dupla:0", "0140")])
    );
    expect(resumo).toMatchObject({ total: 2, vinculados: 1, pendentes: 1, status: "PARCIAL" });
  });

  it("informa corretamente uma unidade pendente no resumo parcial", () => {
    const entrada = entradaPendente({ id: "dupla", quantidade: 2 });
    const dados = contexto([entrada], [registro("legado:dupla:1", "0141")]);
    expect(obterQuantidadeVinculosPendentes(entrada, dados)).toBe(1);
  });

  it("entrada removida deixa de ser pendência atual", () => {
    const entrada = entradaPendente();
    const atividades = [entrada, saida("Remoção")];
    expect(atividadeTemPatrimonioPendente(entrada, contexto(atividades))).toBe(false);
  });

  it("entrada recolhida deixa de ser pendência atual", () => {
    const entrada = entradaPendente();
    const atividades = [entrada, saida("Somente recolhimento")];
    expect(atividadeTemPatrimonioPendente(entrada, contexto(atividades))).toBe(false);
  });

  it("troca usa o numeroPatrimonioAtual vigente", () => {
    const entrada = entradaPendente({ id: "troca" });
    const dados = contexto([entrada], [registro("legado:troca:0", "0159", [{
      tipo: "troca",
      numeroAnterior: "0142",
      numeroNovo: "0159",
    }])]);
    expect(atividadeTemPatrimonioPendente(entrada, dados)).toBe(false);
  });

  it("histórico sem patrimônio atual não resolve a pendência", () => {
    const entrada = entradaPendente({ id: "historico" });
    const dados = contexto([entrada], [registro("legado:historico:0", "", [{
      tipo: "cadastro_inicial",
      numeroNovo: "0142",
    }])]);
    expect(atividadeTemPatrimonioPendente(entrada, dados)).toBe(true);
  });

  it("Somente aluguel ativo sem patrimônio continua pendente", () => {
    const entrada = entradaPendente({ servico: "Somente aluguel" });
    expect(obterPendenciasOperacionais([entrada], contexto([entrada]))).toHaveLength(1);
  });

  it("Somente aluguel conferido deixa de ser pendente", () => {
    const entrada = entradaPendente({ id: "aluguel-conferido" });
    const dados = contexto([entrada], [registro("legado:aluguel-conferido:0", "0142")]);
    expect(obterPendenciasOperacionais([entrada], dados)).toHaveLength(0);
  });

  it("Somente aluguel recolhido deixa de ser pendência atual", () => {
    const entrada = entradaPendente({ id: "aluguel-recolhido" });
    const atividades = [entrada, saida("Somente recolhimento")];
    expect(obterPendenciasOperacionais(atividades, contexto(atividades))).toHaveLength(0);
  });

  it("Deslocamento mantém a validação temporal existente", () => {
    const entrada = entradaIndividual();
    const operacao = operacaoPendente("Deslocamento");
    expect(atividadeTemPatrimonioPendente(operacao, contexto([entrada, operacao]))).toBe(true);
  });

  it("Manutenção mantém a validação temporal existente", () => {
    const entrada = entradaIndividual();
    const operacao = operacaoPendente("Manutenção");
    expect(atividadeTemPatrimonioPendente(operacao, contexto([entrada, operacao]))).toBe(true);
  });

  it("Remoção mantém a validação temporal existente", () => {
    const entrada = entradaIndividual();
    const operacao = operacaoPendente("Remoção");
    expect(atividadeTemPatrimonioPendente(operacao, contexto([entrada, operacao]))).toBe(true);
  });

  it("Somente recolhimento mantém a validação temporal existente", () => {
    const entrada = entradaIndividual();
    const operacao = operacaoPendente("Somente recolhimento");
    expect(atividadeTemPatrimonioPendente(operacao, contexto([entrada, operacao]))).toBe(true);
  });

  it("lista, resumo e verificação individual produzem a mesma quantidade", () => {
    const entrada = entradaPendente({ id: "dupla", quantidade: 2 });
    const dados = contexto([entrada], [registro("legado:dupla:0", "0140")]);
    const pendencias = obterPendenciasOperacionais([entrada], dados);
    expect(pendencias).toHaveLength(1);
    expect(pendencias[0].resumo.pendentes).toBe(1);
    expect(obterQuantidadeVinculosPendentes(entrada, dados)).toBe(1);
    expect(atividadeTemPatrimonioPendente(entrada, dados)).toBe(true);
  });

  it("não modifica a atividade original ao apurar a pendência", () => {
    const entrada = entradaPendente({ id: "imutavel" });
    const anterior = structuredClone(entrada);
    obterPendenciasOperacionais([entrada], contexto([entrada], [registro("legado:imutavel:0", "0142")]));
    expect(entrada).toEqual(anterior);
  });

  it("não modifica datas da atividade", () => {
    const entrada = entradaPendente({ id: "datas" });
    atividadeTemPatrimonioPendente(entrada, contexto([entrada]));
    expect(entrada).toMatchObject({ dataAgendamento: "2026-09-01", dataLiberacao: "2026-09-01" });
  });

  it("não modifica movimentos, períodos ou valores da locação", () => {
    const entrada = { ...entradaPendente({ id: "financeiro" }), valorMensalLocacao: 1234.56 };
    const movimentosAntes = obterMovimentosLocacao(entrada);
    const valorAntes = entrada.valorMensalLocacao;
    atividadeTemPatrimonioPendente(entrada, contexto([entrada]));
    expect(obterMovimentosLocacao(entrada)).toEqual(movimentosAntes);
    expect(entrada.valorMensalLocacao).toBe(valorAntes);
  });
});
