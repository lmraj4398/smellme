// NODE_ENV drifts between 'production' and 'prod' across env files and deploy
// docs. Anything starting with "prod" counts as production so exact-match
// checks (secure cookies, CORS, Swagger, log level) can't silently take the
// non-production branch.
export function isProductionEnv(nodeEnv: string | undefined): boolean {
  return (nodeEnv ?? '').trim().toLowerCase().startsWith('prod');
}
