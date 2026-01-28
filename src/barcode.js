const axios = require("axios");

async function resolveBarcode(ean) {
  const code = String(ean || "").trim();

  // Validation EAN / UPC
  if (!/^\d{8,14}$/.test(code)) return null;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json`;
    const res = await axios.get(url, { timeout: 10000 });

    if (!res.data || res.data.status !== 1) return null;

    const p = res.data.product;

    const name =
      p.product_name_fr ||
      p.product_name ||
      "";

    if (!name) return null;

    const brand = (p.brands || "").split(",")[0]?.trim();
    const quantity = p.quantity || "";

    const title = [brand, name, quantity].filter(Boolean).join(" ");

    return {
      title,
      brand,
      image: p.image_url || p.image_front_url || null,
    };
  } catch (e) {
    console.warn("Barcode resolve failed:", e.message);
    return null;
  }
}

module.exports = { resolveBarcode };
