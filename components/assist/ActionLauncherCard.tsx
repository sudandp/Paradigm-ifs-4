import React from 'react';
import { ExternalLink, Monitor, Mail, MessageCircle, Calendar, Calculator, MapPin, Play } from 'lucide-react';
import { appLauncherService, LaunchableApp } from '../../services/appLauncherService';
import toast from 'react-hot-toast';

interface ActionLauncherCardProps {
  app: LaunchableApp;
  params?: { query?: string; email?: string };
}

export const ActionLauncherCard: React.FC<ActionLauncherCardProps> = ({ app, params }) => {
  const getIcon = () => {
    switch (app.id) {
      case 'ultraviewer':
      case 'anydesk':
        return <Monitor className="w-5 h-5 text-indigo-500" />;
      case 'gmail':
        return <Mail className="w-5 h-5 text-red-500" />;
      case 'whatsapp':
        return <MessageCircle className="w-5 h-5 text-emerald-500" />;
      case 'calendar':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'calculator':
        return <Calculator className="w-5 h-5 text-amber-500" />;
      case 'maps':
        return <MapPin className="w-5 h-5 text-rose-500" />;
      default:
        return <Play className="w-5 h-5 text-slate-500" />;
    }
  };

  const handleLaunch = () => {
    try {
      appLauncherService.launchApp(app.id, params);
      toast.success(`Launching ${app.name}...`);
    } catch (e: any) {
      toast.error(`Could not launch: ${e.message}`);
    }
  };

  return (
    <div className="my-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-xs max-w-md animate-in fade-in duration-150">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {app.name}
            </h4>
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              Desktop / App
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {app.description}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleLaunch}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <span>Open {app.name}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Direct Protocol Link
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionLauncherCard;
