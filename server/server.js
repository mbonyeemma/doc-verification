/*
 * server.js
 *
 * This file sets up a simple Express server exposing a single endpoint
 * `/verify` that accepts image uploads for ID verification.  It performs
 * several rudimentary checks on the provided images: brightness, document
 * aspect ratio, face matching and liveness.  The implementation uses
 * Jimp for basic image processing and @vladmandic/face-api for face
 * detection/recognition.  See README.md for details on installing
 * dependencies and model files.
 */

const express = require('express');
const multer = require('multer');
const Jimp = require('jimp');
const path = require('path');

// face-api runs on top of tfjs-node; require after installing dependencies
const faceapi = require('@vladmandic/face-api');
const { Canvas, Image, ImageData } = require('canvas');
const { verifyImages } = require('./utils/verification');

// Configure face-api to use the canvas implementation
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Directory where the models are stored; see README for download instructions
const MODEL_DIR = path.join(__dirname, 'models');

// Load models at startup.  The weights are loaded asynchronously
async function loadModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    console.log('Face detection models loaded successfully');
  } catch (error) {
    console.warn('Could not load face detection models:', error.message);
    console.warn('Face matching will be skipped. Please download models to server/models/');
  }
}

// Initialize app and middleware
const app = express();
const port = process.env.PORT || 5000;

// Multer storage using memory to avoid persisting files to disk
const upload = multer({ storage: multer.memoryStorage() });

// Simple health check
app.get('/', (req, res) => {
  res.send('ID Verification API is running');
});

/*
 * POST /verify
 *
 * Expected multipart form‑data fields:
 * - frontId:    Image file (front of the ID card)
 * - backId:     Image file (back of the ID card)
 * - selfie:     Image file (selfie)
 * - liveness:   Image file (second selfie for liveness)
 */
app.post('/verify', upload.fields([
  { name: 'frontId', maxCount: 1 },
  { name: 'backId', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'liveness', maxCount: 1 },
]), async (req, res) => {
  try {
    const { files } = req;
    if (!files || !files.frontId || !files.backId || !files.selfie || !files.liveness) {
      return res.status(400).json({ error: 'Missing required images' });
    }
    const frontBuffer = files.frontId[0].buffer;
    const backBuffer = files.backId[0].buffer;
    const selfieBuffer = files.selfie[0].buffer;
    const livenessBuffer = files.liveness[0].buffer;

    // Perform verification; util returns detailed result
    const result = await verifyImages({
      frontBuffer,
      backBuffer,
      selfieBuffer,
      livenessBuffer,
      faceapi,
    });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server after models are loaded
loadModels().then(() => {
  app.listen(port, () => {
    console.log(`ID verification server listening on port ${port}`);
  });
}).catch((err) => {
  console.error('Error loading models:', err);
});