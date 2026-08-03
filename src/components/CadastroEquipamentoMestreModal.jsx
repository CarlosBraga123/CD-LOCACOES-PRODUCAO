import { useState } from "react";
import {
  alterarEquipamentoPatrimonio,
  criarEquipamentoPatrimonio,
  salvarEquipamentosPatrimonio,
} from "../utils/equipamentosPatrimonio";
import {
  normalizarNumeroPatrimonio,
  registrarCadastroInicialPatrimonio,
  salvarRegistrosPatrimonio,
  validarNumeroPatrimonio,
  verificarPatrimonioDuplicado,
} from "../utils/patrimoniosEquipamentos";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function CadastroEquipamentoMestreModal({
  equipamento,
  equipamentos,
  registrosPatrimonio,
  equipamentosAtivos,
  onClose,
  onSalvar,
}) {
  const [form, setForm] = useState({
    numeroPatrimonioAtual: equipamento?.numeroPatrimonioAtual || "",
    equipamento: equipamento?.equipamento || "Balancinho",
    tipoBalancinho: equipamento?.tipoBalancinho || "Eletrico",
    tipoMiniGrua: equipamento?.tipoMiniGrua || "500kg",
    situacaoAdministrativa:
      equipamento?.situacaoAdministrativa || "NO_GALPAO",
    dataCadastro: equipamento?.dataCadastro || hoje(),
    observacao: equipamento?.observacao || "",
  });
  const [salvando, setSalvando] = useState(false);
  const editar = Boolean(equipamento);

  const confirmar = () => {
    if (salvando) return;
    const numero = normalizarNumeroPatrimonio(form.numeroPatrimonioAtual);
    if (!validarNumeroPatrimonio(numero)) {
      alert("Informe um patrimônio contendo somente números.");
      return;
    }
    const repetidoMestre = equipamentos.find(
      (item) =>
        String(item.idEquipamento) !== String(equipamento?.idEquipamento || "") &&
        normalizarNumeroPatrimonio(item.numeroPatrimonioAtual) === numero
    );
    const duplicidade = verificarPatrimonioDuplicado(
      numero,
      equipamento?.idItemOrigem || "",
      registrosPatrimonio,
      equipamentosAtivos
    );
    if (repetidoMestre || duplicidade) {
      alert(
        duplicidade?.tipo === "historico"
          ? `O patrimônio ${numero} já foi utilizado anteriormente.`
          : `O patrimônio ${numero} já está vinculado a outro equipamento.`
      );
      return;
    }
    setSalvando(true);
    let novosEquipamentos;
    let novosRegistros = registrosPatrimonio;
    if (editar) {
      novosEquipamentos = alterarEquipamentoPatrimonio({
        equipamentos,
        idEquipamento: equipamento.idEquipamento,
        alteracoes: {
          equipamento: form.equipamento,
          tipoBalancinho:
            form.equipamento === "Balancinho" ? form.tipoBalancinho : "",
          tipoMiniGrua:
            form.equipamento === "Mini Grua" ? form.tipoMiniGrua : "",
          observacao: form.observacao,
        },
        data: hoje(),
        motivo: "Atualização dos dados técnicos",
        tipo: "edicao_tecnica",
      });
    } else {
      const novo = criarEquipamentoPatrimonio({
        ...form,
        numeroPatrimonioAtual: numero,
      });
      novosEquipamentos = [...equipamentos, novo];
      novosRegistros = registrarCadastroInicialPatrimonio({
        registros: registrosPatrimonio,
        item: { idItem: novo.idItemOrigem, numeroPatrimonio: "" },
        numeroNovo: numero,
        data: form.dataCadastro,
        obraId: "",
      });
    }
    salvarEquipamentosPatrimonio(novosEquipamentos);
    salvarRegistrosPatrimonio(novosRegistros);
    onSalvar(novosEquipamentos, novosRegistros);
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-xl sm:rounded-2xl">
        <div className="flex justify-between gap-3">
          <h3 className="text-lg font-bold">{editar ? "Editar equipamento" : "Novo equipamento"}</h3>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1">Fechar</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Patrimônio
            <input inputMode="numeric" disabled={editar} value={form.numeroPatrimonioAtual} onChange={(e) => setForm({ ...form, numeroPatrimonioAtual: e.target.value })} className="mt-1 w-full rounded border p-2 disabled:bg-gray-100" />
          </label>
          <label className="text-sm font-medium">Equipamento
            <select value={form.equipamento} onChange={(e) => setForm({ ...form, equipamento: e.target.value })} className="mt-1 w-full rounded border p-2"><option>Balancinho</option><option>Mini Grua</option></select>
          </label>
          {form.equipamento === "Balancinho" ? <>
            <label className="text-sm font-medium">Tipo
              <select value={form.tipoBalancinho} onChange={(e) => setForm({ ...form, tipoBalancinho: e.target.value })} className="mt-1 w-full rounded border p-2"><option value="Eletrico">Elétrico</option><option>Manual</option></select>
            </label>
          </> : <label className="text-sm font-medium">Tipo
            <select value={form.tipoMiniGrua} onChange={(e) => setForm({ ...form, tipoMiniGrua: e.target.value })} className="mt-1 w-full rounded border p-2"><option value="500kg">500 kg</option><option value="1T">1 T</option></select>
          </label>}
          {!editar && <label className="text-sm font-medium">Situação inicial
            <select value={form.situacaoAdministrativa} onChange={(e) => setForm({ ...form, situacaoAdministrativa: e.target.value })} className="mt-1 w-full rounded border p-2"><option value="NO_GALPAO">No galpão</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponível</option></select>
          </label>}
          <label className="text-sm font-medium">Data de cadastro
            <input type="date" disabled={editar} value={form.dataCadastro} onChange={(e) => setForm({ ...form, dataCadastro: e.target.value })} className="mt-1 w-full rounded border p-2 disabled:bg-gray-100" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Observação
            <textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="mt-1 w-full rounded border p-2" />
          </label>
        </div>
        <button type="button" disabled={salvando} onClick={confirmar} className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60">{salvando ? "Salvando..." : "Salvar equipamento"}</button>
      </div>
    </div>
  );
}
