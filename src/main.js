import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/libre-caslon-display/400.css";
const path = location.pathname.replace(import.meta.env.BASE_URL, "/");
if (path.startsWith("/dev/animations") || path.startsWith("/lab")) {
 const params=new URLSearchParams(location.search);
 if(params.get('view')==='components'||params.has('scenario'))import('./lab/app.js');
 else import('./lab/routes.js');
}
else if (path.startsWith("/gallery")) import("./gallery.js");
else import("./game/app.js");
