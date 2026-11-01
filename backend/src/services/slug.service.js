const generateUniqueSlug = async (name) => {
  // Generate a basic slug from the name
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  // Append timestamp to ensure uniqueness
  slug = `${slug}-${Date.now()}`;
  return slug;
};

export { generateUniqueSlug };
