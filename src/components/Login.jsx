import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // ajuste o caminho se necessário

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (sessao) {
      onLogin(sessao);
    }
  }, []);

  const handleLogin = async () => {
    try {
      const q = query(
        collection(db, "usuarios"),
        where("nome", "==", usuario),
        where("senha", "==", senha)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setErro("Usuário ou senha inválidos");
        return;
      }

      const user = snapshot.docs[0].data();
      localStorage.setItem("usuarioLogado", JSON.stringify(user));
      onLogin(user);
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      setErro("Erro ao tentar login. Tente novamente.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white shadow-xl rounded-xl p-6 w-full max-w-xs text-center">
        <h1 className="text-2xl font-semibold mb-4 text-gray-800">CD Locações</h1>
        <input
          className="w-full mb-3 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Usuário"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <input
          type="password"
          className="w-full mb-4 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          onClick={handleLogin}
        >
          Entrar
        </button>
        {erro && <p className="text-red-500 text-sm mt-3">{erro}</p>}
      </div>
    </div>
  );
}
