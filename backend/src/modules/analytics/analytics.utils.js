import ApiError from "../../utils/ApiError.js";
const day = 86400000;
export function analyticsRange(query, now = new Date()) {
  let start, end;
  if (query.start || query.end) {
    const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && new Date(value).toISOString().slice(0, 10) === value;
    try {
      if (!valid(query.start) || !valid(query.end)) throw new Error();
      start = new Date(`${query.start}T00:00:00+06:00`);
      end = new Date(new Date(`${query.end}T00:00:00+06:00`).getTime() + day);
    } catch { throw new ApiError(400, "Choose valid start and end dates"); }
  } else {
    const days = Number(query.days || 30);
    if (![7, 30, 90].includes(days)) throw new ApiError(400, "Choose 7, 30 or 90 days");
    const localDate = new Date(now.getTime() + 6 * 3600000).toISOString().slice(0, 10);
    end = new Date(new Date(`${localDate}T00:00:00+06:00`).getTime() + day);
    start = new Date(end.getTime() - days * day);
  }
  const duration = end - start;
  if (duration <= 0 || duration > 366 * day) throw new ApiError(400, "Choose a date range of up to 366 days");
  return { start, end, previousStart: new Date(start.getTime() - duration), days: duration / day };
}
export function changePercent(current, previous) {
  return previous === 0 ? null : Math.round((current - previous) / previous * 1000) / 10;
}
