import React from 'react';
import { createRoot } from 'react-dom/client';
import { MapPin } from 'lucide-react';

/**
 * Google Play "Prominent disclosure" for ACCESS_BACKGROUND_LOCATION.
 *
 * Play policy requires an in-app disclosure, shown BEFORE the runtime permission request,
 * that states (1) what data is collected, (2) that it is collected when the app is closed or
 * not in use, and (3) how it is used. The wording below follows Play's required pattern:
 * "<App> collects location data to enable <feature> even when the app is closed or not in use."
 * Do not shorten it, move it into a settings page, or request the permission without it.
 */

const DisclosureDialog: React.FC<{ onDecision: (accepted: boolean) => void }> = ({ onDecision }) => (
    <div
        className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bg-loc-title"
        aria-describedby="bg-loc-body"
    >
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <MapPin className="h-7 w-7 text-emerald-600" aria-hidden="true" />
            </div>
            <h2 id="bg-loc-title" className="mb-3 text-center text-lg font-bold text-gray-900">
                Allow background location
            </h2>
            <div id="bg-loc-body" className="space-y-3 text-sm leading-relaxed text-gray-600">
                <p>
                    <strong className="text-gray-900">Paradigm IFS collects location data to enable field route tracking and
                    site-visit verification even when the app is closed or not in use.</strong>
                </p>
                <p>
                    Location is recorded only while you are checked in for a shift. It is shared with your employer's
                    attendance system and is not used for advertising.
                </p>
                <p className="text-xs text-gray-500">
                    On the next screen, choose <strong>"Allow all the time"</strong>. You can change this at any time in
                    Settings. Check-in and check-out keep working if you decline.
                </p>
            </div>
            <div className="mt-6 flex gap-3">
                <button
                    type="button"
                    onClick={() => onDecision(false)}
                    className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    No thanks
                </button>
                <button
                    type="button"
                    onClick={() => onDecision(true)}
                    className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                    Continue
                </button>
            </div>
        </div>
    </div>
);

/** Shows the disclosure and resolves true if the user chose to continue. */
export const showBackgroundLocationDisclosure = (): Promise<boolean> =>
    new Promise((resolve) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        const finish = (accepted: boolean) => {
            root.unmount();
            host.remove();
            resolve(accepted);
        };
        root.render(<DisclosureDialog onDecision={finish} />);
    });
