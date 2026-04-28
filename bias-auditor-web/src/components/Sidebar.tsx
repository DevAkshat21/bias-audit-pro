import React from 'react';
import { LayoutDashboard, LineChart, Activity, Brain, FileText, Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasData: boolean;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'bias', label: 'Bias Detection', icon: LineChart },
  { id: 'mitigation', label: 'Mitigation', icon: Activity },
  { id: 'explainability', label: 'Explainability', icon: Brain },
  { id: 'report', label: 'Audit Report', icon: FileText },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, hasData }) => {
  return (
    <nav className="fixed left-0 top-0 h-full w-[260px] z-50 bg-[#0F172A] border-r border-slate-800 flex flex-col">
      {/* Brand Section */}
      <div className="p-6 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white text-[18px] font-bold tracking-tight leading-none">BiasAudit Pro</h1>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mt-1">Enterprise Audit</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-3 ml-2 px-2">
          Compliance Pipeline
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isDisabled = !hasData && item.id !== 'overview';
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  disabled={isDisabled}
                  title={isDisabled ? 'Upload a dataset to unlock this section' : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 h-[48px] px-4 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/10"
                      : isDisabled
                        ? "text-slate-600 cursor-not-allowed opacity-50"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                  )} />
                  <span className="text-[14px] font-medium">{item.label}</span>
                  
                  {isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Status indicator */}
      <div className="p-4 mt-auto">
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300",
          hasData
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-slate-800/50 border-slate-700/50 text-slate-500"
        )}>
          {hasData ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="text-[12px] font-bold leading-none">
              {hasData ? 'Dataset Active' : 'No Dataset'}
            </span>
            <span className="text-[10px] opacity-70 mt-1">
              {hasData ? 'Audit Engine Ready' : 'Awaiting data upload'}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};
