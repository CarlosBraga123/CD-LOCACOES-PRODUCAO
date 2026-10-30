import { atividadePertenceObra } from './obras';

export const KIT_INDEPENDENTE = 'Kit Contrapeso';
export const ehKitIndependente = atividade => atividade?.equipamento === KIT_INDEPENDENTE;
export const SERVICOS_KIT = ['Somente aluguel', 'Somente recolhimento'];

// Só os novos registros desta categoria: acessórios de Balancinho nunca entram.
export const saldoKitsIndependentes = (atividades, obra, ate = '9999-12-31') =>
  atividades.filter(a => ehKitIndependente(a) && atividadePertenceObra(a, obra) && a.dataLiberacao && a.dataLiberacao <= ate)
    .reduce((saldo, a) => saldo + (a.servico === 'Somente aluguel' ? 1 : a.servico === 'Somente recolhimento' ? -1 : 0) * Number(a.quantidade), 0);

export const validarKitIndependente = (atividade, atividades, obra) => {
  if (!ehKitIndependente(atividade)) return;
  if (!SERVICOS_KIT.includes(atividade.servico)) throw Error('Kit Contrapeso permite somente aluguel ou recolhimento.');
  if (!Number.isInteger(Number(atividade.quantidade)) || Number(atividade.quantidade) < 1) throw Error('Informe uma quantidade inteira de kits maior que zero.');
  if (!atividade.dataLiberacao) return; // Agendamento não movimenta saldo.
  const eventos = atividades.filter(a => String(a.id) !== String(atividade.id) && ehKitIndependente(a) && atividadePertenceObra(a, obra) && a.dataLiberacao);
  eventos.push(atividade);
  // Validar por dia também protege edições retroativas e saídas posteriores.
  let saldo = 0;
  for (const data of [...new Set(eventos.map(a => a.dataLiberacao))].sort()) {
    saldo += eventos.filter(a => a.dataLiberacao === data).reduce((n, a) => n + (a.servico === 'Somente aluguel' ? 1 : -1) * Number(a.quantidade), 0);
    if (saldo < 0) throw Error('Recolhimento superior ao saldo de kits independentes da obra na data informada.');
  }
};
