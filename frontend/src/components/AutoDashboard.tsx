"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChartRenderer } from "./ChartRenderer";

export interface DashboardWidget {
  title: string;
  chartType: "bar" | "line" | "pie" | "area";
  tableData: {
    headers: string[];
    rows: any[][];
  };
}

interface AutoDashboardProps {
  widgets: DashboardWidget[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.85, rotateX: -15 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    rotateX: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 18,
      mass: 1.1
    }
  }
};

export function AutoDashboard({ widgets }: AutoDashboardProps) {
  if (!widgets || widgets.length === 0) {
    return <div className="text-slate-400">No dashboard data available.</div>;
  }

  return (
    <motion.div 
      className="w-full mt-6 mb-4 perspective-1000"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {widgets.map((widget, index) => (
          <motion.div
            key={`widget-${index}`}
            variants={itemVariants}
            className="flex flex-col bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden will-change-transform"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="px-5 py-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm tracking-widest uppercase">
                {widget.title}
              </h3>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
              </div>
            </div>
            <div className="p-5 h-[320px] relative">
              {/* Subtle background glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 opacity-50 pointer-events-none"></div>
              <ChartRenderer 
                tableData={widget.tableData} 
                visualizationType={widget.chartType} 
                isWidget={true}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
