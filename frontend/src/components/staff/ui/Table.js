// <Table><thead><tr><Th>Name</Th></tr></thead><tbody><tr><Td>...</Td></tr></tbody></Table>
export function Table({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export const Th = (props) => <th className="bg-surface px-6 py-4 font-semibold text-muted" {...props} />;
export const Td = (props) => <td className="border-t border-line px-6 py-4" {...props} />;