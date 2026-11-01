/**
 * Static data for banners, home categories, and sidebar categories.
 */

export const BANNERS = [
  "/images/banners/banner1.png",
  "/images/banners/banner2.png",
  "/images/banners/banner3.png",
];

export const HOME_CATEGORIES = [
  { name: "Beauty", icon: "/icons/beauty.png", bg: "bg-gradient-to-br from-[#ffe1ec] to-[#ffd6f2]" },
  { name: "Skincare", icon: "/icons/skincare.png", bg: "bg-gradient-to-br from-[#e6f7ff] to-[#dff3ff]" },
  { name: "Makeup", icon: "/icons/makeup.png", bg: "bg-gradient-to-br from-[#f7e7ff] to-[#eedcff]" },
  { name: "Fragrance", icon: "/icons/fragrance.png", bg: "bg-gradient-to-br from-[#fff1e5] to-[#ffe7d6]" },
  { name: "Tools", icon: "/icons/tools.png", bg: "bg-gradient-to-br from-[#e8f5ff] to-[#e2eeff]" },
  { name: "Bodycare", icon: "/icons/bodycare.png", bg: "bg-gradient-to-br from-[#eaf8f0] to-[#e1f3ea]" },
];

export const SIDEBAR_CATEGORIES = [
  { label: "All Product", slug: "all", icon: "grid" },
  { label: "Beauty", slug: "beauty", icon: "sparkle" },
  { label: "Skincare", slug: "skincare", icon: "droplet" },
  { label: "Makeup", slug: "makeup", icon: "palette" },
  { label: "Fragrance", slug: "fragrance", icon: "spray" },
  { label: "Tools", slug: "tools", icon: "brush" },
  { label: "Bodycare", slug: "bodycare", icon: "droplet" },
];
