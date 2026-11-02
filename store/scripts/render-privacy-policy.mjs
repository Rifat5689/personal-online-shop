// Render the same policy used by React into the initial HTML for public crawlers.
import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PolicyDocument, policyTitle, policyDescription } from "../src/pages/store/PrivacyPolicy/policyDocument.js";

import { renderPage } from './seo.mjs';
const dist = new URL("../dist/", import.meta.url);
const escapeAttribute = value => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const content = renderToStaticMarkup(h("div", { className: "ob-store", "data-store-theme": "pink" },
  h("header", { className: "privacy-policy-static-brand" }, h("a", { href: "/" }, "Origins of Beauty")),
  h("main", null, h(PolicyDocument)),
  h("footer", { className: "privacy-policy-static-footer" }, "Origins of Beauty", h("a", { href: "/" }, "Shop"), h("a", { href: "/privacy-policy" }, "Privacy Policy")),
));
const origin = process.env.VITE_STOREFRONT_URL || 'https://originsofbeauty.web.app';
const html = renderPage(readFileSync(new URL('index.html', dist), 'utf8'), {
  title: policyTitle, description: policyDescription, image: new URL('/images/store-share.png', origin).href,
  url: new URL('/privacy-policy', origin).href,
}, content);
writeFileSync(new URL('privacy-policy.html', dist), html);
console.log('Rendered public Privacy Policy HTML with complete policy content.');
