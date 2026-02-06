const els = {
    data: document.getElementById("data"),
    wifiSsid: document.getElementById("wifiSsid"),
    wifiPass: document.getElementById("wifiPass"),
    wifiType: document.getElementById("wifiType"),
    plainText: document.getElementById("plainText"),
    dots: document.getElementById("dots"),
    cornersSquare: document.getElementById("cornersSquare"),
    c1: document.getElementById("c1"),
    hexC1: document.getElementById("hex-c1"),
    logo: document.getElementById("logo"),
    size: document.getElementById("size"),
    ec: document.getElementById("ec"),
    logoSize: document.getElementById("logoSize"),
    transparentBg: document.getElementById("transparentBg"),
    qrContainer: document.getElementById("qr")
};

let logoURL = "";
let currentMode = "url";
let contextTargetId = null;
let html5QrCode = null;
let isScanning = false;
let qrCode = null;
let currentTheme = localStorage.getItem('theme') || 'dark';

function vibrate(duration = 50) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

function initQRCode() {
    try {
        if (els.qrContainer) {
            els.qrContainer.innerHTML = '';
        }

        qrCode = new QRCodeStyling({
            width: 300,
            height: 300,
            type: "canvas",
            data: "https://example.com",
            dotsOptions: {
                color: "#000000",
                type: "rounded"
            },
            backgroundOptions: {
                color: currentTheme === 'light' ? "#ffffff" : "#ffffff"
            },
            cornersSquareOptions: {
                type: "square",
                color: "#000000"
            },
            cornersDotOptions: {
                type: "square",
                color: "#000000"
            },
            qrOptions: {
                errorCorrectionLevel: "M"
            }
        });

        qrCode.append(els.qrContainer);
        return true;
    } catch (error) {
        console.error('QR init failed:', error);
        showToast('Failed to initialize', true);
        return false;
    }
}

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try {
        localStorage.setItem('theme', theme);
    } catch (e) {}

    const themeText = document.getElementById('theme-text');
    if (themeText) {
        themeText.textContent = theme === 'light' ? 'Light' : 'Dark';
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'light' ? '#ffffff' : '#6366f1');
    }

    if (qrCode) {
        updateQR();
    }
}

function toggleTheme() {
    vibrate(30);
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    showToast(`${newTheme === 'light' ? '☀️' : '🌙'} ${newTheme} mode`);
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const handleUpdate = debounce(() => {
    updateQR();
}, 60);

function setupEventListeners() {
    ['data', 'wifiSsid', 'wifiPass', 'wifiType', 'plainText', 'ec', 'size'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', handleUpdate);
            el.addEventListener('change', handleUpdate);
        }
    });

    if (els.c1) {
        els.c1.addEventListener('input', (e) => {
            if (els.hexC1) els.hexC1.value = e.target.value;
            handleUpdate();
        });
    }

    if (els.hexC1) {
        els.hexC1.addEventListener('input', (e) => {
            const val = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(val) && els.c1) {
                els.c1.value = val;
                handleUpdate();
            }
        });
    }

    if (els.transparentBg) {
        els.transparentBg.addEventListener('change', handleUpdate);
    }

    if (els.logo) {
        els.logo.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                if (logoURL) URL.revokeObjectURL(logoURL);
                logoURL = URL.createObjectURL(file);

                const preview = document.getElementById('logo-preview');
                const img = document.getElementById('logo-preview-img');
                const drop = document.getElementById('logo-drop');

                if (img && preview && drop) {
                    img.src = logoURL;
                    preview.classList.remove('hidden');
                    drop.classList.add('hidden');
                }

                els.ec.value = "H";
                updateQR();
                vibrate(50);
                showToast("Logo uploaded");
            }
        };
    }

    document.addEventListener('click', (e) => {
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu && !e.target.closest('#context-menu')) {
            contextMenu.classList.add('hidden');
        }
    });

    window.addEventListener('beforeunload', () => {
        if (logoURL) URL.revokeObjectURL(logoURL);
        if (isScanning) stopScan();
    });
}

function setGenMode(mode) {
    currentMode = mode;
    vibrate(30);

    ['url', 'wifi', 'text'].forEach(m => {
        const el = document.getElementById(`input-${m}`);
        if (el) el.classList.add('hidden');
    });

    const activeInput = document.getElementById(`input-${mode}`);
    if (activeInput) activeInput.classList.remove('hidden');

    updateQR();
}

