/** Where the picked color theme is saved on this device. */
export const THEME_KEY = "st-theme";

/** Runs before the page paints (in the layout head) so the saved colors show without a flash. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="sunrise"||t==="garden")document.documentElement.dataset.theme=t}catch(e){}`;
