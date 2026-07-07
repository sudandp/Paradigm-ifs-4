import re

file_path = r'e:\backup\onboarding all files\Paradigm Office 4\pages\leaves\ApplyLeave.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

toggle_block = '''                                            <div className="flex bg-emerald-500/10 p-1 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionSession('morning')}
                                                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                                        permissionSession === 'morning' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/20'
                                                    }`}
                                                >
                                                    First Off (Morning)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionSession('evening')}
                                                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                                        permissionSession === 'evening' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/20'
                                                    }`}
                                                >
                                                    2nd Off (Evening)
                                                </button>
                                            </div>'''

# Remove toggle block
content = content.replace(toggle_block, '')

# Add it back after the slider
slider_block = '''                                            <div className="space-y-2 px-1">
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="180" 
                                                    step="15" 
                                                    value={permissionMinutes} 
                                                    onChange={(e) => setPermissionMinutes(Number(e.target.value))}
                                                    className={`w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                                                        isMobile ? 'bg-emerald-200/50 accent-emerald-500' : 'bg-gray-200 accent-emerald-500'
                                                    }`}
                                                />
                                                <div className={`flex justify-between text-[10px] font-bold uppercase tracking-widest px-0.5 ${isMobile ? 'text-muted/60' : 'text-gray-400'}`}>
                                                    <span>0m</span>
                                                    <span>1h</span>
                                                    <span>2h</span>
                                                    <span>3h</span>
                                                </div>
                                            </div>'''

content = content.replace(slider_block, slider_block + '\n\n' + toggle_block)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Moved toggle button below permission duration slider")
