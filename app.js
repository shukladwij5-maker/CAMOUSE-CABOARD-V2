// Main Application Logic - Virtual Mouse
let handDetector = null;
let isRunning = false;

// Cursor state
const cursor = {
    el: null,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    prevX: 0,
    prevY: 0,
    smoothX: 0,
    smoothY: 0,
    isLeftDown: false,
    isRightDown: false,
    lerpAmount: 0.1, // Softer lerp for more stability
    motionHistory: [],
    maxHistory: 10, // More frames for better averaging
    lastBackendMove: 0,
    backendThreshold: 30, // Faster poll with filtering
    lastSentX: 0,
    lastSentY: 0,
    minSyncDiff: 0.001 // Jitter threshold
};

let isBackendMode = false;
let isKeyboardMode = false;
let isDeskMode = false;
let typedText = "";

// DOM Elements
let startBtn, stopBtn;
let sandbox;

async function initApp() {
    console.log('Initializing Virtual Mouse App...');

    // Cache DOM elements
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    sandbox = document.getElementById('sandbox');
    cursor.el = document.getElementById('virtual-cursor');

    // Set up event listeners
    startBtn.addEventListener('click', handleStart);
    stopBtn.addEventListener('click', handleStop);

    const videoSection = document.getElementById('video-section');
    const toggleBtn = document.getElementById('toggleVideoBtn');
    toggleBtn.addEventListener('click', () => {
        videoSection.classList.toggle('collapsed');
        toggleBtn.textContent = videoSection.classList.contains('collapsed') ? '▶' : '◀';
    });

    document.getElementById('realPcToggle').addEventListener('change', async (e) => {
        isBackendMode = e.target.checked;
        console.log('Real PC Mode:', isBackendMode);
    });

    document.getElementById('deskModeToggle').addEventListener('change', (e) => {
        isDeskMode = e.target.checked;
        console.log('Desk Mode:', isDeskMode);
    });

    document.getElementById('keyboardToggle').addEventListener('change', (e) => {
        isKeyboardMode = e.target.checked;
        const wrapper = document.getElementById('keyboard-wrapper');
        if (isKeyboardMode) {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    });

    // Add click listeners to keys (optional but good for testing)
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', (e) => {
            handleKeyClick(e.target.textContent);
        });
    });

    // Initialize hand detector
    const canvas = document.getElementById('output');
    handDetector = new HandDetector(
        canvas,
        onHandData,
        () => { } // Hand lost
    );

    canvas.width = 640;
    canvas.height = 480;

    try {
        await handDetector.initialize();
        console.log('Hand detector ready');
    } catch (error) {
        console.error('Hand detector init failed:', error);
    }

    // Start cursor animation loop
    animateCursor();
}

