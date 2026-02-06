# Virtual Hand Mouse (and keyboard)🖐️

A web-based virtual mouse application that uses hand detection via webcam to control a cursor in a sandbox environment and optionally control the actual system cursor.

## Features

✨ **Hand Tracking**: Real-time hand detection using MediaPipe  
🖱️ **Virtual Cursor**: Smooth cursor movement following your hand  
👆 **Gesture Clicks**: 
  - Fold Index Finger: **Left Click**
  - Fold Middle Finger: **Right Click**
🎮 **Sandbox Environment**: A simulated desktop to practice gestures  
🖥️ **OS Control**: Optional Python backend to control your real PC mouse  
🔊 **Audio Feedback**: Click sounds for better interaction

## Quick Start

### 1. Web Sandbox (No setup required)

Simply open `index.html` in a modern web browser.

1.  **Allow camera access** when prompted.
2.  **Click "Start Mouse"**.
3.  **Move your hand** and fold fingers to interact with sandbox elements.

### 2. Control Real PC (Optional)

1.  **Install Python dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Start the Python server**:
    ```bash
    python server.py
    ```

3.  **In the browser**, toggle the **"Control Real PC"** checkbox.
    > [!IMPORTANT]
    > Safety: Move the real mouse to any corner of the screen to abort control (pyautogui failsafe).

## How to Interact

| Action | Gesture |
|--------|---------|
| **Move Cursor** | Move your palm/hand in front of the camera |
| **Left Click** | Fold your **Index Finger** (tip below middle joint) |
| **Right Click** | Fold your **Middle Finger** (tip below middle joint) |

## File Structure

```
camtar/
├── index.html           # UI and Sandbox area
├── styles.css           # Styling and animations
├── app.js              # Core interaction logic
├── hand-detection.js   # MediaPipe wrapper
├── audio-synth.js      # Click sound generation
├── server.py           # OS-level mouse control server
└── requirements.txt    # Python dependencies
```

## Troubleshooting

- **Camera not starting**: Ensure no other application is using the webcam and site permissions are granted.
- **Laggy Cursor**: Use a browser with hardware acceleration (Chrome recommended) and close heavy background tabs.
- **Backend Connection Failed**: Ensure `server.py` is running and the "Control Real PC" toggle is on.

## Credits

- **MediaPipe**: Hand tracking framework
- **PyAutoGUI**: System-level automation (Python)
- **Web Audio API**: Audio feedback

