/**
 * components/ui/ConfirmDialog.jsx
 * Reusable confirmation dialog for destructive actions.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{message}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={isLoading}>
                {cancelLabel}
              </Button>
              <Button variant="danger" size="sm" onClick={onConfirm} disabled={isLoading}>
                {isLoading ? 'Processing...' : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
