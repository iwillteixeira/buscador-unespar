import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { fetchArpItens } from "./api/client";
import { matchValue, FilterMode } from "./utils/matchers";

export default function App() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [column, setColumn] = useState("descricao_pdm");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<FilterMode>("word");

  const { data, isLoading } = useQuery({
    queryKey: ["arp", page, column, search],
    queryFn: () =>
      fetchArpItens({
        page,
        pageSize,
        column,
        value: search,
      }),
    keepPreviousData: true,
  });

  const refined = useMemo(() => {
    if (!data) return [];
    return data.data.filter((row) =>
      matchValue((row as any)[column], search, mode)
    );
  }, [data, search, column, mode]);

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(refined);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ARP");
    XLSX.writeFile(wb, "arp-filtrado.xlsx");
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>ARP – Filtro Avançado</h2>

      <select value={column} onChange={(e) => setColumn(e.target.value)}>
        <option value="descricao_pdm">Descrição PDM</option>
        <option value="fornecedor">Fornecedor</option>
        <option value="unidade_gerenciadora">Unidade</option>
      </select>

      <select value={mode} onChange={(e) => setMode(e.target.value as FilterMode)}>
        <option value="word">Palavra inteira</option>
        <option value="contains">Contém</option>
        <option value="equals">Igual</option>
        <option value="startsWith">Começa com</option>
        <option value="regex">Regex</option>
      </select>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Ex: café"
      />

      <button
        disabled={!refined.length}
        onClick={() => {
          if (confirm(`Exportar ${refined.length} registros para Excel?`)) {
            exportExcel();
          }
        }}
      >
        Exportar Excel
      </button>

      {isLoading && <p>Carregando…</p>}

      <p>
        Mostrando <b>{refined.length}</b> registros
      </p>
    </div>
  );
}
