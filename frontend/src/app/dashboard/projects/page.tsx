"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  FileText,
  CheckCircle2,
  FolderPlus,
  Star,
  Pencil,
  Trash2,
  Power
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const MOCK_PROJECTS: any[] = [];

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case "ShoppingCart":
      return ShoppingCart;
    case "Megaphone":
      return Megaphone;
    case "ShieldAlert":
      return ShieldAlert;
    default:
      return FolderPlus;
  }
};

const getDbTypeInfo = (type: string) => {
  switch (type.toLowerCase()) {
    case "postgresql":
      return { label: "PostgreSQL", iconColor: "text-indigo-400" };
    case "mysql":
      return { label: "MySQL", iconColor: "text-sky-400" };
    case "mongodb":
      return { label: "MongoDB", iconColor: "text-emerald-500" };
    default:
      return { label: type.toUpperCase(), iconColor: "text-slate-400" };
  }
};

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [dbList, setDbList] = useState<any[]>([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [selectedDbs, setSelectedDbs] = useState<Set<string>>(new Set());

  // Editing & Dropdown menu States
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Load projects from localStorage (or use mock data)
  useEffect(() => {
    const saved = localStorage.getItem("insight_projects");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cleaned = parsed.filter((p: any) => p.id !== "1" && p.id !== "2" && p.id !== "3");
        setProjects(cleaned);
        localStorage.setItem("insight_projects", JSON.stringify(cleaned));
      } catch (e) {
        setProjects([]);
      }
    } else {
      setProjects([]);
    }
  }, []);

  // Fetch live database connection options from backend
  const fetchDatabases = async () => {
    try {
      const res = await fetch("http://localhost:8000/databases");
      if (res.ok) {
        const data = await res.json();
        setDbList(data);
      }
    } catch (e) {
      console.error("Failed to fetch databases", e);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const handleToggleDb = (dbId: string) => {
    const updated = new Set(selectedDbs);
    if (updated.has(dbId)) {
      updated.delete(dbId);
    } else {
      updated.add(dbId);
    }
    setSelectedDbs(updated);
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;

    // Map selected database connections to this project
    const projectDbs = dbList
      .filter((db) => selectedDbs.has(db.id))
      .map((db) => {
        const info = getDbTypeInfo(db.type);
        return {
          id: db.id,
          type: info.label,
          name: db.name,
          iconColor: info.iconColor,
        };
      });

    if (editingProjectId) {
      // EDIT EXISTING PROJECT
      const updated = projects.map((p) => {
        if (p.id === editingProjectId) {
          return {
            ...p,
            title: newProjectName.trim(),
            description: newProjectDescription.trim() || "No description provided.",
            databasesCount: projectDbs.length,
            databases: projectDbs,
            updated: "Updated just now",
          };
        }
        return p;
      });
      setProjects(updated);
      localStorage.setItem("insight_projects", JSON.stringify(updated));
      setEditingProjectId(null);
    } else {
      // CREATE NEW PROJECT
      const newProject = {
        id: Date.now().toString(),
        title: newProjectName.trim(),
        description: newProjectDescription.trim() || "No description provided.",
        iconName: "FolderPlus",
        iconColor: "text-indigo-400",
        bgColor: "bg-indigo-500/10",
        status: "Active",
        databasesCount: projectDbs.length,
        updated: "Just now",
        avatars: [{ initials: "JD", color: "bg-indigo-600" }],
        extraAvatars: "",
        databases: projectDbs,
        isFavorite: false,
      };

      const updatedProjects = [newProject, ...projects];
      setProjects(updatedProjects);
      localStorage.setItem("insight_projects", JSON.stringify(updatedProjects));
    }

    // Reset and Close
    setNewProjectName("");
    setNewProjectDescription("");
    setSelectedDbs(new Set());
    setShowModal(false);
  };

  // Toggle Favorite Status
  const handleToggleFavorite = (projectId: string) => {
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, isFavorite: !p.isFavorite };
      }
      return p;
    });
    setProjects(updated);
    localStorage.setItem("insight_projects", JSON.stringify(updated));
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = (projectId: string) => {
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, status: p.status === "Active" ? "Inactive" : "Active" };
      }
      return p;
    });
    setProjects(updated);
    localStorage.setItem("insight_projects", JSON.stringify(updated));
  };

  // Delete Project
  const handleDeleteProject = (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      const updated = projects.filter((p) => p.id !== projectId);
      setProjects(updated);
      localStorage.setItem("insight_projects", JSON.stringify(updated));
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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
          <Button 
            onClick={() => {
              fetchDatabases();
              setEditingProjectId(null);
              setShowModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
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
              className="bg-[var(--surface-1)] border-slate-800 focus:border-indigo-500 h-11 pl-10 rounded-xl text-sm placeholder:text-slate-500 text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800 h-11 rounded-xl px-4 font-medium cursor-pointer">
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
          {filteredProjects.map((project) => {
            const IconComp = getIconComponent(project.iconName || "FolderPlus");
            return (
              <motion.div
                key={project.id}
                variants={itemVariants}
                className="group relative bg-[var(--surface-1)] border border-slate-800/50 hover:border-slate-700 rounded-2xl p-6 transition-all duration-300"
              >
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl ${project.bgColor || "bg-indigo-500/10"} flex items-center justify-center`}>
                      <IconComp className={`h-6 w-6 ${project.iconColor || "text-indigo-400"}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                        {project.title}
                        {project.isFavorite && (
                          <Star className="h-4.5 w-4.5 text-amber-400 fill-amber-400 shrink-0 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                        )}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1 max-w-xl line-clamp-1">
                        {project.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 relative">
                    <Badge 
                      variant="secondary" 
                      className={`border font-semibold px-2.5 py-0.5 transition-colors ${
                        project.status === "Active"
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
                          : "bg-slate-800/50 text-slate-500 border-slate-700/50"
                      }`}
                    >
                      {project.status || "Active"}
                    </Badge>
                    
                    {/* Interactive 3dots Menu Action Dropdown */}
                    <div className="relative">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setActiveMenuProjectId(activeMenuProjectId === project.id ? null : project.id)}
                        className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      
                      <AnimatePresence>
                        {activeMenuProjectId === project.id && (
                          <>
                            {/* Backdrop overlay for outside click to close */}
                            <div 
                              className="fixed inset-0 z-40"
                              onClick={() => setActiveMenuProjectId(null)}
                            />
                            
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute right-0 mt-2 w-48 bg-[var(--surface-1)] border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-left"
                            >
                              {/* Edit Action */}
                              <button
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  setEditingProjectId(project.id);
                                  setNewProjectName(project.title);
                                  setNewProjectDescription(project.description);
                                  const activeIds = new Set<string>(project.databases.map((d: any) => d.id as string));
                                  setSelectedDbs(activeIds);
                                  fetchDatabases();
                                  setShowModal(true);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-indigo-600/10 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5 text-slate-550" />
                                Edit Project
                              </button>

                              {/* Favorite Action */}
                              <button
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  handleToggleFavorite(project.id);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-indigo-600/10 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Star className={`h-3.5 w-3.5 ${project.isFavorite ? "text-amber-400 fill-amber-400" : "text-slate-550"}`} />
                                {project.isFavorite ? "Unfavorite" : "Favorite"}
                              </button>

                              {/* Active/Inactive Toggle Action */}
                              <button
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  handleToggleStatus(project.id);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-indigo-600/10 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Power className={`h-3.5 w-3.5 ${project.status === "Active" ? "text-indigo-400" : "text-slate-550"}`} />
                                {project.status === "Active" ? "Set Inactive" : "Set Active"}
                              </button>

                              <div className="border-t border-slate-800/80 my-1.5" />

                              {/* Delete Action */}
                              <button
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  handleDeleteProject(project.id);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                Delete Project
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

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
                    {project.avatars.map((avatar: any, idx: number) => (
                      <div key={idx} className={`h-7 w-7 rounded-full ${avatar.color} border-2 border-[var(--surface-1)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                        {avatar.initials}
                      </div>
                    ))}
                    {project.extraAvatars && (
                      <div className="h-7 w-7 rounded-full bg-slate-800 border-2 border-[var(--surface-1)] flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">
                        {project.extraAvatars}
                      </div>
                    )}
                  </div>
                </div>

                {/* Databases Chips Area */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/50">
                  {project.databases.map((db: any) => (
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
                  
                  <button 
                    onClick={() => {
                      fetchDatabases();
                      setEditingProjectId(project.id);
                      setNewProjectName(project.title);
                      setNewProjectDescription(project.description);
                      const activeIds = new Set<string>(project.databases.map((d: any) => d.id as string));
                      setSelectedDbs(activeIds);
                      setShowModal(true);
                    }}
                    className="flex flex-col items-center justify-center px-6 py-2.5 bg-transparent border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 rounded-xl transition-all cursor-pointer group/add"
                  >
                    <Plus className="h-4 w-4 text-slate-500 group-hover/add:text-indigo-400 mb-1" />
                    <span className="text-[10px] font-bold text-slate-500 group-hover/add:text-indigo-400 uppercase tracking-wider leading-none">
                      Manage DBs
                    </span>
                  </button>
                </div>

              </motion.div>
            );
          })}
          
          {filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10 max-w-xl mx-auto my-10">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/25">
                <FolderPlus className="h-8 w-8 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">No Projects Found</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
                {searchQuery 
                  ? "No projects match your search query. Try typing something else!" 
                  : "Organize your database connections under projects. Create your first project to get started!"
                }
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => {
                    fetchDatabases();
                    setEditingProjectId(null);
                    setShowModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Create First Project
                </Button>
              )}
            </div>
          )}

          {/* Bottom Add Project Area */}
          {filteredProjects.length > 0 && (
            <motion.div variants={itemVariants} className="pt-4">
               <button 
                 onClick={() => {
                   fetchDatabases();
                   setEditingProjectId(null);
                   setShowModal(true);
                 }}
                 className="w-full py-6 flex items-center justify-center gap-3 border border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-2xl transition-all text-slate-500 hover:text-indigo-400 font-bold group cursor-pointer"
               >
                  <Plus className="h-5 w-5" />
                  New Project
               </button>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Dynamic Popup Centered Modal Dialog */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Blurry Backdrop Filter */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setNewProjectName("");
                setNewProjectDescription("");
                setSelectedDbs(new Set());
                setEditingProjectId(null);
                setShowModal(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Dialog Content Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative bg-[var(--surface-1)] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-8 z-55 flex flex-col max-h-[85vh]"
            >
              {/* Close Button */}
              <button 
                onClick={() => {
                  setNewProjectName("");
                  setNewProjectDescription("");
                  setSelectedDbs(new Set());
                  setEditingProjectId(null);
                  setShowModal(false);
                }}
                className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-900/30 hover:bg-slate-800/80 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {/* Title Header */}
              <div className="mb-6 flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {editingProjectId ? "Edit Project Details" : "Create New Project"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                    {editingProjectId 
                      ? "Modify your project settings and connected databases." 
                      : "Define project details and link multiple database connections."
                    }
                  </p>
                </div>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-5 py-1">
                {/* Project Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Name</label>
                  <Input 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Enterprise Data Platform"
                    className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                  />
                </div>

                {/* Project Description */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                  <Input 
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="e.g., Centralized analytics and customer growth models"
                    className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                  />
                </div>

                {/* Database Toggle Selection Grid */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Link Databases</label>
                    <span className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">You can toggle more than 1 database</span>
                  </div>

                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {dbList.map((db) => {
                      const info = getDbTypeInfo(db.type);
                      const isChecked = selectedDbs.has(db.id);
                      return (
                        <div 
                          key={db.id}
                          onClick={() => handleToggleDb(db.id)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                            isChecked 
                              ? "bg-indigo-600/10 border-indigo-500/30 text-white" 
                              : "bg-[var(--surface-0)] border-slate-850 text-slate-400 hover:border-slate-850"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Database className={`h-4.5 w-4.5 shrink-0 ${isChecked ? "text-indigo-400" : info.iconColor}`} />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white">{db.name}</span>
                              <span className="text-[10px] text-slate-500 font-bold mt-0.5">{info.label}</span>
                            </div>
                          </div>

                          {/* Glossy IOS Toggle Switch */}
                          <div 
                            className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 ${
                              isChecked ? "bg-indigo-600" : "bg-slate-800"
                            }`}
                          >
                            <div 
                              className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${
                                isChecked ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {dbList.length === 0 && (
                      <div className="p-6 text-center border border-dashed border-slate-850 rounded-xl">
                        <Database className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-medium">No databases available</p>
                        <p className="text-[10px] text-slate-600 mt-1">Create databases in the Databases tab first.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-slate-800/50">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setNewProjectName("");
                    setNewProjectDescription("");
                    setSelectedDbs(new Set());
                    setEditingProjectId(null);
                    setShowModal(false);
                  }}
                  className="text-slate-400 hover:text-white hover:bg-slate-850 h-11 px-5 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-7 rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-40 cursor-pointer"
                >
                  {editingProjectId ? "Save Changes" : "Create Project"}
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
