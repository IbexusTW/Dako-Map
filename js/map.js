const gangs = ["Vorspeise", "Hauptgang", "Dessert", "Party"];
const times = ["18:00", "19:30", "21:30", "ab 23:00"];

// Hilfsfunktion gegen XSS (Cross-Site Scripting)
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/[&<>"'/]/g, function(m) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '/': '&#x2F;' };
        return map[m];
    });
}

function getNaviAction(lat, lon, addr) {
    const query = addr ? encodeURIComponent(addr) : `${lat},${lon}`;
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        // Android Intent: Zwingt das System zum App-Picker (Wahlfreiheit) und bietet Fallback
        // Fix für Samsung Internet, das reine geo:-Links oft verschluckt.
        const fallback = encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${query}`);
        return { url: `intent:${lat},${lon}?q=${query}#Intent;scheme=geo;S.browser_fallback_url=${fallback};end`, text: '➔ Navigation' };
    }
    if (/iPad|iPhone|iPod/.test(ua)) return { url: `http://maps.apple.com/?daddr=${query}&dirflg=w`, text: ' Karten' };
    return { url: `https://graphhopper.com/maps/?point=&point=${query}`, text: 'Navigation' };
}

const params = new URLSearchParams(window.location.search);
let shortData;
const urlData = params.get('data');

if (urlData) {
    // Fall 1: Daten kommen frisch aus der URL -> Speichern und nutzen
    try {
        shortData = JSON.parse(urlData);
        localStorage.setItem('dako_saved_route', urlData);
    } catch(e) { console.error('JSON-Fehler in URL:', e); }
} else {
    // Fall 2: Keine URL-Daten -> Schauen ob wir was gespeichert haben (Offline-Modus)
    const savedData = localStorage.getItem('dako_saved_route');
    if (savedData) {
        try { shortData = JSON.parse(savedData); } catch(e) { console.warn('Gespeicherte Daten defekt:', e); }
    }
}

