"use strict";
/*
 * server.ts
 *
 * This TypeScript file defines an Express server for ID verification.  It
 * exposes a POST endpoint at `/verify` that accepts images and performs
 * brightness, aspect ratio, liveness and face matching checks.  See
 * ../README.md for usage instructions and security considerations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const canvas_1 = require("canvas");
const faceapi = __importStar(require("@vladmandic/face-api"));
const verification_1 = require("./utils/verification");
// Monkey patch face-api environment to use node-canvas
faceapi.env.monkeyPatch({ Canvas: canvas_1.Canvas, Image: canvas_1.Image, ImageData: canvas_1.ImageData });
// Directory where the face-api models reside
const MODEL_DIR = path_1.default.join(__dirname, '..', 'models');
/**
 * Load face-api models from disk.  You must download the model files
 * manually (see README) and place them under server/models.
 */
async function loadModels() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
        console.log('Face detection models loaded successfully');
    }
    catch (error) {
        console.warn('Could not load face detection models:', error);
        console.warn('Face matching will be skipped. Please download models to server/models/');
    }
}
// Initialize Express
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 5000;
// Enable CORS
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
// Multer configuration: use memory storage so files are kept in RAM
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Health check
app.get('/', (_req, res) => {
    res.send('ID Verification API is running');
});
// Verification endpoint
app.post('/verify', upload.fields([
    { name: 'frontId', maxCount: 1 },
    { name: 'backId', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'liveness', maxCount: 1 },
]), async (req, res) => {
    try {
        const files = req.files;
        if (!files ||
            !files.frontId ||
            !files.backId ||
            !files.selfie ||
            !files.liveness) {
            res.status(400).json({ error: 'Missing required images' });
            return;
        }
        const frontBuffer = files.frontId[0].buffer;
        const backBuffer = files.backId[0].buffer;
        const selfieBuffer = files.selfie[0].buffer;
        const livenessBuffer = files.liveness[0].buffer;
        const result = await (0, verification_1.verifyImages)({
            frontBuffer,
            backBuffer,
            selfieBuffer,
            livenessBuffer,
            faceapi,
        });
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Load models then start server
loadModels()
    .then(() => {
    app.listen(port, () => {
        console.log(`ID verification server listening on port ${port}`);
    });
})
    .catch((err) => {
    console.error('Error loading models:', err);
});
