import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ScanFace,
  Loader2,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  MoveHorizontal,
  MoveVertical
} from 'lucide-react';

import { api } from '../../services/api';
import { loadFaceModels, getFaceAnalysis } from '../../face';

const ANGLES = [
  {
    label: 'Front',
    instruction: 'Look straight at the camera.',
    detect: ({ yaw, pitch }) => Math.abs(yaw) < 0.14 && pitch >= 0.42 && pitch <= 0.68
  },
  {
    label: 'Left',
    instruction: 'Slowly turn your head to your left.',
    detect: ({ yaw }) => yaw < -0.18
  },
  {
    label: 'Right',
    instruction: 'Slowly turn your head to your right.',
    detect: ({ yaw }) => yaw > 0.18
  },
  {
    label: 'Up',
    instruction: 'Slowly tilt your chin upward.',
    detect: ({ pitch }) => pitch < 0.42
  },
  {
    label: 'Down',
    instruction: 'Slowly tilt your chin downward.',
    detect: ({ pitch }) => pitch > 0.68
  }
];

const STABLE_DURATION = 900;
const SCAN_INTERVAL = 250;

function getFrameFeedback(face) {
  if (face.centerX < 0.37) return 'Move your face slightly to the right.';
  if (face.centerX > 0.63) return 'Move your face slightly to the left.';
  if (face.centerY < 0.30) return 'Move your face slightly down.';
  if (face.centerY > 0.70) return 'Move your face slightly up.';
  if (face.widthRatio < 0.22) return 'Move closer to the camera.';
  if (face.widthRatio > 0.62) return 'Move farther from the camera.';
  if (face.confidence < 0.65) return 'Improve the lighting and keep your face clear.';
  return null;
}

function DirectionGuide({ step }) {
  const icons = [
    <ScanFace size={27} />,
    <ArrowLeft size={30} />,
    <ArrowRight size={30} />,
    <ArrowUp size={30} />,
    <ArrowDown size={30} />
  ];

  return (
    <div className="face-direction-guide" aria-label={`${ANGLES[step].label} direction`}>
      <div className="face-direction-icon">{icons[step]}</div>
      <div>
        <strong>{ANGLES[step].label} position</strong>
        <span>{ANGLES[step].instruction}</span>
      </div>
    </div>
  );
}

