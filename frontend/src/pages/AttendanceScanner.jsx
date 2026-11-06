import '../styles/attendance-scanner.css';
import React, { useEffect, useRef, useState } from 'react';
import { Camera, ScanFace, Check, X, UserRound, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { loadFaceModels, getDescriptor, findBestMatch } from '../face';
import { PageHead, Field } from '../components/common/UI';

const SCAN_INTERVAL_MS = 1200;
const NO_MATCH_MESSAGE = 'No enrolled student matched. Keep your face centered and try again.';

export default function Scanner() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const scanningRef = useRef(false);
  const scanBusyRef = useRef(false);
  const modalOpenRef = useRef(false);
  const matchRef = useRef(null);
  const timerRef = useRef(null);
  // Keep the latest enrolled templates available to the scan loop immediately.
  // React state updates are asynchronous, so the first scan must not use an empty
  // templates array captured before setTemplates() completes.
  const templatesRef = useRef([]);

  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Camera is off');
  const [templates, setTemplates] = useState([]);
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState('timeIn');
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    api('/events')
      .then(data => {
        if (!mountedRef.current) return;
        const items = data.items || [];
        setEvents(items);
        if (items[0]) setEventId(items[0]._id);
      })
      .catch(e => setError(e.message));

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    scanningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause?.();
      videoRef.current.srcObject = null;
    }

    if (mountedRef.current) setCameraOn(false);
  }

  function scheduleNextScan() {
    if (!scanningRef.current || !mountedRef.current || modalOpenRef.current) return;

    timerRef.current = setTimeout(() => {
      runAutomaticScan();
    }, SCAN_INTERVAL_MS);
  }

  async function runAutomaticScan() {
    if (
      !scanningRef.current ||
      !mountedRef.current ||
      scanBusyRef.current ||
      modalOpenRef.current
    ) return;

    if (!eventId) {
      setStatus('Select an event to begin automatic attendance scanning.');
      scheduleNextScan();
      return;
    }

    if (!videoRef.current || videoRef.current.readyState < 2) {
      setStatus('Preparing camera...');
      scheduleNextScan();
      return;
    }

    scanBusyRef.current = true;

    try {
      setStatus('Scanning automatically — position one face inside the frame.');

      const video = videoRef.current;
      const previewFrame = video?.parentElement;

      const descriptor = await getDescriptor(video, {
        frameOnly: true,
        // Match the crop to the actual visible preview (object-fit: cover)
        // and the oval overlay drawn inside this frame.
        frameElement: previewFrame
      });

      if (!scanningRef.current || !mountedRef.current) return;

      if (templatesRef.current.length === 0) {
        setStatus('Face detected, but no students are enrolled. Complete five-angle face enrollment first.');
        setError('');
        return;
      }

      const found = findBestMatch(descriptor, templatesRef.current);

      if (!found) {
        setStatus(NO_MATCH_MESSAGE);
        setError('');
        return;
      }

      // Pause scanning before showing the identity confirmation.
      scanningRef.current = false;
      modalOpenRef.current = true;
      matchRef.current = found;
      setMatch(found);
      setShowConfirmation(true);
      setStatus('Possible match found. Verify the student in person.');
      setError('');
    } catch (e) {
      if (scanningRef.current && mountedRef.current) {
        // A missing/unclear face is normal while the camera is waiting.
        setStatus(e.message || 'Looking for a clear face...');
      }
    } finally {
      scanBusyRef.current = false;
      if (scanningRef.current && !modalOpenRef.current) {
        scheduleNextScan();
      }
    }
  }

  async function start() {
    if (streamRef.current || scanningRef.current) return;

    setError('');
    setMatch(null);
    matchRef.current = null;
    setShowConfirmation(false);
    modalOpenRef.current = false;

    try {
      if (!eventId) {
        setError('Please select an event before starting the scanner.');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access requires localhost or HTTPS.');
      }

      setStatus('Loading face recognition models...');
      await loadFaceModels();

      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (!mountedRef.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = media;
      videoRef.current.srcObject = media;
      await videoRef.current.play();

      const response = await api('/students/face-templates');
      if (!mountedRef.current) return;

      const enrolledTemplates = Array.isArray(response.items)
        ? response.items
        : [];

      templatesRef.current = enrolledTemplates;
      setTemplates(enrolledTemplates);
      setCameraOn(true);
      scanningRef.current = true;
      setStatus(
        enrolledTemplates.length
          ? 'Camera ready. Automatic scanning is active.'
          : 'Camera ready, but no students have completed face enrollment yet.'
      );
      setError('');

      // No Scan Face button is needed: begin scanning as soon as camera is ready.
      runAutomaticScan();
    } catch (e) {
      stopCamera();
      setError(`Scanner could not start: ${e.message}. Check camera permission and model files.`);
      setStatus('Camera is off');
    }
  }

  async function confirm() {
    const candidate = matchRef.current;
    if (!candidate || !eventId || busy) return;

    setBusy(true);
    setError('');

    try {
      await api('/attendance/record', {
        method: 'POST',
        body: JSON.stringify({
          studentId: candidate.student._id,
          eventId,
          action,
          source: 'scanner'
        })
      });

      if (!mountedRef.current) return;

      setStatus(
        `${action === 'timeIn' ? 'Time-In' : 'Time-Out'} recorded for ` +
        `${candidate.student.firstName} ${candidate.student.lastName}. Looking for the next student...`
      );
      setShowConfirmation(false);
      modalOpenRef.current = false;
      matchRef.current = null;
      setMatch(null);
      setError('');

      // Resume automatic scanning after successful attendance recording.
      if (streamRef.current) {
        scanningRef.current = true;
        scheduleNextScan();
      }
    } catch (e) {
      setError(e.message);
      // Keep modal open so the admin can retry or reject.
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function rejectMatch() {
    setShowConfirmation(false);
    modalOpenRef.current = false;
    matchRef.current = null;
    setMatch(null);
    setError('');
    setStatus('Match rejected. No attendance was recorded. Scanning will resume.');

    // Resume scanning after rejecting the candidate.
    if (streamRef.current) {
      scanningRef.current = true;
      scheduleNextScan();
    }
  }

  return (
    <>
      <PageHead
        eyebrow="LIVE CHECK-IN"
        title="Attendance Scanner"
        desc="Automatically find enrolled students, verify their identity in person, then confirm attendance."
      />

      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <div className="panel-head">
            <div>
              <h2><Camera size={19} /> Camera scanner</h2>
              <p className="muted">Face matching is performed locally in this browser.</p>
            </div>
            <span className="pill green">Supervised mode</span>
          </div>

          <div className={`video-box attendance-video ${cameraOn ? 'camera-active' : ''}`}>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              style={{ display: cameraOn ? 'block' : 'none' }}
            />

            {!cameraOn && (
              <div className="video-placeholder">
                <ScanFace size={52} />
                <span>Camera preview will appear here</span>
              </div>
            )}

            {cameraOn && (
              <>
                <div className="attendance-face-oval" aria-hidden="true">
                  <span className="attendance-face-guide-top" />
                  <span className="attendance-face-guide-bottom" />
                </div>
                <div className="attendance-face-caption">
                  CENTER ONE FACE INSIDE THE FRAME
                </div>
                <div className="attendance-camera-instruction">
                  <div className="attendance-camera-arrow">
                    <ScanFace size={25} />
                  </div>
                  <div>
                    <strong>Look straight at the camera</strong>
                    <span>Automatic scanning is active. Keep one face visible inside the oval.</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="scanner-controls">
            {!cameraOn ? (
              <button type="button" className="btn primary" onClick={start} disabled={busy}>
                <Camera size={16} /> Start camera
              </button>
            ) : (
              <button type="button" className="btn ghost" onClick={() => {
                stopCamera();
                setMatch(null);
                matchRef.current = null;
                setShowConfirmation(false);
                modalOpenRef.current = false;
                setStatus('Camera stopped');
              }}>
                <X size={16} /> Stop camera
              </button>
            )}
          </div>

          <p className="muted status-line">
            {scanningRef.current && !showConfirmation && <Loader2 size={15} className="spin" />}
            {status}
          </p>
          {error && <div className="error">{error}</div>}
        </section>

        <section className="panel">
          <h2>Attendance action</h2>

          <Field label="Event">
            <select
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              disabled={cameraOn}
            >
              <option value="">Select event</option>
              {events.map(event => (
                <option key={event._id} value={event._id}>{event.title}</option>
              ))}
            </select>
          </Field>

          <div className="segmented">
            <button
              type="button"
              className={action === 'timeIn' ? 'selected' : ''}
              onClick={() => setAction('timeIn')}
              disabled={busy || showConfirmation}
            >
              Time-In
            </button>
            <button
              type="button"
              className={action === 'timeOut' ? 'selected' : ''}
              onClick={() => setAction('timeOut')}
              disabled={busy || showConfirmation}
            >
              Time-Out
            </button>
          </div>

          <div className="notice">
            Scanning starts automatically when the camera starts. A face match is only a
            candidate; the admin must verify the student's identity and physical presence
            before attendance is recorded.
          </div>
        </section>
      </div>

      {showConfirmation && match && (
        <div className="attendance-confirm-backdrop" role="presentation">
          <section
            className="attendance-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-confirm-title"
          >
            <div className="attendance-confirm-header">
              <div className="attendance-confirm-icon"><ShieldCheck size={23} /></div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Reject candidate and close confirmation"
                onClick={rejectMatch}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>

            <h2 id="attendance-confirm-title">Confirm student identity</h2>
            <p className="attendance-confirm-subtitle">
              A possible face match was found. Check the student's details and verify
              that this is the person physically in front of you.
            </p>

            <div className="attendance-student-identity">
              <div className="attendance-student-avatar"><UserRound size={34} /></div>
              <div>
                <strong>{match.student.firstName} {match.student.lastName}</strong>
                <span>Student No. {match.student.studentNumber}</span>
                {match.student.course && <span>{match.student.course}</span>}
                {match.student.yearLevel && <span>{match.student.yearLevel}</span>}
              </div>
            </div>

            <div className="attendance-match-meta">
              <span>Face distance score</span>
              <strong>{match.distance.toFixed(3)}</strong>
            </div>

            <div className="attendance-confirm-warning">
              <AlertCircle size={17} />
              <span>Do not confirm based on the match score alone. Verify the student's identity in person.</span>
            </div>

            <div className="attendance-confirm-actions">
              <button type="button" className="btn ghost" onClick={rejectMatch} disabled={busy}>
                <X size={16} /> Not this student
              </button>
              <button type="button" className="btn primary" onClick={confirm} disabled={busy || !eventId}>
                <Check size={16} /> {busy ? 'Recording…' : `Confirm ${action === 'timeIn' ? 'Time-In' : 'Time-Out'}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
