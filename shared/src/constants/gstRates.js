/**
 * Standard Indian GST Rates (Goods and Services Tax)
 * Slabs established under the Indian GST framework.
 */

export const GST_RATES = [
  { value: 0, label: "0% (Exempt / Nil Rated)" },
  { value: 0.1, label: "0.1% (Rough Diamonds & Precious Stones)" },
  { value: 0.25, label: "0.25% (Cut Diamonds & Gems)" },
  { value: 1.5, label: "1.5% (Special Housing / Services)" },
  { value: 3, label: "3% (Gold, Silver & Jewellery)" },
  { value: 5, label: "5% (Essential Goods & Food)" },
  { value: 6, label: "6% (Special Composition Rate)" },
  { value: 7.5, label: "7.5% (Hospitality / Restaurant)" },
  { value: 12, label: "12% (Standard Lower Rate)" },
  { value: 18, label: "18% (Standard Rate - Most Items)" },
  { value: 28, label: "28% (Luxury / De-merit Goods)" },
];

export const GST_RATE_NUMBERS = [0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

export const formatGstLabel = (rate) => {
  const num = Number(rate);
  const matched = GST_RATES.find((g) => Number(g.value) === num);
  if (matched) return matched.label;
  return `${rate}% (Custom)`;
};

export default GST_RATES;