async function handleStart() {
    try {
        if (audioSynth.audioContext.state === 'suspended') {
            await audioSynth.audioContext.resume();
        }
        await handDetector.start();
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (err) {
        console.error(err);
    }
}

async function handleStop() {
    await handDetector.stop();
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

function onHandData(landmarks) {
    if (!isRunning) return;

    // Map camera (0-1) to sandbox dimensions
    const rect = sandbox.getBoundingClientRect();

    // Desk Mode: Index finger tip controls cursor, thumb for left click
    if (isDeskMode) {
        // 1. Movement Logic: Use index finger tip (landmark 8)
        const indexTip = landmarks[8];
        let newTargetX = rect.left + (1 - indexTip.x) * rect.width;
        let newTargetY = rect.top + indexTip.y * rect.height;

        // Apply motion smoothing
        cursor.motionHistory.push({ x: newTargetX, y: newTargetY });
        if (cursor.motionHistory.length > cursor.maxHistory) {
            cursor.motionHistory.shift();
        }

        // Average the positions
        let avgX = 0, avgY = 0;
        cursor.motionHistory.forEach(pos => {
            avgX += pos.x;
            avgY += pos.y;
        });
        cursor.targetX = avgX / cursor.motionHistory.length;
        cursor.targetY = avgY / cursor.motionHistory.length;

        // 2. Click Detection: Thumb for left click
        // Detect if thumb tip (4) is above thumb IP joint (3) (thumb is extended/raised)
        // When thumb is raised, it's a click
        const isThumbExtended = landmarks[4].y < landmarks[3].y;
        handleLeftClick(isThumbExtended);

        // No right click in desk mode
        handleRightClick(false);
    } else {
        // Original Mode: Middle finger for cursor, index and middle for clicks
        // 1. Movement Logic (Base position is middle finger MCP)
        const pos = landmarks[9]; // Middle finger MCP is good stable center

        let newTargetX = rect.left + (1 - pos.x) * rect.width;
        let newTargetY = rect.top + pos.y * rect.height;

        // Apply motion smoothing - average last N positions to reduce jitter
        cursor.motionHistory.push({ x: newTargetX, y: newTargetY });
        if (cursor.motionHistory.length > cursor.maxHistory) {
            cursor.motionHistory.shift();
        }

        // Average the positions
        let avgX = 0, avgY = 0;
        cursor.motionHistory.forEach(pos => {
            avgX += pos.x;
            avgY += pos.y;
        });
        cursor.targetX = avgX / cursor.motionHistory.length;
        cursor.targetY = avgY / cursor.motionHistory.length;

        // 2. Click Detection
        // Left Click: Index finger folded
        // Detect if tip (8) is below the middle joint (6)
        const isLeftFolded = landmarks[8].y > landmarks[6].y;
        handleLeftClick(isLeftFolded);

        // Right Click: Middle finger folded
        // Detect if tip (12) is below middle joint (10)
        const isRightFolded = landmarks[12].y > landmarks[10].y;
        handleRightClick(isRightFolded);
    }

    // Handle real PC mouse movement
    if (isBackendMode) {
        // Calculate normalized smoothed position for backend
        const finalNormX = (cursor.targetX - rect.left) / rect.width;
        const finalNormY = (cursor.targetY - rect.top) / rect.height;

        syncToBackend(finalNormX, finalNormY);
    }
}

async function syncToBackend(normX, normY) {
    const now = Date.now();
    if (now - cursor.lastBackendMove < cursor.backendThreshold) return;

    // Jitter filter: check if moved enough
    const dx = Math.abs(normX - cursor.lastSentX);
    const dy = Math.abs(normY - cursor.lastSentY);
    if (dx < cursor.minSyncDiff && dy < cursor.minSyncDiff) return;

    cursor.lastBackendMove = now;
    cursor.lastSentX = normX;
    cursor.lastSentY = normY;

    try {
        await fetch('http://localhost:5000/api/mouse/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: normX, y: normY })
        });
    } catch (e) {
        console.warn('Backend movement failed:', e.message);
    }
}

async function sendBackendClick(button) {
    if (!isBackendMode) return;
    try {
        await fetch('http://localhost:5000/api/mouse/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ button })
        });
    } catch (e) {
        console.warn('Backend click failed:', e.message);
    }
}

function handleLeftClick(isFolded) {
    const statusEl = document.getElementById('status-left');

    if (isFolded && !cursor.isLeftDown) {
        cursor.isLeftDown = true;
        cursor.el.classList.add('left-click');
        statusEl.querySelector('span:last-child').textContent = 'ON';
        statusEl.classList.add('active');

        // Play click sound
        audioSynth.playClick(440); // High pitch click

        // Perform virtual click
        triggerMouseEvent('mousedown');
        triggerMouseEvent('click');
        sendBackendClick('left');
    } else if (!isFolded && cursor.isLeftDown) {
        cursor.isLeftDown = false;
        cursor.el.classList.remove('left-click');
        statusEl.querySelector('span:last-child').textContent = 'OFF';
        statusEl.classList.remove('active');
        triggerMouseEvent('mouseup');
    }
}

