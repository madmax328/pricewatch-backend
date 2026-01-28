const axios = require('axios');

class PriceScraper {
  constructor() {
    this.serpApiKey = process.env.SERP_API_KEY || '';
    this.serpApiUrl = 'https://serpapi.com/search';
    
    this.affiliateIds = {
      amazon: process.env.AMAZON_TAG || '',
      fnac: process.env.FNAC_AFFILIATE_ID || '',
      cdiscount: process.env.CDISCOUNT_AFFILIATE_ID || '',
      darty: process.env.DARTY_AFFILIATE_ID || '',
      boulanger: process.env.BOULANGER_AFFILIATE_ID || '',
      ldlc: process.env.LDLC_AFFILIATE_ID || '',
      materielnet: process.env.MATERIELNET_AFFILIATE_ID || ''
    };
  }

  cleanSearchQuery(query) {
    return query.trim().replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  mapMerchantName(merchant) {
    const mapping = {
      'Amazon.fr': 'Amazon', 'Amazon': 'Amazon',
      'Fnac': 'Fnac', 'Fnac.com': 'Fnac',
      'Darty': 'Darty', 'Darty.com': 'Darty',
      'Boulanger': 'Boulanger', 'Boulanger.com': 'Boulanger',
      'Cdiscount': 'Cdiscount', 'Cdiscount.com': 'Cdiscount',
      'LDLC': 'LDLC', 'LDLC.com': 'LDLC',
      'Materiel.net': 'Materiel.net',
      'Rue du Commerce': 'Rue du Commerce',
      'Apple': 'Apple'
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (merchant.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return merchant;
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // NOUVEAU : Construire une URL de recherche directe sur le site
  buildDirectSearchUrl(siteName, productTitle) {
    const encodedTitle = encodeURIComponent(productTitle);
    
    const searchUrls = {
      'Amazon': `https://www.amazon.fr/s?k=${encodedTitle}`,
      'Fnac': `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${encodedTitle}`,
      'Darty': `https://www.darty.com/nav/recherche/index.html?s=${encodedTitle}`,
      'Boulanger': `https://www.boulanger.com/recherche?q=${encodedTitle}`,
      'Cdiscount': `https://www.cdiscount.com/search/10/${encodedTitle}.html`,
      'LDLC': `https://www.ldlc.com/fr-fr/recherche/${encodedTitle}/`,
      'Materiel.net': `https://www.materiel.net/recherche/${encodedTitle}/`,
      'Apple': `https://www.apple.com/fr/search/${encodedTitle}`,
      'Rue du Commerce': `https://www.rueducommerce.fr/recherche/${encodedTitle}`
    };

    return searchUrls[siteName] || null;
  }

  // Extraire l'URL du marchand depuis différents champs SerpAPI
  extractMerchantUrl(item) {
    // SerpAPI peut retourner l'URL dans différents champs
    // Priorité : product_link > link > serpapi_product_api
    
    // 1. Essayer product_link (URL directe du marchand)
    if (item.product_link && this.isValidUrl(item.product_link)) {
      const url = item.product_link;
      // Si ce n'est PAS un lien Google, c'est bon
      if (!url.includes('google.com') && !url.includes('googleadservices')) {
        console.log(`  ✓ Direct merchant URL found`);
        return url;
      }
    }

    // 2. Essayer link
    if (item.link && this.isValidUrl(item.link)) {
      const url = item.link;
      if (!url.includes('google.com') && !url.includes('googleadservices')) {
        console.log(`  ✓ Direct link found`);
        return url;
      }
    }

    // 3. Si on a le nom du site et le titre du produit, construire l'URL de recherche
    if (item.source && item.title) {
      const siteName = this.mapMerchantName(item.source);
      const searchUrl = this.buildDirectSearchUrl(siteName, item.title);
      if (searchUrl) {
        console.log(`  → Built search URL for ${siteName}`);
        return searchUrl;
      }
    }

    console.log(`  ✗ No valid URL found`);
    return null;
  }

  addAffiliateTag(url, siteName) {
    if (!url || !this.isValidUrl(url)) {
      return url;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // AMAZON
      if (hostname.includes('amazon') && this.affiliateIds.amazon) {
        urlObj.searchParams.set('tag', this.affiliateIds.amazon);
        console.log(`  💰 Added Amazon tag: ${this.affiliateIds.amazon}`);
        return urlObj.toString();
      }

      // Autres sites - pour l'instant retourner l'URL normale
      return url;

    } catch (error) {
      return url;
    }
  }

  extractPrice(priceData) {
    if (!priceData) return null;
    if (typeof priceData === 'number') return priceData;

    if (typeof priceData === 'string') {
      const cleanPrice = priceData.replace(/[^\d,\.]/g, '');
      const price = parseFloat(cleanPrice.replace(',', '.'));
      
      if (!isNaN(price) && price > 0 && price < 100000) {
        return price;
      }
    }
    return null;
  }

  async scrapeGoogleShopping(query) {
    if (!this.serpApiKey) {
      console.error('❌ SERP_API_KEY not configured');
      return [];
    }

    try {
      console.log(`🔍 [SerpAPI] Searching Google Shopping: ${query}`);

      const response = await axios.get(this.serpApiUrl, {
        params: {
          api_key: this.serpApiKey,
          engine: 'google_shopping',
          q: query,
          gl: 'fr',
          hl: 'fr',
          location: 'France',
          num: 50
        },
        timeout: 30000
      });

      const data = response.data;
      
      if (!data.shopping_results || data.shopping_results.length === 0) {
        console.log('⚠️  No shopping results found');
        return [];
      }

      console.log(`✅ SerpAPI returned ${data.shopping_results.length} results`);
      console.log(`📝 Processing results...`);

      const results = [];
      const seenMerchants = new Set();

      for (const item of data.shopping_results) {
        const price = this.extractPrice(item.price || item.extracted_price);
        
        if (!price) {
          console.log(`  ⏭️  Skipping result without price`);
          continue;
        }

        console.log(`\n  🔍 Processing: ${item.source || 'Unknown'} - ${price}€`);

        // Extraire l'URL du marchand
        let merchantUrl = this.extractMerchantUrl(item);
        
        // Si pas d'URL valide, ignorer
        if (!merchantUrl) {
          console.log(`  ✗ Skipping: no valid URL`);
          continue;
        }

        const merchantName = this.mapMerchantName(item.source || 'Marchand inconnu');
        
        // Ajouter le tag d'affiliation
        merchantUrl = this.addAffiliateTag(merchantUrl, merchantName);

        const merchantKey = merchantName.toLowerCase();
        
        // Éviter les doublons
        if (seenMerchants.has(merchantKey)) {
          const existingIndex = results.findIndex(r => r.site.toLowerCase() === merchantKey);
          if (existingIndex !== -1 && results[existingIndex].price > price) {
            console.log(`  ↻ Updating ${merchantName} with better price`);
            results[existingIndex] = {
              title: item.title || query,
              price: price,
              url: merchantUrl,
              image: item.thumbnail || '',
              site: merchantName,
              availability: 'Disponible',
              rating: item.rating || null
            };
          } else {
            console.log(`  ⏭️  Already have ${merchantName}`);
          }
          continue;
        }

        seenMerchants.add(merchantKey);
        console.log(`  ✓ Added ${merchantName}`);

        results.push({
          title: item.title || query,
          price: price,
          url: merchantUrl,
          image: item.thumbnail || '',
          site: merchantName,
          availability: 'Disponible',
          rating: item.rating || null
        });
      }

      results.sort((a, b) => a.price - b.price);

      console.log(`\n✅ Final: ${results.length} unique merchants with valid URLs`);
      const sites = results.map(r => r.site).join(', ');
      console.log(`📊 Sites: ${sites}`);

      return results;

    } catch (error) {
      console.error(`❌ SerpAPI error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
      return [];
    }
  }

  async scrapeAll(query) {
    const cleanQuery = this.cleanSearchQuery(query);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Scraping prices for: "${cleanQuery}"`);
    console.log(`📊 SerpAPI: ${this.serpApiKey ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log('='.repeat(60));

    const results = await this.scrapeGoogleShopping(cleanQuery);

    console.log(`\n✅ Total: ${results.length} results`);
    console.log('='.repeat(60) + '\n');
    
    return {
      query: cleanQuery,
      totalResults: results.length,
      results: results,
      timestamp: new Date().toISOString(),
      source: 'Google Shopping via SerpAPI'
    };
  }
}

module.exports = PriceScraper;