function updateSegment(targetId, btn) {
    vibrate(30);
    const val = btn.dataset.val;
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.value = val;

    const parent = btn.parentElement;
    Array.from(parent.children).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateQR();
}

function updateRangeVal(el) {
    const valDisplay = document.getElementById("val-" + el.id);
    if (valDisplay) valDisplay.textContent = el.value;
    handleUpdate();
}

function getData() {
    if (currentMode === 'url') {
        return els.data?.value || "https://example.com";
    } else if (currentMode === 'text') {
        return els.plainText?.value || "Sample text";
    } else if (currentMode === 'wifi') {
        const ssid = els.wifiSsid?.value || "";
        if (!ssid.trim()) {
            return "WIFI:T:WPA;S:MyNetwork;P:;;";
        } else {
            const type = els.wifiType?.value || "WPA";
            const pass = type === 'nopass' ? '' : (els.wifiPass?.value || '');
            return `WIFI:T:${type};S:${ssid};P:${pass};;`;
        }
    }
    return "QR Studio";
}

function updateQR() {
    if (!qrCode) return;

    try {
        const qrData = getData();
        const c1 = els.c1?.value || "#000000";
        const dotsType = els.dots?.value || "rounded";
        const cornersType = els.cornersSquare?.value || "square";
        const bgColor = els.transparentBg?.checked ? "transparent" : (currentTheme === 'light' ? "#ffffff" : "#ffffff");
        const errorLevel = els.ec?.value || "M";

        const updateConfig = {
            data: qrData,
            qrOptions: {
                errorCorrectionLevel: errorLevel
            },
            backgroundOptions: {
                color: bgColor
            },
            dotsOptions: {
                type: dotsType,
                color: c1
            },
            cornersSquareOptions: {
                type: cornersType,
                color: c1
            },
            cornersDotOptions: {
                type: cornersType === 'extra-rounded' ? 'dot' : 'square',
                color: c1
            }
        };

        if (logoURL) {
            updateConfig.image = logoURL;
            updateConfig.imageOptions = {
                imageSize: parseFloat(els.logoSize?.value || 0.3),
                margin: 6,
                crossOrigin: "anonymous",
                hideBackgroundDots: true
            };
        }

        qrCode.update(updateConfig);

    } catch (error) {
        console.error('QR update failed:', error);
    }
}

function removeLogo() {
    if (logoURL) URL.revokeObjectURL(logoURL);
    logoURL = "";

    const preview = document.getElementById('logo-preview');
    const drop = document.getElementById('logo-drop');
    const logoInput = document.getElementById('logo');

    if (preview) preview.classList.add('hidden');
    if (drop) drop.classList.remove('hidden');
    if (logoInput) logoInput.value = '';

    updateQR();
    vibrate(30);
    showToast("Logo removed");
}

function downloadQR(ext) {
    if (!qrCode) {
        showToast('QR not ready', true);
        return;
    }

    vibrate(50);
    showLoading();
    const size = parseInt(els.size?.value || 2000);
    const prevSize = 300;

    let filename = 'qr-code';
    if (currentMode === 'url' && els.data?.value) {
        try {
            const url = new URL(els.data.value);
            filename = `qr-${url.hostname.replace('www.', '')}`;
        } catch {
            filename = 'qr-url';
        }
    } else if (currentMode === 'wifi' && els.wifiSsid?.value) {
        filename = `qr-wifi-${els.wifiSsid.value.replace(/[^a-z0-9]/gi, '-')}`;
    } else if (currentMode === 'text') {
        filename = 'qr-text';
    }

    filename += `-${Date.now()}`;

    try {
        qrCode.update({ width: size, height: size });
        qrCode.download({
            name: filename,
            extension: ext
        }).then(() => {
            qrCode.update({ width: prevSize, height: prevSize });
            hideLoading();
            showToast(`Downloaded as ${ext.toUpperCase()}`);
        }).catch(err => {
            hideLoading();
            showToast("Download failed", true);
            console.error(err);
        });
    } catch (error) {
        hideLoading();
        showToast("Download failed", true);
        console.error(error);
    }
}

