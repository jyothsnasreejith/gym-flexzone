const pad2 = (value) => String(value).padStart(2, "0");

const toDateOnly = (date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

const safeDateFromYMD = (dateStr) => {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const normalizeDate = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const normalizeFestivalRows = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((row) => row?.festival_date && row?.name)
    .map((row) => ({
      id: row.id ?? `${row.name}-${row.festival_date}`,
      name: row.name,
      message: row.message || "",
      festivalDate: safeDateFromYMD(row.festival_date),
    }))
    .filter((festival) => festival.festivalDate);
};

export const getFestivalsForDate = (rows = [], date = new Date()) => {
  const target = toDateOnly(date);
  const festivals = normalizeFestivalRows(rows);

  return festivals.filter(
    (festival) => toDateOnly(festival.festivalDate) === target
  );
};

export const getUpcomingFestivals = (
  rows = [],
  date = new Date(),
  days = 30,
  includeToday = false
) => {
  const baseDate = normalizeDate(date);
  const minDays = includeToday ? 0 : 1;
  const festivals = normalizeFestivalRows(rows);

  return festivals
    .map((festival) => {
      const nextDate = normalizeDate(festival.festivalDate);
      const daysUntil = Math.round(
        (nextDate - baseDate) / (1000 * 60 * 60 * 24)
      );

      return {
        ...festival,
        daysUntil,
      };
    })
    .filter((festival) => festival.daysUntil >= minDays && festival.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
};
