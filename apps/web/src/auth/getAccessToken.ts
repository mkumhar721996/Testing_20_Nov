// Seam for the signed-in user's access token. Sign-in (Identity Provider) is delivered
// separately; until then this reads a token placed in session storage, or none.
export function getAccessToken(): string | null {
  return sessionStorage.getItem('access_token')
}
