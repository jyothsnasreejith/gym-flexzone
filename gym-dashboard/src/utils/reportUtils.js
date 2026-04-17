export const toDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeDateValue = (value) => {
  if (!value) return null;
  if (typeof value === "string" && value.length === 10) {
    return `${value}T00:00:00`;
  }
  return value;
};

export const parseDate = (value) => {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateOnly = (value) => {
  const date = parseDate(value);
  return date ? toDateOnly(date) : "";
};

export const formatCurrency = (value) => `\u20B9${Number(value || 0).toFixed(2)}`;

export const formatSignedCurrency = (value, sign) =>
  `${sign}\u20B9${Number(value || 0).toFixed(2)}`;

export const createDefaultRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateOnly(start), to: toDateOnly(now) };
};

export const isRangeValid = (range) =>
  Boolean(range.from && range.to && range.from <= range.to);

export const escapeCsv = (value) => {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const buildCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCsv).join(",");
  const lines = rows.map((row) =>
    headers.map((key) => escapeCsv(row[key])).join(",")
  );
  return [headerLine, ...lines].join("\n");
};

export const downloadCsv = (filename, headers, rows) => {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
