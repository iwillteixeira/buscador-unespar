import type { FilterOp } from "../api/types";

export function Filters(props: {
  columns: string[];
  filterColumn: string;
  setFilterColumn: (v: string) => void;
  filterOp: FilterOp;
  setFilterOp: (v: FilterOp) => void;
  filterValue: string;
  setFilterValue: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <label>
        Coluna:&nbsp;
        <select value={props.filterColumn} onChange={(e) => props.setFilterColumn(e.target.value)}>
          {props.columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Operação:&nbsp;
        <select value={props.filterOp} onChange={(e) => props.setFilterOp(e.target.value as FilterOp)}>
          <option value="contains">contém</option>
          <option value="equals">igual</option>
          <option value="startsWith">começa com</option>
          <option value="word">palavra inteira</option>
          <option value="regex">regex</option>
        </select>
      </label>

      <label style={{ flex: "1 1 280px" }}>
        Buscar:&nbsp;
        <input
          style={{ width: "100%" }}
          value={props.filterValue}
          onChange={(e) => props.setFilterValue(e.target.value)}
          placeholder='Ex: cone (use "palavra inteira" para não trazer "microfone")'
        />
      </label>
    </div>
  );
}
