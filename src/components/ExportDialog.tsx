export function ExportDialog(props: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  count: number;
  format: "xls" | "xlsx";
  setFormat: (v: "xls" | "xlsx") => void;
}) {
  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div style={{ background: "white", borderRadius: 12, padding: 16, width: "min(520px, 100%)" }}>
        <h3 style={{ marginTop: 0 }}>Exportar para Excel?</h3>
        <p>Você vai exportar <b>{props.count}</b> registros (já filtrados).</p>

        <label>
          Formato:&nbsp;
          <select value={props.format} onChange={(e) => props.setFormat(e.target.value as any)}>
            <option value="xls">.xls (mais antigo)</option>
            <option value="xlsx">.xlsx (recomendado)</option>
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={props.onCancel}>Cancelar</button>
          <button onClick={props.onConfirm}>Exportar</button>
        </div>
      </div>
    </div>
  );
}
