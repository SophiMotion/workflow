import { useWorkbenchStore } from '../../store/workbench-store';

export function BomTable() {
  const model = useWorkbenchStore((state) => state.model);
  if (!model) return null;
  const components = new Map(model.components.map((item) => [item.id, item]));
  return (
    <div className="bom-scroll">
      <table className="data-table bom-table">
        <thead><tr><th>零件号</th><th>名称</th><th>数量</th><th>材料</th></tr></thead>
        <tbody>
          {model.bom.map((row) => {
            const component = components.get(row.componentId);
            return (
              <tr key={row.componentId}>
                <td>{row.partNumber ?? '—'}</td>
                <td>{component?.name ?? row.componentId}</td>
                <td>{row.quantity}</td>
                <td>{row.material ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
