export const COOLDOWN_SECONDS = 60;

/** Turns Supabase's raw auth errors into something a player can act on. */
export function explainAuthError(message: string): { text: string; wait?: number } {
  // Per-address cooldown: "...you can only request this after 52 seconds."
  const secs = message.match(/after (\d+) seconds?/i);
  if (secs) return { text: `Please wait ${secs[1]} seconds before asking for another link.`, wait: Number(secs[1]) };
  if (/rate limit|too many/i.test(message)) {
    return {
      text: 'Too many sign-in emails right now. Try Google, or wait a bit and try again.',
      wait: COOLDOWN_SECONDS,
    };
  }
  return { text: message };
}
