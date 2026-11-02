import React from "react";
const h = React.createElement;
export const policyTitle = "Privacy Policy | Origins of Beauty";
export const policyDescription = "Learn how Origins of Beauty handles customer information, orders, website analytics and WhatsApp messages, and how to request access or deletion.";
export const privacyEmail = "originsofbeauty9@gmail.com";
export const policySections = [
  { id: "information", title: "Information we collect", paragraphs: [
    "When you create an account, we collect your username and password. Passwords are stored as hashes. We also record account identifiers, browser identifiers and account activity timestamps.",
    "When you place an order, we collect the recipient’s name, phone number, delivery address, selected products, quantities, order value, delivery charges and order and payment status. Checkout currently uses cash on delivery; the website does not ask for card details.",
    "If you submit a product review, we store its text, rating, display name and any images you choose to upload. Published reviews and their images can be visible to other visitors. If you contact us by email, we receive the email address and information you include in your message.",
  ] },
  { id: "whatsapp", title: "Phone numbers and WhatsApp messages", paragraphs: [
    "When you message our business on WhatsApp, we receive your WhatsApp phone number, profile name when provided, message text, message identifiers and timestamps. We store customer conversations and staff replies, together with delivery or read status and message errors, in our business database. For incoming non-text messages, the current inbox records the message type rather than downloading the media content.",
    "We use the official WhatsApp Cloud API provided by Meta to receive messages and send replies through our admin panel. Meta and WhatsApp process the information needed to operate that service. Free-form replies are limited to the customer service window supported by WhatsApp.",
    "If an administrator enables AI replies for a conversation, we send a limited recent text history and the administrator’s business and communication instructions to Google’s Gemini API to draft a response. That response may be sent automatically through WhatsApp. AI is off by default, can be disabled by staff, and is not a human representative. Staff can take over a conversation. AI responses can be inaccurate; ask our team to confirm important product or order information.",
    "Authorized staff can read and respond to messages in our inbox. Please avoid sending passwords, payment card details or other sensitive information in a chat.",
  ], links: [{ label: "WhatsApp Privacy Policy", href: "https://www.whatsapp.com/legal/privacy-policy" }, { label: "WhatsApp Business Data Processing Terms", href: "https://www.whatsapp.com/legal/business-data-processing-terms" }] },
  { id: "use", title: "How we use customer information", paragraphs: [
    "We use customer information to maintain accounts, process and manage orders, arrange delivery, handle returns and refunds, respond to questions, and provide customer support. We also use order records and website activity to understand store performance, troubleshoot problems and protect the service against misuse.",
    "We do not use customer information for marketing campaigns or sell or share it for advertising outside this website.",
  ] },
  { id: "browser-storage", title: "Browser storage and website analytics", paragraphs: [
    "The website uses local storage, session storage and authentication cookies where applicable to support shopping and sign-in. Stored information can include cart contents, saved product preferences, customer session information and order-tracking details.",
    "Our own analytics record page categories, product interactions, cart and checkout activity, search events, engagement time, referral hostname, device category and session or visitor identifiers. Analytics session identifiers can also be associated with orders. Live visitor information helps us understand which areas of the shop are being used. These identifiers are not a guarantee that activity is anonymous.",
    "You can clear or restrict browser storage through your browser settings. Doing so may remove saved cart or session information and affect sign-in or other features. Hosting and infrastructure providers may also process technical request data, such as IP addresses, to deliver and secure the service.",
  ] },
  { id: "providers", title: "Third-party service providers", paragraphs: [
    "The website uses Google Firebase Hosting for the storefront, Microsoft Azure for backend hosting and image storage, MongoDB for database storage, and Meta/WhatsApp for business messaging. Google’s Gemini API processes text provided to optional AI reply and preview features when those features are used. Information is processed by the relevant provider as needed to operate those services. Email enquiries are handled through our published Gmail address.",
    "Service providers may process information in countries other than your own. Their handling of information is also subject to their applicable terms and privacy policies. Following a link to another website or using WhatsApp brings you within that service’s own privacy practices.",
    "We do not currently share customer order details with delivery couriers.",
  ], links: [{ label: "Google Privacy Policy", href: "https://policies.google.com/privacy" }, { label: "Gemini API Additional Terms", href: "https://ai.google.dev/gemini-api/terms" }] },
  { id: "security", title: "Data storage and security", paragraphs: [
    "Customer accounts, orders, analytics and WhatsApp records are stored in our database. Uploaded review images are stored through our image storage service. The deployed website uses HTTPS. Admin functions require authentication and store access checks; WhatsApp webhook events are checked against Meta’s signature before being processed. Meta API credentials are kept on the backend.",
    "Production database records are also copied to a separate testing database used for store maintenance and testing. These operational copies are relevant when reviewing a request to delete information.",
    "These controls reduce risk, but no website, storage system or transmission method can guarantee complete security. Protect your account credentials and contact us if you suspect unauthorized use.",
  ] },
  { id: "retention", title: "Data retention and deletion requests", paragraphs: [
    "The current website does not automatically delete account, order, analytics or WhatsApp conversation history after a single fixed period. Clearing your browser storage does not delete records held in our database. WhatsApp’s customer service window controls when we can reply; it is not a message retention period.",
    "To request deletion, email the privacy contact below with the username, order reference or WhatsApp phone number relevant to your request. Tell us which information you want deleted. Do not send your password or unnecessary identity documents. We may ask for information needed to verify that the records belong to you before acting on a request.",
    "We will review the request and explain any information that needs to be retained for outstanding orders, disputes or applicable recordkeeping requirements. Deleting our copy of a conversation does not remove messages from your device, another person’s device or records controlled separately by WhatsApp or other service providers.",
  ] },
  { id: "rights", title: "Your privacy choices and rights", paragraphs: [
    "You can contact us to ask about information we hold about you, request access or correction, or request deletion. Depending on the law that applies to you, additional rights may include objecting to or restricting certain uses, receiving a copy of your information or raising a concern with a relevant authority. The availability and scope of these rights depend on the circumstances and applicable law.",
    "You can choose whether to create an account or contact us through WhatsApp. Some information, such as a delivery name, phone number and address, is needed to fulfil an order. You can stop messaging us on WhatsApp or use its block controls, and use email for privacy requests instead.",
  ] },
  { id: "contact", title: "Contact us", paragraphs: [
    "For questions about this policy or requests concerning your personal information, contact Origins of Beauty using the email below. Please use the subject “Privacy request” so we can identify your enquiry.",
  ], contact: true },
  { id: "updates", title: "Policy updates", paragraphs: [
    "We may update this policy when our services or data practices change. The updated version will be posted on this page with a revised last-updated date. Please check this page for the current policy.",
  ] },
];

