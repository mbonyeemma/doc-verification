# ID Verification System

This repository contains a simple proof‑of‑concept ID verification system.  It is **not production ready** and is intended as a starting point for your own implementation.  The goal is to demonstrate how a front‑end application can guide a user through capturing the front and back of a national identity card, taking a selfie for face comparison, performing a very basic liveness check, and submitting the data to a back‑end API for validation.  The actual integration with government databases or other official data sources is left to you.

## Contents

```
id‑verification/
├── client/          # React front‑end application
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/          # Node/Express back‑end
│   ├── server.js
│   ├── utils/
│   │   └── verification.js
│   └── package.json
└── README.md        # this file
```

## Features

* **Multi‑step user interface (React)** – The front‑end guides users through the following steps:
  1. Upload or capture the **front** and **back** of their Ugandan ID card or driver’s licence.
  2. Take a **selfie** and then a second **liveness selfie** (e.g., blink) using the webcam.
  3. Submit all images to the server and display the verification result.

* **File upload API (Node/Express)** – The back‑end exposes an endpoint at `/verify` that accepts multipart form‑data containing the images.  It performs simple checks such as:
  - **Image brightness** – Warn the user if the pictures are too dark (`"not_enough_light"`).
  - **Aspect ratio and size** – Validate the approximate dimensions of an ID card.  This is a naive check and should be replaced with robust document recognition logic.
  - **Face matching** – Compare the face on the ID with the face in the selfie and liveness images.  This requires a face recognition library such as `@vladmandic/face-api` and `canvas`.  The implementation is provided in `utils/verification.js` but you must install the dependencies and supply the models.
  - **Liveness detection** – Compare the selfie and liveness images to detect motion (e.g., a blink).  Here we compute a simple pixel difference; in practice you should use dedicated liveness algorithms.

* **Responses** – The server returns a JSON object summarising the checks.  Possible `status` values include `"verified"`, `"not_enough_light"`, `"invalid_document"`, `"face_mismatch"`, and `"liveness_failed"`.

## Running the Application

Because this project depends on third‑party libraries, you need internet connectivity to download them via `npm`.  If your environment has restricted network access (as in some coding challenges), you will need to run the following commands in a local development environment with npm configured correctly.

### 1. Install dependencies

From the root of the project run:

```bash
cd server
npm install

cd ../client
npm install
```

The back‑end relies on the following key packages:

* `express` – web framework
* `multer` – multipart form‑data parsing
* `jimp` – basic image processing (brightness and size)
* `@vladmandic/face-api` and `canvas` – face detection and recognition (optional but recommended)

The front‑end uses:

* `react` and `react-dom` – UI framework
* `react-webcam` – access to the user’s webcam
* `face-api.js` – optional client‑side face detection; the back‑end performs the core matching.

### 2. Download face detection models

Face‑api requires pre‑trained models (`*.model.json` and binary weights) to run.  Download the following models from the official [face-api.js releases](https://github.com/justadudewhohacks/face-api.js/tree/master/weights) and place them in `server/models` and optionally `client/public/models`:

* `face_detection_model-weights_manifest.json` and associated weight files
* `face_landmark_68_model-weights_manifest.json` and weight files
* `face_recognition_model-weights_manifest.json` and weight files

The server code expects the models in `server/models` by default.

### 3. Start the server and client

In separate terminals:

```bash
# start the back‑end
cd server
node server.js

# start the front‑end
cd ../client
npm start
```

By default, the client runs on `http://localhost:3000` and the server listens on `http://localhost:5000`.  Modify the `REACT_APP_API_URL` environment variable in `client/src/App.js` if you want to point the client to a different server URL.

### 4. Usage

1. Open the React app in your browser.  You will be prompted to allow camera access.
2. Follow the steps to capture the front and back of your ID, take a selfie, then take a liveness selfie (blink).
3. Submit the images.  The server will respond with the verification result.

## Security and Privacy Considerations

This project processes highly sensitive personal data.  The following points must be addressed before deploying it:

* **Data storage** – The provided implementation does **not** persist any images or personal information; it reads the files into memory for processing and discards them.  In production, you may need to store images securely and comply with data protection regulations (e.g., GDPR).
* **Transport encryption** – Always serve the client and API over HTTPS to prevent interception of data in transit.
* **Authentication and authorisation** – Implement user authentication if appropriate for your use case.  This example does not include user management.
* **Privacy policy** – Clearly inform users how their data will be used, stored, and deleted.

## DISCLAIMER

This repository is provided for educational purposes only.  It implements a **naive** ID verification flow and does not constitute a secure or robust identity proofing solution.  You must conduct a thorough security review, comply with local regulations, and integrate with official data sources before using this system in a real‑world scenario.# Updated Fri Jul 25 10:58:45 EAT 2025
