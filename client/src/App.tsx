import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import './App.css';

// API endpoint; default to localhost:5001 but can be overridden via env var
const API_URL: string = (window as any).REACT_APP_API_URL || 'http://localhost:5001/verify';

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
  const [showCountryDropdown, setShowCountryDropdown] = useState<boolean>(false);
  const [showDocumentDropdown, setShowDocumentDropdown] = useState<boolean>(false);
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
  const [autoCapture, setAutoCapture] = useState<boolean>(false);
  const [captureCountdown, setCaptureCountdown] = useState<number>(0);
  const [imageQuality, setImageQuality] = useState<number>(0);
  const [showReview, setShowReview] = useState<boolean>(false);
  const [capturedImageSrc, setCapturedImageSrc] = useState<string>('');
  const webcamRef = useRef<Webcam>(null);
  const autoCaptureInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      setCameraPermission(true);
      setCameraError('');
      console.log('Camera permission granted');
    } catch (err: any) {
      console.error('Camera permission error:', err);
      const errorMessage = typeof err === 'string' ? err : err.message || err.name || 'Unknown error';
      
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setCameraError('Camera is not supported on this device.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(`Camera error: ${errorMessage}`);
      }
    }
  };

  const requestCameraPermission = async () => {
    setCameraError('');
    await checkCameraPermission();
  };

  const getSteps = (): StepData[] => {
    if (!selectedDocument) return [];
    
    const steps: StepData[] = [];
    
    // Add document capture steps
    steps.push({
      id: 1,
      title: 'Front Side',
      description: 'Capture the front of your document',
      instruction: 'Position your document within the frame. Make sure all corners are visible and the text is clear.',
      overlay: 'id'
    });
    
    if (selectedDocument.sides === 2) {
      steps.push({
        id: 2,
        title: 'Back Side',
        description: 'Capture the back of your document',
        instruction: 'Flip your document and position it within the frame. Ensure all information is clearly visible.',
        overlay: 'id'
      });
    }
    
    // Add selfie step
    steps.push({
      id: steps.length + 1,
      title: 'Selfie',
      description: 'Take a clear photo of your face',
      instruction: 'Position your face within the oval. Look directly at the camera and ensure good lighting.',
      overlay: 'face'
    });
    
    // Add liveness step
    steps.push({
      id: steps.length + 1,
      title: 'Liveness Check',
      description: 'Blink your eyes to verify you\'re real',
      instruction: 'Look at the camera and blink naturally. This helps verify you\'re a real person.',
      overlay: 'liveness'
    });
    
    return steps;
  };

  // Auto-capture functionality
  const startAutoCapture = useCallback(() => {
    if (autoCaptureInterval.current) {
      clearInterval(autoCaptureInterval.current);
    }
    
    setAutoCapture(true);
    setCaptureCountdown(3);
    
    const countdown = setInterval(() => {
      setCaptureCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          handleCapture();
          setAutoCapture(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    autoCaptureInterval.current = countdown;
  }, []);

  const stopAutoCapture = useCallback(() => {
    if (autoCaptureInterval.current) {
      clearInterval(autoCaptureInterval.current);
      autoCaptureInterval.current = null;
    }
    setAutoCapture(false);
    setCaptureCountdown(0);
  }, []);

  // Image quality detection
  const analyzeImageQuality = useCallback((imageSrc: string): Promise<number> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(0);
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Calculate brightness
        let brightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        brightness = brightness / (data.length / 4);
        
        // Calculate contrast (simplified)
        let contrast = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pixelBrightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          contrast += Math.abs(pixelBrightness - brightness);
        }
        contrast = contrast / (data.length / 4);
        
        // Quality score (0-100)
        const quality = Math.min(100, Math.max(0, 
          (brightness / 255) * 40 + // Brightness component
          (contrast / 255) * 40 +   // Contrast component
          (img.width * img.height) / (1920 * 1080) * 20 // Resolution component
        ));
        
        resolve(quality);
      };
      img.src = imageSrc;
    });
  }, []);

  const handleCapture = async () => {
    if (!webcamRef.current) return;
    
    // Use higher quality settings
    const imageSrc = webcamRef.current.getScreenshot({
      width: 1920,
      height: 1080
    });
    if (!imageSrc) return;
    
    // Analyze image quality
    const quality = await analyzeImageQuality(imageSrc);
    setImageQuality(quality);
    
    // Store the image source for review
    setCapturedImageSrc(imageSrc);
    setShowReview(true);
    
    // Convert base64 to blob
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    
    const steps = getSteps();
    const currentStepData = steps[currentStep];
    
    if (!currentStepData) return;
    
    let imageKey = '';
    switch (currentStepData.overlay) {
      case 'id':
        imageKey = currentStepData.title.toLowerCase().includes('front') ? 'frontId' : 'backId';
        break;
      case 'face':
        imageKey = 'selfie';
        break;
      case 'liveness':
        imageKey = 'liveness';
        break;
    }
    
    setCapturedImages(prev => ({
      ...prev,
      [imageKey]: blob
    }));
  };

  const submitVerification = async () => {
    setIsProcessing(true);
    setError('');
    
    try {
      const formData = new FormData();
      
      // Add images to form data
      Object.entries(capturedImages).forEach(([key, blob]) => {
        if (blob) {
          formData.append(key, blob, `${key}.jpg`);
        }
      });
      
      // Add back ID if document has 2 sides
      if (selectedDocument?.sides === 2 && capturedImages.backId) {
        formData.append('backId', capturedImages.backId, 'backId.jpg');
      }
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setResult(result);
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        const userId = Math.random().toString(36).substr(2, 9);
        const redirectUrl = `https://clic.world?data=success&userId=${userId}&country=${selectedCountry?.id}&document=${selectedDocument?.id}`;
        window.location.href = redirectUrl;
      }, 3000);
      
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to submit verification');
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePhoto = () => {
    setShowReview(false);
    setCapturedImageSrc('');
    setImageQuality(0);
    
    const steps = getSteps();
    const currentStepData = steps[currentStep];
    
    if (!currentStepData) return;
    
    let imageKey = '';
    switch (currentStepData.overlay) {
      case 'id':
        imageKey = currentStepData.title.toLowerCase().includes('front') ? 'frontId' : 'backId';
        break;
      case 'face':
        imageKey = 'selfie';
        break;
      case 'liveness':
        imageKey = 'liveness';
        break;
    }
    
    setCapturedImages(prev => ({
      ...prev,
      [imageKey]: null
    }));
  };

  const confirmPhoto = () => {
    setShowReview(false);
    setCapturedImageSrc('');
    setImageQuality(0);
    
    const steps = getSteps();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitVerification();
    }
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
    setImageQuality(0);
    stopAutoCapture();
  };

  const renderOverlay = () => {
    const steps = getSteps();
    const currentStepData = steps[currentStep];
    
    if (!currentStepData || !currentStepData.overlay) return null;
    
    switch (currentStepData.overlay) {
      case 'id':
        return (
          <div className="overlay id-overlay">
            <div className="id-frame">
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>
              <div className="id-guide-text">Position document here</div>
            </div>
          </div>
        );
      case 'face':
      case 'liveness':
        return (
          <div className="overlay face-overlay">
            <div className="face-frame">
              <div className="face-oval">
                <div className="face-guide-text">Position face here</div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderWelcome = () => (
    <div className="welcome-container">
      <div className="welcome-header">
        <div className="logo">
          <div className="logo-icon">🔐</div>
          <h1>Bava Verify</h1>
        </div>
        <p>Complete your identity verification in just a few steps</p>
      </div>
      
      <div className="selection-form">
        <div className="form-group">
          <label className="form-label">Select Your Country</label>
          <div className="dropdown-container">
            <button 
              className="dropdown-button"
              onClick={() => {
                setShowCountryDropdown(!showCountryDropdown);
                setShowDocumentDropdown(false);
              }}
            >
              {selectedCountry ? (
                <span className="selected-option">
                  <span className="option-flag">{selectedCountry.flag}</span>
                  <span className="option-text">{selectedCountry.name}</span>
                </span>
              ) : (
                <span className="placeholder">Choose your country</span>
              )}
              <span className="dropdown-arrow">▼</span>
            </button>
            
            {showCountryDropdown && (
              <div className="dropdown-menu">
                {COUNTRIES.map(country => (
                  <button
                    key={country.id}
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedCountry(country);
                      setShowCountryDropdown(false);
                    }}
                  >
                    <span className="option-flag">{country.flag}</span>
                    <span className="option-text">{country.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Select Document Type</label>
          <div className="dropdown-container">
            <button 
              className="dropdown-button"
              onClick={() => {
                setShowDocumentDropdown(!showDocumentDropdown);
                setShowCountryDropdown(false);
              }}
            >
              {selectedDocument ? (
                <span className="selected-option">
                  <span className="option-icon">{selectedDocument.icon}</span>
                  <span className="option-text">{selectedDocument.name}</span>
                </span>
              ) : (
                <span className="placeholder">Choose document type</span>
              )}
              <span className="dropdown-arrow">▼</span>
            </button>
            
            {showDocumentDropdown && (
              <div className="dropdown-menu">
                {DOCUMENT_TYPES.map(doc => (
                  <button
                    key={doc.id}
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedDocument(doc);
                      setShowDocumentDropdown(false);
                    }}
                  >
                    <span className="option-icon">{doc.icon}</span>
                    <span className="option-text">{doc.name}</span>
                    <span className="option-sides">({doc.sides === 1 ? '1 side' : '2 sides'})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button 
          className="btn btn-primary btn-large"
          disabled={!selectedCountry || !selectedDocument}
          onClick={() => {
            if (selectedCountry && selectedDocument) {
              // Proceed to camera permission check
            }
          }}
        >
          Start Verification
        </button>
      </div>

      <div className="features">
        <div className="feature">
          <div className="feature-icon">📱</div>
          <div className="feature-text">Mobile Optimized</div>
        </div>
        <div className="feature">
          <div className="feature-icon">🔒</div>
          <div className="feature-text">Secure & Private</div>
        </div>
        <div className="feature">
          <div className="feature-icon">⚡</div>
          <div className="feature-text">Fast Process</div>
        </div>
      </div>
    </div>
  );

  const renderCameraPermission = () => (
    <div className="permission-container">
      <div className="permission-header">
        <h2>Camera Permission Required</h2>
        <p>We need access to your camera to capture your documents and photos</p>
      </div>
      <div className="permission-content">
        <div className="camera-icon">📷</div>
        <div className="permission-text">
          <p>This app uses your camera to:</p>
          <ul>
            <li>Capture document images</li>
            <li>Take a selfie for verification</li>
            <li>Perform liveness detection</li>
          </ul>
        </div>
        
        {isMobile && !isHttps && (
          <div className="https-warning">
            <div className="warning-text">
              ⚠️ <strong>HTTPS Required:</strong> Camera access requires HTTPS on mobile devices.
            </div>
            <div className="https-url">
              Please use: <code>https://localhost:3000</code>
            </div>
          </div>
        )}
        
        {cameraError && (
          <div className="error-message">
            {cameraError}
          </div>
        )}
        
        <div className="permission-actions">
          <button className="btn btn-primary" onClick={requestCameraPermission}>
            Allow Camera Access
          </button>
        </div>
        
        <div className="permission-tips">
          <h4>Tips for best results:</h4>
          <ul>
            <li>Ensure good lighting</li>
            <li>Hold your device steady</li>
            <li>Keep documents flat and well-lit</li>
            <li>Look directly at the camera for selfies</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderReviewScreen = () => {
    const steps = getSteps();
    const currentStepData = steps[currentStep];
    
    if (!currentStepData) return null;
    
    return (
      <div className="step-content">
        <div className="step-header">
          <div className="step-indicator">
            <span className="step-number">{currentStep + 1}</span>
            <span className="step-total">/ {steps.length}</span>
          </div>
          <h2 className="step-title">Review Photo</h2>
          <p className="step-description">Check if the photo is clear and complete</p>
        </div>
        
        <div className="review-container">
          <img 
            src={capturedImageSrc} 
            alt="Captured photo" 
            className="review-image"
          />
          
          {imageQuality > 0 && (
            <div className="quality-indicator review-quality">
              <div className="quality-bar">
                <div 
                  className="quality-fill" 
                  style={{ width: `${imageQuality}%` }}
                ></div>
              </div>
              <span className="quality-text">
                Quality: {Math.round(imageQuality)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="instruction-panel">
          <p className="instruction-text">
            {imageQuality > 70 ? 'Great quality! Photo looks good.' : 'Photo quality could be better. Consider retaking.'}
          </p>
          
          <div className="action-buttons">
            <button 
              className="btn btn-primary" 
              onClick={confirmPhoto}
              disabled={isProcessing}
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Submit'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={retakePhoto}
              disabled={isProcessing}
            >
              Retake
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    const steps = getSteps();
    const currentStepData = steps[currentStep];
    
    if (!currentStepData) return null;
    
    const hasImage = capturedImages[currentStepData.overlay === 'id' 
      ? (currentStepData.title.toLowerCase().includes('front') ? 'frontId' : 'backId')
      : currentStepData.overlay === 'face' ? 'selfie' : 'liveness'];
    
    return (
      <div className="step-content">
        <div className="step-header">
          <div className="step-indicator">
            <span className="step-number">{currentStep + 1}</span>
            <span className="step-total">/ {steps.length}</span>
          </div>
          <h2 className="step-title">{currentStepData.title}</h2>
          <p className="step-description">{currentStepData.description}</p>
        </div>
        
        <div className="camera-container">
          <Webcam
            ref={webcamRef}
            className="camera-feed"
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            videoConstraints={{
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }}
            onUserMedia={() => console.log('Camera started')}
            onUserMediaError={(err) => {
              console.error('Camera error:', err);
              setCameraError('Failed to start camera. Please check permissions.');
            }}
          />
          {renderOverlay()}
          
          {autoCapture && (
            <div className="auto-capture-overlay">
              <div className="countdown">{captureCountdown}</div>
            </div>
          )}
          
          {imageQuality > 0 && (
            <div className="quality-indicator">
              <div className="quality-bar">
                <div 
                  className="quality-fill" 
                  style={{ width: `${imageQuality}%` }}
                ></div>
              </div>
              <span className="quality-text">
                Quality: {Math.round(imageQuality)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="instruction-panel">
          <p className="instruction-text">{currentStepData.instruction}</p>
          
          <div className="action-buttons">
            <button 
              className="btn btn-primary" 
              onClick={handleCapture}
              disabled={isProcessing}
            >
              Capture Photo
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={startAutoCapture}
              disabled={isProcessing || autoCapture}
            >
              Auto Capture
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="success-container">
      <div className="success-content">
        <div className="success-icon">✅</div>
        <h2>Verification Complete!</h2>
        <p>Your identity verification has been submitted successfully.</p>
        <div className="redirect-text">
          Redirecting to clic.world in 3 seconds...
        </div>
      </div>
    </div>
  );

  // Main render logic
  if (result) {
    return renderSuccess();
  }

  if (!selectedCountry || !selectedDocument) {
    return renderWelcome();
  }

  if (!cameraPermission) {
    return renderCameraPermission();
  }

  if (isProcessing) {
    return (
      <div className="processing-container">
        <div className="spinner"></div>
        <h2>Processing Verification...</h2>
        <p>Please wait while we verify your documents and photos.</p>
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
          {getSteps().map((step, index) => (
            <div
              key={step.id}
              className={`progress-step ${index <= currentStep ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
      
      {showReview ? renderReviewScreen() : renderStepContent()}
      
      {error && (
        <div className="error-message">
          {error}
          <button className="btn btn-secondary" onClick={resetVerification}>
            Start Over
          </button>
        </div>
      )}
    </div>
  );
};

export default App;