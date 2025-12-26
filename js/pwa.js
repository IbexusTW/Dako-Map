// Service Worker Registrierung
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registriert:', reg.scope))
            .catch(err => console.log('Service Worker Fehler:', err));
    });
}

// --- Install-Button Logik ---
let installEvent = null;

// Android/Chrome Event abfangen
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    const banner = document.getElementById('android-install-banner');
    if (banner) banner.style.display = 'flex'; // Banner anzeigen, sobald verfügbar
});

window.triggerInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
        document.getElementById('android-install-banner').style.display = 'none';
    }
    installEvent = null;
};

window.showIOSHelp = () => {
    alert("So installierst du die App:\n\n1. Tippe unten im Browser auf das 'Teilen'-Symbol (Viereck mit Pfeil nach oben).\n2. Scrolle etwas runter und wähle 'Zum Home-Bildschirm'.");
};

function getInstallBannerHtml() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    if (isStandalone) return ''; // App läuft bereits installiert -> Kein Banner

    if (isIOS) {
        return `<div class="install-banner">
            <span>📲 <b>App installieren?</b><br>Für Offline-Nutzung</span>
            <button onclick="showIOSHelp()">Anleitung</button>
        </div>`;
    } else if (isAndroid) {
        // Android: Standardmäßig ausgeblendet, wird via Event eingeblendet
        return `<div id="android-install-banner" class="install-banner" style="display:none">
            <span>📲 <b>App installieren</b><br>Für Offline-Nutzung</span>
            <button onclick="triggerInstall()">Installieren</button>
        </div>`;
    } else {
        // Desktop
        return `<div class="install-banner desktop-hint">
            <span>💡 <b>Tipp:</b> Öffne diesen Link auf deinem Handy, um die App für unterwegs zu installieren!</span>
        </div>`;
    }
}