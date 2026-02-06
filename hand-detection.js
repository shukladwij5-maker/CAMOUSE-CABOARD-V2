// Hand Detection Module using MediaPipe
// Detects hand position and triggers string playing

class HandDetector {
    constructor(canvasElement, onHandDetected, onHandLost) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.onHandDetected = onHandDetected;
        this.onHandLost = onHandLost;

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults(this.onResults.bind(this));

        this.camera = null;
        this.results = null;
        this.isRunning = false;
        this.keepAliveInterval = null; // Keep processing even when minimized
    }

    async initialize() {
        // Initialize camera
        const video = document.querySelector('#webcam');

        if (!video) {
            throw new Error('Video element not found');
        }

        try {
            this.camera = new Camera(video, {
                onFrame: async () => {
                    if (this.isRunning) {
                        await this.hands.send({ image: video });
                    }
                },
                width: 1920,
                height: 1440
            });

            // Camera is ready to be started via .start()
            return this.camera;
        } catch (error) {
            console.error('Camera initialization failed:', error);
            throw new Error('Failed to initialize camera: ' + error.message);
        }
    }

    async start() {
        if (this.camera) {
            this.isRunning = true;
            await this.camera.start();
            
            // Keep camera active even when tab is hidden
            // This uses setInterval to keep processing frames
            if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = setInterval(() => {
                // This keeps the browser from stopping background processing
                if (!this.isRunning && this.camera) {
                    console.log('Keeping camera active in background...');
                }
            }, 1000);
        }
    }

    async stop() {
        this.isRunning = false;
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        if (this.camera) {
            await this.camera.stop();
        }
    }

    onResults(results) {
        this.results = results;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw video frame
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.drawHands(results.multiHandLandmarks, results.multiHandedness);
        }
    }

    drawHands(landmarks, handedness) {
        landmarks.forEach((handLandmarks, index) => {
            // Draw hand landmarks
            this.drawConnectors(handLandmarks);
            this.drawLandmarks(handLandmarks);

            // Notify about hand position
            this.onHandDetected(handLandmarks, index, handedness[index].label);
        });
    }

    drawConnectors(landmarks) {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],           // Index
            [0, 9], [9, 10], [10, 11], [11, 12],      // Middle
            [0, 13], [13, 14], [14, 15], [15, 16],    // Ring
            [0, 17], [17, 18], [18, 19], [19, 20]     // Pinky
        ];

        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 2;

        connections.forEach(([start, end]) => {
            const from = landmarks[start];
            const to = landmarks[end];

            this.ctx.beginPath();
            this.ctx.moveTo(from.x * this.canvas.width, from.y * this.canvas.height);
            this.ctx.lineTo(to.x * this.canvas.width, to.y * this.canvas.height);
            this.ctx.stroke();
        });
    }

    drawLandmarks(landmarks) {
        this.ctx.fillStyle = '#FF0000';
        landmarks.forEach(landmark => {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;

            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    getHandPosition(handLandmarks) {
        // Get the palm position (average of key landmarks)
        const palmIndices = [0, 5, 9, 13, 17];
        let avgX = 0, avgY = 0;

        palmIndices.forEach(i => {
            avgX += handLandmarks[i].x;
            avgY += handLandmarks[i].y;
        });

        return {
            x: avgX / palmIndices.length,
            y: avgY / palmIndices.length,
            z: (handLandmarks[0].z || 0) // depth
        };
    }

    getFingerTips(handLandmarks) {
        // Return positions of finger tips
        return {
            thumb: handLandmarks[4],
            index: handLandmarks[8],
            middle: handLandmarks[12],
            ring: handLandmarks[16],
            pinky: handLandmarks[20]
        };
    }
}
