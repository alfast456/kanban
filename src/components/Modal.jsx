import { useEffect, useRef } from 'react';
import { IconAlert } from './Icons';

export function Modal({ children, onClose, className = '' }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    previousFocus.current = document.activeElement;
    const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const first = dialog?.querySelector(focusable);
    first?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape') return onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const elements = [...dialog.querySelectorAll(focusable)].filter(element => !element.disabled);
      if (!elements.length) return;
      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`modal-content ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={event => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, text, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} className="confirm-modal">
      <div className="confirm-icon" aria-hidden="true">
        <IconAlert size={36} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="modal-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>Batal</button>
        <button type="button" className="delete-confirm-btn" onClick={onConfirm}>Ya, Hapus</button>
      </div>
    </Modal>
  );
}
