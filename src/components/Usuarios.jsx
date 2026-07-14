import { useEffect, useState } from "react";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({
    id: null,
    nome: "",
    usuario: "",
    senha: "",
    tipo: "funcionario", // admin, funcionario, gestor, cliente
  });

  useEffect(() => {
    const salvos = JSON.parse(localStorage.getItem("usuarios") || "[]");
    setUsuarios(salvos);
  }, []);

  const salvar = () => {
    const novos = form.id
      ? usuarios.map((u) => (u.id === form.id ? form : u))
      : [...usuarios, { ...form, id: Date.now() }];

    setUsuarios(novos);
    localStorage.setItem("usuarios", JSON.stringify(novos));
    setForm({ id: null, nome: "", usuario: "", senha: "", tipo: "funcionario" });
  };

  const editar = (u) => setForm(u);

  const excluir = (id) => {
    if (confirm("Deseja excluir este usuário?")) {
      const novos = usuarios.filter((u) => u.id !== id);
      setUsuarios(novos);
      localStorage.setItem("usuarios", JSON.stringify(novos));
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Gerenciar Usuários</h2>

      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        <input
          placeholder="Nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          placeholder="Usuário"
          value={form.usuario}
          onChange={(e) => setForm({ ...form, usuario: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          placeholder="Senha"
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
          className="border p-2 rounded"
          type="password"
        />
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="admin">Admin</option>
          <option value="funcionario">Funcionário</option>
          <option value="gestor">Gestor</option>
          <option value="cliente">Cliente</option>
        </select>
      </div>

      <button onClick={salvar} className="bg-blue-600 text-white px-4 py-2 rounded">
        {form.id ? "Atualizar" : "Salvar"}
      </button>

      <ul className="mt-6 space-y-2">
        {usuarios.map((u) => (
          <li key={u.id} className="border rounded p-3 bg-gray-50 shadow-sm flex justify-between items-center">
            <div>
              <strong>{u.nome}</strong> ({u.tipo})<br />
              Usuário: {u.usuario}
            </div>
            <div className="space-x-2 text-sm">
              <button onClick={() => editar(u)} className="text-blue-600 underline">Editar</button>
              <button onClick={() => excluir(u.id)} className="text-red-600 underline">Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
