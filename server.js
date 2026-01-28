// backend/server.js - FINAL avec extraction vrais liens

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
  res.json({ status: 'ok', version: 'final-real-links' });
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
  if (sourceLower.includes('auchan')) return 'auchan.fr';
  if (sourceLower.includes('carrefour')) return 'carrefour.fr';
  if (sourceLower.includes('electro')) return 'electrodepot.fr';
  return null;
}

// Extraire les VRAIS liens via Immersive Product API
async function getRealLinks(immersiveApiUrl) {
  try {
    console.log('[Immersive] Fetching real links...');
    
    const response = await axios.get(immersiveApiUrl, { timeout: 10000 });
    const data = response.data;
    
    // Les vrais liens sont dans online_sellers
    const sellers = data.online_sellers || [];
    console.log(`[Immersive] Found ${sellers.length} sellers with real links`);
    
    return sellers.map(seller => ({
      name: seller.name,
      price: seller.extracted_price || seller.price,
      link: seller.link, // VRAI lien marchand !
      rating: seller.rating
    }));
    
  } catch (error) {
    console.error('[Immersive] Error:', error.message);
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

    // 1. Google Shopping pour trouver le produit
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_shopping',
        q: query,
        location: 'France',
        hl: 'fr',
        gl: 'fr',
        google_domain: 'google.fr',
        api_key: SERPAPI_KEY,
        num: 10 // On prend moins car on va appeler l'API immersive
      },
      timeout: 15000
    });

    const products = response.data.shopping_results || [];
    console.log(`[Shopping] ${products.length} products`);

    if (products.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    // 2. Prendre le premier produit pertinent
    const relevantProduct = products.find(p => matchesQuery(p.title, query));
    
    if (!relevantProduct) {
      console.log('[API] No relevant product found');
      return res.json({ results: [], total: 0 });
    }

    console.log(`[API] Found: ${relevantProduct.title}`);
    console.log(`[API] Extracting real links...`);

    // 3. Extraire les vrais liens via Immersive Product API
    const immersiveUrl = relevantProduct.serpapi_immersive_product_api;
    
    if (!immersiveUrl) {
      console.log('[API] No immersive API available');
      return res.json({ results: [], total: 0 });
    }

    const sellers = await getRealLinks(immersiveUrl);
    
    if (sellers.length === 0) {
      console.log('[API] No sellers found');
      return res.json({ results: [], total: 0 });
    }

    // 4. Filtrer marchands connus
    const results = sellers
      .map(seller => {
        const domain = extractDomain(seller.name);
        if (!domain) return null;

        let price = seller.price;
        if (typeof price === 'string') {
          price = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
        }
        
        if (!price || price <= 0 || price > 15000) return null;

        return {
          title: relevantProduct.title,
          price: price,
          source: seller.name,
          link: seller.link, // VRAI lien marchand !
          image: relevantProduct.thumbnail,
          domain: domain
        };
      })
      .filter(r => r !== null);

    // 5. Dédupliquer et trier
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
      console.log(`     → ${r.link.substring(0, 80)}...`);
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
  console.log(`🛍️ SerpAPI with Immersive Product (real merchant links)`);
});

module.exports = app;
