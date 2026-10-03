const PUBLISHABLE_PREFIX = 'pk_test_';
const SECRET_PREFIX = 'sk_test_';

export function clerkFrontendApiOrigin(publishable: string): string {
  const encoded = publishable.startsWith(PUBLISHABLE_PREFIX)
    ? publishable.slice(PUBLISHABLE_PREFIX.length)
    : '';
  const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
  if (!host || /[^a-z0-9.-]/i.test(host)) {
    throw new Error('Clerk publishable key did not contain a frontend API host.');
  }
  return `https://${host}`;
}

export function isSignedInClerkConfigured(
  email: string,
  publishable: string,
  secret: string,
): boolean {
  return (
    email.length > 0 &&
    publishable.startsWith(PUBLISHABLE_PREFIX) &&
    publishable.length > PUBLISHABLE_PREFIX.length &&
    secret.startsWith(SECRET_PREFIX) &&
    secret.length > SECRET_PREFIX.length
  );
}
