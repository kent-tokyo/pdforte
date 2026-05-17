import { useState, useCallback } from "react";

export function useDialogState(setOpen: (v: boolean) => void, onReset?: () => void) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setStatus(null);
    setBusy(false);
    onReset?.();
  }, [setOpen, onReset]);
  return { busy, setBusy, status, setStatus, close };
}
