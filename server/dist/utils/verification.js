"use strict";
/*
 * utils/verification.ts
 *
 * This module defines helper functions used by the ID verification API
 * for brightness analysis, aspect ratio validation, image difference
 * calculation (for liveness) and face matching.  All functions return
 * promises and use TypeScript types for clarity.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBrightness = computeBrightness;
exports.checkAspectRatio = checkAspectRatio;
exports.computeImageDifference = computeImageDifference;
exports.bufferToImage = bufferToImage;
exports.verifyImages = verifyImages;
const jimp_1 = __importDefault(require("jimp"));
const canvas_1 = require("canvas");
// Thresholds
const BRIGHTNESS_THRESHOLD = 0.4;
const ASPECT_RATIO_LOWER = 1.3;
const ASPECT_RATIO_UPPER = 1.8;
const LIVENESS_DIFF_THRESHOLD = 0.05;
const FACE_DISTANCE_THRESHOLD = 0.6;
/**
 * Compute average brightness of an image.
 * @param buffer Binary image data
 */
async function computeBrightness(buffer) {
    const image = await jimp_1.default.read(buffer);
    let total = 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        total += lum;
    });
    const avg = total / (image.bitmap.width * image.bitmap.height) / 255;
    return avg;
}
/**
 * Check if the aspect ratio of an image buffer resembles a typical ID
 * card (around 1.5 width/height).  Returns true if the ratio falls
 * within acceptable bounds.
 */
async function checkAspectRatio(buffer) {
    const image = await jimp_1.default.read(buffer);
    const ratio = image.bitmap.width / image.bitmap.height;
    return ratio >= ASPECT_RATIO_LOWER && ratio <= ASPECT_RATIO_UPPER;
}
/**
 * Compute a greyscale difference ratio between two images.  The images
 * are resized to a common 200×200 resolution and the absolute pixel
 * differences are summed and normalised to [0, 1].
 */
async function computeImageDifference(buf1, buf2) {
    const targetWidth = 200;
    const targetHeight = 200;
    const img1 = await jimp_1.default.read(buf1);
    const img2 = await jimp_1.default.read(buf2);
    img1.resize(targetWidth, targetHeight).greyscale();
    img2.resize(targetWidth, targetHeight).greyscale();
    let diffSum = 0;
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const pixel1 = jimp_1.default.intToRGBA(img1.getPixelColor(x, y)).r;
            const pixel2 = jimp_1.default.intToRGBA(img2.getPixelColor(x, y)).r;
            diffSum += Math.abs(pixel1 - pixel2);
        }
    }
    const maxDiff = 255 * targetWidth * targetHeight;
    return diffSum / maxDiff;
}
/**
 * Convert a buffer into a canvas Image.  Used for face-api input.
 */
async function bufferToImage(buffer) {
    return (0, canvas_1.loadImage)(buffer);
}
/**
 * Verify a set of images using brightness, aspect ratio, liveness and
 * face matching checks.  Pass in the loaded faceapi namespace from
 * server.ts (after models are loaded).  Returns a result describing
 * the outcome of the verification.
 */
async function verifyImages(params) {
    const { frontBuffer, backBuffer, selfieBuffer, livenessBuffer, faceapi } = params;
    // 1. Brightness
    const brightnessValues = await Promise.all([
        computeBrightness(frontBuffer),
        computeBrightness(backBuffer),
        computeBrightness(selfieBuffer),
        computeBrightness(livenessBuffer),
    ]);
    const minBrightness = Math.min(...brightnessValues);
    if (minBrightness < BRIGHTNESS_THRESHOLD) {
        return { status: 'not_enough_light', details: { brightness: brightnessValues } };
    }
    // 2. Aspect ratio on front/back
    const ratioFront = await checkAspectRatio(frontBuffer);
    const ratioBack = await checkAspectRatio(backBuffer);
    if (!ratioFront || !ratioBack) {
        return { status: 'invalid_document', details: { ratioFront, ratioBack } };
    }
    // 3. Liveness
    const difference = await computeImageDifference(selfieBuffer, livenessBuffer);
    if (difference < LIVENESS_DIFF_THRESHOLD) {
        return { status: 'liveness_failed', details: { difference } };
    }
    // 4. Face matching (skip if models not available)
    try {
        const idImage = await bufferToImage(frontBuffer);
        const selfieImage = await bufferToImage(selfieBuffer);
        const idResult = await faceapi
            .detectSingleFace(idImage)
            .withFaceLandmarks()
            .withFaceDescriptor();
        const selfieResult = await faceapi
            .detectSingleFace(selfieImage)
            .withFaceLandmarks()
            .withFaceDescriptor();
        if (!idResult || !selfieResult || !idResult.descriptor || !selfieResult.descriptor) {
            return {
                status: 'face_not_found',
                details: { idFound: !!idResult, selfieFound: !!selfieResult },
            };
        }
        const distance = faceapi.euclideanDistance(idResult.descriptor, selfieResult.descriptor);
        if (distance > FACE_DISTANCE_THRESHOLD) {
            return { status: 'face_mismatch', details: { distance } };
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // If it's a model loading error, skip face detection
        if (message.includes('model') || message.includes('weights')) {
            console.warn('Face detection models not available, skipping face matching');
            return { status: 'verified', details: { faceDetectionSkipped: true } };
        }
        return { status: 'face_detection_error', error: message };
    }
    return { status: 'verified' };
}
