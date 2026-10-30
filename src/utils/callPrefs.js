// Call preferences, saved per browser so rooms and projects agree.
//   mic, cam        - whether they start on when you join. Off until you turn them on; after
//                     that the last choice is remembered.
//   keepOnNavigate  - keep a call going when you leave its room or project for another page.
//                     Off: leaving the page ends the call.
const KEY = "call-media";
const DEFAULTS = { mic: false, cam: false, keepOnNavigate: false };

export const getCallPrefs = () => {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
        return { ...DEFAULTS };
    }
};

export const saveCallPrefs = (prefs) => {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...getCallPrefs(), ...prefs }));
    } catch {
        /* private mode or storage blocked: fall back to the defaults next time */
    }
};
