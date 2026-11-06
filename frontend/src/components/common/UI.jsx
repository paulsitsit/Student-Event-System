import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export const PageHead = ({ eyebrow, title, desc, action }) => (
  <div className="page-head">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{desc}</p>
    </div>
    {action}
  </div>
);

export function Modal({ title, onClose, children }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title = 'Please confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-modal-content">
        {danger && (
          <span className="confirm-modal-icon">
            <AlertTriangle size={22} />
          </span>
        )}
        <p className="muted confirm-modal-message">{message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn danger' : 'btn primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
