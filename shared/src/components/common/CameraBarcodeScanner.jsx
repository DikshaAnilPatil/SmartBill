import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  CheckCircle2,
  ScanLine,
  AlertCircle,
  Volume2,
  VolumeX,
  Keyboard,
} from "lucide-react";
import { Btn, Modal } from "./ui";

// Beep audio synthesizer for instant POS scan sound
function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

export default function CameraBarcodeScanner({ isOpen, onClose, onScan, title = "Scan Product Barcode" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  const [facingMode, setFacingMode] = useState("environment"); // "environment" (rear) | "user" (front)
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
  }, []);

  // Handle successful scan
  const handleSuccessScan = useCallback((code) => {
    if (!code || isProcessing) return;
    setIsProcessing(true);
    setLastScannedCode(code);

    if (soundEnabled) {
      playBeepSound();
    }

    // Short visual pause so user sees green confirmation box
    setTimeout(() => {
      onScan(code);
      stopCamera();
      onClose();
    }, 450);
  }, [isProcessing, soundEnabled, onScan, stopCamera, onClose]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    setLastScannedCode("");
    setIsProcessing(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported on this browser/device.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities?.() || {};
        setTorchSupported(Boolean(capabilities.torch));
      }

      // Start Barcode Detection Loop
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new window.BarcodeDetector({
          formats: [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "code_128",
            "code_39",
            "code_93",
            "itf",
            "qr_code",
          ],
        });

        const detectFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(detectFrame);
            return;
          }

          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const detected = barcodes[0].rawValue;
              if (detected && detected.trim()) {
                handleSuccessScan(detected.trim());
                return;
              }
            }
          } catch (_) {}

          animFrameRef.current = requestAnimationFrame(detectFrame);
        };

        animFrameRef.current = requestAnimationFrame(detectFrame);
      }
    } catch (err) {
      console.warn("Camera init error:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied. Please allow camera access in your browser address bar."
          : err.message || "Could not start camera."
      );
    }
  }, [facingMode, handleSuccessScan, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn("Flashlight error:", err);
    }
  };

  // Switch between front & rear cameras
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Submit manual barcode entry
  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const clean = manualCode.trim();
    if (clean) {
      handleSuccessScan(clean);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={title}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      className="max-w-md"
    >
      <div className="space-y-3.5">
        {/* Viewfinder Container */}
        <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
          {cameraError ? (
            <div className="p-5 text-center text-rose-300 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-rose-400 mb-1" />
              <p className="text-xs font-semibold">{cameraError}</p>
              <p className="text-[11px] text-slate-400">
                You can still enter the barcode number manually below or use a USB barcode gun.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className={`w-4/5 h-3/5 border-2 rounded-xl transition-all relative ${
                  lastScannedCode
                    ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(52,211,153,0.5)]"
                    : "border-blue-400/80 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                }`}>
                  {/* Scanning Laser Line Animation */}
                  {!lastScannedCode && (
                    <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-bounce top-1/2 -translate-y-1/2" />
                  )}

                  {/* Corner Reticle Markers */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 rounded-br-sm" />
                </div>
              </div>

              {/* Live Overlay Notification on Match */}
              {lastScannedCode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-600/95 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Scanned: {lastScannedCode}</span>
                </div>
              )}

              {/* Camera Controls Overlay */}
              <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-2">
                {torchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                      torchOn ? "bg-amber-500 text-white shadow-lg" : "bg-black/50 text-white hover:bg-black/70"
                    }`}
                    title={torchOn ? "Turn off Flashlight" : "Turn on Flashlight"}
                  >
                    {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-all cursor-pointer"
                  title="Switch Camera (Front/Rear)"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                    soundEnabled ? "bg-black/50 text-white hover:bg-black/70" : "bg-rose-500 text-white"
                  }`}
                  title={soundEnabled ? "Mute Beep Sound" : "Enable Beep Sound"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Manual Barcode Fallback Input */}
        <form onSubmit={handleManualSubmit} className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5 text-blue-500" />
            <span>Or Enter / Gun Scan Barcode Number:</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. 8901234567890"
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Use Code
            </button>
          </div>
        </form>

        <p className="text-[10px] text-center text-slate-400">
          Hold product barcode or QR code steady inside the box. It will automatically detect and beep!
        </p>
      </div>
    </Modal>
  );
}
