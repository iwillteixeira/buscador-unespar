import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { fetchArpItens, type AdvancedFilters } from "./api/client";
import { saveToCache, getFromCache, clearCache } from "./utils/indexedDB";

export default function App() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [column] = useState("palavra_chave");
  const [search, setSearch] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [orderColumn, setOrderColumn] = useState(3);
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    status: "vigente",
  });
  
  const [tempAdvancedFilters, setTempAdvancedFilters] = useState<AdvancedFilters>({
    status: "vigente",
  });

  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [allData, setAllData] = useState<any[]>([]);
  const [useCache, setUseCache] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [pdmSuggestions, setPdmSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionPage, setSuggestionPage] = useState(0);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollContentRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    if (!search.trim()) {
      setPdmSuggestions([]);
      setShowSuggestions(false);
      setSuggestionPage(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      setSuggestionPage(0);
      try {
        const response = await fetch(
          `/serpro-api/cnbs-api/material/v1/palavra?palavra=${encodeURIComponent(search)}`
        );
        
        if (!response.ok) {
          setPdmSuggestions([]);
          setShowSuggestions(false);
          setLoadingSuggestions(false);
          return;
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data.slice(0, 50) : [];
        
        const normalize = (str: string) => 
          str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        
        const searchNorm = normalize(search);
        
        const scored = items.map((item: any) => {
          const nome = item.nomePdm || item.descricaoPDM || "";
          const nomeNorm = normalize(nome);
          let score = 0;
          
          const lengthDiff = Math.abs(nomeNorm.length - searchNorm.length);
          
          if (nomeNorm === searchNorm) score += 10000;
          
          if (lengthDiff <= 2 && nomeNorm.includes(searchNorm)) {
            score += 5000;
          }
          
          if (nomeNorm.startsWith(searchNorm)) {
            score += 1000;
            if (lengthDiff <= 3) score += 500;
          }
          
          if (nomeNorm.includes(searchNorm)) score += 200;
          
          const searchWords = searchNorm.split(" ").filter(w => w.length > 1);
          const nomeWords = nomeNorm.split(" ");
          
          searchWords.forEach(sw => {
            nomeWords.forEach(nw => {
              if (nw === sw) score += 800;
              if (nw.startsWith(sw)) {
                const nwLengthDiff = Math.abs(nw.length - sw.length);
                if (nwLengthDiff <= 2) score += 400;
                else score += 100;
              }
              if (nw.includes(sw)) score += 50;
            });
          });
          
          const exactWordMatch = nomeWords.some(nw => nw === searchNorm);
          if (exactWordMatch) score += 3000;
          
          return { ...item, score, nome };
        });
        
        scored.sort((a, b) => b.score - a.score);
        setPdmSuggestions(scored.slice(0, 18));
        setShowSuggestions(true);
        
      } catch (err) {
        console.error("Erro ao buscar sugestões:", err);
        setPdmSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["arp", page, column, searchQuery, orderColumn, orderDir, advancedFilters, pageSize],
    queryFn: () =>
      fetchArpItens({
        page,
        pageSize,
        column,
        value: searchQuery,
        orderColumn,
        orderDir,
        advancedFilters,
      }),
    enabled: searchQuery.length > 0 && !useCache,
    retry: 1,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  async function loadAllData() {
    if (!search.trim()) {
      alert("Digite uma palavra-chave primeiro!");
      return;
    }

    const cached = await getFromCache(search);
    if (cached && cached.items.length > 0) {
      const useExisting = window.confirm(
        `Encontrado cache com ${cached.items.length} itens para "${search}". Usar dados em cache?`
      );
      if (useExisting) {
        setAllData(cached.items);
        setUseCache(true);
        setSearchQuery(search);
        return;
      }
    }

    setIsLoadingAll(true);
    setLoadProgress(0);
    setCancelLoading(false);
    const allItems: any[] = [];
    
    try {
      const firstResponse = await fetchArpItens({
        page: 1,
        pageSize: 1000,
        column,
        value: search,
        orderColumn: 3,
        orderDir: "asc",
        advancedFilters: { status: "vigente" },
      });

      const totalRecords = firstResponse.recordsFiltered;
      const batchSize = 1000;
      const totalPages = Math.ceil(totalRecords / batchSize);
      
      if (totalRecords > 50000) {
        const proceed = window.confirm(
          `⚠️ Foram encontrados ${totalRecords} registros! Isso pode demorar alguns minutos. Continuar?`
        );
        if (!proceed) {
          setIsLoadingAll(false);
          return;
        }
      }

      allItems.push(...firstResponse.data);
      setLoadProgress(Math.round((1 / totalPages) * 100));

      const parallelRequests = 5;
      
      for (let i = 2; i <= totalPages; i += parallelRequests) {
        if (cancelLoading) {
          alert("Carregamento cancelado!");
          break;
        }

        const promises = [];
        for (let j = 0; j < parallelRequests && (i + j) <= totalPages; j++) {
          const pageNum = i + j;
          promises.push(
            fetchArpItens({
              page: pageNum,
              pageSize: batchSize,
              column,
              value: search,
              orderColumn: 3,
              orderDir: "asc",
              advancedFilters: { status: "vigente" },
            })
          );
        }

        const responses = await Promise.all(promises);
        responses.forEach(response => {
          allItems.push(...response.data);
        });

        setLoadProgress(Math.round((Math.min(i + parallelRequests - 1, totalPages) / totalPages) * 100));
      }

      if (!cancelLoading) {
        await saveToCache(search, allItems);
        
        setAllData(allItems);
        setUseCache(true);
        setSearchQuery(search);
        alert(`✅ ${allItems.length} itens carregados e salvos em cache!`);
      }
      
    } catch (err) {
      console.error("Erro ao carregar todos os dados:", err);
      alert("❌ Erro ao carregar dados. A API pode estar limitando requisições. Tente novamente em alguns minutos.");
    } finally {
      setIsLoadingAll(false);
      setLoadProgress(0);
      setCancelLoading(false);
    }
  }

  const results = useMemo(() => {
    const rawResults = useCache ? allData : (data?.data || []);
    
    if (rawResults.length === 0) return [];

    let filtered = rawResults;

    const pdmFilter = advancedFilters.codigoPdm?.trim();
    if (pdmFilter) {
      const pdmCodes = pdmFilter.split(',').map(code => code.trim()).filter(code => code.length > 0);
      if (pdmCodes.length > 0) {
        filtered = filtered.filter(row => 
          pdmCodes.some(code => row.codigo_pdm?.includes(code))
        );
      }
    }

    return filtered;
  }, [useCache, allData, data?.data, advancedFilters.codigoPdm]);

  const totalRecords = useCache ? allData.length : (data?.recordsFiltered || 0);
  const totalPages = Math.ceil(totalRecords / pageSize);
  const filteredCount = results.length;
  const displayedResults = useCache ? results.slice((page - 1) * pageSize, page * pageSize) : results;

  useEffect(() => {
    if (tableRef.current && topScrollContentRef.current) {
      topScrollContentRef.current.style.width = `${tableRef.current.scrollWidth}px`;
    }
  }, [displayedResults]);

  function handleSearch() {
    if (!search.trim()) return;
    setSearchQuery(search);
    setAdvancedFilters(tempAdvancedFilters);
    setPage(1);
    setSelectedItems(new Set());
    setUseCache(false);
  }

  function handleSort(columnIndex: number) {
    if (orderColumn === columnIndex) {
      setOrderDir(orderDir === "asc" ? "desc" : "asc");
    } else {
      setOrderColumn(columnIndex);
      setOrderDir("asc");
    }
    setPage(1);
    setSelectedItems(new Set());
  }

  function handleAdvancedFilterChange(field: keyof AdvancedFilters, value: string) {
    setTempAdvancedFilters(prev => ({ ...prev, [field]: value }));
  }

  function clearAdvancedFilters() {
    setTempAdvancedFilters({ status: "vigente" });
    setAdvancedFilters({ status: "vigente" });
    setSelectedItems(new Set());
  }

  function toggleSelectAll() {
    if (selectedItems.size === displayedResults.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(displayedResults.map((_, idx) => idx)));
    }
  }

  function toggleSelectItem(idx: number) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedItems(newSelected);
  }

  function exportExcel() {
    const itemsToExport = selectedItems.size > 0 
      ? displayedResults.filter((_, idx) => selectedItems.has(idx))
      : displayedResults;
    
    if (itemsToExport.length === 0) {
      alert("Nenhum item selecionado para exportar!");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(itemsToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ARP");
    XLSX.writeFile(wb, "arp-filtrado.xlsx");
  }

  const SortIcon = ({ colIndex }: { colIndex: number }) => {
    if (orderColumn !== colIndex) return <span style={{ color: "#ccc" }}>⇅</span>;
    return <span>{orderDir === "asc" ? "↑" : "↓"}</span>;
  };

  const activeFiltersCount = Object.entries(tempAdvancedFilters).filter(
    ([key, value]) => value && key !== "status"
  ).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <header style={{
        backgroundImage: "linear-gradient(#000000 0%, #D8D8D8 0%, #FFFFFF 75%)",
        color: "#000",
        padding: "20px",
        marginBottom: 0,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <div style={{ 
          maxWidth: "100%", 
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 20
        }}>
          <img 
            src="https://unespar.edu.br/++theme++tema-unespar-plone/img/logo-unespar.png" 
            alt="UNESPAR"
            style={{ height: 60 }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div style={{ color: "#000" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#000" }}>
              Buscador ARP - Sistema de Compras
            </h1>
            <p style={{ margin: "5px 0 0 0", fontSize: 14, color: "#333" }}>
              Universidade Estadual do Paraná
            </p>
          </div>
        </div>
      </header>

      <div style={{
        height: "30px",
        background: "#002661",
        borderTop: "3px solid #007F3D",
        marginBottom: 20
      }}></div>

      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", maxWidth: "100%", margin: "0 auto" }}>
      <h2 style={{ color: "#1e5a3c", marginTop: 0 }}>ARP – Busca por Palavra-chave</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 15, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 16, position: "relative" }}>
          <strong>Palavra-chave:</strong>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder="Digite e pressione Enter..."
            style={{ marginLeft: 5, padding: "6px 12px", width: 300, fontSize: 15 }}
            disabled={isFetching || isLoadingAll}
          />
          
          {loadingSuggestions && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 5,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: 10,
              width: 400,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000
            }}>
              ⏳ Buscando sugestões de PDM...
            </div>
          )}
          
          {showSuggestions && pdmSuggestions.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 5,
              backgroundColor: "white",
              border: "1px solid #007F3D",
              borderRadius: 4,
              padding: 10,
              width: 500,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: "1px solid #ddd"
              }}>
                <strong style={{ color: "#007F3D" }}>💡 Sugestões de Código PDM:</strong>
                <button
                  onClick={() => setShowSuggestions(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                    color: "#666"
                  }}
                >
                  ✕
                </button>
              </div>
              {(() => {
                const itemsPerPage = 6;
                const totalPages = Math.min(3, Math.ceil(pdmSuggestions.length / itemsPerPage));
                const startIdx = suggestionPage * itemsPerPage;
                const endIdx = startIdx + itemsPerPage;
                const currentPageItems = pdmSuggestions.slice(startIdx, endIdx);
                
                return (
                  <>
                    {currentPageItems.map((item, idx) => (
                      <div
                        key={startIdx + idx}
                        onClick={() => {
                          setTempAdvancedFilters({ ...tempAdvancedFilters, codigoPdm: String(item.codigoPDM) });
                          setShowSuggestions(false);
                          setSuggestionPage(0);
                        }}
                        style={{
                          padding: 8,
                          margin: "4px 0",
                          cursor: "pointer",
                          backgroundColor: "#f8f9fa",
                          borderRadius: 4,
                          border: "1px solid #dee2e6",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e7f4e9";
                          e.currentTarget.style.borderColor = "#007F3D";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8f9fa";
                          e.currentTarget.style.borderColor = "#dee2e6";
                        }}
                      >
                        <div style={{ fontWeight: "bold", color: "#002661" }}>
                          📦 {item.codigoPDM} - {item.nome}
                        </div>
                        <div style={{ fontSize: 13, color: "#495057", marginTop: 2 }}>
                          Classe: {item.nomeClasse || "N/A"}
                        </div>
                      </div>
                    ))}
                    
                    {totalPages > 1 && (
                      <div style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px solid #dee2e6"
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSuggestionPage(Math.max(0, suggestionPage - 1));
                          }}
                          disabled={suggestionPage === 0}
                          style={{
                            padding: "4px 12px",
                            fontSize: 12,
                            backgroundColor: suggestionPage === 0 ? "#e9ecef" : "#002661",
                            color: suggestionPage === 0 ? "#6c757d" : "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: suggestionPage === 0 ? "not-allowed" : "pointer"
                          }}
                        >
                          ← Anterior
                        </button>
                        
                        <span style={{ fontSize: 13, color: "#495057" }}>
                          Página {suggestionPage + 1} de {totalPages}
                        </span>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSuggestionPage(Math.min(totalPages - 1, suggestionPage + 1));
                          }}
                          disabled={suggestionPage >= totalPages - 1}
                          style={{
                            padding: "4px 12px",
                            fontSize: 12,
                            backgroundColor: suggestionPage >= totalPages - 1 ? "#e9ecef" : "#002661",
                            color: suggestionPage >= totalPages - 1 ? "#6c757d" : "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: suggestionPage >= totalPages - 1 ? "not-allowed" : "pointer"
                          }}
                        >
                          Próxima →
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </label>

        <button
          onClick={handleSearch}
          disabled={!search.trim() || isFetching || isLoadingAll}
          style={{ 
            padding: "6px 20px", 
            fontWeight: "bold",
            fontSize: 15,
            backgroundColor: (isFetching || isLoadingAll) ? "#ccc" : "#002661",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: (isFetching || isLoadingAll) ? "not-allowed" : "pointer"
          }}
        >
          {isFetching ? "⏳ Buscando..." : "🔍 Buscar (Normal)"}
        </button>

        <button
          onClick={loadAllData}
          disabled={!search.trim() || isLoadingAll || isFetching}
          style={{ 
            padding: "6px 20px",
            fontWeight: "bold",
            fontSize: 15,
            backgroundColor: isLoadingAll ? "#ccc" : "#2d7a50",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: isLoadingAll ? "not-allowed" : "pointer"
          }}
        >
          {isLoadingAll ? `⏳ ${loadProgress}%` : "📦 Carregar TODOS"}
        </button>

        {isLoadingAll && (
          <button
            onClick={() => setCancelLoading(true)}
            style={{ 
              padding: "6px 16px",
              fontSize: 14,
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            ❌ Cancelar
          </button>
        )}

        <button
          onClick={async () => {
            if (window.confirm("Limpar todo o cache de dados?")) {
              await clearCache();
              setAllData([]);
              setUseCache(false);
              alert("Cache limpo!");
            }
          }}
          style={{ 
            padding: "6px 16px",
            fontSize: 14,
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          🗑️ Limpar Cache
        </button>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={isLoadingAll}
          style={{ 
            padding: "6px 20px",
            fontSize: 15,
            backgroundColor: "#007F3D",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            position: "relative"
          }}
        >
          {showAdvanced ? "▲" : "▼"} Filtros Avançados
          {activeFiltersCount > 0 && (
            <span style={{
              position: "absolute",
              top: -5,
              right: -5,
              backgroundColor: "#dc3545",
              color: "white",
              borderRadius: "50%",
              padding: "2px 6px",
              fontSize: 11,
              fontWeight: "bold"
            }}>
              {activeFiltersCount}
            </span>
          )}
        </button>

        <label style={{ fontSize: 14 }}>
          Itens/página:
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            disabled={isLoadingAll}
            style={{ marginLeft: 5, padding: "6px", borderRadius: 4, border: "1px solid #ced4da" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        <button
          disabled={!displayedResults.length}
          onClick={() => {
            const count = selectedItems.size > 0 ? selectedItems.size : displayedResults.length;
            const message = selectedItems.size > 0 
              ? `Exportar ${count} registro(s) selecionado(s) para Excel?`
              : `Nenhum item selecionado. Exportar todos os ${count} registros desta página para Excel?`;
            if (window.confirm(message)) {
              exportExcel();
            }
          }}
          style={{ 
            padding: "6px 20px",
            fontSize: 15,
            backgroundColor: displayedResults.length ? "#28a745" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: displayedResults.length ? "pointer" : "not-allowed"
          }}
        >
          📥 Exportar {selectedItems.size > 0 ? `Selecionados (${selectedItems.size})` : `Página (${displayedResults.length})`}
        </button>
      </div>

      {useCache && allData.length > 0 && (
        <div style={{ 
          padding: 12, 
          backgroundColor: "#d1ecf1", 
          border: "1px solid #bee5eb", 
          borderRadius: 4,
          color: "#0c5460",
          fontSize: 14,
          marginBottom: 10
        }}>
          💾 <strong>Cache Ativo:</strong> {allData.length} itens carregados | Filtrados: <strong>{filteredCount}</strong>
        </div>
      )}

      {isLoadingAll && (
        <div style={{ 
          padding: 16, 
          backgroundColor: "#fff3cd", 
          border: "1px solid #ffeaa7", 
          borderRadius: 4,
          color: "#856404",
          fontSize: 15,
          marginBottom: 10
        }}>
          <div style={{ marginBottom: 8 }}>
            ⏳ Carregando dados em lote (1000 itens por requisição, 5 paralelas)...
          </div>
          <div style={{ 
            width: "100%", 
            backgroundColor: "#e0e0e0", 
            borderRadius: 10, 
            overflow: "hidden",
            height: 25
          }}>
            <div style={{ 
              width: `${loadProgress}%`, 
              backgroundColor: "#2d7a50",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold",
              transition: "width 0.3s"
            }}>
              {loadProgress}%
            </div>
          </div>
        </div>
      )}

      {showAdvanced && (
        <div style={{
          backgroundColor: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: 4,
          padding: 16,
          marginBottom: 15
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Filtros Avançados</h3>
            <button
              onClick={clearAdvancedFilters}
              style={{
                padding: "4px 12px",
                fontSize: 13,
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Limpar Filtros
            </button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Status:</strong>
              <select
                value={tempAdvancedFilters.status || "vigente"}
                onChange={(e) => handleAdvancedFilterChange("status", e.target.value)}
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              >
                <option value="">Todos</option>
                <option value="vigente">Vigente</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Código PDM:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.codigoPdm || ""}
                onChange={(e) => handleAdvancedFilterChange("codigoPdm", e.target.value)}
                placeholder="Ex: 12345 ou 19766, 19266 (múltiplos)"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
              {tempAdvancedFilters.codigoPdm && String(tempAdvancedFilters.codigoPdm).includes(',') && (
                <small style={{ color: "#6c757d", marginTop: 2 }}>
                  🔍 {String(tempAdvancedFilters.codigoPdm).split(',').filter(c => c.trim()).length} código(s): {String(tempAdvancedFilters.codigoPdm).split(',').map(c => c.trim()).filter(c => c).join(', ')}
                </small>
              )}
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Órgão:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.orgao || ""}
                onChange={(e) => handleAdvancedFilterChange("orgao", e.target.value)}
                placeholder="Nome do órgão"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>UASG:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.uasg || ""}
                onChange={(e) => handleAdvancedFilterChange("uasg", e.target.value)}
                placeholder="Código UASG"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Modalidade:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.modalidade || ""}
                onChange={(e) => handleAdvancedFilterChange("modalidade", e.target.value)}
                placeholder="Ex: Pregão Eletrônico"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Número ARP:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.numeroArp || ""}
                onChange={(e) => handleAdvancedFilterChange("numeroArp", e.target.value)}
                placeholder="Número da ARP"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Número Processo:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.numeroProcesso || ""}
                onChange={(e) => handleAdvancedFilterChange("numeroProcesso", e.target.value)}
                placeholder="Número do processo"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Fornecedor:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.fornecedor || ""}
                onChange={(e) => handleAdvancedFilterChange("fornecedor", e.target.value)}
                placeholder="Nome do fornecedor"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>CNPJ Fornecedor:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.cnpjFornecedor || ""}
                onChange={(e) => handleAdvancedFilterChange("cnpjFornecedor", e.target.value)}
                placeholder="CNPJ"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Validade Início:</strong>
              <input
                type="date"
                value={tempAdvancedFilters.validadeInicio || ""}
                onChange={(e) => handleAdvancedFilterChange("validadeInicio", e.target.value)}
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Validade Fim:</strong>
              <input
                type="date"
                value={tempAdvancedFilters.validadeFim || ""}
                onChange={(e) => handleAdvancedFilterChange("validadeFim", e.target.value)}
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Valor Mínimo:</strong>
              <input
                type="number"
                value={tempAdvancedFilters.valorMin || ""}
                onChange={(e) => handleAdvancedFilterChange("valorMin", e.target.value)}
                placeholder="R$ mínimo"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Valor Máximo:</strong>
              <input
                type="number"
                value={tempAdvancedFilters.valorMax || ""}
                onChange={(e) => handleAdvancedFilterChange("valorMax", e.target.value)}
                placeholder="R$ máximo"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>UF:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.uf || ""}
                onChange={(e) => handleAdvancedFilterChange("uf", e.target.value)}
                placeholder="Ex: PR, SP, RJ"
                maxLength={2}
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da", textTransform: "uppercase" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Município:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.municipio || ""}
                onChange={(e) => handleAdvancedFilterChange("municipio", e.target.value)}
                placeholder="Nome do município"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              <strong>Descrição PDM:</strong>
              <input
                type="text"
                value={tempAdvancedFilters.descricaoPdm || ""}
                onChange={(e) => handleAdvancedFilterChange("descricaoPdm", e.target.value)}
                placeholder="Descrição do item"
                style={{ padding: "6px", marginTop: 4, borderRadius: 4, border: "1px solid #ced4da" }}
              />
            </label>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: "#6c757d" }}>
            ℹ️ Os filtros avançados são aplicados automaticamente quando você clica em "Buscar"
          </div>
        </div>
      )}

      {!searchQuery && (
        <div style={{ 
          padding: 16, 
          backgroundColor: "#f0f8ff", 
          border: "1px solid #b8daff", 
          borderRadius: 4,
          color: "#004085",
          fontSize: 15
        }}>
          ℹ️ Digite uma <strong>palavra-chave</strong> no campo de busca e clique em "Buscar" (ou pressione Enter)
          <br />
          <small>Exemplos: computador, papel, caneta, cafe, etc.</small>
        </div>
      )}

      {error && (
        <div style={{ 
          padding: 16, 
          backgroundColor: "#f8d7da", 
          border: "1px solid #f5c6cb", 
          borderRadius: 4,
          color: "#721c24"
        }}>
          ❌ Erro ao buscar dados: {error instanceof Error ? error.message : "Erro desconhecido"}
          <br />
          <small>Tente novamente ou use outra palavra-chave.</small>
        </div>
      )}

      {isFetching && !isLoadingAll && (
        <div style={{ 
          padding: 16, 
          backgroundColor: "#fff3cd", 
          border: "1px solid #ffeaa7", 
          borderRadius: 4,
          color: "#856404",
          fontSize: 15
        }}>
          ⏳ Aguarde... buscando dados da API (pode levar alguns segundos)
        </div>
      )}

      {searchQuery && !isFetching && !isLoadingAll && !error && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 16, margin: 0 }}>
            Total: <b>{totalRecords}</b> registros | Página <b>{page}</b> de <b>{totalPages}</b>
          </p>
          
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <button
              onClick={() => setPage(1)}
              disabled={page === 1 || isFetching || isLoadingAll}
              style={{
                padding: "5px 10px",
                backgroundColor: page === 1 ? "#e9ecef" : "#002661",
                color: page === 1 ? "#6c757d" : "white",
                border: "none",
                borderRadius: 4,
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontSize: 14
              }}
            >
              ⏮ Primeira
            </button>
            
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching || isLoadingAll}
              style={{
                padding: "5px 10px",
                backgroundColor: page === 1 ? "#e9ecef" : "#002661",
                color: page === 1 ? "#6c757d" : "white",
                border: "none",
                borderRadius: 4,
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontSize: 14
              }}
            >
              ◀ Anterior
            </button>
            
            <span style={{ padding: "0 10px", fontSize: 15 }}>
              Página <input 
                type="number" 
                min={1} 
                max={totalPages}
                value={page}
                onChange={(e) => {
                  const newPage = parseInt(e.target.value);
                  if (newPage >= 1 && newPage <= totalPages) {
                    setPage(newPage);
                  }
                }}
                style={{ 
                  width: 60, 
                  padding: "4px", 
                  textAlign: "center",
                  border: "1px solid #ced4da",
                  borderRadius: 4
                }}
              /> de {totalPages}
            </span>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isFetching || isLoadingAll}
              style={{
                padding: "5px 10px",
                backgroundColor: page === totalPages ? "#e9ecef" : "#002661",
                color: page === totalPages ? "#6c757d" : "white",
                border: "none",
                borderRadius: 4,
                cursor: page === totalPages ? "not-allowed" : "pointer",
                fontSize: 14
              }}
            >
              Próxima ▶
            </button>
            
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || isFetching || isLoadingAll}
              style={{
                padding: "5px 10px",
                backgroundColor: page === totalPages ? "#e9ecef" : "#002661",
                color: page === totalPages ? "#6c757d" : "white",
                border: "none",
                borderRadius: 4,
                cursor: page === totalPages ? "not-allowed" : "pointer",
                fontSize: 14
              }}
            >
              Última ⏭
            </button>
          </div>
        </div>
      )}

      {!isFetching && !isLoadingAll && displayedResults.length > 0 && (
        <>
          <div 
            ref={topScrollRef}
            onScroll={handleTopScroll}
            style={{ 
              overflowX: "auto", 
              overflowY: "hidden",
              height: 20,
              marginTop: 12,
              border: "1px solid #ddd",
              borderRadius: 4
            }}
          >
            <div ref={topScrollContentRef} style={{ height: 1 }}></div>
          </div>

          <div 
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            style={{ 
              overflowX: "auto", 
              border: "1px solid #ddd", 
              borderRadius: 4, 
              marginTop: 4,
              maxHeight: "600px",
              overflowY: "auto"
            }}
          >
            <table ref={tableRef} style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: "#e9ecef" }}>
                  <th style={{ 
                    padding: 8, 
                    textAlign: "center", 
                    borderBottom: "2px solid #adb5bd", 
                    width: 40,
                    position: "sticky",
                    top: 0,
                    backgroundColor: "#e9ecef",
                    zIndex: 10
                  }}>
                    <input 
                      type="checkbox" 
                      checked={selectedItems.size === displayedResults.length && displayedResults.length > 0}
                      onChange={toggleSelectAll}
                      title="Selecionar todos"
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th 
                    onClick={() => handleSort(0)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 80,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Número <SortIcon colIndex={0} />
                  </th>
                  <th 
                    onClick={() => handleSort(1)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 150,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Unidade Gerenciadora <SortIcon colIndex={1} />
                  </th>
                  <th 
                    onClick={() => handleSort(2)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 100,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Nº Item Compra <SortIcon colIndex={2} />
                  </th>
                  <th 
                    onClick={() => handleSort(3)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 100, 
                      backgroundColor: "#c8e6c9",
                      position: "sticky",
                      top: 0,
                      zIndex: 10
                    }}
                  >
                    <strong>Código PDM</strong> <SortIcon colIndex={3} />
                  </th>
                  <th 
                    onClick={() => handleSort(4)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 300,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Descrição Detalhada <SortIcon colIndex={4} />
                  </th>
                  <th 
                    onClick={() => handleSort(5)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 50,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    UF <SortIcon colIndex={5} />
                  </th>
                  <th 
                    onClick={() => handleSort(6)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 200,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Fornecedor <SortIcon colIndex={6} />
                  </th>
                  <th 
                    onClick={() => handleSort(7)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 80,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Qtd Registrada <SortIcon colIndex={7} />
                  </th>
                  <th 
                    onClick={() => handleSort(8)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 80,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Saldo Adesão <SortIcon colIndex={8} />
                  </th>
                  <th 
                    onClick={() => handleSort(9)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 100,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Vigência Inicial <SortIcon colIndex={9} />
                  </th>
                  <th 
                    onClick={() => handleSort(10)} 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      cursor: "pointer", 
                      userSelect: "none", 
                      minWidth: 100,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Vigência Final <SortIcon colIndex={10} />
                  </th>
                  <th 
                    style={{ 
                      padding: 8, 
                      textAlign: "left", 
                      borderBottom: "2px solid #adb5bd", 
                      minWidth: 200,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#e9ecef",
                      zIndex: 10
                    }}
                  >
                    Descrição PDM
                  </th>
                </tr>
              </thead>
              <tbody>
              {displayedResults.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #dee2e6", backgroundColor: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                  <td style={{ padding: 8, textAlign: "center" }}>
                    <input 
                      type="checkbox" 
                      checked={selectedItems.has(idx)}
                      onChange={() => toggleSelectItem(idx)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>{row.numero || "-"}</td>
                  <td style={{ padding: 8 }}>{row.unidade_gerenciadora || "-"}</td>
                  <td style={{ padding: 8 }}>{row.numero_item_compra || "-"}</td>
                  <td style={{ padding: 8, fontWeight: "bold" }}>{row.codigo_pdm || "-"}</td>
                  <td style={{ padding: 8 }}>{row.descricaoDetalhada || row.descricaodetalhada || "-"}</td>
                  <td style={{ padding: 8 }}>{row.unidade_federacao || "-"}</td>
                  <td style={{ padding: 8 }}>{row.fornecedor || "-"}</td>
                  <td style={{ padding: 8 }}>{row.quantidade_registrada || "-"}</td>
                  <td style={{ padding: 8 }}>{row.saldo_adesao || "-"}</td>
                  <td style={{ padding: 8 }}>{row.vigencia_inicial || "-"}</td>
                  <td style={{ padding: 8 }}>{row.vigencia_final || "-"}</td>
                  <td style={{ padding: 8 }}>{row.descricao_pdm || row.descricaoPdm || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
      )}

      {!isFetching && !isLoadingAll && searchQuery && displayedResults.length === 0 && !error && (
        <div style={{ 
          padding: 16, 
          backgroundColor: "#e2e3e5", 
          border: "1px solid #d6d8db", 
          borderRadius: 4,
          color: "#383d41"
        }}>
          Nenhum registro encontrado com a palavra-chave "<strong>{searchQuery}</strong>". Tente outra palavra.
        </div>
      )}

      {totalPages > 1 && !isFetching && !isLoadingAll && (
        <div style={{ 
          padding: 12, 
          marginTop: 12,
          backgroundColor: "#e8f5e9", 
          border: "1px solid #c8e6c9", 
          borderRadius: 4,
          color: "#1e5a3c",
          fontSize: 14
        }}>
          ℹ️ Use os botões de navegação acima para ver mais resultados.
          <br />
          <small>Clique nos cabeçalhos das colunas para ordenar os dados.</small>
        </div>
      )}
    </div>
    </div>
  );
}