if (shortData) {
    // 1. Daten normalisieren (Unterstützung für flaches Format {t, r: [[lon,lat,addr,desc]]})
    let token = null;
    let eventDate = null;
    if (!Array.isArray(shortData)) {
        eventDate = shortData.d || shortData.date;
        if (shortData.r) { token = shortData.t; shortData = shortData.r; }
        else if (shortData.route) { token = shortData.tok; shortData = shortData.route; }
    }

    // Array-Einträge in Objekte umwandeln, falls nötig
    shortData = shortData.map(item => {
        if (Array.isArray(item)) return { point: [item[0], item[1]], addr: item[2], desc: item[3] };
        if (item.p) return { point: item.p, addr: item.a, desc: item.d };
        return item;
    });

    // 2. Funktion zum Starten der App (wird aufgerufen, wenn Token gültig oder nicht vorhanden)
    const initMapApp = () => {
        const map = L.map('map', { 
            zoomControl: true,
            minZoom: 13, // Genug Übersicht für Griesheim <-> DA
            maxZoom: 18, // Straßenebene, spart die ganz tiefen Zoom-Tiles
            maxBounds: [[49.79, 8.52], [49.925, 8.76]], // Griesheim/Eberstadt bis Arheilgen (ohne Wixhausen)
            maxBoundsViscosity: 1.0 // Harte Grenze, lässt sich nicht wegziehen
        });
        window.map = map;

        // Layer 1: Stadia (Standard)
        const stadiaLayer = L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
        });

        // Layer 2: Thunderforest Transport (Optional) - Key kommt aus config.js (_app_c.x9)
        const transportLayer = L.tileLayer('https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apikey}', {
            apikey: (typeof _app_c !== 'undefined' && _app_c.x9) ? _app_c.x9 : '',
            maxZoom: 18,
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });

        stadiaLayer.addTo(map); // Standard-Layer aktivieren
        L.control.layers({ "Stadtplan": stadiaLayer, "ÖPNV": transportLayer }, null, { position: 'topright' }).addTo(map);
        
        let userLocMarker, userLocCircle, locateBtnElement;

        const LocateControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function() {
                const btn = L.DomUtil.create('div', 'locate-btn');
                btn.innerHTML = locateIconSvg;
                btn.onclick = () => {
                    btn.classList.add('loading');
                    map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
                };
                locateBtnElement = btn;
                return btn;
            }
        });
        map.addControl(new LocateControl());

        // Kontakt-Button als Map-Control (oben rechts, unter den Layern)
        const ContactControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function() {
                const btn = L.DomUtil.create('div', 'leaflet-control contact-control-btn');
                btn.innerHTML = contactIconSvg;
                btn.onclick = (e) => {
                    L.DomEvent.stopPropagation(e); // Klick nicht an Karte durchreichen
                    openContactModal();
                };
                return btn;
            }
        });
        map.addControl(new ContactControl());

        map.on('locationfound', (e) => {
            if (locateBtnElement) locateBtnElement.classList.remove('loading');
            const radius = e.accuracy / 2;
            if (!userLocMarker) {
                userLocMarker = L.marker(e.latlng).addTo(map);
                userLocCircle = L.circle(e.latlng, radius).addTo(map);
            } else {
                userLocMarker.setLatLng(e.latlng);
                userLocCircle.setLatLng(e.latlng).setRadius(radius);
            }
        });
        
        map.on('locationerror', (e) => {
            if (locateBtnElement && locateBtnElement.classList.contains('loading')) {
                locateBtnElement.classList.remove('loading');
                alert("Standort konnte nicht ermittelt werden. Bitte GPS aktivieren.");
            }
        });
        
        // GPS-Tracking Logik: Nur tracken, wenn App sichtbar ist (spart Akku)
        const startTracking = () => map.locate({ watch: true, setView: false, enableHighAccuracy: true });
        startTracking();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                map.stopLocate(); // GPS aus
            } else {
                startTracking(); // GPS an
            }
        });

        const features = shortData.map((item, i) => {
            // Reisezeit-Berechnung zum vorherigen Punkt
            let travelInfo = "";
            if (i > 0) {
                const prev = shortData[i - 1];
                // Leaflet erwartet [Lat, Lon], GeoJSON ist [Lon, Lat] -> wir müssen drehen
                const distMeters = map.distance([prev.point[1], prev.point[0]], [item.point[1], item.point[0]]);
                const distKm = distMeters / 1000;
                
                // Umwegfaktor für die Anzeige (ca. 40% länger als Luftlinie durch Straßenführung)
                const displayDistMeters = distMeters * 1.4;
                const displayDistKm = displayDistMeters / 1000;

                let mins;
                
                // Distanz formatieren (z.B. "850 m" oder "1,2 km")
                const distText = displayDistKm < 1 ? `${Math.round(displayDistMeters)} m` : `${displayDistKm.toFixed(1).replace('.', ',')} km`;

                if (distKm <= 1.1) {
                    // Laufen: Realstrecke (Umweg) / 5km/h + 3 Min Puffer, aufgerundet auf 5 Min
                    const rawMins = (displayDistKm / 5) * 60 + 3;
                    mins = Math.ceil(rawMins / 5) * 5;
                    travelInfo = `🚶 ${distText} • ca. ${mins} Min.`;
                } else {
                    // ÖPNV: 15 Min Sockel + 4 Min pro km (entspricht ca. 15km/h Luftlinie), aufgerundet auf nächste 5 Min
                    const rawMins = 15 + (distKm * 4);
                    mins = Math.ceil(rawMins / 5) * 5;
                    travelInfo = `🚋 ${distText} • ca. ${mins} Min.`;
                }
            }
            
            // Prüfen, ob der Gang vergangen ist
            let isPast = false;
            if (eventDate) {
                // Fix: Sicherer Zugriff, falls times[i] undefined ist (bei mehr Stationen als Zeiten)
                const timeMatch = (times[i] || '').match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const courseDate = new Date(eventDate);
                    courseDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
                    if (new Date() > courseDate) isPast = true;
                }
            }

            // Sichere Fallbacks für Namen und Zeiten, falls Arrays nicht zur Routenlänge passen
            const safeName = gangs[i] || `Station ${i + 1}`;
            const safeTime = times[i] || '';

            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: item.point },
                properties: { 
                    addr: escapeHtml(item.addr), // XSS Schutz
                    desc: escapeHtml(item.desc), // XSS Schutz
                    num: i + 1, 
                    name: safeName, 
                    time: safeTime, 
                    label: (i === 3 ? "P" : i + 1), 
                    id: i,
                    travel: travelInfo,
                    isPast: isPast
                }
            };
        });

        const coords = features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
        L.polyline(coords, { color: '#555', weight: 3, dashArray: '5, 10' }).addTo(map);

        const layer = L.geoJSON({ type: "FeatureCollection", features }, {
            pointToLayer: (f, latlng) => {
                return L.marker(latlng, { 
                    icon: L.divIcon({ 
                        className: `custom-pin-icon ${f.properties.isPast ? 'past' : ''}`, 
                        html: getRuebeMarkerHtml(f.properties.label),
                        iconSize: [45, 45], iconAnchor: [22.5, 43], popupAnchor: [0, -38]
                    }) 
                });
            },
            onEachFeature: (f, l) => {
                const nav = getNaviAction(f.geometry.coordinates[1], f.geometry.coordinates[0], f.properties.addr);
                const popupContent = `<strong>${f.properties.name}</strong><br>${f.properties.time} ${f.properties.travel ? '<span style="color:#666; font-size: 0.9em;">(' + f.properties.travel + ')</span>' : ''}<br>${f.properties.addr || ''}<br><i style="font-size:12px;color:#666">${f.properties.desc || ''}</i><br><a href="${nav.url}" target="_blank" class="navi-btn-popup">${nav.text}</a>`;
                
                l.on('click', () => {
                    const container = document.getElementById('station-list-container');
                    if (container.classList.contains('collapsed')) {
                        L.popup({ offset: [0, -38] })
                            .setLatLng(l.getLatLng())
                            .setContent(popupContent)
                            .openOn(map);
                    } else {
                        const el = document.getElementById(`station-${f.properties.id}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('highlight');
                            setTimeout(() => el.classList.remove('highlight'), 1500);
                        }
                    }
                });
            }
        }).addTo(map);

        map.fitBounds(layer.getBounds(), { padding: [50, 50] });

        const list = document.getElementById('station-list');

        const listItemsHtml = features.map(f => {
            const nav = getNaviAction(f.geometry.coordinates[1], f.geometry.coordinates[0], f.properties.addr);
            return `<div id="station-${f.properties.id}" class="list-item ${f.properties.isPast ? 'past' : ''}" onclick="map.setView([${f.geometry.coordinates[1]}, ${f.geometry.coordinates[0]}], 17)">
                <div class="list-info-wrapper">
                    <div class="list-ruebe-icon">${getRuebeMarkerHtml(f.properties.label)}</div>
                    <div class="list-content">
                        <div class="list-meta">${f.properties.time} ${f.properties.travel ? ' • ' + f.properties.travel : ''}</div>
                        <h3>${f.properties.name}</h3>
                        <div class="list-details">${f.properties.addr ? f.properties.addr + '<br>' : ''}<i style="color:#888">${f.properties.desc || ''}</i></div>
                    </div>
                </div>
                <a href="${nav.url}" target="_blank" class="list-action-btn" onclick="event.stopPropagation()">${pinIconSvg}</a>
            </div>`;
        }).join('');

        // Fix: Prüfen ob Funktion existiert (falls pwa.js nicht geladen wurde)
        list.innerHTML = (typeof getInstallBannerHtml === 'function' ? getInstallBannerHtml() : '') + listItemsHtml;
    };

    // 3. Check gegen blocked.json (wenn Token vorhanden)
    if (token) {
        fetch('blocked.json')
            .then(res => res.json())
            .then(blockedList => {
                if (blockedList.includes(token)) {
                    // Token ist gesperrt -> Warnung anzeigen
                    document.getElementById('station-list-container').style.display = 'none';
                    document.getElementById('map').innerHTML = `
                        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding: 20px; text-align: center;">
                            <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                            <h2 style="color: #6e4a80; margin: 0 0 15px 0;">Karte nicht mehr aktuell</h2>
                            <p style="font-size: 18px; color: #333; line-height: 1.6;">
                                Achtung: Diese Karte ist nicht mehr aktuell, bitte rufe die aktualisierte Karte aus deinen Mails auf.
                            </p>
                        </div>`;
                } else {
                    // Token okay -> App starten
                    initMapApp();
                }
            })
            .catch(e => {
                console.error('Fehler beim Prüfen der Sperrliste:', e);
                initMapApp(); // Im Zweifel (oder offline) erlauben
            });
    } else {
        // Kein Token -> App normal starten
        initMapApp();
    }
} else {
    // Fall 3: Gar keine Daten (weder URL noch LocalStorage) -> Hinweis anzeigen
    document.getElementById('station-list-container').style.display = 'none';
    document.getElementById('map').innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding: 20px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">✉️</div>
            <h2 style="color: #6e4a80; margin: 0 0 15px 0;">Keine Route gefunden</h2>
            <p style="font-size: 18px; color: #333; line-height: 1.6;">
                Bitte öffne den Link direkt aus der Routenmail heraus.
            </p>
        </div>`;
}

// Versuchen, den Speicher vor automatischer Löschung zu schützen (Persistent Storage)
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(granted => {
        if (granted) {
            console.log("Speicher ist persistent (wird nicht automatisch gelöscht).");
        } else {
            console.log("Speicher ist 'Best Effort' (kann bei Platzmangel gelöscht werden).");
        }
    });
}