function copyImageToClipboard() {
    vibrate(50);
    const canvas = document.querySelector("#qr canvas");
    if (!canvas) {
        showToast("QR not ready", true);
        return;
    }

    canvas.toBlob(blob => {
        if (navigator.clipboard && navigator.clipboard.write) {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
                showToast("Copied to clipboard");
            }).catch(err => {
                showToast("Copy failed", true);
            });
        } else {
            showToast("Clipboard not supported", true);
        }
    });
}

async function shareQR() {
    if (!navigator.share) {
        showToast("Share not supported", true);
        return;
    }

    vibrate(50);
    const canvas = document.querySelector("#qr canvas");
    if (!canvas) {
        showToast("QR not ready", true);
        return;
    }

    try {
        await new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], "qr-code.png", { type: "image/png" });
                try {
                    await navigator.share({
                        files: [file],
                        title: 'QR Code'
                    });
                    showToast("Shared");
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        showToast("Share cancelled", false);
                    }
                }
                resolve();
            });
        });
    } catch (err) {
        console.error('Share failed:', err);
    }
}

function switchTab(id, btn) {
    vibrate(30);
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

    const tab = document.getElementById(id);
    if (tab) tab.classList.add("active");
    if (btn) btn.classList.add("active");

    if (id !== 'scan' && isScanning) {
        stopScan();
    }
}

async function startScan() {
    if (isScanning) return;

    vibrate(50);
    try {
        html5QrCode = new Html5Qrcode("reader");

        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            onScanSuccess,
            onScanError
        );

        isScanning = true;
        const placeholder = document.getElementById("camera-placeholder");
        const startBtn = document.getElementById("btn-scan-start");
        const stopBtn = document.getElementById("btn-scan-stop");

        if (placeholder) placeholder.style.display = "none";
        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

    } catch (err) {
        console.error("Camera error:", err);
        let message = "Camera access denied";

        if (err.name === 'NotAllowedError') {
            message = "Please allow camera access";
        } else if (err.name === 'NotFoundError') {
            message = "No camera found";
        } else if (err.name === 'NotReadableError') {
            message = "Camera in use";
        }

        showToast(message, true);
    }
}

function stopScan() {
    if (!html5QrCode || !isScanning) return;

    vibrate(30);
    html5QrCode.stop().then(() => {
        isScanning = false;
        const placeholder = document.getElementById("camera-placeholder");
        const startBtn = document.getElementById("btn-scan-start");
        const stopBtn = document.getElementById("btn-scan-stop");

        if (placeholder) placeholder.style.display = "flex";
        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");
        html5QrCode = null;
    }).catch(err => {
        console.error("Stop error:", err);
        isScanning = false;
    });
}

function onScanSuccess(decodedText, decodedResult) {
    vibrate(200);

    const resultText = document.getElementById("scanResultText");
    const resultContainer = document.getElementById("scanResultContainer");

    if (resultText) resultText.textContent = decodedText;
    if (resultContainer) resultContainer.classList.remove("hidden");

    const urlPattern = /^(https?:\/\/|www\.)/i;
    const link = document.getElementById("scanResultLink");
    if (link) {
        if (urlPattern.test(decodedText)) {
            link.href = decodedText.startsWith('http') ? decodedText : 'https://' + decodedText;
            link.classList.remove("hidden");
        } else {
            link.classList.add("hidden");
        }
    }

    showToast("Scanned successfully");
}

function onScanError(errorMessage) {
}

function scanFromFile(input) {
    const file = input.files[0];
    if (!file) return;

    vibrate(50);
    showLoading();

    const html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.scanFile(file, true)
        .then(decodedText => {
            hideLoading();
            onScanSuccess(decodedText);
        })
        .catch(err => {
            hideLoading();
            console.error("Scan error:", err);
            showToast("No QR found", true);
        });

    input.value = '';
}

function copyResult() {
    vibrate(50);
    const textEl = document.getElementById("scanResultText");
    if (!textEl) return;

    const text = textEl.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied");
        }).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        showToast("Copied");
    } catch (err) {
        showToast("Copy failed", true);
    }

    document.body.removeChild(textarea);
}

