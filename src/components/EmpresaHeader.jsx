import { useEffect, useState } from "react";

export default function EmpresaHeader() {
  const [logo, setLogo] = useState(localStorage.getItem("empresaLogo") || "/logo.png");
  const [nome, setNome] = useState(localStorage.getItem("empresaNome") || "CD Locações");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem("empresaLogo", reader.result);
      setLogo(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleNomeChange = (e) => {
    setNome(e.target.value);
    localStorage.setItem("empresaNome", e.target.value);
  };

  return (
    <div className="flex flex-col items-center mb-6">
      <label>
        <img src={logo} alt="Logo" className="h-12 w-auto mb-2 cursor-pointer" />
        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
      </label>
      <input
        type="text"
        value={nome}
        onChange={handleNomeChange}
        className="text-center font-semibold text-xl bg-transparent outline-none"
      />
    </div>
  );
}
