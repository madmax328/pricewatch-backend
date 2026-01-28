// backend/server.js - VERSION FINALE avec vrais liens

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
  res.json({ status: 'ok', version: 'final-stores' });
});

function matchesQuery(title, query) {
  if (!title || !query) return false;
  const titleLower = title.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(w => w.length > 2);
  if (queryWords.length === 0) return true;
  const matches = queryWords.filter(word => titleLower.includes(word));
  return matches.length / queryWords.length >= 0.5;
}

function extractDomain(name) {
  if (!name) return null;
  const nameLower = name.toLowerCase();
  if (nameLower.includes('amazon')) return 'amazon.fr';
  if (nameLower.includes('fnac')) return 'fnac.com';
  if (nameLower.includes('cdiscount')) return 'cdiscount.com';
  if (nameLower.includes('darty')) return 'darty.com';
  if (nameLower.includes('boulanger')) return 'boulanger.com';
  if (nameLower.includes('ldlc')) return 'ldlc.com';
  if (nameLower.includes('materiel')) return 'materiel.net';
  if (nameLower.includes('back market')) return 'backmarket.fr';
  if (nameLower.includes('backmarket')) return 'backmarket.fr';
  if (nameLower.includes('rakuten')) return 'rakuten.fr';
  if (nameLower.includes('auchan')) return 'auchan.fr';
  if (nameLower.includes('carrefour')) return 'carrefour.fr';
  if (nameLower.includes('electro')) return 'electrodepot.fr';
  return null;
}

// Extraire les VRAIS liens via Immersive Product API
async function getRealLinks(immersiveApiUrl) {
  try {
    console.log('[Immersive] Fetching...');
    
    const response = await axios.get(immersiveApiUrl, { timeout: 10000 });
    const data = response.data;
    
    // Les vrais liens sont dans product_results.stores
    const stores = data.product_results?.stores || [];
    console.log(`[Immersive] Found ${stores.length} stores`);
    
    return stores.map(store => ({
      name: store.name,
      price: store.extracted_price || store.extracted_total,
      link: store.link, // VRAI lien marchand !
      rating: store.rating,
      title: store.title
    }));
    
  } catch (error) {
    console.error('[Immersive] Error:', error.response?.status, error.message);
    return [];
  }
}

app.post('/api/compare', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    console.log(`\n[API] Searching: "${query}"`);

    // 1. Google Shopping
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_shopping',
        q: query,
        location: 'France',
        hl: 'fr',
        gl: 'fr',
        google_domain: 'google.fr',
        api_key: SERPAPI_KEY,
        num: 10
      },
      timeout: 15000
    });

    const products = response.data.shopping_results || [];
    console.log(`[Shopping] ${products.length} products`);

    if (products.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    // 2. Premier produit pertinent
    const relevantProduct = products.find(p => matchesQuery(p.title, query));
    
    if (!relevantProduct) {
      console.log('[API] No relevant product');
      return res.json({ results: [], total: 0 });
    }

    console.log(`[API] Found: ${relevantProduct.title}`);

    // 3. Extraire vrais liens
    const immersiveUrl = relevantProduct.serpapi_immersive_product_api;
    
    if (!immersiveUrl) {
      console.log('[API] No immersive API URL');
      return res.json({ results: [], total: 0 });
    }

    const stores = await getRealLinks(immersiveUrl);
    
    if (stores.length === 0) {
      console.log('[API] No stores found');
      return res.json({ results: [], total: 0 });
    }

    // 4. Filtrer marchands français
    const results = stores
      .map(store => {
        const domain = extractDomain(store.name);
        if (!domain) return null;

        const price = store.price;
        if (!price || price <= 0 || price > 15000) return null;

        return {
          title: store.title || relevantProduct.title,
          price: price,
          source: store.name,
          link: store.link, // VRAI lien !
          image: relevantProduct.thumbnail,
          domain: domain
        };
      })
      .filter(r => r !== null);

    // 5. Dédupliquer
    const byMerchant = new Map();
    for (const item of results) {
      if (!byMerchant.has(item.domain) || byMerchant.get(item.domain).price > item.price) {
        byMerchant.set(item.domain, item);
      }
    }

    const finalResults = Array.from(byMerchant.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);

    console.log(`[API] ${finalResults.length} merchants with REAL links:`);
    finalResults.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.source} - ${r.price}€`);
      console.log(`     ${r.link.substring(0, 70)}...`);
    });

    const formatted = finalResults.map(r => ({
      title: r.title,
      price: r.price,
      priceFormatted: `${r.price.toFixed(2).replace('.', ',')}€`,
      source: r.source,
      link: r.link,
      image: r.image || ''
    }));

    res.json({ results: formatted, total: formatted.length });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PriceWatch Backend FINAL on port ${PORT}`);
  console.log(`🛍️ SerpAPI Immersive Product (stores with real links)`);
});

module.exports = app;
