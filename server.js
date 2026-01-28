// backend/server.js - VERSION FINALE (SerpAPI Shopping)

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
  res.json({ status: 'ok', version: 'final-serpapi' });
});

// Vérifier pertinence
function matchesQuery(title, query) {
  if (!title || !query) return false;
  const titleLower = title.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(w => w.length > 2);
  const matches = queryWords.filter(word => titleLower.includes(word));
  return matches.length / queryWords.length >= 0.7;
}

// Extraire domaine
function extractDomain(source) {
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('amazon')) return 'amazon.fr';
  if (sourceLower.includes('fnac')) return 'fnac.com';
  if (sourceLower.includes('cdiscount')) return 'cdiscount.com';
  if (sourceLower.includes('darty')) return 'darty.com';
  if (sourceLower.includes('boulanger')) return 'boulanger.com';
  if (sourceLower.includes('ldlc')) return 'ldlc.com';
  if (sourceLower.includes('materiel')) return 'materiel.net';
  if (sourceLower.includes('back market')) return 'backmarket.fr';
  if (sourceLower.includes('rakuten')) return 'rakuten.fr';
  return null;
}

app.post('/api/compare', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    console.log(`\n[API] ========== Searching: "${query}" ==========`);

    // Google Shopping via SerpAPI
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

    const products = response.data.shopping_results || [];
    console.log(`[SerpAPI] Found ${products.length} products`);

    // Filtrer et parser
    const results = products
      .filter(p => matchesQuery(p.title, query))
      .map(p => {
        // Prix
        let price = p.extracted_price;
        if (!price && p.price) {
          const priceStr = p.price.replace(/[^\d.,]/g, '').replace(',', '.');
          price = parseFloat(priceStr);
        }

        const domain = extractDomain(p.source);
        if (!domain) return null;

        return {
          title: p.title,
          price: price,
          source: p.source,
          link: p.product_link || p.link,
          image: p.thumbnail,
          domain: domain
        };
      })
      .filter(p => p !== null && p.price > 0 && p.price < 15000);

    // Dédupliquer par marchand (garder le moins cher)
    const byMerchant = new Map();
    for (const item of results) {
      const key = item.domain;
      if (!byMerchant.has(key) || byMerchant.get(key).price > item.price) {
        byMerchant.set(key, item);
      }
    }

    // Trier par prix
    const finalResults = Array.from(byMerchant.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);

    console.log(`[API] Returning ${finalResults.length} unique merchants:`);

    // Formater
    const formatted = finalResults.map((r, i) => {
      console.log(`[API] ${i+1}. ${r.source} - ${r.price}€`);
      
      return {
        title: r.title,
        price: r.price,
        priceFormatted: `${r.price.toFixed(2).replace('.', ',')}€`,
        source: r.source,
        link: r.link,
        image: r.image || ''
      };
    });

    console.log(`[API] ========== Done ==========\n`);

    res.json({ 
      results: formatted,
      total: formatted.length 
    });

  } catch (error) {
    console.error('[API] ❌ Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to compare',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PriceWatch Backend FINAL on port ${PORT}`);
  console.log(`🛍️ SerpAPI Google Shopping (multi-merchant)`);
  console.log(`🔑 SerpAPI Key: ${SERPAPI_KEY ? 'YES' : 'NO'}`);
});

module.exports = app;
