export const EQUIPAMENTOS_OPERACAO = {
  BALANCINHO: "Balancinho",
  MINI_GRUA: "Mini Grua",
};

export const OPERACOES = [
  {
    nome: "Instalação",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.BALANCINHO, EQUIPAMENTOS_OPERACAO.MINI_GRUA],
    cobraServico: true,
    iniciaLocacao: true,
    encerraLocacao: false,
  },
  {
    nome: "Deslocamento",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.BALANCINHO],
    cobraServico: true,
    iniciaLocacao: false,
    encerraLocacao: false,
  },
  {
    nome: "Ascensão",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.MINI_GRUA],
    cobraServico: true,
    iniciaLocacao: false,
    encerraLocacao: false,
  },
  {
    nome: "Manutenção",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.BALANCINHO, EQUIPAMENTOS_OPERACAO.MINI_GRUA],
    cobraServico: true,
    iniciaLocacao: false,
    encerraLocacao: false,
  },
  {
    nome: "Remoção",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.BALANCINHO, EQUIPAMENTOS_OPERACAO.MINI_GRUA],
    cobraServico: true,
    iniciaLocacao: false,
    encerraLocacao: true,
  },
  {
    nome: "Somente aluguel",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.BALANCINHO, EQUIPAMENTOS_OPERACAO.MINI_GRUA],
    cobraServico: false,
    iniciaLocacao: true,
    encerraLocacao: false,
  },
  {
    nome: "Somente recolhimento",
    equipamentosPermitidos: [EQUIPAMENTOS_OPERACAO.BALANCINHO, EQUIPAMENTOS_OPERACAO.MINI_GRUA],
    cobraServico: false,
    iniciaLocacao: false,
    encerraLocacao: true,
  },
];

export const obterOperacoes = (equipamento) => {
  return OPERACOES.filter((operacao) =>
    operacao.equipamentosPermitidos.includes(equipamento)
  );
};

export const obterRegraOperacao = (equipamento, servico) => {
  return obterOperacoes(equipamento).find((operacao) => operacao.nome === servico) || null;
};
