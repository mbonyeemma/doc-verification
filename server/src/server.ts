/*
 * server.ts
 *
 * This TypeScript file defines an Express server for ID verification.  It
 * exposes a POST endpoint at `/verify` that accepts images and performs
 * brightness, aspect ratio, liveness and face matching checks.  See
 * ../README.md for usage instructions and security considerations.
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import { Canvas, Image, ImageData } from 'canvas';
import * as faceapi from '@vladmandic/face-api';
import { verifyImages } from './utils/verification';

// Monkey patch face-api environment to use node-canvas
faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any });

// Directory where the face-api models reside
const MODEL_DIR: string = path.join(__dirname, '..', 'models');

/**
 * Load face-api models from disk.  You must download the model files
 * manually (see README) and place them under server/models.
 */
async function loadModels(): Promise<void> {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    console.log('Face detection models loaded successfully');
  } catch (error) {
    console.warn('Could not load face detection models:', error);
    console.warn('Face matching will be skipped. Please download models to server/models/');
  }
}

// Initialize Express
const app = express();
const port: number = Number(process.env.PORT) || 5000;

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Multer configuration: use memory storage so files are kept in RAM
const upload = multer({ storage: multer.memoryStorage() });

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.send('ID Verification API is running');
});

// Verification endpoint
app.post(
  '/verify',
  upload.fields([
    { name: 'frontId', maxCount: 1 },
    { name: 'backId', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'liveness', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = (req as any).files as {
        [fieldname: string]: any[];
      };
      if (
        !files ||
        !files.frontId ||
        !files.backId ||
        !files.selfie ||
        !files.liveness
      ) {
        res.status(400).json({ error: 'Missing required images' });
        return;
      }
      const frontBuffer: Buffer = files.frontId[0].buffer;
      const backBuffer: Buffer = files.backId[0].buffer;
      const selfieBuffer: Buffer = files.selfie[0].buffer;
      const livenessBuffer: Buffer = files.liveness[0].buffer;

      const result = await verifyImages({
        frontBuffer,
        backBuffer,
        selfieBuffer,
        livenessBuffer,
        faceapi,
      });
      res.json(result);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Load models then start server
loadModels()
  .then(() => {
    app.listen(port, () => {
      console.log(`ID verification server listening on port ${port}`);
    });
  })
  .catch((err: unknown) => {
    console.error('Error loading models:', err);
  });