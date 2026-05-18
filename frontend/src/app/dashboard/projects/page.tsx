"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  MoreVertical,
  ShoppingCart,
  Megaphone,
  ShieldAlert,
  Database,
  Clock,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const MOCK_PROJECTS = [
  {
    id: "1",
    title: "E-commerce Analytics",
    description: "Analytics for ecommerce platform including sales, user behavior, and inventory.",
    icon: ShoppingCart,
    iconColor: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    status: "Active",
    databasesCount: 3,
    updated: "Updated 2h ago",
    avatars: [
      { initials: "A", color: "bg-purple-600" },
      { initials: "M", color: "bg-emerald-500" },
      { initials: "S", color: "bg-blue-500" },
    ],
    extraAvatars: "+2",
    databases: [
      { id: "db1", type: "PostgreSQL", name: "sales_db", iconColor: "text-blue-400" },
      { id: "db2", type: "MongoDB", name: "product_catalog", iconColor: "text-green-500" },
      { id: "db3", type: "Vector DB", name: "recommendations", iconColor: "text-purple-500" },
    ],
  },
  {
    id: "2",
    title: "Marketing Intelligence",
    description: "Customer insights, campaign performance, and marketing analytics.",
    icon: Megaphone,
    iconColor: "text-purple-400",
    bgColor: "bg-purple-500/10",
    status: "Active",
    databasesCount: 2,
    updated: "Updated 1d ago",
    avatars: [
      { initials: "M", color: "bg-purple-600" },
      { initials: "S", color: "bg-orange-500" },
    ],
    extraAvatars: "+1",
    databases: [
      { id: "db4", type: "MySQL", name: "marketing_db", iconColor: "text-blue-500" },
      { id: "db5", type: "PostgreSQL", name: "warehouse", iconColor: "text-blue-400" },
    ],
  },
  {
    id: "3",
    title: "Fraud Detection",
    description: "Real-time fraud detection and risk analysis.",
    icon: ShieldAlert,
    iconColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    status: "Active",
    databasesCount: 2,
    updated: "Updated 3d ago",
    avatars: [
      { initials: "A", color: "bg-purple-600" },
      { initials: "R", color: "bg-blue-600" },
    ],
    extraAvatars: "+3",
    databases: [
      { id: "db6", type: "Graph DB", name: "fraud_graph", iconColor: "text-purple-500" },
      { id: "db7", type: "PostgreSQL", name: "transactions", iconColor: "text-blue-400" },
    ],
  },
];

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)] overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <LayoutGrid className="h-8 w-8 text-indigo-500" />
              Projects
            </h1>
            <p className="text-slate-400 mt-2 font-medium">
              Organize databases by project for better collaboration.
            </p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-indigo-600/20">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--surface-1)] border-slate-800 focus:border-indigo-500 h-11 pl-10 rounded-xl text-sm placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800 h-11 rounded-xl px-4 font-medium">
              Recently Updated
              <ChevronDown className="h-4 w-4 ml-2 text-slate-500" />
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11 bg-[var(--surface-1)] border-slate-800 text-slate-400 hover:text-white rounded-xl">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Projects List */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6 pb-20"
        >
          {MOCK_PROJECTS.map((project) => (
            <motion.div
              key={project.id}
              variants={itemVariants}
              className="group relative bg-[var(--surface-1)] border border-slate-800/50 hover:border-slate-700 rounded-2xl p-6 transition-all duration-300"
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl ${project.bgColor} flex items-center justify-center`}>
                    <project.icon className={`h-6 w-6 ${project.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-xl line-clamp-1">
                      {project.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold px-2.5 py-0.5">
                    {project.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Project Meta */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    {project.databasesCount} Databases
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {project.updated}
                  </div>
                </div>
                
                {/* Avatars */}
                <div className="flex -space-x-2">
                  {project.avatars.map((avatar, idx) => (
                    <div key={idx} className={`h-7 w-7 rounded-full ${avatar.color} border-2 border-[var(--surface-1)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                      {avatar.initials}
                    </div>
                  ))}
                  <div className="h-7 w-7 rounded-full bg-slate-800 border-2 border-[var(--surface-1)] flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">
                    {project.extraAvatars}
                  </div>
                </div>
              </div>

              {/* Databases Chips Area */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/50">
                {project.databases.map((db) => (
                  <div
                    key={db.id}
                    className="flex items-center gap-3 px-4 py-2.5 bg-[var(--surface-0)] border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <Database className={`h-4 w-4 ${db.iconColor}`} />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">{db.type}</span>
                      <span className="text-xs font-medium text-slate-300 leading-none">{db.name}</span>
                    </div>
                  </div>
                ))}
                
                <button className="flex flex-col items-center justify-center px-6 py-2.5 bg-transparent border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 rounded-xl transition-all cursor-pointer group/add">
                  <Plus className="h-4 w-4 text-slate-500 group-hover/add:text-indigo-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-500 group-hover/add:text-indigo-400 uppercase tracking-wider leading-none">
                    Add Database
                  </span>
                </button>
              </div>

            </motion.div>
          ))}
          
          {/* Bottom Add Project Area */}
          <motion.div variants={itemVariants} className="pt-4">
             <button className="w-full py-6 flex items-center justify-center gap-3 border border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-2xl transition-all text-slate-500 hover:text-indigo-400 font-bold group">
                <Plus className="h-5 w-5" />
                New Project
             </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