function handleRightClick(isFolded) {
    const statusEl = document.getElementById('status-right');

    if (isFolded && !cursor.isRightDown) {
        cursor.isRightDown = true;
        cursor.el.classList.add('right-click');
        statusEl.querySelector('span:last-child').textContent = 'ON';
        statusEl.classList.add('active');

        audioSynth.playClick(220); // Low pitch click
        triggerMouseEvent('contextmenu');
        sendBackendClick('right');
    } else if (!isFolded && cursor.isRightDown) {
        cursor.isRightDown = false;
        cursor.el.classList.remove('right-click');
        statusEl.querySelector('span:last-child').textContent = 'OFF';
        statusEl.classList.remove('active');
    }
}

function handleKeyClick(keyText) {
    const display = document.getElementById('typed-text-display');
    if (keyText === 'Back') {
        typedText = typedText.slice(0, -1);
    } else if (keyText === 'Space') {
        typedText += " ";
    } else {
        typedText += keyText;
    }
    display.textContent = typedText + "|";
}

function triggerMouseEvent(type) {
    const el = document.elementFromPoint(cursor.x, cursor.y);
    if (!el) return;

    const event = new MouseEvent(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: cursor.x,
        clientY: cursor.y
    });
    el.dispatchEvent(event);

    // Visual feedback for icons
    if (type === 'mousedown' && el.closest('.desktop-icon')) {
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('active'));
        el.closest('.desktop-icon').classList.add('active');
    }
}

function animateCursor() {
    // Super smooth LERP movement to reduce shakiness
    cursor.x += (cursor.targetX - cursor.x) * cursor.lerpAmount;
    cursor.y += (cursor.targetY - cursor.y) * cursor.lerpAmount;

    // Additional smoothing - use exponential moving average
    cursor.smoothX = cursor.smoothX * 0.7 + cursor.x * 0.3;
    cursor.smoothY = cursor.smoothY * 0.7 + cursor.y * 0.3;

    // Use the smoothed position for display
    cursor.el.style.left = `${cursor.smoothX - 12}px`;
    cursor.el.style.top = `${cursor.smoothY - 12}px`;

    // Hover detection
    const hoveredEl = document.elementFromPoint(cursor.x, cursor.y);
    document.querySelectorAll('.desktop-icon, .btn, .key').forEach(el => el.classList.remove('hovered'));
    if (hoveredEl) {
        const target = hoveredEl.closest('.desktop-icon') || hoveredEl.closest('.btn') || hoveredEl.closest('.key');
        if (target) target.classList.add('hovered');
    }

    requestAnimationFrame(animateCursor);
}

// Global Audio update for click sounds
if (typeof audioSynth !== 'undefined') {
    audioSynth.playClick = function (freq) {
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const g = this.audioContext.createGain();

        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, now + 0.1);

        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(g);
        g.connect(this.masterVolume);

        osc.start(now);
        osc.stop(now + 0.1);
    };
}

// Handle tab switching - keep running even when minimized/hidden
document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
        // Tab is hidden - DON'T stop, just log it
        console.log('Tab hidden - keeping camera running in background...');
        // Camera continues to run automatically
    } else {
        // Tab is visible again
        console.log('Tab visible again');

        // Resume audio context if suspended
        if (typeof audioSynth !== 'undefined' && audioSynth.audioContext && audioSynth.audioContext.state === 'suspended') {
            try {
                await audioSynth.audioContext.resume();
                console.log('✓ Audio context resumed');
            } catch (e) {
                console.error('Error resuming audio:', e);
            }
        }
    }
});

// Keep app active - prevent browser from suspending the tab
setInterval(() => {
    // This keeps the browser from throttling the tab
    if (isRunning) {
        // Dummy operation to keep CPU active
        Math.random();
    }
}, 500);

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
    if (isRunning) {
        await handleStop();
    }
});

initApp();
