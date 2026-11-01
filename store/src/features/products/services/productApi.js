import axios from "axios";

/**
 * Fetch the full product list from the static JSON file.
 * @returns {Promise<Array>}
 */
export const fetchProducts = async () => {
  const { data } = await axios.get("/products.json");
  return data ?? [];
};
