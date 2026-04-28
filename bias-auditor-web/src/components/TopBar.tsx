import React, { useRef } from 'react';
import { Search, Bell, HelpCircle, ChevronDown, Upload } from 'lucide-react';

interface TopBarProps {
  onFileUpload: (file: File) => void;
  isAnalyzing: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onFileUpload, isAnalyzing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // Reset so the same file can be re-uploaded if needed
      event.target.value = '';
    }
  };

  return (
    <header className="sticky top-0 w-full h-16 z-40 bg-white border-b border-outline-variant flex justify-between items-center px-lg mb-xl shadow-sm">
      <div className="flex items-center w-1/3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
          <input
            className="w-full h-[36px] pl-10 pr-4 bg-surface rounded border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-body-sm text-on-surface placeholder:text-outline outline-none transition-all"
            placeholder="Search audits, datasets, models..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-md">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv"
        />
        <button 
          onClick={handleUploadClick}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#27AE60] hover:bg-[#219653] disabled:opacity-50 text-white rounded text-sm font-semibold transition-all shadow-sm"
        >
          <Upload className="w-4 h-4" />
          {isAnalyzing ? 'Analyzing...' : 'Upload Data'}
        </button>

        <button className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="h-6 w-px bg-outline-variant mx-xs"></div>
        <button className="flex items-center gap-sm hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full border border-outline-variant bg-slate-200 overflow-hidden">
            <img
              alt="Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBMzi65otZLATC-m-r6JNqfQVt9iI3FXHeDCJ5PaZ1IFpSTJaF4ZyFmK6Hcin5tObrAEb44CmcXIqBSWl5HkD8kzCw7OwoQ4_EnkxQsdoqKev8uuzCW_1uU9Hvf1TFWMXG3doSEwx-PaOfHlcyoKnC6riUWuTV4V6HasdD0yO2kUxh89jHzA9hunQm_rYNAQ54exKeiRWaLnRIb8H4apKuPbZUDNrlWdY8fLoFsqhwuC6Dn-1yvwP7YSQ1BuWFmy7qemQUpB6lpVfDY"
            />
          </div>
          <span className="text-sm font-medium text-on-surface hidden lg:block">Admin User</span>
          <ChevronDown className="w-4 h-4 text-outline hidden lg:block" />
        </button>
      </div>
    </header>
  );
};
