import { useEffect, useState } from "react";

export default function Configuracoes() {
  const [balancinhos, setBalancinhos] = useState({});
  const [ancoragens, setAncoragens] = useState({});

  useEffect(() => {
    const padraoB = JSON.parse(localStorage.getItem("pecasBalancinho") || "{}");
    const padraoA = JSON.parse(localStorage.getItem("pecasAncoragem") || "{}");

    setBalancinhos({
      "1": padraoB["1"] || "Conjunto 1m, 2 Travas, 2 Cabos, 2 Motores",
      "1.5": padraoB["1.5"] || "Conjunto 1,5m, 2 Travas, 2 Cabos, 2 Motores",
      "2": padraoB["2"] || "Conjunto 2m, 2 Travas, 2 Cabos, 2 Motores",
      "3": padraoB["3"] || "Conjunto 3m, 2 Travas, 2 Cabos, 2 Motores",
      "4": padraoB["4"] || "Conjunto 4m, 2 Travas, 2 Cabos, 2 Motores",
      "5": padraoB["5"] || "Conjunto 5m, 2 Travas, 2 Cabos, 2 Motores",
      "6": padraoB["6"] || "Conjunto 6m, 2 Travas, 2 Cabos, 2 Motores",
    });

    setAncoragens({
      "Andaime Simples": padraoA["Andaime Simples"] || "2 Módulos, 2 Tesouras, 4 Clips, 2 Escoras",
      "Andaime Duplo": padraoA["Andaime Duplo"] || "4 Módulos, 4 Tesouras, 8 Clips, 4 Escoras",
      "Afastador": padraoA["Afastador"] || "2 Afastadores, 2 Cabos Curtos, 2 Clips Reforçados",
    });
  }, []);

  const salvarMateriais = () => {
    localStorage.setItem("pecasBalancinho", JSON.stringify(balancinhos));
    localStorage.setItem("pecasAncoragem", JSON.stringify(ancoragens));
    alert("Materiais salvos com sucesso!");
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-bold">⚙️ Configurações de Materiais</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Peças do Balancinho (por tamanho)</h3>
          {Object.entries(balancinhos).map(([tamanho, texto]) => (
            <div key={tamanho} className="mb-2">
              <label className="block text-sm font-medium">Tamanho {tamanho}m:</label>
              <textarea
                value={texto}
                onChange={(e) =>
                  setBalancinhos((prev) => ({ ...prev, [tamanho]: e.target.value }))
                }
                className="border p-2 rounded w-full text-sm"
              />
            </div>
          ))}
        </div>

        <div>
          <h3 className="font-semibold mb-2">Peças por Tipo de Ancoragem</h3>
          {Object.entries(ancoragens).map(([tipo, texto]) => (
            <div key={tipo} className="mb-2">
              <label className="block text-sm font-medium">{tipo}:</label>
              <textarea
                value={texto}
                onChange={(e) =>
                  setAncoragens((prev) => ({ ...prev, [tipo]: e.target.value }))
                }
                className="border p-2 rounded w-full text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={salvarMateriais} className="bg-blue-600 text-white px-4 py-2 rounded">
        Salvar Materiais
      </button>
    </div>
  );
}
