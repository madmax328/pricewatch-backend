// backend/server.js - VERSION GOOGLE SHOPPING PURE

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
  res.json({ status: 'ok', version: 'shopping-pure' });
});

app.post('/api/compare', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    console.log(`\n[API] Searching: "${query}"`);

    // Google Shopping - AUCUNE modification
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_shopping',
        q: query,
        location: 'France',
        hl: 'fr',
        gl: 'fr',
        google_domain: 'google.fr',
        api_key: SERPAPI_KEY,
        num: 30
      },
      timeout: 15000
    });

    const shoppingResults = response.data.shopping_results || [];
    console.log(`[Shopping] ${shoppingResults.length} raw results`);

    if (shoppingResults.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    // Formatter SANS filtrage (tout garder)
    const formattedResults = shoppingResults
      .map(item => {
        // Prix - priorité extracted_price
        let price = item.extracted_price;
        if (!price && item.price) {
          const priceStr = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
          price = parseFloat(priceStr);
        }

        // Skip seulement si vraiment pas de prix
        if (!price || isNaN(price) || price <= 0) {
          return null;
        }

        return {
          title: item.title || 'Produit',
          price: price,
          priceFormatted: `${price.toFixed(2).replace('.', ',')}€`,
          source: item.source || 'Marchand',
          link: item.product_link || item.link || '#', // TEL QUEL de Google
          image: item.thumbnail || '',
          rating: item.rating || null,
          reviews: item.reviews || null
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => a.price - b.price)
      .slice(0, 10); // Max 10 résultats

    console.log(`[API] ${formattedResults.length} results:`);
    formattedResults.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.source} - ${r.price}€`);
    });

    res.json({ 
      results: formattedResults,
      total: formattedResults.length 
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PriceWatch Backend PURE on port ${PORT}`);
  console.log(`🛍️ Google Shopping - Raw data (no filtering)`);
});

module.exports = app;
