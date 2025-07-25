import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import './App.css';

// API endpoint; default to localhost:5001 but can be overridden via env var
const API_URL: string = process.env.REACT_APP_API_URL || 'http://localhost:5001/verify';

interface Country {
  id: string;
  name: string;
  flag: string;
}

interface DocumentType {
  id: string;
  name: string;
  sides: number;
  icon: string;
}

interface StepData {
  id: number;
  title: string;
  description: string;
  instruction: string;
  overlay: 'id' | 'face' | 'liveness' | null;
}

const COUNTRIES: Country[] = [
  { id: 'uganda', name: 'Uganda', flag: '🇺🇬' },
  { id: 'kenya', name: 'Kenya', flag: '🇰🇪' },
  { id: 'rwanda', name: 'Rwanda', flag: '🇷🇼' },
  { id: 'tanzania', name: 'Tanzania', flag: '🇹🇿' }
];

const DOCUMENT_TYPES: DocumentType[] = [
  { id: 'id', name: 'National ID', sides: 2, icon: '🆔' },
  { id: 'drivers_license', name: 'Driver\'s License', sides: 2, icon: '🚗' },
  { id: 'passport', name: 'Passport', sides: 1, icon: '📘' }
];

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [capturedImages, setCapturedImages] = useState<{ [key: string]: Blob | null }>({
    frontId: null,
    backId: null,
    selfie: null,
    liveness: null
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isHttps, setIsHttps] = useState<boolean>(false);
  const webcamRef = useRef<Webcam>(null);

  // Check if mobile and HTTPS on mount
  useEffect(() => {
    const checkEnvironment = () => {
      // Check if mobile
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
      
      // Check if HTTPS
      const https = window.location.protocol === 'https:';
      setIsHttps(https);
      
      console.log('Environment check:', { mobile, https, userAgent: navigator.userAgent });
    };
    
    checkEnvironment();
  }, []);

  // Check camera permissions when document is selected
  useEffect(() => {
    if (selectedDocument && !cameraPermission) {
      checkCameraPermission();
    }
  }, [selectedDocument, cameraPermission]);

  const checkCameraPermission = async () => {
    try {
      console.log('Checking camera permission...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported in this browser');
        return;
      }

      // Check if we're on HTTPS (required for camera on mobile)
      if (isMobile && !isHttps) {
        setCameraError('HTTPS is required for camera access on mobile devices. Please use https://localhost:3000');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log('Camera permission granted');
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission(true);
      setCameraError('');
    } catch (err: any) {
      console.error('Camera permission error:', err);
      setCameraPermission(false);
      
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setCameraError('Camera access is not supported in this browser.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const requestCameraPermission = async () => {
    try {
      await checkCameraPermission();
    } catch (err) {
      console.error('Failed to request camera permission:', err);
      setCameraError('Please enable camera access in your browser settings');
    }
  };

  const getSteps = (): StepData[] => {
    if (!selectedDocument) return [];
    
    const steps: StepData[] = [];
    
    // Add document capture steps
    if (selectedDocument.sides === 2) {
      steps.push({
        id: 0,
        title: `${selectedDocument.name} Front`,
        description: `Position your ${selectedDocument.name.toLowerCase()} within the frame`,
        instruction: `Place your ${selectedDocument.name.toLowerCase()} front side down, ensuring all edges are visible within the blue border`,
        overlay: 'id'
      });
      steps.push({
        id: 1,
        title: `${selectedDocument.name} Back`,
        description: `Now capture the back of your ${selectedDocument.name.toLowerCase()}`,
        instruction: `Flip your ${selectedDocument.name.toLowerCase()} and position it within the frame, keeping all edges visible`,
        overlay: 'id'
      });
    } else {
      steps.push({
        id: 0,
        title: `${selectedDocument.name}`,
        description: `Position your ${selectedDocument.name.toLowerCase()} within the frame`,
        instruction: `Place your ${selectedDocument.name.toLowerCase()} ensuring all edges are visible within the blue border`,
        overlay: 'id'
      });
    }
    
    // Add selfie and liveness steps
    steps.push({
      id: steps.length,
      title: 'Selfie',
      description: 'Take a clear photo of your face',
      instruction: 'Position your face within the oval frame, ensuring good lighting and a neutral expression',
      overlay: 'face'
    });
    
    steps.push({
      id: steps.length,
      title: 'Liveness Check',
      description: 'Prove you\'re a real person',
      instruction: 'Blink naturally or turn your head slightly, then capture the photo',
      overlay: 'liveness'
    });
    
    return steps;
  };

  const STEPS = getSteps();

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    const webcam = webcamRef.current;
    if (!webcam) return null;
    const imageSrc = webcam.getScreenshot();
    if (!imageSrc) return null;
    const res = await fetch(imageSrc);
    const blob = await res.blob();
    return blob;
  }, []);

  const handleCapture = async () => {
    const photo = await capturePhoto();
    if (!photo) {
      setError('Failed to capture photo. Please try again.');
      return;
    }

    const imageKey = currentStep === 0 ? 'frontId' : 
                    currentStep === 1 ? 'backId' : 
                    currentStep === 2 ? 'selfie' : 'liveness';
    
    setCapturedImages(prev => ({
      ...prev,
      [imageKey]: photo
    }));

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      await submitVerification();
    }
  };

  const submitVerification = async () => {
    if (!capturedImages.frontId || !capturedImages.selfie || !capturedImages.liveness) {
      setError('Missing required images');
      return;
    }

    setIsProcessing(true);
    setError('');

    const formData = new FormData();
    formData.append('frontId', capturedImages.frontId);
    if (capturedImages.backId) {
      formData.append('backId', capturedImages.backId);
    }
    formData.append('selfie', capturedImages.selfie);
    formData.append('liveness', capturedImages.liveness);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
      
      // Redirect to success page after 3 seconds
      setTimeout(() => {
        const userId = Math.floor(Math.random() * 1000) + 100; // Generate random user ID
        window.location.href = `https://clic.world?data=success&userId=${userId}&country=${selectedCountry?.id}&document=${selectedDocument?.id}`;
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePhoto = () => {
    const imageKey = currentStep === 0 ? 'frontId' : 
                    currentStep === 1 ? 'backId' : 
                    currentStep === 2 ? 'selfie' : 'liveness';
    
    setCapturedImages(prev => ({
      ...prev,
      [imageKey]: null
    }));
  };

  const resetVerification = () => {
    setCurrentStep(0);
    setSelectedCountry(null);
    setSelectedDocument(null);
    setCapturedImages({
      frontId: null,
      backId: null,
      selfie: null,
      liveness: null
    });
    setResult(null);
    setError('');
  };

  const renderOverlay = () => {
    const step = STEPS[currentStep];
    if (!step.overlay) return null;

    if (step.overlay === 'id') {
      return (
        <div className="overlay id-overlay">
          <div className="id-frame">
            <div className="corner top-left"></div>
            <div className="corner top-right"></div>
            <div className="corner bottom-left"></div>
            <div className="corner bottom-right"></div>
          </div>
        </div>
      );
    }

    if (step.overlay === 'face' || step.overlay === 'liveness') {
      return (
        <div className="overlay face-overlay">
          <div className="face-frame">
            <div className="face-oval"></div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderWelcome = () => (
    <div className="welcome-container">
      <div className="welcome-header">
        <h1>Welcome to Bava Verify</h1>
        <p>Select your country to get started</p>
      </div>
      
      <div className="country-grid">
        {COUNTRIES.map(country => (
          <button
            key={country.id}
            className="country-card"
            onClick={() => setSelectedCountry(country)}
          >
            <span className="country-flag">{country.flag}</span>
            <span className="country-name">{country.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderDocumentSelection = () => (
    <div className="document-selection-container">
      <div className="selection-header">
        <button className="back-button" onClick={() => setSelectedCountry(null)}>
          ← Back
        </button>
        <h2>Choose Document Type</h2>
        <p>Select the type of document you want to verify</p>
      </div>
      
      <div className="document-grid">
        {DOCUMENT_TYPES.map(doc => (
          <button
            key={doc.id}
            className="document-card"
            onClick={() => setSelectedDocument(doc)}
          >
            <span className="document-icon">{doc.icon}</span>
            <span className="document-name">{doc.name}</span>
            <span className="document-sides">{doc.sides} side{doc.sides > 1 ? 's' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderCameraPermission = () => (
    <div className="permission-container">
      <div className="permission-header">
        <h2>Camera Permission Required</h2>
        <p>Bava Verify needs access to your camera to capture your documents and photos</p>
      </div>
      
      <div className="permission-content">
        <div className="camera-icon">📷</div>
        
        {isMobile && !isHttps && (
          <div className="https-warning">
            <p className="warning-text">⚠️ HTTPS Required</p>
            <p>Camera access requires HTTPS on mobile devices. Please use:</p>
            <code className="https-url">https://localhost:3000</code>
          </div>
        )}
        
        <p className="permission-text">
          {cameraError || 'Please allow camera access to continue'}
        </p>
        
        <div className="permission-actions">
          <button className="btn btn-primary" onClick={requestCameraPermission}>
            Enable Camera Access
          </button>
          
          {isMobile && !isHttps && (
            <button 
              className="btn btn-secondary" 
              onClick={() => window.location.href = 'https://localhost:3000'}
            >
              Switch to HTTPS
            </button>
          )}
        </div>
        
        <div className="permission-tips">
          <h4>Tips for camera access:</h4>
          <ul>
            <li>Make sure you're using HTTPS (https://localhost:3000)</li>
            <li>Allow camera permissions when prompted</li>
            <li>If denied, check browser settings and try again</li>
            <li>Ensure no other apps are using the camera</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    const step = STEPS[currentStep];
    const hasCapturedImage = capturedImages[step.id === 0 ? 'frontId' : 
                                          step.id === 1 ? 'backId' : 
                                          step.id === 2 ? 'selfie' : 'liveness'];

    return (
      <div className="step-content">
        <div className="step-header">
          <div className="step-indicator">
            <span className="step-number">{currentStep + 1}</span>
            <span className="step-total">/ {STEPS.length}</span>
          </div>
          <h2 className="step-title">{step.title}</h2>
          <p className="step-description">{step.description}</p>
        </div>

        <div className="camera-container">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ 
              facingMode: step.overlay === 'face' || step.overlay === 'liveness' ? 'user' : 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }}
            className="camera-feed"
            onUserMedia={() => console.log('Camera started successfully')}
            onUserMediaError={(err) => {
              console.error('Camera error:', err);
              const errorMessage = typeof err === 'string' ? err : err.message || err.name || 'Unknown error';
              setCameraError(`Camera error: ${errorMessage}`);
            }}
          />
          {renderOverlay()}
        </div>

        <div className="instruction-panel">
          <p className="instruction-text">{step.instruction}</p>
        </div>

        <div className="action-buttons">
          {hasCapturedImage ? (
            <>
              <button className="btn btn-secondary" onClick={retakePhoto}>
                Retake Photo
              </button>
              <button className="btn btn-primary" onClick={handleCapture}>
                {currentStep === STEPS.length - 1 ? 'Submit Verification' : 'Continue'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleCapture}>
              Capture Photo
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="success-container">
      <div className="success-content">
        <div className="success-icon">✅</div>
        <h2>Verification Successful!</h2>
        <p>Your identity has been verified successfully.</p>
        <p className="redirect-text">Redirecting to Bava...</p>
        <div className="spinner"></div>
      </div>
    </div>
  );

  // Render different screens based on current state
  if (isProcessing) {
    return (
      <div className="app">
        <div className="processing-container">
          <div className="spinner"></div>
          <h2>Processing Verification...</h2>
          <p>Please wait while we verify your identity</p>
        </div>
      </div>
    );
  }

  if (result && result.status === 'verified') {
    return (
      <div className="app">
        {renderSuccess()}
      </div>
    );
  }

  if (!selectedCountry) {
    return (
      <div className="app">
        {renderWelcome()}
      </div>
    );
  }

  if (!selectedDocument) {
    return (
      <div className="app">
        {renderDocumentSelection()}
      </div>
    );
  }

  if (!cameraPermission) {
    return (
      <div className="app">
        {renderCameraPermission()}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-info">
          <span className="country-badge">{selectedCountry.flag} {selectedCountry.name}</span>
          <span className="document-badge">{selectedDocument.icon} {selectedDocument.name}</span>
        </div>
        <div className="progress-bar">
          {STEPS.map((_, index) => (
            <div 
              key={index} 
              className={`progress-step ${index <= currentStep ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {renderStepContent()}
    </div>
  );
};

export default App;