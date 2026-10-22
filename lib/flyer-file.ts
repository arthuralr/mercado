const flyerMimeTypesByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function getFlyerMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase('en-US') ?? '';
  return flyerMimeTypesByExtension[extension] ?? '';
}

export function isSupportedFlyerFile(file: File): boolean {
  const mimeType = getFlyerMimeType(file.name);
  return Boolean(mimeType) && (!file.type || file.type === mimeType);
}

export function isPdfFlyer(fileName: string, fileType = ''): boolean {
  return fileType === 'application/pdf' || getFlyerMimeType(fileName) === 'application/pdf';
}

export const MAX_FLYER_FILE_SIZE = 10 * 1024 * 1024;
