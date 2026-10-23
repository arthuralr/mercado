export const DEFAULT_VAPID_PUBLIC_KEY =
  'BPlBuxt_eTlKP9YMr2wNo-7g2VNtbtKDtgVCUE7woK4sLqo5EWJjnc3SXwSy5IfRs58pEjKW7mtoB6Sm_qGZtMU';

export const DEFAULT_VAPID_PRIVATE_KEY =
  'jfaYAzkjv1dEazox64c9xsbHlMAWxRh1XdtBZLS7HNE';

export const DEFAULT_VAPID_SUBJECT = 'mailto:contato@dottasupermercados.com.br';

export function getPublicVapidKey(): string {
  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return envKey || DEFAULT_VAPID_PUBLIC_KEY;
}

export function getServerVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} {
  const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const envSubject = process.env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;

  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
      subject: envSubject,
    };
  }

  return {
    publicKey: DEFAULT_VAPID_PUBLIC_KEY,
    privateKey: DEFAULT_VAPID_PRIVATE_KEY,
    subject: envSubject,
  };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData =
    typeof window !== 'undefined'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