export default function FaceEnrollment({ student, onClose, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const stableSinceRef = useRef(null);
  const descriptorsRef = useRef([]);
  const stepRef = useRef(0);
  const savingRef = useRef(false);

  const [step, setStep] = useState(0);
  const [descriptors, setDescriptors] = useState([]);
  const [status, setStatus] = useState('Start the camera to begin automatic enrollment.');
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState('Fit your face inside the oval.');
  const [holding, setHolding] = useState(false);

  function stopCamera() {
    scanningRef.current = false;
    stableSinceRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setCameraOn(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function startCamera() {
    if (streamRef.current || scanningRef.current) return;

    setError('');
    setStatus('Loading face recognition models...');
    setFeedback('Preparing camera...');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access requires localhost or HTTPS.');
      }

      await loadFaceModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraOn(true);
      setStatus(ANGLES[0].instruction);
      setFeedback('Fit your face inside the oval.');
      scanningRef.current = true;
      scanLoop();
    } catch (e) {
      stopCamera();
      setError(`Unable to start camera: ${e.message}`);
      setStatus('Camera could not be started.');
    }
  }

  async function saveEnrollment(finalDescriptors) {
    if (savingRef.current) return;

    savingRef.current = true;
    scanningRef.current = false;
    setSaving(true);
    setStatus('Saving all five face angles...');
    setFeedback('Please wait while enrollment is saved.');

    try {
      await api(`/students/${student._id}/face`, {
        method: 'PUT',
        body: JSON.stringify({ descriptors: finalDescriptors })
      });

      if (!mountedRef.current) return;

      setFinished(true);
      setStatus('Face enrollment completed successfully!');
      setFeedback('All five angles were captured and saved.');
      stopCamera();
      onSaved?.();
    } catch (e) {
      savingRef.current = false;
      if (!mountedRef.current) return;
      setError(`Unable to save enrollment: ${e.message}`);
      setStatus('Enrollment could not be saved. Please try again.');
      setFeedback('Your captures are retained. Restart camera to retry.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function scanLoop() {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      while (scanningRef.current && mountedRef.current && !savingRef.current) {
        const video = videoRef.current;

        if (!video || video.readyState < 2 || !video.videoWidth) {
          await new Promise(resolve => setTimeout(resolve, SCAN_INTERVAL));
          continue;
        }

        try {
          const face = await getFaceAnalysis(video);
          if (!scanningRef.current || !mountedRef.current) break;

          const frameFeedback = getFrameFeedback(face);

          if (frameFeedback) {
            stableSinceRef.current = null;
            setHolding(false);
            setFeedback(frameFeedback);
            setStatus('Adjust your face to fit the guide.');
          } else {
            const currentAngle = ANGLES[stepRef.current];

            if (currentAngle.detect(face)) {
              if (stableSinceRef.current === null) {
                stableSinceRef.current = Date.now();
                setHolding(true);
                setFeedback('Perfect position. Hold still...');
                setStatus('Position detected. Hold still...');
              } else if (Date.now() - stableSinceRef.current >= STABLE_DURATION) {
                const captured = [...descriptorsRef.current];
                captured[stepRef.current] = face.descriptor;
                descriptorsRef.current = captured;
                setDescriptors(captured);
                stableSinceRef.current = null;
                setHolding(false);

                if (stepRef.current < ANGLES.length - 1) {
                  const next = stepRef.current + 1;
                  stepRef.current = next;
                  setStep(next);
                  setFeedback('Angle captured. Follow the new arrow.');
                  setStatus(`✓ ${currentAngle.label} captured. ${ANGLES[next].instruction}`);
                } else {
                  await saveEnrollment(captured);
                  break;
                }
              }
            } else {
              stableSinceRef.current = null;
              setHolding(false);
              setFeedback('Follow the arrow and adjust your head position.');
              setStatus(currentAngle.instruction);
            }
          }
        } catch (e) {
          stableSinceRef.current = null;
          setHolding(false);
          setFeedback(e.message);
          setStatus('Looking for a clear face...');
        }

        await new Promise(resolve => setTimeout(resolve, SCAN_INTERVAL));
      }
    } finally {
      busyRef.current = false;
    }
  }

  const capturedCount = descriptors.filter(Boolean).length;
  const progress = Math.round((capturedCount / ANGLES.length) * 100);

  return (
    <div className="enrollment">
      <p className="muted">
        Enrolling: <b>{student.firstName} {student.lastName}</b> · {student.studentNumber}
      </p>

      <div className="angle-progress">
        {ANGLES.map((angle, index) => (
          <div key={angle.label} className={descriptors[index] ? 'done' : index === step ? 'current' : ''}>
            <span>{descriptors[index] ? '✓' : index + 1}</span>
            <small>{angle.label}</small>
          </div>
        ))}
      </div>

      <div className={`video-box enrollment-video ${holding ? 'face-holding' : ''}`}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{ display: cameraOn ? 'block' : 'none' }}
        />

        {!cameraOn && (
          <div className="video-placeholder">
            <Camera size={42} />
            <span>Camera preview</span>
          </div>
        )}

        {cameraOn && (
          <>
            <div className="face-guide-oval">
              <span className="face-guide-top" />
              <span className="face-guide-bottom" />
            </div>
            <div className="face-guide-caption">FIT YOUR FACE INSIDE THE OVAL</div>
            <div className="face-camera-direction">
              <div className="face-camera-direction-icon">
                {step === 0 ? <ScanFace size={23} /> :
                 step === 1 ? <ArrowLeft size={25} /> :
                 step === 2 ? <ArrowRight size={25} /> :
                 step === 3 ? <ArrowUp size={25} /> :
                 <ArrowDown size={25} />}
              </div>
              <div>
                <strong>{ANGLES[step].label}</strong>
                <span>{ANGLES[step].instruction}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="face-feedback">
        <span className={holding ? 'feedback-dot ready' : 'feedback-dot'} />
        <span>{feedback}</span>
      </div>

      <div className="enrollment-progress">
        <div className="progress-heading">
          <strong>{finished ? 'Enrollment complete' : 'Automatic face scanning'}</strong>
          <span>{capturedCount}/5 · {progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="status-line">
        {saving ? <Loader2 size={17} className="spin" /> : finished ? <CheckCircle2 size={17} /> : <ScanFace size={17} />}
        <span>{status}</span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="scanner-controls">
        {!cameraOn && !finished && (
          <button type="button" className="btn primary" onClick={startCamera} disabled={saving}>
            <Camera size={16} /> Start automatic enrollment
          </button>
        )}

        {finished && (
          <button type="button" className="btn primary" onClick={onClose}>
            <CheckCircle2 size={16} /> Done
          </button>
        )}

        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            stopCamera();
            onClose?.();
          }}
        >
          <X size={16} /> Close
        </button>
      </div>
    </div>
  );
}
