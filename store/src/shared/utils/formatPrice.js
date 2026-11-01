/**
 * Price formatting utilities for Bangladeshi Taka (BDT).
 */

const bdFormatter = new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 });

/**
 * Format a numeric price to locale string (no currency symbol).
 * @param {number|string} price
 * @returns {string}
 */
export const formatPrice = (price) => {
  const num = Number(price);
  return Number.isFinite(num) ? bdFormatter.format(num) : String(price || '0');
};

/**
 * Format price with ৳ prefix.
 * @param {number|string} price
 * @returns {string}
 */
export const formatPriceBDT = (price) => `৳ ${formatPrice(price)}`;

/**
 * Format price with "Tk" prefix (used in product details).
 * @param {number|string} price
 * @returns {string}
 */
export const formatPriceTk = (price) => `Tk ${formatPrice(price)}`;
