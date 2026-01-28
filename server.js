// backend/server.js - VERSION FINALE avec filtrage marchands

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SERPAPI_KEY = process.env.SERPAPI_KEY;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'final' });
});

// Marchands français de confiance
const TRUSTED_MERCHANTS = [
  'amazon', 'fnac', 'cdiscount', 'darty', 'boulanger', 
  'ldlc', 'materiel', 'rue du commerce', 'rueducommerce',
  'auchan', 'carrefour', 'leclerc', 'rakuten', 
  'back market', 'backmarket', 'electro', 'but', 'conforama'
];

function isTrustedMerchant(source) {
  if (!source) return false;
  const sourceLower = source.toLowerCase();
  return TRUSTED_MERCHANTS.some(merchant => sourceLower.includes(merchant));
}

function extractDomain(source) {
  if (!source) return null;
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('amazon')) return 'amazon.fr';
  if (sourceLower.includes('fnac')) return 'fnac.com';
  if (sourceLower.includes('cdiscount')) return 'cdiscount.com';
  if (sourceLower.includes('darty')) return 'darty.com';
  if (sourceLower.includes('boulanger')) return 'boulanger.com';
  if (sourceLower.includes('ldlc')) return 'ldlc.com';
  if (sourceLower.includes('materiel')) return 'materiel.net';
  if (sourceLower.includes('back market')) return 'backmarket.fr';
  if (sourceLower.includes('backmarket')) return 'backmarket.fr';
  if (sourceLower.includes('rakuten')) return 'rakuten.fr';
  if (sourceLower.includes('rue du commerce')) return 'rueducommerce.fr';
  if (sourceLower.includes('rueducommerce')) return 'rueducommerce.fr';
  if (sourceLower.includes('auchan')) return 'auchan.fr';
  if (sourceLower.includes('carrefour')) return 'carrefour.fr';
  if (sourceLower.includes('leclerc')) return 'leclerc.fr';
  if (sourceLower.includes('electro')) return 'electrodepot.fr';
  return null;
}

app.post('/api/compare', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    console.log(`\n[API] Searching: "${query}"`);

    // Google Shopping
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_shopping',
        q: query,
        location: 'France',
        hl: 'fr',
        gl: 'fr',
        google_domain: 'google.fr',
        api_key: SERPAPI_KEY,
        num: 40
      },
      timeout: 15000
    });

    const shoppingResults = response.data.shopping_results || [];
    console.log(`[Shopping] ${shoppingResults.length} raw results`);

    if (shoppingResults.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    // Filtrer et formatter
    const filteredResults = shoppingResults
      .map(item => {
        // Vérifier marchand de confiance
        if (!isTrustedMerchant(item.source)) {
          return null;
        }

        // Prix
        let price = item.extracted_price;
        if (!price && item.price) {
          const priceStr = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
          price = parseFloat(priceStr);
        }

        if (!price || isNaN(price) || price <= 0) {
          return null;
        }

        const domain = extractDomain(item.source);

        return {
          title: item.title || 'Produit',
          price: price,
          priceFormatted: `${price.toFixed(2).replace('.', ',')}€`,
          source: item.source,
          link: item.product_link || item.link || '#',
          image: item.thumbnail || '',
          rating: item.rating || null,
          reviews: item.reviews || null,
          domain: domain
        };
      })
      .filter(item => item !== null);

    // Dédupliquer par marchand (garder le moins cher)
    const byMerchant = new Map();
    for (const item of filteredResults) {
      const key = item.domain || item.source;
      if (!byMerchant.has(key) || byMerchant.get(key).price > item.price) {
        byMerchant.set(key, item);
      }
    }

    // Trier par prix et limiter
    const finalResults = Array.from(byMerchant.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);

    console.log(`[API] ${finalResults.length} trusted merchants:`);
    finalResults.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.source} - ${r.price}€`);
    });

    res.json({ 
      results: finalResults,
      total: finalResults.length 
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PriceWatch Backend FINAL on port ${PORT}`);
  console.log(`🛍️ Google Shopping + Trusted French merchants`);
});

module.exports = app;
