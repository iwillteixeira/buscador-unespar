import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { fetchArpItens, type AdvancedFilters } from "./api/client";
import {
  Search,
  Package,
  Trash2,
  Filter,
  Download,
  Info,
  ChevronDown,
  Eye,
  Check,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Phone,
  X,
} from "lucide-react";
import "./App.css";

export default function App() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [column] = useState("palavra_chave");
  const [search, setSearch] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
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


  const [pdmSuggestions, setPdmSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionPage, setSuggestionPage] = useState(0);

  const [cnpjData, setCnpjData] = useState<Record<string, any>>({});
  const [loadingCnpj, setLoadingCnpj] = useState<Record<string, boolean>>({});

  const [visibleColumns, setVisibleColumns] = useState({
    numero: true,
    unidade_gerenciadora: true,
    numero_item_compra: true,
    codigo_pdm: true,
    descricao_detalhada: true,
    uf: true,
    fornecedor: true,
    telefone: true,
    email: true,
    uf_municipio: true,
    quantidade_registrada: true,
    saldo_adesao: true,
    vigencia_inicial: true,
    vigencia_final: true,
    descricao_pdm: true,
    acao: true,
  });

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
        const items = Array.isArray(data) ? data.slice(0, 100) : [];

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

          const searchWords = searchNorm.split(" ").filter((w) => w.length > 1);
          const nomeWords = nomeNorm.split(" ");

          searchWords.forEach((sw) => {
            nomeWords.forEach((nw) => {
              if (nw === sw) score += 800;
              if (nw.startsWith(sw)) {
                const nwLengthDiff = Math.abs(nw.length - sw.length);
                if (nwLengthDiff <= 2) score += 400;
                else score += 100;
              }
              if (nw.includes(sw)) score += 50;
            });
          });

          const exactWordMatch = nomeWords.some((nw) => nw === searchNorm);
          if (exactWordMatch) score += 3000;

          return { ...item, score, nome };
        });

        scored.sort((a, b) => b.score - a.score);
        setPdmSuggestions(scored.slice(0, 48));
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

  const { data, error, isFetching } = useQuery({
    queryKey: ["arp", page, column, searchQuery, orderColumn, orderDir, advancedFilters, pageSize, searchVersion],
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
    enabled: searchQuery.length > 0,
    retry: 1,
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });


  const results = useMemo(() => {
    const rawResults = data?.data || [];

    if (rawResults.length === 0) return [];

    let filtered = rawResults;

    const pdmFilter = advancedFilters.codigoPdm?.trim();
    if (pdmFilter) {
      const pdmCodes = pdmFilter
        .split(",")
        .map((code) => code.trim())
        .filter((code) => code.length > 0)
        .map((code) => (/^\d+$/.test(code) ? code.padStart(5, "0") : code));
      if (pdmCodes.length > 0) {
        filtered = filtered.filter((row) =>
          pdmCodes.some((code) => row.codigo_pdm?.includes(code))
        );
      }
    }

    return filtered;
  }, [data?.data, advancedFilters.codigoPdm]);

  const totalRecords = data?.recordsFiltered || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const displayedResults = results.filter((row) => {
    const saldo = parseFloat(row.saldo_adesao);
    return !isNaN(saldo) && saldo !== 0;
  });

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
    setSearchVersion((v) => v + 1);
  }

  function extractCnpj(fornecedor: string): string | null {
    if (!fornecedor) return null;
    const cnpjMatch = fornecedor.match(/\d{2}[\.]?\d{3}[\.]?\d{3}[\/]?\d{4}[\-]?\d{2}/);
    if (!cnpjMatch) return null;
    return cnpjMatch[0].replace(/[.,\/-]/g, "");
  }

  async function fetchCnpjData(fornecedor: string, rowIdx: number) {
    const cnpj = extractCnpj(fornecedor);
    if (!cnpj) return;

    setLoadingCnpj((prev) => ({ ...prev, [rowIdx]: true }));

    try {
      const [openCnpjResponse, brasilApiResponse] = await Promise.allSettled([
        fetch(`https://api.opencnpj.org/${cnpj}`),
        fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`),
      ]);

      let combinedData: any = {};

      if (openCnpjResponse.status === "fulfilled" && openCnpjResponse.value.ok) {
        const data = await openCnpjResponse.value.json();
        combinedData = { ...combinedData, ...data };
      }

      if (brasilApiResponse.status === "fulfilled" && brasilApiResponse.value.ok) {
        const data = await brasilApiResponse.value.json();
        combinedData = {
          ...combinedData,
          telefone: combinedData.telefone || data.ddd_telefone_1 || data.ddd_telefone_2,
          email: combinedData.email || data.email,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          cep: data.cep,
          municipio: data.municipio,
          uf: data.uf,
        };
      }

      if (Object.keys(combinedData).length > 0) {
        setCnpjData((prev) => ({ ...prev, [rowIdx]: combinedData }));
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
    } finally {
      setLoadingCnpj((prev) => ({ ...prev, [rowIdx]: false }));
    }
  }

  function toggleColumnVisibility(columnKey: keyof typeof visibleColumns) {
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: !prev[columnKey] }));
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
    setTempAdvancedFilters((prev) => ({ ...prev, [field]: value }));
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
    const itemsToExport =
      selectedItems.size > 0
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
    if (orderColumn !== colIndex)
      return <ArrowUpDown size={13} className="sort-icon sort-icon--inactive" />;
    return orderDir === "asc" ? (
      <ArrowUp size={13} className="sort-icon" />
    ) : (
      <ArrowDown size={13} className="sort-icon" />
    );
  };

  const activeFiltersCount = Object.entries(tempAdvancedFilters).filter(
    ([key, value]) => value && key !== "status"
  ).length;

  const columnLabels: Record<keyof typeof visibleColumns, string> = {
    numero: "Número",
    unidade_gerenciadora: "Unidade Gerenciadora",
    numero_item_compra: "Nº Item Compra",
    codigo_pdm: "Código PDM",
    descricao_detalhada: "Descrição Detalhada",
    uf: "UF",
    fornecedor: "Fornecedor",
    telefone: "Telefone",
    email: "Email",
    uf_municipio: "UF/Município",
    quantidade_registrada: "Qtd Registrada",
    saldo_adesao: "Saldo Adesão",
    vigencia_inicial: "Vigência Inicial",
    vigencia_final: "Vigência Final",
    descricao_pdm: "Descrição PDM",
    acao: "Ação",
  };

  return (
    <div className="app-wrapper">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header__content">
          <img
            src="https://unespar.edu.br/++theme++tema-unespar-plone/img/logo-unespar.png"
            alt="UNESPAR"
            className="app-header__logo"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div>
            <h1 className="app-header__title">Buscador ARP – Sistema de Compras</h1>
            <p className="app-header__subtitle">Universidade Estadual do Paraná</p>
          </div>
        </div>
      </header>
      <div className="app-header__accent" />

      {/* ── Main ── */}
      <main className="app-main">
        <div className="page-title">
          <Package size={20} />
          <h2>ARP – Busca por Palavra-chave</h2>
        </div>

        {/* ── Search card ── */}
        <div className="card mb-3">
          <div className="search-toolbar">
            {/* Keyword input */}
            <div className="search-field">
              <label className="field-label">Palavra-chave</label>
              <div className="input-icon-wrapper">
                <Search size={15} className="input-icon" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="Digite e pressione Enter..."
                  className="text-input search-input"
                  disabled={isFetching}
                />
              </div>

              {loadingSuggestions && (
                <div className="suggestions-dropdown">
                  <span className="text-muted text-sm">Buscando sugestões de PDM…</span>
                </div>
              )}

              {showSuggestions && pdmSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  <div className="suggestions-header">
                    <strong className="text-primary">Sugestões de Código PDM</strong>
                    <button className="btn-icon" onClick={() => setShowSuggestions(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  {(() => {
                    const itemsPerPage = 6;
                    const totalSugPages = Math.min(
                      8,
                      Math.ceil(pdmSuggestions.length / itemsPerPage)
                    );
                    const startIdx = suggestionPage * itemsPerPage;
                    const currentPageItems = pdmSuggestions.slice(startIdx, startIdx + itemsPerPage);
                    return (
                      <>
                        {currentPageItems.map((item, idx) => (
                          <div
                            key={startIdx + idx}
                            className="suggestion-item"
                            onClick={() => {
                              setTempAdvancedFilters({
                                ...tempAdvancedFilters,
                                codigoPdm: String(item.codigoPDM).padStart(5, "0"),
                              });
                              setShowSuggestions(false);
                              setSuggestionPage(0);
                            }}
                          >
                            <div className="suggestion-item__code">
                              <Package size={12} />
                              {item.codigoPDM} – {item.nome}
                            </div>
                            <div className="suggestion-item__sub">
                              Classe: {item.nomeClasse || "N/A"}
                            </div>
                          </div>
                        ))}
                        {totalSugPages > 1 && (
                          <div className="suggestions-pagination">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSuggestionPage(Math.max(0, suggestionPage - 1));
                              }}
                              disabled={suggestionPage === 0}
                              className="btn btn-sm btn-outline"
                            >
                              <ChevronLeft size={13} /> Anterior
                            </button>
                            <span className="text-muted text-sm">
                              {suggestionPage + 1} / {totalSugPages}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSuggestionPage(Math.min(totalSugPages - 1, suggestionPage + 1));
                              }}
                              disabled={suggestionPage >= totalSugPages - 1}
                              className="btn btn-sm btn-outline"
                            >
                              Próxima <ChevronRight size={13} />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="btn-group">
              <button
                onClick={handleSearch}
                disabled={!search.trim() || isFetching}
                className="btn btn-primary"
              >
                <Search size={14} />
                {isFetching ? "Buscando…" : "Buscar"}
              </button>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}

                className={`btn btn-filter${activeFiltersCount > 0 ? " has-badge" : ""}`}
              >
                <Filter size={14} />
                Filtros
                {activeFiltersCount > 0 && <span className="badge">{activeFiltersCount}</span>}
                <ChevronDown
                  size={13}
                  style={{
                    transition: "transform 0.2s",
                    transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
            </div>

            {/* Right toolbar */}
            <div className="toolbar-right">
              <label className="field-label-inline">
                Itens/pág.
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
  
                  className="select-sm"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                </select>
              </label>

              <button
                disabled={!displayedResults.length}
                onClick={() => {
                  const count =
                    selectedItems.size > 0 ? selectedItems.size : displayedResults.length;
                  const message =
                    selectedItems.size > 0
                      ? `Exportar ${count} registro(s) selecionado(s) para Excel?`
                      : `Nenhum item selecionado. Exportar todos os ${count} registros desta página para Excel?`;
                  if (window.confirm(message)) exportExcel();
                }}
                className="btn btn-export"
              >
                <Download size={14} />
                Exportar{" "}
                {selectedItems.size > 0
                  ? `(${selectedItems.size})`
                  : `(${displayedResults.length})`}
              </button>
            </div>
          </div>
        </div>


        {/* ── Advanced filters ── */}
        {showAdvanced && (
          <div className="card filters-card mb-3">
            <div className="filters-card__header">
              <div className="filters-card__title">
                <Filter size={16} /> Filtros Avançados
              </div>
              <button onClick={clearAdvancedFilters} className="btn btn-sm btn-danger">
                <Trash2 size={13} /> Limpar
              </button>
            </div>

            <div className="filters-grid">
              <label className="filter-field">
                <span className="field-label">Status</span>
                <select
                  value={tempAdvancedFilters.status || "vigente"}
                  onChange={(e) => handleAdvancedFilterChange("status", e.target.value)}
                  className="select-input"
                >
                  <option value="">Todos</option>
                  <option value="vigente">Vigente</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </label>

              <label className="filter-field">
                <span className="field-label">Código PDM</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.codigoPdm || ""}
                  onChange={(e) => handleAdvancedFilterChange("codigoPdm", e.target.value)}
                  placeholder="Ex: 12345 ou 19766, 19266"
                  className="text-input"
                />
                {tempAdvancedFilters.codigoPdm &&
                  String(tempAdvancedFilters.codigoPdm).includes(",") && (
                    <span className="field-hint">
                      <Info size={11} />
                      {
                        String(tempAdvancedFilters.codigoPdm)
                          .split(",")
                          .filter((c) => c.trim()).length
                      }{" "}
                      código(s)
                    </span>
                  )}
              </label>

              <label className="filter-field">
                <span className="field-label">Órgão</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.orgao || ""}
                  onChange={(e) => handleAdvancedFilterChange("orgao", e.target.value)}
                  placeholder="Nome do órgão"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">UASG</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.uasg || ""}
                  onChange={(e) => handleAdvancedFilterChange("uasg", e.target.value)}
                  placeholder="Código UASG"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Modalidade</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.modalidade || ""}
                  onChange={(e) => handleAdvancedFilterChange("modalidade", e.target.value)}
                  placeholder="Ex: Pregão Eletrônico"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Número ARP</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.numeroArp || ""}
                  onChange={(e) => handleAdvancedFilterChange("numeroArp", e.target.value)}
                  placeholder="Número da ARP"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Número Processo</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.numeroProcesso || ""}
                  onChange={(e) => handleAdvancedFilterChange("numeroProcesso", e.target.value)}
                  placeholder="Número do processo"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Fornecedor</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.fornecedor || ""}
                  onChange={(e) => handleAdvancedFilterChange("fornecedor", e.target.value)}
                  placeholder="Nome do fornecedor"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">CNPJ Fornecedor</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.cnpjFornecedor || ""}
                  onChange={(e) => handleAdvancedFilterChange("cnpjFornecedor", e.target.value)}
                  placeholder="CNPJ"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Validade Início</span>
                <input
                  type="date"
                  value={tempAdvancedFilters.validadeInicio || ""}
                  onChange={(e) => handleAdvancedFilterChange("validadeInicio", e.target.value)}
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Validade Fim</span>
                <input
                  type="date"
                  value={tempAdvancedFilters.validadeFim || ""}
                  onChange={(e) => handleAdvancedFilterChange("validadeFim", e.target.value)}
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Valor Mínimo</span>
                <input
                  type="number"
                  value={tempAdvancedFilters.valorMin || ""}
                  onChange={(e) => handleAdvancedFilterChange("valorMin", e.target.value)}
                  placeholder="R$ mínimo"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Valor Máximo</span>
                <input
                  type="number"
                  value={tempAdvancedFilters.valorMax || ""}
                  onChange={(e) => handleAdvancedFilterChange("valorMax", e.target.value)}
                  placeholder="R$ máximo"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">UF</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.uf || ""}
                  onChange={(e) => handleAdvancedFilterChange("uf", e.target.value)}
                  placeholder="Ex: PR, SP, RJ"
                  maxLength={2}
                  className="text-input uppercase"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Município</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.municipio || ""}
                  onChange={(e) => handleAdvancedFilterChange("municipio", e.target.value)}
                  placeholder="Nome do município"
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Ano da Compra</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.anoCompra || ""}
                  onChange={(e) => handleAdvancedFilterChange("anoCompra", e.target.value)}
                  placeholder="Ex: 2024"
                  maxLength={4}
                  className="text-input"
                />
              </label>

              <label className="filter-field">
                <span className="field-label">Descrição PDM</span>
                <input
                  type="text"
                  value={tempAdvancedFilters.descricaoPdm || ""}
                  onChange={(e) => handleAdvancedFilterChange("descricaoPdm", e.target.value)}
                  placeholder="Descrição do item"
                  className="text-input"
                />
              </label>
            </div>

            <p className="field-hint mt-2">
              <Info size={12} /> Os filtros avançados são aplicados ao clicar em "Buscar"
            </p>
          </div>
        )}

        {/* ── Status messages ── */}
        {!searchQuery && (
          <div className="alert alert-info">
            <Info size={16} />
            <span>
              Digite uma <strong>palavra-chave</strong> no campo de busca e clique em "Buscar" (ou
              pressione Enter)
              <br />
              <small>Exemplos: computador, papel, caneta, cafe, etc.</small>
            </span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <Info size={16} />
            <span>
              Erro ao buscar dados:{" "}
              {error instanceof Error ? error.message : "Erro desconhecido"}
              <br />
              <small>Tente novamente ou use outra palavra-chave.</small>
            </span>
          </div>
        )}

        {isFetching && (
          <div className="alert alert-warning">
            <Info size={16} />
            <span>Aguarde… buscando dados da API (pode levar alguns segundos)</span>
          </div>
        )}

        {/* ── Pagination bar ── */}
        {searchQuery && !isFetching && !error && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Total: <strong>{totalRecords}</strong> registros &nbsp;|&nbsp; Página{" "}
              <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <div className="pagination-controls">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1 || isFetching}
                className="btn btn-sm btn-page"
                title="Primeira página"
              >
                <ChevronsLeft size={15} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="btn btn-sm btn-page"
                title="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="pagination-page-input">
                Pág.
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const newPage = parseInt(e.target.value);
                    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
                  }}
                  className="page-input"
                />
                de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="btn btn-sm btn-page"
                title="Próxima página"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || isFetching}
                className="btn btn-sm btn-page"
                title="Última página"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Table section ── */}
        {!isFetching && displayedResults.length > 0 && (
          <>
            {/* Column visibility chips */}
            <div className="card column-vis-card mb-2">
              <div className="column-vis-label">
                <Eye size={14} /> Colunas Visíveis
              </div>
              <div className="column-chips">
                {(Object.keys(visibleColumns) as Array<keyof typeof visibleColumns>).map((key) => (
                  <button
                    key={key}
                    onClick={() => toggleColumnVisibility(key)}
                    className={`column-chip${visibleColumns[key] ? " column-chip--active" : ""}`}
                  >
                    {visibleColumns[key] ? <Check size={11} /> : <Eye size={11} />}
                    {columnLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Dual scroll */}
            <div ref={topScrollRef} onScroll={handleTopScroll} className="top-scroll">
              <div ref={topScrollContentRef} style={{ height: 1 }} />
            </div>

            {/* Table */}
            <div ref={tableScrollRef} onScroll={handleTableScroll} className="table-wrapper">
              <table ref={tableRef} className="data-table">
                <thead>
                  <tr>
                    <th className="th th-checkbox">
                      <input
                        type="checkbox"
                        checked={
                          selectedItems.size === displayedResults.length &&
                          displayedResults.length > 0
                        }
                        onChange={toggleSelectAll}
                        title="Selecionar todos"
                      />
                    </th>
                    {visibleColumns.numero && (
                      <th className="th" style={{ minWidth: 80 }}>
                        <span className="th-sort" onClick={() => handleSort(0)}>
                          Número <SortIcon colIndex={0} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.unidade_gerenciadora && (
                      <th className="th" style={{ minWidth: 150 }}>
                        <span className="th-sort" onClick={() => handleSort(1)}>
                          Unidade Gerenciadora <SortIcon colIndex={1} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.numero_item_compra && (
                      <th className="th" style={{ minWidth: 100 }}>
                        <span className="th-sort" onClick={() => handleSort(2)}>
                          Nº Item Compra <SortIcon colIndex={2} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.codigo_pdm && (
                      <th className="th th-highlight" style={{ minWidth: 100 }}>
                        <span className="th-sort" onClick={() => handleSort(3)}>
                          Código PDM <SortIcon colIndex={3} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.descricao_detalhada && (
                      <th className="th" style={{ minWidth: 300 }}>
                        <span className="th-sort" onClick={() => handleSort(4)}>
                          Descrição Detalhada <SortIcon colIndex={4} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.uf && (
                      <th className="th" style={{ minWidth: 50 }}>
                        <span className="th-sort" onClick={() => handleSort(5)}>
                          UF <SortIcon colIndex={5} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.fornecedor && (
                      <th className="th" style={{ minWidth: 200 }}>
                        <span className="th-sort" onClick={() => handleSort(6)}>
                          Fornecedor <SortIcon colIndex={6} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.telefone && (
                      <th className="th" style={{ minWidth: 120 }}>
                        <span className="th-sort" onClick={() => handleSort(7)}>
                          Telefone <SortIcon colIndex={7} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th className="th" style={{ minWidth: 200 }}>
                        <span className="th-sort" onClick={() => handleSort(8)}>
                          Email <SortIcon colIndex={8} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.uf_municipio && (
                      <th className="th" style={{ minWidth: 200 }}>
                        <span className="th-sort" onClick={() => handleSort(9)}>
                          UF/Município <SortIcon colIndex={9} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.quantidade_registrada && (
                      <th className="th" style={{ minWidth: 80 }}>
                        <span className="th-sort" onClick={() => handleSort(10)}>
                          Qtd Registrada <SortIcon colIndex={10} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.saldo_adesao && (
                      <th className="th" style={{ minWidth: 80 }}>
                        <span className="th-sort" onClick={() => handleSort(11)}>
                          Saldo Adesão <SortIcon colIndex={11} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.vigencia_inicial && (
                      <th className="th" style={{ minWidth: 100 }}>
                        <span className="th-sort" onClick={() => handleSort(12)}>
                          Vigência Inicial <SortIcon colIndex={12} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.vigencia_final && (
                      <th className="th" style={{ minWidth: 100 }}>
                        <span className="th-sort" onClick={() => handleSort(13)}>
                          Vigência Final <SortIcon colIndex={13} />
                        </span>
                      </th>
                    )}
                    {visibleColumns.descricao_pdm && (
                      <th className="th" style={{ minWidth: 200 }}>
                        Descrição PDM
                      </th>
                    )}
                    {visibleColumns.acao && (
                      <th className="th" style={{ minWidth: 80, textAlign: "center" }}>
                        Ação
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedResults.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`tr${selectedItems.has(idx) ? " tr--selected" : ""}`}
                    >
                      <td className="td td-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(idx)}
                          onChange={() => toggleSelectItem(idx)}
                        />
                      </td>
                      {visibleColumns.numero && <td className="td">{row.numero || "-"}</td>}
                      {visibleColumns.unidade_gerenciadora && (
                        <td className="td">{row.unidade_gerenciadora || "-"}</td>
                      )}
                      {visibleColumns.numero_item_compra && (
                        <td className="td">{row.numero_item_compra || "-"}</td>
                      )}
                      {visibleColumns.codigo_pdm && (
                        <td className="td td-bold td-highlight">{row.codigo_pdm || "-"}</td>
                      )}
                      {visibleColumns.descricao_detalhada && (
                        <td className="td">
                          {row.descricaoDetalhada || row.descricaodetalhada || "-"}
                        </td>
                      )}
                      {visibleColumns.uf && (
                        <td className="td">{row.unidade_federacao || "-"}</td>
                      )}
                      {visibleColumns.fornecedor && (
                        <td className="td">{row.fornecedor || "-"}</td>
                      )}
                      {visibleColumns.telefone && (
                        <td className="td">
                          {cnpjData[idx] ? (
                            <div className="cnpj-cell">
                              <span>{cnpjData[idx].telefone || "-"}</span>
                              <button
                                onClick={() => fetchCnpjData(row.fornecedor, idx)}
                                className="btn btn-xs btn-outline"
                                disabled={loadingCnpj[idx]}
                              >
                                <Phone size={11} />
                                {loadingCnpj[idx] ? "…" : "Atualizar"}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => fetchCnpjData(row.fornecedor, idx)}
                              className="btn btn-xs btn-success"
                              disabled={loadingCnpj[idx] || !extractCnpj(row.fornecedor)}
                            >
                              <Phone size={11} />
                              {loadingCnpj[idx] ? "Buscando…" : "Buscar"}
                            </button>
                          )}
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="td">{cnpjData[idx]?.email || row.email || "-"}</td>
                      )}
                      {visibleColumns.uf_municipio && (
                        <td className="td">
                          {cnpjData[idx]?.uf && cnpjData[idx]?.municipio
                            ? `${cnpjData[idx].uf} / ${cnpjData[idx].municipio}`
                            : "-"}
                        </td>
                      )}
                      {visibleColumns.quantidade_registrada && (
                        <td className="td">{row.quantidade_registrada || "-"}</td>
                      )}
                      {visibleColumns.saldo_adesao && (
                        <td className="td">{row.saldo_adesao || "-"}</td>
                      )}
                      {visibleColumns.vigencia_inicial && (
                        <td className="td">{row.vigencia_inicial || "-"}</td>
                      )}
                      {visibleColumns.vigencia_final && (
                        <td className="td">{row.vigencia_final || "-"}</td>
                      )}
                      {visibleColumns.descricao_pdm && (
                        <td className="td">{row.descricao_pdm || row.descricaoPdm || "-"}</td>
                      )}
                      {visibleColumns.acao && (
                        <td className="td" style={{ textAlign: "center" }}>
                          {(() => {
                            const match = typeof row.acao === "string" && row.acao.match(/href="([^"]+)"/);
                            const url = match ? match[1] : null;
                            return url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-xs btn-outline"
                                title="Ver detalhes no portal"
                              >
                                <Eye size={13} />
                                Ver
                              </a>
                            ) : "-";
                          })()}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {!isFetching && searchQuery && displayedResults.length === 0 && !error && (
          <div className="empty-state">
            <Package size={44} className="empty-state__icon" />
            <p>
              Nenhum registro encontrado com a palavra-chave "<strong>{searchQuery}</strong>".
              <br />
              <small>Tente outra palavra.</small>
            </p>
          </div>
        )}

        {/* ── Footer hint ── */}
        {totalPages > 1 && !isFetching && (
          <div className="alert alert-success mt-2">
            <Info size={14} />
            <span>
              Use os botões de navegação acima para ver mais resultados. Clique nos cabeçalhos das
              colunas para ordenar.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
