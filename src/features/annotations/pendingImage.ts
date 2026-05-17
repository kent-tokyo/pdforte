let _dataUrl: string | null = null;

export function setPendingImageData(dataUrl: string) { _dataUrl = dataUrl; }
export function getPendingImageData() { return _dataUrl; }
export function clearPendingImageData() { _dataUrl = null; }
