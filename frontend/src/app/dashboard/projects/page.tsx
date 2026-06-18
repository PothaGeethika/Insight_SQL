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
  Power,
  Package,
  Settings,
  Sparkles,
  Users,
  BarChart2,
  DollarSign,
  LineChart
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
  const [orgs, setOrgs] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [projectType, setProjectType] = useState("Analytics");
  const [selectedDbs, setSelectedDbs] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  // Editing & Dropdown menu States
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Fetch orgs and set active
  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/backend/orgs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
        const personal = data.find((o: any) => o.name === "Personal Workspace");
        const selectedId = personal ? personal.id : (data[0]?.id || null);
        setActiveOrgId(selectedId);
        if (selectedId) {
          fetchWorkspaceMembers(selectedId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWorkspaceMembers = async (orgId: string) => {
    try {
      const res = await fetch(`/api/backend/orgs/${orgId}/members`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceMembers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/backend/projects", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrgs();
    fetchProjects();
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    try {
      const res = await fetch("/api/backend/databases", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDbList(data);
      }
    } catch (e) {
      console.error("Failed to fetch databases", e);
    }
  };

  const handleToggleDb = (dbId: string) => {
    const updated = new Set(selectedDbs);
    if (updated.has(dbId)) updated.delete(dbId);
    else updated.add(dbId);
    setSelectedDbs(updated);
  };

  const handleToggleMember = (userId: string) => {
    const updated = new Set(selectedMembers);
    if (updated.has(userId)) updated.delete(userId);
    else updated.add(userId);
    setSelectedMembers(updated);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const projectDbs = dbList
      .filter((db) => selectedDbs.has(db.id))
      .map((db) => {
        const info = getDbTypeInfo(db.type);
        return { id: db.id, type: info.label, name: db.name, iconColor: info.iconColor };
      });

    const payload = {
      title: newProjectName.trim(),
      description: newProjectDescription.trim() || "No description provided.",
      databases: projectDbs,
      projectType,
      projectMembers: Array.from(selectedMembers),
      org_id: activeOrgId
    };

    try {
      if (editingProjectId) {
        const res = await fetch(`/api/backend/projects/${editingProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include"
        });
        if (res.ok) {
          fetchProjects();
        }
      } else {
        const res = await fetch("/api/backend/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include"
        });
        if (res.ok) {
          fetchProjects();
        }
      }
    } catch (e) {
      console.error(e);
    }

    setNewProjectName("");
    setNewProjectDescription("");
    setSelectedDbs(new Set());
    setSelectedMembers(new Set());
    setShowModal(false);
  };

  const handleToggleFavorite = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    try {
      await fetch(`/api/backend/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...project, isFavorite: !project.is_favorite }),
        credentials: "include"
      });
      fetchProjects();
    } catch (e) {}
  };

  const handleToggleStatus = (projectId: string) => {
    // Backend doesn't support status yet, update local state for UI mockup
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: p.status === "Active" ? "Inactive" : "Active" } : p));
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      try {
        await fetch(`/api/backend/projects/${projectId}`, {
          method: "DELETE",
          credentials: "include"
        });
        fetchProjects();
      } catch (e) {}
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
    <div className="flex flex-col h-full bg-[var(--surface-0)] dark:bg-transparent overflow-y-auto">
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
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setNewProjectName("");
                setNewProjectDescription("");
                setSelectedDbs(new Set());
                setSelectedMembers(new Set());
                setEditingProjectId(null);
                setShowModal(false);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative bg-[#0B0C10] border border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.15)] rounded-3xl w-full max-w-[500px] flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    <Package className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {editingProjectId ? "Edit Project" : "Create New Project"}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Set up a new project to start your AI analytics journey.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                
                {/* Name */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white">
                    <FolderPlus className="h-4 w-4 text-indigo-400" /> Project Name
                  </label>
                  <Input 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="bg-[#13141C] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white">
                    <FileText className="h-4 w-4 text-indigo-400" /> Description
                  </label>
                  <div className="relative">
                    <textarea 
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="Describe your project goals, use cases, and objectives..."
                      className="w-full bg-[#13141C] border border-slate-800 focus:border-indigo-500 rounded-xl text-sm text-white p-3 min-h-[100px] resize-none outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                    <span className="absolute bottom-3 right-3 text-xs text-slate-500">
                      {newProjectDescription.length} / 500
                    </span>
                  </div>
                </div>

                {/* Project Type */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white">
                    <LayoutGrid className="h-4 w-4 text-indigo-400" /> Project Type
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#13141C] border border-slate-800 focus:border-indigo-500 rounded-xl h-11 px-3 text-sm text-slate-300 appearance-none outline-none cursor-pointer"
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                    >
                      <option value="Analytics">Select project type</option>
                      <option value="Analytics">Analytics</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Finance">Finance</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "Analytics", icon: BarChart2, color: "text-indigo-400" },
                      { id: "Marketing", icon: Megaphone, color: "text-sky-400" },
                      { id: "Finance", icon: DollarSign, color: "text-emerald-400" }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setProjectType(type.id)}
                        className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all ${
                          projectType === type.id 
                            ? "bg-indigo-500/10 border-indigo-500/50 text-white" 
                            : "bg-[#13141C] border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <type.icon className={`h-4 w-4 ${projectType === type.id ? type.color : ""}`} />
                        {type.id}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Databases */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="h-4 w-4 text-indigo-400" /> Database
                  </label>
                  <p className="text-xs text-slate-500 -mt-1">Select the databases you want to connect</p>
                  
                  <div className="bg-[#13141C] border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/50">
                    {dbList.map(db => {
                      const isChecked = selectedDbs.has(db.id);
                      return (
                        <label key={db.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/30 transition-colors">
                          <div className={`h-5 w-5 rounded flex items-center justify-center border transition-all ${
                            isChecked ? "bg-indigo-500 border-indigo-500" : "border-slate-700"
                          }`}>
                            {isChecked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <Database className={`h-4 w-4 ${isChecked ? "text-indigo-400" : "text-slate-500"}`} />
                          <span className={`text-sm ${isChecked ? "text-white" : "text-slate-300"}`}>{db.name}</span>
                        </label>
                      );
                    })}
                    {dbList.length === 0 && (
                      <div className="p-4 text-center text-sm text-slate-500">No databases available</div>
                    )}
                  </div>
                </div>

                {/* Team Members */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="h-4 w-4 text-indigo-400" /> Team Members
                  </label>
                  <p className="text-xs text-slate-500 -mt-1">Add team members to collaborate on this project</p>
                  
                  <div className="bg-[#13141C] border border-slate-800 rounded-xl p-3 flex flex-wrap gap-2 items-center">
                    {workspaceMembers.map(m => {
                      const isSelected = selectedMembers.has(m.user_id);
                      if (!isSelected) return null;
                      return (
                        <div key={m.user_id} className="flex items-center gap-2 bg-slate-800/50 rounded-full pl-1.5 pr-3 py-1 border border-slate-700">
                          <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                            {m.user_id.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-300">{m.user_id}</span>
                          <button onClick={() => handleToggleMember(m.user_id)} className="text-slate-500 hover:text-white">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                    
                    <div className="relative group">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-full transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Add more
                      </button>
                      
                      {/* Invisible hover area to show members list */}
                      <div className="absolute top-full left-0 mt-2 w-48 bg-[#1A1C23] border border-slate-700 rounded-xl shadow-xl hidden group-hover:block z-50 p-1">
                        {workspaceMembers.length === 0 ? (
                          <div className="p-2 text-xs text-slate-400 text-center">No workspace members</div>
                        ) : (
                          workspaceMembers.map(m => (
                            <button
                              key={m.user_id}
                              onClick={() => handleToggleMember(m.user_id)}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2"
                            >
                              <div className={`h-3 w-3 rounded flex items-center justify-center border ${selectedMembers.has(m.user_id) ? "bg-indigo-500 border-indigo-500" : "border-slate-600"}`}>
                                {selectedMembers.has(m.user_id) && <CheckCircle2 className="h-2 w-2 text-white" />}
                              </div>
                              {m.user_id}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="bg-[#13141C] border border-slate-800 rounded-xl overflow-hidden group cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-slate-400" />
                      <div>
                        <h4 className="text-sm font-semibold text-white">Advanced Settings</h4>
                        <p className="text-xs text-slate-500">Configure additional project settings</p>
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
                
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 mt-2 border-t border-slate-800/50 flex items-center justify-between gap-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-[#13141C] hover:bg-slate-800 border border-slate-800 text-white h-12 rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="flex-[2] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] h-12 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4.5 w-4.5" /> 
                  Create Project
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
