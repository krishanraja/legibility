// Google Analytics 4 (gtag.js), alongside PostHog rather than instead of it.
//
// Defined once here because two different renderers emit a <head>: the React shell in
// __root.tsx, which serves every route, and the plain-string 500 page in error-page.ts, which
// serves the requests where React never got that far. The 500 page puts the tag first in
// <head>, as Google's install instructions specify. The React shell gets as close as React's
// head hoisting allows; __root.tsx explains where each part lands.

export const GA_MEASUREMENT_ID = "G-J5173WPD98";

export const GA_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

export const GA_INLINE = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${GA_MEASUREMENT_ID}');
`;

/** The tag as Google supplies it, for renderers that build HTML as a string. */
export const GA_TAG_HTML = `<!-- Google tag (gtag.js) -->
<script async src="${GA_SCRIPT_SRC}"></script>
<script>${GA_INLINE}</script>`;
