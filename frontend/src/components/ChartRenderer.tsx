"use client";

import React, { useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

interface ChartRendererProps {
  tableData: { headers: string[]; rows: any[][] };
  visualizationType?: "bar" | "line" | "pie" | "area" | "auto" | string | null;
  isWidget?: boolean;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b"];

export function ChartRenderer({ tableData, visualizationType = "auto", isWidget = false }: ChartRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Theme-aware color tokens — no more hardcoded hex
  const axisStroke   = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
  const tickFill     = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const gridStroke   = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const tooltipBg    = isDark ? "rgba(17,17,24,0.95)"    : "rgba(255,255,255,0.98)";
  const tooltipBdr   = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const tooltipHead  = isDark ? "#e2e8f0" : "#0f172a";
  const tooltipText  = isDark ? "#94a3b8"  : "#475569";
  const dotFill      = isDark ? "#111118"  : "#ffffff";
  const wrapperBg    = isDark ? "rgba(17,17,24,0.7)"     : "rgba(248,250,252,0.9)";
  const wrapperBdr   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const cursorFill   = isDark ? "rgba(99,102,241,0.06)"  : "rgba(99,102,241,0.04)";

  const { headers, rows } = tableData;

  const processedData = useMemo(() => {
    return rows.map((row) => {
      const obj: any = {};
      headers.forEach((header, i) => {
        const val = row[i];
        obj[header] = typeof val === "string" && !isNaN(Number(val)) && val.trim() !== ""
          ? Number(val)
          : val;
      });
      return obj;
    });
  }, [headers, rows]);

  const { xAxisKey, yAxisKeys } = useMemo(() => {
    let xAxis = "";
    const yAxes: string[] = [];
    if (processedData.length > 0) {
      const first = processedData[0];
      const strings = headers.filter(h => typeof first[h] === "string" && h !== "SOURCE_DATABASE");
      xAxis = strings[0] ?? headers.find(h => h !== "SOURCE_DATABASE") ?? headers[0];
      yAxes.push(...headers.filter(h => typeof first[h] === "number" && h !== "SOURCE_DATABASE"));
      if (yAxes.length === 0) {
        const fb = headers.find(h => h !== xAxis && h !== "SOURCE_DATABASE");
        if (fb) yAxes.push(fb); else if (headers[1]) yAxes.push(headers[1]);
      }
    }
    return { xAxisKey: xAxis, yAxisKeys: yAxes };
  }, [headers, processedData]);

  if (!processedData.length || !xAxisKey || !yAxisKeys.length) {
    return <p className="p-4 text-sm text-muted-foreground">Not enough numerical data to render a chart.</p>;
  }

  let actualType = visualizationType;
  if (actualType === "auto" || !actualType) {
    if (processedData.length > 20) actualType = "line";
    else if (yAxisKeys.length === 1 && processedData.length <= 10) actualType = "pie";
    else actualType = "bar";
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: tooltipBg,
        border: `1px solid ${tooltipBdr}`,
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        backdropFilter: "blur(12px)",
      }}>
        <p style={{ fontWeight: 600, color: tooltipHead, marginBottom: 6, fontSize: 13 }}>{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
            <span style={{ color: tooltipText }}>{entry.name}:</span>
            <span style={{ fontWeight: 600, color: tooltipHead, fontVariantNumeric: "tabular-nums" }}>
              {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const axisProps = {
    stroke: axisStroke,
    tick: { fill: tickFill, fontSize: 11 },
    tickMargin: 8,
  };

  const renderChart = () => {
    switch (actualType) {
      case "pie":
        return (
          <PieChart>
            <Pie
              data={processedData}
              dataKey={yAxisKeys[0]}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={55}
              paddingAngle={4}
              label={({ name, percent }) => percent !== undefined && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : null}
              labelLine={false}
              stroke="none"
            >
              {processedData.map((_: any, i: number) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: tickFill }} />
          </PieChart>
        );

      case "line":
        return (
          <LineChart data={processedData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: tickFill }} />
            {yAxisKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key}
                stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                dot={{ r: 3.5, strokeWidth: 2, fill: dotFill, stroke: COLORS[i % COLORS.length] }}
                activeDot={{ r: 5.5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart data={processedData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
            <defs>
              {yAxisKeys.map((key, i) => (
                <linearGradient key={`g-${key}`} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: tickFill }} />
            {yAxisKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key}
                stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                fillOpacity={1} fill={`url(#g-${key})`}
              />
            ))}
          </AreaChart>
        );

      case "bar":
      default:
        return (
          <BarChart data={processedData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorFill }} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: tickFill }} />
            {yAxisKeys.map((key, i) => (
              <Bar key={key} dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={[5, 5, 0, 0]}
                maxBarSize={56}
              />
            ))}
          </BarChart>
        );
    }
  };

  if (isWidget) {
    return (
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-[380px] mt-3 mb-2 p-5 rounded-2xl border relative overflow-hidden"
      style={{ background: wrapperBg, borderColor: wrapperBdr, backdropFilter: "blur(12px)" }}
    >
      <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
    </motion.div>
  );
}
