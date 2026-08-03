export default function TrocaPatrimonioModal({
  troca,
  setTroca,
  patrimonioAtual,
  candidatos,
  salvando,
  confirmarNumero,
  confirmarSubstituicao,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl">
        <h4 className="font-bold">Patrimônio atual {patrimonioAtual}</h4>
        {troca.modo === "escolha" && (
          <>
            <p className="text-sm">O que deseja fazer?</p>
            <button type="button" onClick={() => setTroca({ ...troca, modo: "numero" })} className="w-full rounded border p-3 text-left">Alterar somente o número</button>
            <button type="button" disabled={!troca.unidadeOrigemId} onClick={() => setTroca({ ...troca, modo: "substituir" })} className="w-full rounded border p-3 text-left disabled:opacity-50">Substituir por equipamento existente</button>
          </>
        )}
        {troca.modo === "numero" && (
          <>
            <input inputMode="numeric" value={troca.numeroNovo} onChange={(e) => setTroca({ ...troca, numeroNovo: e.target.value })} placeholder="Novo patrimônio" className="w-full rounded border p-2" />
            <input type="date" value={troca.data} onChange={(e) => setTroca({ ...troca, data: e.target.value })} className="w-full rounded border p-2" />
            <select value={troca.motivo} onChange={(e) => setTroca({ ...troca, motivo: e.target.value })} className="w-full rounded border p-2"><option value="">Motivo da troca</option><option>Substituição do quadro de comando</option><option>Etiqueta danificada</option><option>Correção de numeração</option><option>Outro</option></select>
            {troca.motivo === "Outro" && <input value={troca.motivoOutro} onChange={(e) => setTroca({ ...troca, motivoOutro: e.target.value })} placeholder="Descreva o motivo" className="w-full rounded border p-2" />}
            <textarea value={troca.observacao} onChange={(e) => setTroca({ ...troca, observacao: e.target.value })} placeholder="Observação (opcional)" className="w-full rounded border p-2" />
          </>
        )}
        {troca.modo === "substituir" && (
          <>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {candidatos.length === 0 ? <p className="text-sm text-gray-500">Nenhum equipamento compatível disponível.</p> : candidatos.map(({ item, ativo }) => (
                <label key={item.idEquipamento} className={`block rounded border p-3 ${troca.destinoId === item.idEquipamento ? "border-blue-500 bg-blue-50" : ""}`}>
                  <input type="radio" name="destinoSubstituicao" checked={troca.destinoId === item.idEquipamento} onChange={() => setTroca({ ...troca, destinoId: item.idEquipamento })} /> <strong className="font-mono">{item.numeroPatrimonioAtual}</strong> • {item.equipamento} {item.tipoBalancinho || item.tipoMiniGrua}
                  <span className="block text-xs text-gray-600">{ativo ? `LOCADO • ${ativo.construtoraNome || ativo.construtora || ""} / ${ativo.obraNome || ativo.obra || ""}` : "NO_GALPAO"}{item.observacao ? ` • ${item.observacao}` : ""}</span>
                </label>
              ))}
            </div>
            <input type="date" value={troca.data} onChange={(e) => setTroca({ ...troca, data: e.target.value })} className="w-full rounded border p-2" />
            <select value={troca.motivo} onChange={(e) => setTroca({ ...troca, motivo: e.target.value })} className="w-full rounded border p-2"><option value="">Motivo</option><option>Defeito</option><option>Manutenção</option><option>Troca preventiva</option><option>Avaria</option><option>Organização do patrimônio</option><option>Outro</option></select>
            {troca.motivo === "Outro" && <input value={troca.motivoOutro} onChange={(e) => setTroca({ ...troca, motivoOutro: e.target.value })} placeholder="Descreva o motivo" className="w-full rounded border p-2" />}
            <textarea value={troca.observacao} onChange={(e) => setTroca({ ...troca, observacao: e.target.value })} placeholder="Observação (opcional)" className="w-full rounded border p-2" />
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={salvando} onClick={() => troca.modo === "escolha" ? setTroca(null) : setTroca({ ...troca, modo: "escolha" })} className="rounded border px-4 py-2">{troca.modo === "escolha" ? "Cancelar" : "Voltar"}</button>
          {troca.modo !== "escolha" && <button type="button" disabled={salvando} onClick={troca.modo === "numero" ? confirmarNumero : confirmarSubstituicao} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60">{salvando ? "Salvando..." : "Confirmar"}</button>}
        </div>
      </div>
    </div>
  );
}
