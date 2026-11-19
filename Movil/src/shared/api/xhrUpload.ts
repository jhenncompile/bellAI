/**
 * Envío de FormData con archivos locales (`{ uri, name, type }`).
 *
 * En Expo SDK 58 el `fetch` global es la implementación WinterCG de Expo, que solo acepta
 * `Blob`/`File` en FormData y lanza «Unsupported FormDataPart implementation» con las partes
 * `{ uri }` de React Native. `XMLHttpRequest` usa la red nativa de React Native, que sí lee el
 * archivo desde la URI, así que las subidas de fotos pasan por aquí.
 */
export interface XhrResponse {
  status: number;
  text: string;
}

export class XhrNetworkError extends Error {
  timedOut: boolean;
  constructor(message: string, timedOut = false) {
    super(message);
    this.name = timedOut ? 'AbortError' : 'XhrNetworkError';
    this.timedOut = timedOut;
  }
}

export function sendFormData(
  method: 'POST' | 'PUT' | 'PATCH',
  url: string,
  form: FormData,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<XhrResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) {
      // El boundary del multipart lo pone la capa nativa
      if (k.toLowerCase() !== 'content-type') xhr.setRequestHeader(k, v);
    }
    xhr.timeout = timeoutMs;
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText ?? '' });
    xhr.onerror = () => reject(new XhrNetworkError('Fallo de red al subir el archivo'));
    xhr.ontimeout = () => reject(new XhrNetworkError('Tiempo de espera agotado', true));
    xhr.send(form);
  });
}
