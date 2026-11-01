import { useEffect } from "react";

export function PageMetadata({ title, description = "", image, noindex = false }) {
  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = title;
    const snapshots = [];
    const update = (attribute, name, content) => {
      const selector = `meta[${attribute}="${name}"]`;
      let element = document.head.querySelector(selector);
      const previous = element?.getAttribute("content");
      const existed = !!element;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
      snapshots.push(() => existed ? element.setAttribute("content", previous || "") : element.remove());
    };
    update("name", "description", description);
    update("property", "og:title", title);
    update("property", "og:description", description);
    update("property", "og:image", image || "");
    update("property", "og:url", window.location.origin + window.location.pathname);
    update("name", "twitter:card", image ? "summary_large_image" : "summary");
    update("name", "twitter:title", title);
    update("name", "twitter:description", description);
    update("name", "twitter:image", image || "");
    update("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const existed = !!canonical;
    const previousUrl = canonical?.getAttribute("href");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + window.location.pathname;
    return () => {
      document.title = previousTitle;
      snapshots.forEach(restore => restore());
      if (existed) canonical.setAttribute("href", previousUrl || "");
      else canonical.remove();
    };
  }, [title, description, image, noindex]);
  return null;
}
