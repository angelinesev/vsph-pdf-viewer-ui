/** Inject visitor geo + IP into request headers for serverless analytics. */
export default async (request, context) => {
  const headers = new Headers(request.headers);
  const country = context.geo?.country?.code;

  if (country) {
    headers.set('x-vsph-country', country);
  }
  if (context.geo?.country?.name) {
    headers.set('x-vsph-country-name', context.geo.country.name);
  }
  if (context.geo?.city) {
    headers.set('x-vsph-city', context.geo.city);
  }
  if (context.ip) {
    headers.set('x-vsph-client-ip', context.ip);
  }

  return context.next(new Request(request, { headers }));
};

export const config = {
  path: '/*',
};
