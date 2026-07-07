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

# Remove toggle block from wherever it is
content = content.replace(toggle_block, '')

# Now replace the header
old_header = '''                <header 
                    className={`p-4 flex items-center gap-4 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-[#041b0f]/80 backdrop-blur-lg border-b border-emerald-500/10' : 'mb-8'}`}
                    style={isMobile ? { paddingTop: 'calc(1rem + env(safe-area-inset-top))' } : {}}
                >
                    {isMobile && (
                        <Button 
                            variant="secondary" 
                            onClick={() => navigate(-1)} 
                            className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-primary-text tracking-tight uppercase text-lg flex items-center gap-2">
                            {isEditMode ? 'Edit Request' : `Applying for Leave`}
                            {isOffline && (
                                <span className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shrink-0">
                                    <CloudOff className="w-3 h-3" />
                                    OFFLINE
                                </span>
                            )}
                        </h1>
                        {!isEditMode && (
                            <p className="text-xs font-bold text-muted/60 uppercase tracking-widest mt-0.5">
                                Balance: <span className="text-emerald-500">{leaveBalance.toFixed(1)} days</span>
                            </p>
                        )}
                    </div>
                </header>'''

new_header = '''                <header 
                    className={`p-4 flex items-center justify-between gap-4 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-[#041b0f]/80 backdrop-blur-lg border-b border-emerald-500/10' : 'mb-8'}`}
                    style={isMobile ? { paddingTop: 'calc(1rem + env(safe-area-inset-top))' } : {}}
                >
                    <div className="flex items-center gap-4">
                        {isMobile && (
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate(-1)} 
                                className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                        )}
                        <div>
                            <h1 className="text-2xl font-black text-primary-text tracking-tight uppercase text-lg flex items-center gap-2">
                                {isEditMode ? 'Edit Request' : `Applying for Leave`}
                                {isOffline && (
                                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shrink-0">
                                        <CloudOff className="w-3 h-3" />
                                        OFFLINE
                                    </span>
                                )}
                            </h1>
                            {!isEditMode && (
                                <p className="text-xs font-bold text-muted/60 uppercase tracking-widest mt-0.5">
                                    Balance: <span className="text-emerald-500">{leaveBalance.toFixed(1)} days</span>
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {watchLeaveType === 'Permission' && (
                        <div className="flex bg-emerald-500/10 p-1 rounded-lg shrink-0">
                            <button
                                type="button"
                                onClick={() => setPermissionSession('morning')}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                    permissionSession === 'morning' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/20'
                                }`}
                            >
                                1st Half
                            </button>
                            <button
                                type="button"
                                onClick={() => setPermissionSession('evening')}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                    permissionSession === 'evening' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-500/20'
                                }`}
                            >
                                2nd Half
                            </button>
                        </div>
                    )}
                </header>'''

content = content.replace(old_header, new_header)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Moved toggle button to header and renamed labels")
