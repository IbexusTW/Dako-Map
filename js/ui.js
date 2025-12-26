const container = document.getElementById('station-list-container');
const handle = document.getElementById('list-handle');
const handleText = document.getElementById('handle-text');
let isDragging = false, startY = 0, startHeight = 0;

if (handle && container) {
    handle.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
    handle.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', endDrag);
    
    // Barrierefreiheit: Tastatur-Support (Enter/Leertaste)
    handle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Verhindert Scrollen bei Leertaste
            toggleList();
        }
    });
}

function startDrag(e) {
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = container.getBoundingClientRect().height;
    isDragging = true; container.style.transition = 'none';
    if(e.cancelable) e.preventDefault();
}

function doDrag(e) {
    if (!isDragging) return;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const newHeight = startHeight + (startY - currentY);
    if (newHeight >= 45 && newHeight < window.innerHeight - 50) {
        container.style.height = newHeight + 'px'; container.classList.remove('collapsed');
    }
}

function endDrag(e) {
    if (!isDragging) return; isDragging = false;
    container.style.transition = 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    const h = container.getBoundingClientRect().height;
    if (Math.abs(h - startHeight) < 5) toggleList();
    else if (h < 150) collapseList();
    else openListState();
    // Fix: Sicherer Check, ob map existiert und die Methode hat
    setTimeout(() => { 
        if(window.map && typeof window.map.invalidateSize === 'function') window.map.invalidateSize(); 
    }, 350);
}

function collapseList() { 
    container.classList.add('collapsed'); 
    container.style.height = ''; 
    handleText.innerText = "▲ Stationen anzeigen";
    handle.setAttribute('aria-expanded', 'false');
}
function openListState() { 
    container.classList.remove('collapsed'); 
    handleText.innerText = "▼ Karte vergrößern";
    handle.setAttribute('aria-expanded', 'true');
}
function toggleList() { container.classList.contains('collapsed') ? openListState() : collapseList(); }