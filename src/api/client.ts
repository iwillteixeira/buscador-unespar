import axios from "axios";

export type ArpItem = {
  descricaoDetalhada: string;
  descricaodetalhada?: string;
  unidade_federacao: string;
  id: number;
  numero_item_compra: string;
  codigo_pdm: string;
  descricao_pdm: string;
  descricaoPdm?: string;
  fornecedor: string;
  unidade_gerenciadora: string;
  quantidade_registrada: string;
  saldo_adesao: string;
  numero: string;
  vigencia_inicial: string;
  vigencia_final: string;
  catmatseritem_id: string;
  nome_resumido: string;
  palavra_chave?: string;
  acao?: string;
};

export type ApiResponse = {
  data: ArpItem[];
  recordsTotal: number;
  recordsFiltered: number;
};

export type AdvancedFilters = {
  status?: string;
  codigoUnidade?: string;
  modalidadeCompra?: string;
  descricaodetalhada?: string;
  dataFim?: string;
  numeroAta?: string;
  numeroCompra?: string;
  anoCompra?: string;
  codigoItem?: string;
  descricaoItem?: string;
  numeroItemCompra?: string;
  esfera?: string;
  uf?: string;
  municipio?: string;
  codigoPdm?: string;
  descricaoPdm?: string;
};

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  timeout: 30000,
});

export async function fetchArpItens(params: {
  page: number;
  pageSize: number;
  column: string;
  value: string;
  orderColumn?: number;
  orderDir?: "asc" | "desc";
  advancedFilters?: AdvancedFilters;
}): Promise<ApiResponse> {
  const body = new URLSearchParams();

  body.append("start", String((params.page - 1) * params.pageSize));
  body.append("length", String(params.pageSize));
  body.append("search[value]", "");
  body.append("search[regex]", "false");

  // Definir todas as colunas como no original
  const columns = [
    "numero",
    "unidade_gerenciadora",
    "numero_item_compra",
    "codigo_pdm",
    "descricaodetalhada",
    "unidade_federacao",
    "fornecedor",
    "quantidade_registrada",
    "saldo_adesao",
    "vigencia_inicial",
    "vigencia_final",
    "acao",
    "", "", "", "",
    "descricaoPdm"
  ];

  columns.forEach((col, idx) => {
    body.append(`columns[${idx}][data]`, col);
    body.append(`columns[${idx}][name]`, col);
    body.append(`columns[${idx}][searchable]`, "true");
    body.append(`columns[${idx}][orderable]`, idx === 16 ? "false" : "true");
    body.append(`columns[${idx}][search][value]`, "");
    body.append(`columns[${idx}][search][regex]`, "false");
  });

  // Ordenação
  body.append("order[0][column]", String(params.orderColumn || 0));
  body.append("order[0][dir]", params.orderDir || "asc");

  // Filtro principal (palavra-chave)
  let filterIndex = 0;
  if (params.value) {
    body.append(`camposFiltro[${filterIndex}][name]`, params.column);
    body.append(`camposFiltro[${filterIndex}][value]`, params.value);
    filterIndex++;
  }
  
  // Filtros avançados
  const filters = params.advancedFilters || {};
  const filterMap: [string, string][] = [
    ["status", filters.status || "vigente"],
    ["codigoUnidade", filters.codigoUnidade || ""],
    ["modalidadeCompra", filters.modalidadeCompra || ""],
    ["descricaodetalhada", filters.descricaodetalhada || ""],
    ["dataFim", filters.dataFim || ""],
    ["numeroAta", filters.numeroAta || ""],
    ["numeroCompra", filters.numeroCompra || ""],
    ["anoCompra", filters.anoCompra || ""],
    ["codigoItem", filters.codigoItem || ""],
    ["descricaoItem", filters.descricaoItem || ""],
    ["numeroItemCompra", filters.numeroItemCompra || ""],
    ["esfera", filters.esfera || ""],
    ["uf", filters.uf || ""],
    ["municipio", filters.municipio || ""],
    ["codigoPdm", filters.codigoPdm || ""],
    ["descricaoPdm", filters.descricaoPdm || ""],
  ];

  filterMap.forEach(([name, value]) => {
    body.append(`camposFiltro[${filterIndex}][name]`, name);
    body.append(`camposFiltro[${filterIndex}][value]`, value);
    filterIndex++;
  });

  const { data } = await api.post<ApiResponse>(
    "/transparencia/transparencia/arp-item",
    body
  );

  return data;
}
