/** Where the app finds ScholarTasks. The publishable key is public by design (row security protects the data). */
export const SITE_URL = "https://scholartasks.com";
export const SITE_HOSTS = ["scholartasks.vercel.app", "scholartasks.com", "www.scholartasks.com"];
export const SUPABASE_URL = "https://ojexaihieabvngtwghzq.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Q48hgg2yop7zpsRR9uDlig_JOJK6VkJ";
/** The key the website's sign-in library keeps its session under in the browser. */
export const WEB_SESSION_KEY = "sb-ojexaihieabvngtwghzq-auth-token";
/** Ask for Face ID again after the app has been in the background this long. */
export const RELOCK_AFTER_MS = 5 * 60 * 1000;
