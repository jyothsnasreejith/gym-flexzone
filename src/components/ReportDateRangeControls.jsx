const ReportDateRangeControls = ({ range, onChange, disabled }) => (
  <div className="grid gap-2 text-xs">
    <label className="grid grid-cols-[44px_1fr] items-center gap-2 text-gray-500">
      <span>From</span>
      <input
        type="date"
        value={range.from}
        onChange={(e) => onChange({ ...range, from: e.target.value })}
        className="w-full rounded-md border px-2 py-1 text-xs text-gray-700"
        disabled={disabled}
      />
    </label>
    <label className="grid grid-cols-[44px_1fr] items-center gap-2 text-gray-500">
      <span>To</span>
      <input
        type="date"
        value={range.to}
        onChange={(e) => onChange({ ...range, to: e.target.value })}
        className="w-full rounded-md border px-2 py-1 text-xs text-gray-700"
        disabled={disabled}
      />
    </label>
  </div>
);

export default ReportDateRangeControls;
