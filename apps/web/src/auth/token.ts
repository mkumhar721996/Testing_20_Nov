/**
 * The one seam the Cognito sign-in story replaces: until then nobody is signed in,
 * so the API answers 401 and the screens show their error state.
 */
export function getAccessToken(): string | null {
  return null
}
