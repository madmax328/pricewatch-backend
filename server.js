// backend/server.js - VERSION 3.4.4 (debug structure)

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.4.4-rapidapi' });
});

// Retry logic
async function fetchWithRetry(url, config, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`[RapidAPI] Attempt ${i + 1}/${retries + 1}...`);
      const response = await axios.get(url, config);
      console.log(`[RapidAPI] ✅ Success on attempt ${i + 1}`);
      return response;
    } catch (error) {
      if (i === retries) throw error;
      console.log(`[RapidAPI] ⚠️ Attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Vérifier pertinence
function matchesQuery(title, query) {
  if (!title || !query) return false;
  const titleLower = title.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(w => w.length > 2);
  const matches = queryWords.filter(word => titleLower.includes(word));
  return matches.length / queryWords.length >= 0.6;
}

// RapidAPI Product Search
async function searchProducts(query) {
  try {
    console.log('[RapidAPI] Searching with /search-v2...');
    
    const response = await fetchWithRetry(
      'https://real-time-product-search.p.rapidapi.com/search-v2',
      {
        params: {
          q: query,
          country: 'fr',
          language: 'fr',
          page: '1',
          limit: '30',
          sort_by: 'BEST_MATCH',
          product_condition: 'ANY'
        },
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'real-time-product-search.p.rapidapi.com'
        },
        timeout: 30000
      }
    );

    const data = response.data;
    console.log('[RapidAPI] Response status:', response.status);
    
    // DEBUG: Afficher la structure complète
    console.log('[RapidAPI] Response keys:', Object.keys(data));
    console.log('[RapidAPI] Full response:', JSON.stringify(data, null, 2));

    // Chercher les produits dans différents endroits possibles
    let products = null;
    
    if (data.data && Array.isArray(data.data)) {
      products = data.data;
      console.log('[RapidAPI] Products found in: data.data');
    } else if (data.products && Array.isArray(data.products)) {
      products = data.products;
      console.log('[RapidAPI] Products found in: data.products');
    } else if (data.results && Array.isArray(data.results)) {
      products = data.results;
      console.log('[RapidAPI] Products found in: data.results');
    } else if (Array.isArray(data)) {
      products = data;
      console.log('[RapidAPI] Products found in: root array');
    } else {
      console.log('[RapidAPI] ⚠️ Could not find products array');
      console.log('[RapidAPI] Available keys:', Object.keys(data));
      
      // Chercher dans les clés
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          console.log(`[RapidAPI] Found array in: data.${key} (length: ${data[key].length})`);
          products = data[key];
          break;
        }
      }
    }

    if (!products || products.length === 0) {
      console.log('[RapidAPI] ⚠️ No products found');
      return [];
    }

    console.log(`[RapidAPI] Found ${products.length} products`);
    console.log('[RapidAPI] Sample product:', JSON.stringify(products[0], null, 2));

    // Parser les produits
    const results = products
      .filter(p => {
        const title = p.product_title || p.title || p.name || '';
        return matchesQuery(title, query);
      })
      .slice(0, 15)
      .map(p => {
        // Prix
        let price = 0;
        if (p.offer && p.offer.price) {
          price = parseFloat(p.offer.price);
        } else if (p.price) {
          price = parseFloat(p.price);
        } else if (p.typical_price_range && p.typical_price_range[0]) {
          const match = p.typical_price_range[0].match(/[\d.,]+/);
          if (match) price = parseFloat(match[0].replace(',', '.'));
        }

        // Source
        let source = 'Marchand';
        if (p.offer && p.offer.store_name) {
          source = p.offer.store_name;
        } else if (p.source) {
          source = p.source;
        } else if (p.store) {
          source = p.store;
        } else if (p.merchant) {
          source = p.merchant;
        }

        const link = p.product_link || p.link || p.url || '';
        const image = p.product_photo || p.image || p.thumbnail || '';
        const title = p.product_title || p.title || p.name || 'Produit';

        console.log(`[RapidAPI] → ${source} - ${price}€ - ${title.substring(0, 40)}`);

        return {
          title: title,
          price: price,
          link: link,
          image: image,
          source: source
        };
      });

    return results;

  } catch (error) {
    console.error('[RapidAPI] ❌ Error:', error.message);
    if (error.response) {
      console.error('[RapidAPI] Status:', error.response.status);
      console.error('[RapidAPI] Data:', JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

app.post('/api/compare', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    console.log(`\n[API] ========== Searching: "${query}" ==========`);

    const products = await searchProducts(query);

    console.log(`[API] Raw results: ${products.length}`);

    // Filtrer prix valides
    const validResults = products
      .filter(r => {
        if (!r.price || r.price <= 0 || r.price > 15000) return false;
        if (!r.link || !r.link.startsWith('http')) return false;
        return true;
      })
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);

    console.log(`[API] Valid results: ${validResults.length}`);

    // Formater
    const formatted = validResults.map((r, i) => {
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

    console.log(`[API] ========== Returning ${formatted.length} results ==========\n`);

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
  console.log(`✅ PriceWatch Backend v3.4.4 on port ${PORT}`);
  console.log(`🛍️ RapidAPI search-v2 (with debug)`);
  console.log(`🔑 API Key: ${RAPIDAPI_KEY ? 'YES' : 'NO'}`);
});

module.exports = app;
