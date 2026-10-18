// OneSignal web push. The Firebase uid is the OneSignal external id, so the server can
// target a person (all their browsers) without storing device tokens itself.
// Needs REACT_APP_ONESIGNAL_APP_ID; without it every call is a harmless no-op.
// The installed desktop app has no web push, so it shows native notifications instead.
const APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID;
const SDK = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

export const pushConfigured = () => Boolean(APP_ID) && !window.colabsDesktop;

let ready;
function load() {
    if (!pushConfigured()) return Promise.resolve(null);
    if (ready) return ready;
    ready = new Promise((resolve) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        const script = document.createElement("script");
        script.src = SDK;
        script.defer = true;
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
        window.OneSignalDeferred.push(async (OneSignal) => {
            try {
                await OneSignal.init({
                    appId: APP_ID,
                    serviceWorkerPath: "OneSignalSDKWorker.js",
                    allowLocalhostAsSecureOrigin: true,
                    notifyButton: { enable: false },
                });
                resolve(OneSignal);
            } catch (err) {
                console.warn("OneSignal init failed:", err);
                resolve(null);
            }
        });
    });
    return ready;
}

export const initPush = () => load();

export async function pushLogin(uid, email) {
    const os = await load();
    if (!os || !uid) return;
    try {
        await os.login(String(uid));
        if (email) os.User.addEmail(email);
    } catch (err) { console.warn("OneSignal login failed:", err); }
}

export async function pushLogout() {
    const os = await load();
    try { await os?.logout(); } catch { /* ignore */ }
}

export async function pushStatus() {
    const os = await load();
    if (!os) return { supported: false, enabled: false, permission: "unsupported" };
    return {
        supported: true,
        enabled: Boolean(os.User.PushSubscription.optedIn),
        permission: os.Notifications.permission ? "granted" : (typeof Notification !== "undefined" ? Notification.permission : "default"),
    };
}

export async function enablePush() {
    const os = await load();
    if (!os) throw new Error("Push is not available in this browser");
    await os.Notifications.requestPermission();
    await os.User.PushSubscription.optIn();
    return pushStatus();
}

export async function disablePush() {
    const os = await load();
    await os?.User.PushSubscription.optOut();
    return pushStatus();
}
