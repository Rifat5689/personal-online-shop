import { CardResetMenu, useReportCard } from "../../../components/common/CardReset";
import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React, { useEffect, useId, useRef, useState } from "react";
import { money } from "../../../components/common/QueryState";
const options = {
  revenue: "Revenue",
  orders: "Orders",
  views: "Page views",
  clicks: "Product clicks"
};
export function AnalyticsTrend({
  daily
}) {
  const {
    t
  } = usePageTranslation();
  const report = useReportCard("analytics-trend");
  daily = report.data?.daily || daily;
  const chart = useRef(null);
  const [width, setWidth] = useState(740);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  const [metric, setMetric] = useState("revenue");
  const [point, setPoint] = useState(null);
  const gradient = useId().replace(/:/g, "");
  const index = Math.min(point ?? daily.length - 1, daily.length - 1);
  const selected = daily[index];
  const previousKey = `previous${metric[0].toUpperCase()}${metric.slice(1)}`;
  const maximum = Math.max(1, ...daily.flatMap(day => [day[metric], day[previousKey]]));
  const x = i => 30 + i / Math.max(1, daily.length - 1) * (width - 60);
  const y = value => 200 - value / maximum * 165;
  const path = key => daily.map((day, i) => `${i ? "L" : "M"}${x(i)},${y(day[key])}`).join(" ");
  const inspectPoint = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width * width;
    setPoint(Math.max(0, Math.min(daily.length - 1, Math.round((position - 30) / (width - 60) * (daily.length - 1)))));
  };
  const total = daily.reduce((sum, day) => sum + (day[metric] || 0), 0);
  const format = value => metric === "revenue" ? money(value) : new Intl.NumberFormat("en-BD").format(value);
  return <section className="analytics-card analytics-trend card-reset-surface" data-report-card="analytics-trend"><CardResetMenu cardId="analytics-trend" title="Performance over time" />
    <div className="analytics-section-heading"><div><h2>{t("Performance over time")}</h2><p>{t("Compared with the previous equal-length period")}</p></div><div className="analytics-chart-tabs" role="group" aria-label={t("Chart metric")}>{Object.entries(options).map(([key, label]) => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{t(label)}</button>)}</div></div>
    <div className="analytics-chart-summary"><div><small>{options[metric]}{t(" in selected period")}</small><strong>{format(total)}</strong></div><span><i />{t("Current period")}<i className="previous" />{t("Previous period")}</span></div>
    <svg onPointerMove={event => {
      if (event.pointerType === "mouse" || event.buttons) inspectPoint(event);
    }} onPointerDown={inspectPoint} ref={chart} viewBox={`0 0 ${width} 230`} role="img" aria-label={`${options[metric]} chart, current and previous period`}>
      <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#008459" stopOpacity=".18" /><stop offset="100%" stopColor="#008459" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => <g key={i}><line x1="30" x2={width - 30} y1={35 + i * 55} y2={35 + i * 55} stroke="#edf1f7" /><text x={width - 30} y={29 + i * 55} textAnchor="end" fill="#8b98aa" fontSize="10">{new Intl.NumberFormat("en", {
            notation: "compact"
          }).format(maximum * (1 - i / 3))}</text></g>)}
      <path d={`${path(metric)} L${width - 30},200 L30,200 Z`} fill={`url(#${gradient})`} />
      <path d={path(previousKey)} fill="none" stroke="#a5b4c8" strokeWidth="2" strokeDasharray="6 5" />
      <path d={path(metric)} fill="none" stroke="#008459" strokeWidth="2.5" strokeLinejoin="round" />
      {selected && <><line x1={x(index)} x2={x(index)} y1="25" y2="200" stroke="#008459" strokeDasharray="3 4" opacity=".35" /><circle cx={x(index)} cy={y(selected[metric])} r="5" fill="#008459" stroke="white" strokeWidth="2" /></>}
      <text x="30" y="224" fontSize="11" fill="#71849a">{daily[0]?.date}</text><text x={width - 30} y="224" textAnchor="end" fontSize="11" fill="#71849a">{daily.at(-1)?.date}</text>
    </svg>
    <div className="analytics-day-detail" aria-live="polite"><span>{selected?.date}</span><strong>{format(selected?.[metric] || 0)}</strong><small>{t("Previous period: ")}{format(selected?.[previousKey] || 0)}</small></div>
    <input className="analytics-chart-slider" aria-label={t("Inspect chart date")} type="range" min="0" max={Math.max(0, daily.length - 1)} value={index} aria-valuetext={selected ? `${selected.date}: ${format(selected[metric])}; previous period ${format(selected[previousKey])}` : "No data"} onChange={event => setPoint(Number(event.target.value))} />
    <p className="analytics-footnote">{t("Tap the chart or use the slider to compare a day. Dates use Asia/Dhaka.")}</p>
  </section>;
}
