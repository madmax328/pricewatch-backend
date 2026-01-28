// backend/server.js - VERSION SANS AXIOS (fix undici)

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SERPAPI_KEY = process.env.SERPAPI_KEY;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'final-no-axios' });
});

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

async function extractRealLink(googleUrl) {
  try {
    console.log('[Extract] Fetching...');
    
    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    
    let realLink = null;
    
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      
      if (!href || href.includes('google.com') || href.includes('google.fr')) {
        return;
      }
      
      if (href.startsWith('http') && 
          (href.includes('amazon') || href.includes('fnac') || 
           href.includes('cdiscount') || href.includes('darty') ||
           href.includes('boulanger') || href.includes('ldlc'))) {
        realLink = href;
        return false;
      }
    });

    if (!realLink) {
      const urlPattern = /https?:\/\/(www\.)?(amazon|fnac|cdiscount|darty|boulanger|ldlc|materiel|backmarket|rakuten)[\w\-\.\/\?=&%]+/g;
      const matches = html.match(urlPattern);
      
      if (matches && matches.length > 0) {
        realLink = matches[0];
      }
    }

    if (realLink) {
      console.log(`[Extract] ✅`);
      return realLink;
    }

    console.log('[Extract] ⚠️');
    return googleUrl;

  } catch (error) {
    console.error('[Extract] Error:', error.message);
    return googleUrl;
  }
}

app.post('/api/compare', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    console.log(`\n[API] Searching: "${query}"`);

    // Google Shopping avec node-fetch
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      location: 'France',
      hl: 'fr',
      gl: 'fr',
      google_domain: 'google.fr',
      api_key: SERPAPI_KEY,
      num: '40'
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await response.json();

    const shoppingResults = data.shopping_results || [];
    console.log(`[Shopping] ${shoppingResults.length} raw`);

    if (shoppingResults.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    const filteredResults = shoppingResults
      .map(item => {
        if (!isTrustedMerchant(item.source)) return null;

        let price = item.extracted_price;
        if (!price && item.price) {
          const priceStr = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
          price = parseFloat(priceStr);
        }

        if (!price || isNaN(price) || price <= 0) return null;

        return {
          title: item.title || 'Produit',
          price: price,
          priceFormatted: `${price.toFixed(2).replace('.', ',')}€`,
          source: item.source,
          googleLink: item.product_link || item.link,
          image: item.thumbnail || '',
          rating: item.rating || null,
          reviews: item.reviews || null,
          domain: extractDomain(item.source)
        };
      })
      .filter(item => item !== null);

    const byMerchant = new Map();
    for (const item of filteredResults) {
      const key = item.domain || item.source;
      if (!byMerchant.has(key) || byMerchant.get(key).price > item.price) {
        byMerchant.set(key, item);
      }
    }

    const uniqueResults = Array.from(byMerchant.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);

    console.log(`[API] Extracting for ${uniqueResults.length}...`);

    const extractPromises = uniqueResults.map(async (item, index) => {
      await new Promise(resolve => setTimeout(resolve, index * 500));
      const realLink = await extractRealLink(item.googleLink);
      return { ...item, link: realLink };
    });

    const finalResults = await Promise.all(extractPromises);

    console.log(`[API] ${finalResults.length} results:`);
    finalResults.forEach((r, i) => {
      const type = r.link.includes('google') ? '⚠️' : '✅';
      console.log(`  ${i+1}. ${r.source} - ${r.price}€ ${type}`);
    });

    res.json({ results: finalResults, total: finalResults.length });

  } catch (error) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ PriceWatch Backend FINAL on port ${PORT}`);
  console.log(`🔗 No axios (undici fix)`);
});

module.exports = app;
