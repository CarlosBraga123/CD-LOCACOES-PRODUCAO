import { useState, useEffect } from "react";

export default function ListaDeTarefas({ usuario }) {
  const [tarefas, setTarefas] = useState([]);
  const [texto, setTexto] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    const salvas = JSON.parse(localStorage.getItem("tarefas") || "[]");
    setTarefas(salvas);
  }, []);

  const salvarTarefas = (lista) => {
    setTarefas(lista);
    localStorage.setItem("tarefas", JSON.stringify(lista));
  };

  const adicionarOuAtualizar = () => {
    if (!texto.trim()) return;

    if (editandoId) {
      const atualizadas = tarefas.map((t) =>
        t.id === editandoId ? { ...t, texto } : t
      );
      salvarTarefas(atualizadas);
      setEditandoId(null);
    } else {
      const nova = {
        id: Date.now(),
        texto,
        criadaEm: new Date().toISOString(),
        concluida: false,
        concluidaEm: null,
        concluidaPor: null,
      };
      const atualizadas = [nova, ...tarefas];
      salvarTarefas(atualizadas);
    }

    setTexto("");
  };

  const concluir = (id) => {
    const atualizadas = tarefas.map((t) =>
      t.id === id
        ? {
            ...t,
            concluida: true,
            concluidaEm: new Date().toISOString(),
            concluidaPor: usuario || "Usuário",
          }
        : t
    );
    salvarTarefas(atualizadas);
  };

  const editar = (tarefa) => {
    setTexto(tarefa.texto);
    setEditandoId(tarefa.id);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">📝 Lista de Tarefas</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite uma nova tarefa..."
          className="border p-2 rounded w-full"
        />
        <button
          onClick={adicionarOuAtualizar}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editandoId ? "Salvar" : "Adicionar"}
        </button>
      </div>

      <div className="space-y-3">
        {tarefas.map((tarefa) => (
          <div
            key={tarefa.id}
            className={`p-3 rounded-lg border shadow-sm bg-white flex justify-between items-start`}
          >
            <div>
              <p className="font-medium">{tarefa.texto}</p>
              <p className="text-xs text-gray-500">
                Criada em: {new Date(tarefa.criadaEm).toLocaleString()}
              </p>
              {tarefa.concluida && (
                <p className="text-xs text-green-600">
                  ✅ Concluída por {tarefa.concluidaPor} em {new Date(tarefa.concluidaEm).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {!tarefa.concluida && (
                <>
                  <button
                    onClick={() => concluir(tarefa.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Concluir
                  </button>
                  <button
                    onClick={() => editar(tarefa)}
                    className="bg-yellow-400 text-black px-3 py-1 rounded text-sm"
                  >
                    Editar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
