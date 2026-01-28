// Configuration pour le backend
module.exports = {
  // Port du serveur
  PORT: process.env.PORT || 3000,
  
  // Environnement
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // CORS - Autoriser l'extension Chrome
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Cache - Durée de vie en secondes
  CACHE_TTL: 3600, // 1 heure
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 60,
  
  // Timeout pour les requêtes de scraping (ms)
  SCRAPING_TIMEOUT: 10000,
  
  // User agents pour éviter les blocages
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ],
  
  // Sites supportés avec leurs configurations
  SUPPORTED_SITES: {
    amazon: {
      domain: 'amazon.fr',
      searchUrl: 'https://www.amazon.fr/s?k=',
      enabled: true
    },
    fnac: {
      domain: 'fnac.com',
      searchUrl: 'https://www.fnac.com/SearchResult/ResultList.aspx?Search=',
      enabled: true
    },
    darty: {
      domain: 'darty.com',
      searchUrl: 'https://www.darty.com/nav/recherche/index.html?s=',
      enabled: true
    },
    boulanger: {
      domain: 'boulanger.com',
      searchUrl: 'https://www.boulanger.com/recherche?q=',
      enabled: true
    },
    cdiscount: {
      domain: 'cdiscount.com',
      searchUrl: 'https://www.cdiscount.com/search/10/',
      enabled: true
    },
    rueducommerce: {
      domain: 'rueducommerce.fr',
      searchUrl: 'https://www.rueducommerce.fr/recherche/',
      enabled: true
    },
    materielnet: {
      domain: 'materiel.net',
      searchUrl: 'https://www.materiel.net/recherche/',
      enabled: true
    },
    ldlc: {
      domain: 'ldlc.com',
      searchUrl: 'https://www.ldlc.com/fr-fr/recherche/',
      enabled: true
    }
  }
};
