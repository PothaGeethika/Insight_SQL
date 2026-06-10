"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { motion } from "framer-motion";

interface ChartRendererProps {
  tableData: {
    headers: string[];
    rows: any[][];
  };
  visualizationType?: "bar" | "line" | "pie" | "area" | "auto" | string | null;
  isWidget?: boolean;
}

// Stunning color palette (neon blues, purples, cyans to match InsightSQL)
const COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
];

export function ChartRenderer({ tableData, visualizationType = "auto", isWidget = false }: ChartRendererProps) {
  const { headers, rows } = tableData;

  // Process data for Recharts
  const processedData = useMemo(() => {
    return rows.map((row) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        // Try to parse numbers for better charting
        const val = row[index];
        if (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "") {
          obj[header] = Number(val);
        } else {
          obj[header] = val;
        }
      });
      return obj;
    });
  }, [headers, rows]);

  // Determine axes
  const { xAxisKey, yAxisKeys } = useMemo(() => {
    let xAxis = "";
    const yAxes: string[] = [];

    if (processedData.length > 0) {
      const firstRow = processedData[0];
      
      // Find the first string/date column for X axis (ignore SOURCE_DATABASE)
      const stringKeys = headers.filter(h => typeof firstRow[h] === "string" && h !== "SOURCE_DATABASE");
      xAxis = stringKeys.length > 0 ? stringKeys[0] : (headers.find(h => h !== "SOURCE_DATABASE") || headers[0]);

      // Find all numerical columns for Y axes
      yAxes.push(...headers.filter(h => typeof firstRow[h] === "number" && h !== "SOURCE_DATABASE"));
      
      // Fallback if no numbers found
      if (yAxes.length === 0 && headers.length > 1) {
        const fallbackY = headers.find(h => h !== xAxis && h !== "SOURCE_DATABASE");
        if (fallbackY) yAxes.push(fallbackY);
        else yAxes.push(headers[1]);
      }
    }
    return { xAxisKey: xAxis, yAxisKeys: yAxes };
  }, [headers, processedData]);

  if (!processedData.length || !xAxisKey || !yAxisKeys.length) {
    return <div className="p-4 text-sm text-slate-400">Not enough numerical data to render a chart.</div>;
  }

  // Determine actual chart type
  let actualType = visualizationType;
  if (actualType === "auto" || !actualType) {
    // Simple heuristic for auto
    if (processedData.length > 20) actualType = "line";
    else if (yAxisKeys.length === 1 && processedData.length <= 10) actualType = "pie";
    else actualType = "bar";
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="font-semibold text-slate-200 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300">{entry.name}:</span>
              <span className="font-mono text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
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
              innerRadius={60} // Donut style
              paddingAngle={5}
              label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : null}
              labelLine={false}
              stroke="none"
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
          </PieChart>
        );
      
      case "line":
        return (
          <LineChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 12 }} tickMargin={10} />
            <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {yAxisKeys.map((key, idx) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={COLORS[idx % COLORS.length]} 
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#0f172a' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              {yAxisKeys.map((key, idx) => (
                <linearGradient key={`color-${key}`} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 12 }} tickMargin={10} />
            <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {yAxisKeys.map((key, idx) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={COLORS[idx % COLORS.length]} 
                fillOpacity={1} 
                fill={`url(#color-${key})`} 
              />
            ))}
          </AreaChart>
        );

      case "bar":
      default:
        return (
          <BarChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 12 }} tickMargin={10} />
            <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff60', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff0a' }} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            {yAxisKeys.map((key, idx) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={COLORS[idx % COLORS.length]} 
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />
            ))}
          </BarChart>
        );
    }
  };

  if (isWidget) {
    return (
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, mass: 1 }}
      className="w-full h-[400px] mt-4 mb-2 p-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl relative overflow-hidden"
    >
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </motion.div>
  );
}
