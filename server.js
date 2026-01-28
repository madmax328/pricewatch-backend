// backend/server.js - VERSION FINALE (avec logs détaillés)

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
  res.json({ status: 'ok', version: 'final-debug' });
});

// Vérifier pertinence
function matchesQuery(title, query) {
  if (!title || !query) return false;
  const titleLower = title.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(w => w.length > 2);
  const matches = queryWords.filter(word => titleLower.includes(word));
  const ratio = matches.length / queryWords.length;
  return ratio >= 0.6; // Baissé à 60%
}

// Extraire domaine
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

    if (products.length > 0) {
      console.log('[DEBUG] Sample product:', JSON.stringify(products[0], null, 2));
    }

    // Filtrer et parser
    let processedCount = 0;
    let matchedCount = 0;
    let domainCount = 0;
    let priceCount = 0;
    
    const results = products
      .map((p, i) => {
        processedCount++;
        
        // Log premier produit en détail
        if (i === 0) {
          console.log(`[DEBUG] Processing product 1:`);
          console.log(`  - title: ${p.title}`);
          console.log(`  - source: ${p.source}`);
          console.log(`  - extracted_price: ${p.extracted_price}`);
          console.log(`  - price: ${p.price}`);
        }

        // Vérifier match
        if (!matchesQuery(p.title, query)) {
          if (i < 3) console.log(`[FILTER] ❌ Product ${i+1}: No match - "${p.title.substring(0, 50)}..."`);
          return null;
        }
        matchedCount++;

        // Prix
        let price = p.extracted_price;
        if (!price && p.price) {
          const priceStr = p.price.replace(/[^\d.,]/g, '').replace(',', '.');
          price = parseFloat(priceStr);
        }

        if (!price || isNaN(price) || price <= 0 || price > 15000) {
          if (i < 3) console.log(`[FILTER] ❌ Product ${i+1}: Invalid price - ${price}`);
          return null;
        }
        priceCount++;

        // Domain
        const domain = extractDomain(p.source);
        if (!domain) {
          if (i < 3) console.log(`[FILTER] ❌ Product ${i+1}: Unknown merchant - ${p.source}`);
          return null;
        }
        domainCount++;

        if (i < 3) {
          console.log(`[FILTER] ✅ Product ${i+1}: ${p.source} - ${price}€`);
        }

        return {
          title: p.title,
          price: price,
          source: p.source,
          link: p.product_link || p.link,
          image: p.thumbnail,
          domain: domain
        };
      })
      .filter(p => p !== null);

    console.log(`[FILTER] Stats:`);
    console.log(`  - Processed: ${processedCount}`);
    console.log(`  - Matched query: ${matchedCount}`);
    console.log(`  - Valid price: ${priceCount}`);
    console.log(`  - Known merchant: ${domainCount}`);
    console.log(`  - Final results: ${results.length}`);

    // Dédupliquer par marchand
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

    console.log(`[API] Returning ${finalResults.length} unique merchants`);

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
  console.log(`✅ PriceWatch Backend FINAL DEBUG on port ${PORT}`);
  console.log(`🛍️ SerpAPI Google Shopping (with detailed logs)`);
  console.log(`🔑 SerpAPI Key: ${SERPAPI_KEY ? 'YES' : 'NO'}`);
});

module.exports = app;
