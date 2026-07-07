import re

with open(r'e:\backup\onboarding all files\Paradigm Office 4\pages\leaves\ApplyLeave.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

def repl_punchin(m):
    return r'<input type="time" {...field} readOnly={watchLeaveType === \'Permission\'} className={`w-full p-2.5 rounded-lg border text-sm ${watchLeaveType === \'Permission\' ? \'opacity-75 cursor-not-allowed bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-bold\' : isMobile ? \'bg-[#041b0f] border-emerald-500/20 text-white\' : \'bg-white border-gray-200 text-gray-900\'}`} />'

content = re.sub(r'<input type=\"time\" \{\.\.\.field\} className=\{`w-full p-2\.5 rounded-lg border text-sm \$\{isMobile \? \'bg-\[\#041b0f\] border-emerald-500/20 text-white\' : \'bg-white border-gray-200 text-gray-900\'\}`\} />', repl_punchin, content, count=1)

permission_card_top = r'{watchLeaveType === \'Permission\' && \(\s*<div className=\{`p-6 rounded-2xl border space-y-5 transition-all duration-300 \$\{\s*isMobile\s*\?\s*\'bg-emerald-500/5 border-emerald-500/10\'\s*:\s*\'bg-white border-gray-200 shadow-sm\'\s*\}`\}>'

permission_card_replacement = r'''{watchLeaveType === 'Permission' && !hasPunchInLog && (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-medium mb-4 flex items-center gap-2">
                                            <CloudOff className="w-5 h-5" />
                                            Please punch in from your office first, then raise a request for permission.
                                        </div>
                                    )}

                                    {watchLeaveType === 'Permission' && (
                                        <div className={`p-6 rounded-2xl border space-y-5 transition-all duration-300 ${
                                            isMobile 
                                                ? 'bg-emerald-500/5 border-emerald-500/10' 
                                                : 'bg-white border-gray-200 shadow-sm'
                                        }`}>
                                            <div className="flex bg-emerald-500/10 p-1 rounded-lg">
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

content = re.sub(permission_card_top, permission_card_replacement, content, count=1)

display_box_old = r'<div className=\{`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-3 text-xs \$\{\s*isMobile\s*\?\s*\'bg-\[\#041b0f\]/50 border-emerald-500/10 text-primary-text\'\s*:\s*\'bg-gray-50 border-gray-200 text-gray-700\'\s*\}`\}>\s*<div className=\"flex items-center gap-2\">\s*<span className=\{`font-semibold flex items-center gap-1\.5 \$\{isMobile \? \'opacity-60\' : \'text-gray-500\'\}`\}>\s*<span className=\"inline-block w-1\.5 h-1\.5 rounded-full bg-emerald-500 animate-pulse\" /> Now:\s*</span>\s*<span className=\{`font-bold text-sm px-2\.5 py-1 rounded-lg border \$\{\s*isMobile\s*\?\s*\'bg-cyan-500/15 text-cyan-400 border-cyan-500/20\'\s*:\s*\'bg-white text-gray-800 border-gray-300 shadow-xs\'\s*\}`\}>\s*\{currentTime\}\s*</span>\s*</div>\s*<div className=\{`hidden md:block font-bold \$\{isMobile \? \'opacity-40\' : \'text-gray-300\'\}`\}>➔</div>\s*<div className=\"flex items-center gap-2\">\s*<span className=\{`font-semibold \$\{isMobile \? \'opacity-60\' : \'text-gray-500\'\}`\}>Adjusted Out:</span>\s*<span className=\{`font-bold text-sm px-2\.5 py-1 rounded-lg border \$\{\s*isMobile\s*\?\s*\'bg-emerald-500/15 text-emerald-500 border-emerald-500/20\'\s*:\s*\'bg-emerald-50 text-emerald-700 border-emerald-300\'\s*\}`\}>\s*\{getAdjustedPunchOut\(currentTime, permissionMinutes\)\}\s*</span>\s*</div>'

display_box_new = r'''<div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-3 text-xs ${
                                                isMobile 
                                                    ? 'bg-[#041b0f]/50 border-emerald-500/10 text-primary-text' 
                                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                                            }`}>
                                                {permissionSession === 'evening' ? (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-semibold flex items-center gap-1.5 ${isMobile ? 'opacity-60' : 'text-gray-500'}`}>
                                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Now:
                                                            </span>
                                                            <span className={`font-bold text-sm px-2.5 py-1 rounded-lg border ${
                                                                isMobile
                                                                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                                                                    : 'bg-white text-gray-800 border-gray-300 shadow-xs'
                                                            }`}>
                                                                {currentTime}
                                                            </span>
                                                        </div>
                                                        <div className={`hidden md:block font-bold ${isMobile ? 'opacity-40' : 'text-gray-300'}`}>➔</div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-semibold ${isMobile ? 'opacity-60' : 'text-gray-500'}`}>Adjusted Out:</span>
                                                            <span className={`font-bold text-sm px-2.5 py-1 rounded-lg border ${
                                                                isMobile 
                                                                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                            }`}>
                                                                {getAdjustedPunchOut(currentTime, permissionMinutes)}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-semibold flex items-center gap-1.5 ${isMobile ? 'opacity-60' : 'text-gray-500'}`}>
                                                                Base In:
                                                            </span>
                                                            <span className={`font-bold text-sm px-2.5 py-1 rounded-lg border ${
                                                                isMobile
                                                                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                                                                    : 'bg-white text-gray-800 border-gray-300 shadow-xs'
                                                            }`}>
                                                                {basePunchInTime || '09:00'}
                                                            </span>
                                                        </div>
                                                        <div className={`hidden md:block font-bold ${isMobile ? 'opacity-40' : 'text-gray-300'}`}>➔</div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-semibold ${isMobile ? 'opacity-60' : 'text-gray-500'}`}>Adjusted In:</span>
                                                            <span className={`font-bold text-sm px-2.5 py-1 rounded-lg border ${
                                                                isMobile 
                                                                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                            }`}>
                                                                {getAdjustedPunchIn(basePunchInTime || '09:00', permissionMinutes)}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}'''

content = re.sub(display_box_old, display_box_new, content, count=1)


with open(r'e:\backup\onboarding all files\Paradigm Office 4\pages\leaves\ApplyLeave.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
