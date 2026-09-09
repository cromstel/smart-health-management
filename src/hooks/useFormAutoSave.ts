import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export function useFormAutoSave<T extends Record<string, any>>(
  storageKey: string,
  initialData: T,
  isOpen: boolean,
  onRestore?: (restoredData: T) => void
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
      const savedRaw = localStorage.getItem(`autosave_draft_${storageKey}`);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          if (parsed && parsed.data && parsed.timestamp) {
            // Check if draft is less than 24 hours old
            const isFresh = Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000;
            if (isFresh && Object.keys(parsed.data).length > 0) {
              setFormData(parsed.data);
              setDraftSavedAt(parsed.savedAt || new Date(parsed.timestamp).toLocaleTimeString());
              setHasRestoredDraft(true);
              if (onRestore) {
                onRestore(parsed.data);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse autosave draft', e);
        }
      }
    } else {
      setHasRestoredDraft(false);
    }
  }, [isOpen, storageKey, onRestore]);

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
      const payload = {
        data: formData,
        timestamp: Date.now(),
        savedAt: savedAtStr,
      };
      localStorage.setItem(`autosave_draft_${storageKey}`, JSON.stringify(payload));
      setDraftSavedAt(savedAtStr);
      setIsAutoSaving(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, isOpen, storageKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`autosave_draft_${storageKey}`);
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
  }, [storageKey]);

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
