// Script de test pour le scraper
const PriceScraper = require('./scraper');

async function testScraper() {
  const scraper = new PriceScraper();
  
  console.log('🧪 Testing PriceWatch Scraper...\n');
  
  // Test queries
  const testQueries = [
    'iPhone 15 Pro',
    'MacBook Air M2',
    'PlayStation 5',
    'AirPods Pro'
  ];
  
  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${query}`);
    console.log('='.repeat(60));
    
    try {
      const results = await scraper.scrapeAll(query);
      
      console.log(`\n✅ Found ${results.totalResults} results\n`);
      
      if (results.results.length > 0) {
        console.log('Top 5 results:');
        results.results.slice(0, 5).forEach((result, index) => {
          console.log(`\n${index + 1}. ${result.site}`);
          console.log(`   ${result.title.substring(0, 60)}...`);
          console.log(`   💰 ${result.price.toFixed(2)}€`);
          console.log(`   🔗 ${result.url.substring(0, 80)}...`);
        });
      } else {
        console.log('⚠️  No results found');
      }
      
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
    
    // Pause entre les tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing complete!');
  console.log('='.repeat(60) + '\n');
}

// Run test
if (require.main === module) {
  testScraper()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testScraper;
