const getPagination = (params = {}) => {
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const limit = Math.min(
    100,
    Math.max(1, Math.floor(Number(params.limit) || 20)),
  );
  return { limit, skip: (page - 1) * limit, page };
};
const createSlug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export { getPagination, createSlug };
