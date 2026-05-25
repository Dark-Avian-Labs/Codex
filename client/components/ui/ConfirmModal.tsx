import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      className="glass-modal-surface max-w-md p-5 shadow-2xl"
      ariaLabelledBy="confirm-delete-title"
    >
      <h2 id="confirm-delete-title">{title}</h2>
      <p className="text-muted text-sm">{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
