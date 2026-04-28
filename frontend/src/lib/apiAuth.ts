let apiToken =
  document.querySelector<HTMLMetaElement>('meta[name="twwe-api-token"]')?.content || '';

let tokenPromise: Promise<string> | null = null;
const originalFetch = window.fetch.bind(window);

const isApiUrl = (input: RequestInfo | URL) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  return url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
};

const getApiToken = async () => {
  if (apiToken) return apiToken;
  if (!tokenPromise) {
    tokenPromise = originalFetch('/api/session')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        apiToken = data?.token || '';
        return apiToken;
      })
      .catch(() => '');
  }
  return tokenPromise;
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!isApiUrl(input)) {
    return originalFetch(input, init);
  }

  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  if (url.endsWith('/api/session')) {
    return originalFetch(input, init);
  }

  const token = await getApiToken();
  if (!token) {
    return originalFetch(input, init);
  }

  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('X-TWWE-Token', token);

  return originalFetch(input, {
    ...init,
    headers,
  });
};
