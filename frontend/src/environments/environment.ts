function resolveApiUrl(): string {
  const hostname = globalThis.location.hostname;
  if (hostname.includes('devtunnels.ms')) {
    return 'https://' + hostname.replace('-4200.', '-3000.');
  }
  return 'http://localhost:3000';
}

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(),
};
