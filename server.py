"""
Digital Hand Mouse - Python Backend
Provides OS-level mouse control using pyautogui
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import pyautogui
import threading

app = Flask(__name__)
CORS(app)

# Disable pyautogui safety delay for faster response
pyautogui.PAUSE = 0
pyautogui.FAILSAFE = True # Move mouse to corner to abort

# Get screen resolution
SCREEN_WIDTH, SCREEN_HEIGHT = pyautogui.size()

@app.route('/api/mouse/move', methods=['POST'])
def move_mouse():
    try:
        data = request.json
        # Normalize coordinates (0-1) to screen size
        x = data.get('x', 0.5) * SCREEN_WIDTH
        y = data.get('y', 0.5) * SCREEN_HEIGHT
        
        # Move actual mouse
        pyautogui.moveTo(x, y, _pause=False)
        
        return jsonify({'success': True, 'pos': [x, y]})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/mouse/click', methods=['POST'])
def click_mouse():
    try:
        data = request.json
        button = data.get('button', 'left') # 'left' or 'right'
        
        if button == 'left':
            pyautogui.click()
        elif button == 'right':
            pyautogui.rightClick()
            
        return jsonify({'success': True, 'button': button})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'screen': [SCREEN_WIDTH, SCREEN_HEIGHT],
        'version': '2.0.0'
    })

if __name__ == '__main__':
    print(f'AI Mouse Server starting on screen {SCREEN_WIDTH}x{SCREEN_HEIGHT}...')
    print('Safety: Move mouse to any corner to stop it.')
    app.run(host='0.0.0.0', port=5000, debug=False)