function useScannedData() {
    const text = document.getElementById("scanResultText")?.textContent;
    if (!text || text === '...') return;

    vibrate(50);
    switchTab('gen', document.querySelector('.nav-item'));

    if (text.startsWith('http')) {
        setGenMode('url');
        if (els.data) els.data.value = text;
    } else if (text.startsWith('WIFI:')) {
        setGenMode('wifi');
        const ssidMatch = text.match(/S:([^;]+)/);
        const passMatch = text.match(/P:([^;]*)/);
        const typeMatch = text.match(/T:([^;]+)/);

        if (ssidMatch && els.wifiSsid) els.wifiSsid.value = ssidMatch[1];
        if (passMatch && els.wifiPass) els.wifiPass.value = passMatch[1];
        if (typeMatch && els.wifiType) els.wifiType.value = typeMatch[1];
    } else {
        setGenMode('text');
        if (els.plainText) els.plainText.value = text;
    }

    updateQR();
    closeResult();
    showToast("Data loaded");
}

function closeResult() {
    vibrate(30);
    const resultContainer = document.getElementById("scanResultContainer");
    const resultLink = document.getElementById("scanResultLink");
    if (resultContainer) resultContainer.classList.add("hidden");
    if (resultLink) resultLink.classList.add("hidden");
}

function renderHistory() {
    const list = document.getElementById("history-list");
    if (!list) return;

    try {
        const hist = JSON.parse(localStorage.getItem("qr-history") || "[]");
        list.innerHTML = "";

        if (hist.length === 0) {
            list.innerHTML = '<span style="font-size:13px; color:var(--text-2); padding:10px;">No history</span>';
            return;
        }

        hist.forEach(i => {
            const div = document.createElement("div");
            div.className = "hist-thumb";
            div.style.background = `linear-gradient(135deg, ${i.color || '#000'}, ${i.color || '#000'})`;

            div.onclick = () => loadHistoryItem(i);

            div.oncontextmenu = (e) => {
                e.preventDefault();
                contextTargetId = i.id;
                const menu = document.getElementById("context-menu");
                if (menu) {
                    menu.style.top = `${e.pageY}px`;
                    menu.style.left = `${e.pageX}px`;
                    menu.classList.remove("hidden");
                }
            };

            list.appendChild(div);
        });
    } catch (error) {
        console.error('History error:', error);
    }
}

function loadHistoryItem(i) {
    vibrate(50);
    setGenMode(i.mode);
    if (i.mode === 'url' && els.data) els.data.value = i.data;
    if (i.mode === 'wifi' && els.wifiSsid) els.wifiSsid.value = i.data;
    if (i.mode === 'text' && els.plainText) els.plainText.value = i.data;
    if (i.color && els.c1) els.c1.value = i.color;
    if (i.color && els.hexC1) els.hexC1.value = i.color;

    updateQR();
    showToast("Loaded");
}

function cmAction(action) {
    vibrate(30);
    try {
        const hist = JSON.parse(localStorage.getItem("qr-history") || "[]");
        const item = hist.find(h => h.id === contextTargetId);

        if (action === 'load' && item) loadHistoryItem(item);
        if (action === 'del') {
            const newHist = hist.filter(h => h.id !== contextTargetId);
            localStorage.setItem("qr-history", JSON.stringify(newHist));
            renderHistory();
            showToast("Deleted");
        }
        const menu = document.getElementById("context-menu");
        if (menu) menu.classList.add("hidden");
    } catch (error) {
        console.error('Context menu error:', error);
    }
}

function clearHistory() {
    if (confirm("Clear all history?")) {
        vibrate(100);
        try {
            localStorage.removeItem("qr-history");
            renderHistory();
            showToast("History cleared");
        } catch (error) {
            console.error('Clear error:', error);
        }
    }
}

function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function showToast(msg, isError = false) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "toast";
    if (isError) {
        el.style.borderColor = "#ff4444";
        el.style.background = "rgba(255, 68, 68, 0.1)";
    }
    el.textContent = msg;
    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) loader.classList.add('hidden');
    }, 500);

    if (typeof QRCodeStyling === 'undefined') {
        showToast('QR library failed to load', true);
        return;
    }

    applyTheme(currentTheme);

    const qrInitialized = initQRCode();
    if (!qrInitialized) {
        showToast('Failed to initialize', true);
        return;
    }

   if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered:', registration.scope);
                showToast('✓ Ready for offline use');
            })
            .catch(error => {
                console.error('SW registration failed:', error);
            });
    });
}
   
    setupEventListeners();
    updateQR();
    renderHistory();
});