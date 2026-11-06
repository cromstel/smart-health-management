import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export function useFormAutoSave<T extends Record<string, any>>(
  storageKey: string,
  initialData: T,
  isOpen: boolean
) {
  const [formData, setFormData] = useState<T>(initialData);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Keep a ref of initialData to avoid infinite effect triggers
  const initialDataRef = useRef(initialData);
  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  // Check for existing draft when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Session-scoped draft only (server persistence disabled per audit).
      setHasRestoredDraft(false);
      setDraftSavedAt(null);
    } else {
      setHasRestoredDraft(false);
    }
  }, [isOpen]);

  // Auto-save form data on change (debounced 500ms)
  useEffect(() => {
    if (!isOpen) return;

    // Check if formData is different from initialData (using normalized key sorting)
    const normalize = (obj: any) =>
      obj && typeof obj === 'object' && !Array.isArray(obj)
        ? JSON.stringify(obj, Object.keys(obj).sort())
        : JSON.stringify(obj);
    const isDifferent = normalize(formData) !== normalize(initialDataRef.current);
    if (!isDifferent) return;

    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      const savedAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      // Draft persistence disabled per audit (session-scoped only); do not write to localStorage.
      setDraftSavedAt(savedAtStr);
      setIsAutoSaving(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, isOpen, storageKey]);

  // Clear draft (session-scoped; no localStorage removal per audit).
  const clearDraft = useCallback(() => {
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
  }, []);

  // Discard draft and reset form to initial values
  const discardDraft = useCallback(() => {
    clearDraft();
    setFormData(initialDataRef.current);
    toast.info('Draft discarded. Form reset to default values.');
  }, [clearDraft]);

  return {
    formData,
    setFormData,
    hasRestoredDraft,
    draftSavedAt,
    isAutoSaving,
    clearDraft,
    discardDraft,
  };
}
