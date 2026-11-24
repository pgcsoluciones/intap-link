/** The production account selector issues its host-only cookie on the API
 * host. The App origin remains the navigation destination. Preview keeps
 * its existing same-host session/selection contract.
 */
export function ownerApiOrigin(appOrigin: string): string {
  return appOrigin === 'https://app.intaprd.com'
    ? 'https://api.intaprd.com'
    : appOrigin
}
