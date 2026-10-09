import React, { useState } from 'react';
import {
  X, Search, Sparkles, Mail, MessageSquare, FileText, CheckSquare,
  Monitor, Calculator, Clock, Calendar, Zap, Droplets, ArrowUpDown,
  Flame, Camera, Wind, Cpu, Waves, Lock, Bug, Scale, Fuel, TrendingUp,
  Download, Play, ArrowRight, BookOpen, Layers
} from 'lucide-react';
import { ALL_OFFICE_SKILLS, OfficeSkill } from '../../services/skillsRegistry';

interface SkillsDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (prompt: string) => void;
}

export const SkillsDrawerModal: React.FC<SkillsDrawerModalProps> = ({ isOpen, onClose, onSelectSkill }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', title: 'All Skills (54)' },
    { id: 'communication', title: 'Comms & Drafting' },
    { id: 'notes_tasks', title: 'Notes & Tasks' },
    { id: 'system_launch', title: 'App Launchers' },
    { id: 'hr_attendance', title: 'HR & Roster' },
    { id: 'mep_facilities', title: 'MEP Operations' },
    { id: 'office_tools', title: 'Utilities' }
  ];

  const filteredSkills = ALL_OFFICE_SKILLS.filter(skill => {
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    const matchesSearch =
      skill.name.toLowerCase().includes(search.toLowerCase()) ||
      skill.slashCommand.toLowerCase().includes(search.toLowerCase()) ||
      skill.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Mail': return <Mail className="w-4 h-4 text-rose-500" />;
      case 'MessageSquare': return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'FileText': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'CheckSquare': return <CheckSquare className="w-4 h-4 text-amber-500" />;
      case 'Monitor': return <Monitor className="w-4 h-4 text-indigo-500" />;
      case 'Calculator': return <Calculator className="w-4 h-4 text-cyan-500" />;
      case 'Clock': return <Clock className="w-4 h-4 text-violet-500" />;
      case 'Zap': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Droplets': return <Droplets className="w-4 h-4 text-sky-500" />;
      case 'ArrowUpDown': return <ArrowUpDown className="w-4 h-4 text-purple-500" />;
      case 'Flame': return <Flame className="w-4 h-4 text-orange-500" />;
      default: return <Sparkles className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Digital Companion Skills Library
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  54 Specialized Skills
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">/</code> in chat or select any skill below to trigger instant actions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search 54 skills by name, slash command (e.g., /email, /ultraviewer, /dg), or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              onClick={() => {
                onSelectSkill(skill.samplePrompt);
                onClose();
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-750 hover:border-emerald-500/60 hover:shadow-md transition text-left group flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:scale-105 transition">
                      {renderIcon(skill.icon)}
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {skill.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400">
                    {skill.slashCommand}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {skill.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition">
                <span>Try Skill</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredSkills.length} of {ALL_OFFICE_SKILLS.length} operational skills</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default SkillsDrawerModal;
