"use client";

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, User, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useAlert } from "@/contexts/AlertContext";
import { validateImageFile } from "@/lib/uploadUtils";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => void;
  uploading?: boolean;
  className?: string;
}

export default function AvatarUpload({
  currentAvatarUrl,
  onUpload,
  onRemove,
  uploading = false,
  className = ""
}: AvatarUploadProps) {
  const { showError } = useAlert();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoTakenRef = useRef<boolean>(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear any previous validation errors
      setValidationError(null);
      
      // Validate file before upload
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid file');
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      // Clear any previous validation errors
      setValidationError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file - let parent handle success/error messages
      await onUpload(file);
    } catch (error) {
      console.error('Upload error:', error);
      // Only show error in component if it's a validation error
      // Let parent handle upload errors
      throw error;
    }
  };

  const startCamera = async () => {
    try {
      setValidationError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user'
        }
      });
      
      streamRef.current = stream;
      setShowCamera(true);
      
      // Wait for the next tick to ensure the video element is rendered
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
        }
      }, 100);
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      const errorMessage = 'Unable to access camera. Please check permissions or use file upload instead.';
      setValidationError(errorMessage);
      showError(errorMessage, 'Camera Access Failed');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setShowCamera(false);
    setCountdown(null);
    setIsCapturing(false);
    photoTakenRef.current = false;
  };

  const startCountdown = () => {
    if (isCapturing) return; // Prevent multiple countdowns
    
    // Check if video is ready before starting countdown
    if (videoRef.current && (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0)) {
      const errorMessage = 'Camera not ready. Please wait a moment and try again.';
      setValidationError(errorMessage);
      showError(errorMessage, 'Camera Not Ready');
      return;
    }
    
    setIsCapturing(true);
    photoTakenRef.current = false;
    setCountdown(3);
    
    // Use a simpler approach with setTimeout chain
    setTimeout(() => {
      setCountdown(2);
      setTimeout(() => {
        setCountdown(1);
        setTimeout(() => {
          setCountdown(0);
          setTimeout(() => {
            if (!photoTakenRef.current) {
              photoTakenRef.current = true;
              try {
                capturePhoto();
              } catch (error) {
                console.error('Error calling capturePhoto:', error);
                setIsCapturing(false);
                setCountdown(null);
                stopCamera();
              }
            }
          }, 300);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas and draw video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            // Create file with timestamp for uniqueness
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const file = new File([blob], `camera-capture-${timestamp}.jpg`, { type: 'image/jpeg' });
            
            // Validate the captured image
            const validation = validateImageFile(file);
            if (!validation.valid) {
              const errorMessage = validation.error || 'Invalid captured image';
              setValidationError(errorMessage);
              showError(errorMessage, 'Capture Failed');
              setIsCapturing(false);
              setCountdown(null);
              stopCamera();
              return;
            }
            
            try {
              await handleFileUpload(file);
              setIsCapturing(false);
              setCountdown(null);
              stopCamera();
            } catch (error) {
              console.error('Error uploading captured photo:', error);
              setIsCapturing(false);
              setCountdown(null);
              stopCamera();
            }
          } else {
            const errorMessage = 'Failed to capture photo. Please try again.';
            setValidationError(errorMessage);
            showError(errorMessage, 'Capture Failed');
            setIsCapturing(false);
            setCountdown(null);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      } else {
        const errorMessage = 'Canvas not available. Please try again.';
        setValidationError(errorMessage);
        showError(errorMessage, 'Capture Failed');
        setIsCapturing(false);
        setCountdown(null);
        stopCamera();
      }
    } else {
      const errorMessage = 'Camera not available. Please try again.';
      setValidationError(errorMessage);
      showError(errorMessage, 'Camera Error');
      setIsCapturing(false);
      setCountdown(null);
      stopCamera();
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAvatar = () => {
    // Clear both preview and current avatar
    setPreviewUrl(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Call the removal callback if provided
    if (onRemove) {
      onRemove();
    }
  };

  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Avatar Preview */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center border-2 border-slate-600">
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt="Avatar preview"
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-16 w-16 text-slate-400" />
            )}
          </div>
          
          {(previewUrl || currentAvatarUrl) && (
            <button
              onClick={previewUrl ? clearPreview : removeAvatar}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg"
              disabled={uploading}
              title={previewUrl ? "Remove preview" : "Remove avatar"}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="flex items-center justify-center space-x-2 p-3 bg-red-500/20 border border-red-500/50 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-300">{validationError}</span>
        </div>
      )}

      {/* File Requirements */}
      <div className="text-center">
        <p className="text-xs text-slate-400">
          Supported formats: JPEG, PNG, WebP, GIF • Max size: 5MB
        </p>
      </div>

      {/* Upload Buttons */}
      {!showCamera && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Photo</span>
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={startCamera}
            disabled={uploading}
            className="flex items-center space-x-2"
          >
            <Camera className="h-4 w-4" />
            <span>Take Photo</span>
          </Button>
        </div>
      )}

      {/* Camera Interface */}
      {showCamera && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative bg-slate-800 rounded-lg p-2">
              <video
                ref={videoRef}
                className="w-64 h-64 object-cover rounded-lg bg-slate-900"
                autoPlay
                muted
                playsInline
                onLoadedMetadata={() => {
                  console.log('Video metadata loaded');
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                  const errorMessage = 'Camera error. Please try again.';
                  setValidationError(errorMessage);
                  showError(errorMessage, 'Camera Error');
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-full"></div>
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="text-6xl font-bold text-white animate-pulse">
                      {countdown === 0 ? '📸' : countdown}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-3">
              {countdown !== null
                ? `Get ready! Taking photo in ${countdown}...`
                : 'Position your face within the circle and click capture'
              }
            </p>
          </div>
          
          <div className="flex justify-center space-x-2">
            <Button
              type="button"
              onClick={startCountdown}
              disabled={uploading || isCapturing}
              className={`transition-colors ${
                isCapturing
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isCapturing ? 'Taking Photo...' : 'Capture Photo'}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={stopCamera}
              disabled={uploading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Upload status */}
      {uploading && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-sm">Uploading...</span>
          </div>
        </div>
      )}
    </div>
  );
}