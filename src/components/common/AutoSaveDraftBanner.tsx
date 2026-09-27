import React from 'react';
import { Save, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AutoSaveDraftBannerProps {
  hasRestoredDraft: boolean;
  draftSavedAt: string | null;
  isAutoSaving: boolean;
  onDiscard: () => void;
}

export const AutoSaveDraftBanner: React.FC<AutoSaveDraftBannerProps> = ({
  hasRestoredDraft,
  draftSavedAt,
  isAutoSaving,
  onDiscard,
}) => {
  if (!hasRestoredDraft && !draftSavedAt) return null;

  return (
    <div className="bg-warning/10 border border-warning/30 dark:border-warning/80 rounded-lg p-2.5 mb-4 flex items-center justify-between text-xs text-warning dark:text-amber-200">
      <div className="flex items-center gap-2 min-w-0">
        {isAutoSaving ? (
          <RefreshCw className="h-3.5 w-3.5 text-warning dark:text-warning animate-spin shrink-0" />
        ) : (
          <Save className="h-3.5 w-3.5 text-warning dark:text-warning shrink-0" />
        )}
        <div className="truncate">
          {hasRestoredDraft ? (
            <span className="font-semibold">Draft Restored: </span>
          ) : (
            <span className="font-semibold">Auto-Saving: </span>
          )}
          <span className="opacity-90">
            {isAutoSaving
              ? 'Saving changes to local storage...'
              : `Saved locally to localStorage (${draftSavedAt})`}
          </span>
        </div>
      </div>

      {hasRestoredDraft && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="h-7 text-xs text-warning dark:text-amber-300 hover:bg-warning/20 px-2 gap-1 shrink-0 ml-2"
        >
          <Trash2 className="h-3 w-3" />
          Discard Draft
        </Button>
      )}
    </div>
  );
};
