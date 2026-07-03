// Email is stubbed for now — it logs the invite link to the server console.
// Swap this for Resend/Postmark later without changing any callers.
export async function sendInviteEmail(to: string, acceptUrl: string): Promise<void> {
  console.log(`\n📧 [email stub] Invitation for ${to}\n   Accept link: ${acceptUrl}\n`)
}
