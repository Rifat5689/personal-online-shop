// Public catalog only. Sessions, errors and mutations always retain no-store.
export function publicCatalogCache(req, res, next) {
  res.vary('Authorization');
  res.vary('Cookie');
  if (req.method !== 'GET' || req.get('authorization') || req.get('cookie')) return next();
  const json = res.json.bind(res);
  res.json = body => {
    if (res.statusCode === 200) res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    return json(body);
  };
  next();
}
