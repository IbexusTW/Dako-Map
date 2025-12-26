// Logik für die digitale Visitenkarte

const contactModal = document.getElementById('contact-modal');
const contactForm = document.getElementById('contact-form');
const qrContainer = document.getElementById('qr-code-container');
const qrOutput = document.getElementById('qr-output');
const contactInfoText = document.getElementById('contact-info-text');

// Daten laden
function loadContactData() {
    const saved = localStorage.getItem('dako_contact');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('contact-name').value = data.name || '';
        document.getElementById('contact-phone').value = data.phone || '';
        document.getElementById('contact-email').value = data.email || '';
        document.getElementById('contact-insta').value = data.insta || '';
        if (data.name) showQrCode(data);
    }
}

// Modal öffnen/schließen
window.openContactModal = () => {
    contactModal.style.display = 'flex';
    loadContactData();
};

window.closeContactModal = () => {
    contactModal.style.display = 'none';
};

// Speichern & Generieren
window.saveContact = (e) => {
    e.preventDefault();
    const name = document.getElementById('contact-name').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const insta = document.getElementById('contact-insta').value.trim();

    if (!name) {
        alert("Bitte gib deinen Namen an.");
        return;
    }
    if (!phone && !email && !insta) {
        alert("Bitte gib mindestens eine Kontaktmöglichkeit an (Handy, E-Mail oder Instagram).");
        return;
    }

    const data = { name, phone, email, insta };
    
    localStorage.setItem('dako_contact', JSON.stringify(data));
    showQrCode(data);
};

function showQrCode(data) {
    if (!data.name) return;

    // vCard 3.0 Format erstellen
    let vCard = `BEGIN:VCARD\nVERSION:3.0\nN:;${data.name};;;\nFN:${data.name}`;
    
    if (data.phone) vCard += `\nTEL;TYPE=CELL:${data.phone}`;
    if (data.email) vCard += `\nEMAIL:${data.email}`;
    if (data.insta) vCard += `\nX-SOCIALPROFILE;type=instagram:${data.insta}`;
    
    // Notiz mit "Darmstadt Kocht" und ggf. Instagram Fallback
    let notes = [];
    if (data.insta) notes.push(`Instagram: ${data.insta}`);
    notes.push('Darmstadt Kocht');
    vCard += `\nNOTE:${notes.join(' - ')}`;
    
    vCard += `\nEND:VCARD`;

    // QR Code generieren (Bibliothek qrcode-generator)
    // TypeNumber 0 = Auto-Detect, 'L' = Low Error Correction (reicht hier)
    const qr = qrcode(0, 'L');
    qr.addData(vCard);
    qr.make();

    qrOutput.innerHTML = qr.createImgTag(5); // 5 = Pixelgröße pro Modul
    
    contactForm.style.display = 'none';
    if (contactInfoText) contactInfoText.style.display = 'none';
    qrContainer.style.display = 'flex';
}

window.editContact = () => {
    qrContainer.style.display = 'none';
    contactForm.style.display = 'block';
    if (contactInfoText) contactInfoText.style.display = 'block';
};

// Event Listener für Klick außerhalb des Modals
window.addEventListener('click', (e) => {
    if (e.target === contactModal) {
        closeContactModal();
    }
});

// Initial laden, falls schon Daten da sind, damit der Button evtl. anders aussieht (optional)
loadContactData();