export function PolicyDocument() {
  return h("article", { className: "privacy-policy", "aria-labelledby": "privacy-title" },
    h("header", { className: "privacy-policy-heading" },
      h("a", { className: "privacy-policy-back", href: "/" }, "← Back to shop"),
      h("p", { className: "privacy-policy-eyebrow" }, "ORIGINS OF BEAUTY"),
      h("h1", { id: "privacy-title" }, "Privacy Policy"),
      h("p", { className: "privacy-policy-intro" }, "How we handle your information when you shop with us or contact our team."),
      h("p", { className: "privacy-policy-date" }, "Last updated: ", h("time", { dateTime: "2026-11-01" }, "1 November 2026")),
    ),
    h("div", { className: "privacy-policy-layout" },
      h("nav", { className: "privacy-policy-toc", "aria-label": "Privacy policy sections" }, h("strong", null, "On this page"), h("ol", null, policySections.map(section => h("li", { key: section.id }, h("a", { href: `#${section.id}` }, section.title))))),
      h("div", { className: "privacy-policy-content" },
        h("p", { className: "privacy-policy-scope" }, "This policy describes how Origins of Beauty handles information collected through our online shop, customer accounts, orders and business communications, including WhatsApp."),
        policySections.map((section, index) => h("section", { key: section.id, id: section.id, "aria-labelledby": `privacy-${section.id}` },
          h("h2", { id: `privacy-${section.id}` }, `${index + 1}. ${section.title}`),
          section.paragraphs.map((paragraph, i) => h("p", { key: i }, paragraph)),
          section.links && h("ul", { className: "privacy-policy-provider-links" }, section.links.map(link => h("li", { key: link.href }, h("a", { href: link.href }, link.label)))),
          section.contact && h("a", { className: "privacy-policy-email", href: `mailto:${privacyEmail}?subject=Privacy%20request` }, privacyEmail),
        )),
      ),
    ),
  );
}
