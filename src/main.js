import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/libre-caslon-display/400.css";
const path = location.pathname.replace(import.meta.env.BASE_URL, "/");
if (path.startsWith("/dev/animations") || path.startsWith("/lab")) import("./lab/app.js");
else if (path.startsWith("/gallery")) import("./gallery.js");
else import("./game/app.js");
