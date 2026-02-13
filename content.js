// ShopWise Collective - Content Script
console.log('🛒 ShopWise Collective loaded!');

// Simple price extractor for Amazon
function getAmazonPrice() {
  const priceSelectors = [
    '.a-price-whole',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen'
  ];
  
  for (let selector of priceSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent || element.getAttribute('content') || '';
      const price = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (!isNaN(price)) return price;
    }
  }
  return null;
}

// Get product ASIN (Amazon's unique ID)
function getASIN() {
  const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
  if (urlMatch) return urlMatch[1];
  
  const inputEl = document.querySelector('input[name="ASIN"]');
  return inputEl ? inputEl.value : null;
}

// Get product title
function getProductTitle() {
  const titleEl = document.querySelector('#productTitle');
  return titleEl ? titleEl.textContent.trim() : 'Unknown Product';
}

// Save product data
async function saveProduct() {
  const asin = getASIN();
  const price = getAmazonPrice();
  const title = getProductTitle();
  
  if (!asin || !price) {
    console.log('Could not detect product or price');
    return;
  }
  
  const product = {
    asin,
    price,
    title,
    url: window.location.href.split('?')[0],
    timestamp: Date.now(),
    date: new Date().toISOString()
  };
  
  // Get existing data
  chrome.storage.local.get(['products'], (result) => {
    const products = result.products || {};
    
    // Initialize product history if new
    if (!products[asin]) {
      products[asin] = {
        title,
        url: product.url,
        history: []
      };
    }
    
    // Add price to history
    products[asin].history.push({
      price,
      timestamp: product.timestamp,
      date: product.date
    });
    
    // Keep only last 30 entries
    if (products[asin].history.length > 30) {
      products[asin].history = products[asin].history.slice(-30);
    }
    
    // Save back to storage
    chrome.storage.local.set({ products }, () => {
      console.log('✅ Product saved:', product);
      showWidget(products[asin]);
    });
  });
}

// Show price widget
function showWidget(productData) {
  // Remove existing widget
  const existing = document.getElementById('shopwise-widget');
  if (existing) existing.remove();
  
  // Analyze price history
  const history = productData.history || [];
  let analysis = '📊 Tracking started';
  let color = '#4299e1';
  
  if (history.length >= 2) {
    const current = history[history.length - 1].price;
    const previous = history[history.length - 2].price;
    const diff = current - previous;
    const percent = ((diff / previous) * 100).toFixed(1);
    
    if (diff < 0) {
      analysis = `📉 Price dropped $${Math.abs(diff).toFixed(2)} (${Math.abs(percent)}%)`;
      color = '#48bb78';
    } else if (diff > 0) {
      analysis = `📈 Price increased $${diff.toFixed(2)} (${percent}%)`;
      color = '#f56565';
    } else {
      analysis = `✅ Price stable at $${current.toFixed(2)}`;
      color = '#4299e1';
    }
  }
  
  // Get lowest price
  const prices = history.map(h => h.price);
  const lowest = prices.length > 0 ? Math.min(...prices) : history[history.length - 1].price;
  const highest = prices.length > 0 ? Math.max(...prices) : history[history.length - 1].price;
  const current = history[history.length - 1].price;
  
  // Create widget
  const widget = document.createElement('div');
  widget.id = 'shopwise-widget';
  widget.innerHTML = `
    <div class="sw-header">
      <span>🛒 ShopWise</span>
      <button class="sw-close">×</button>
    </div>
    <div class="sw-body">
      <div class="sw-current">
        <div class="sw-label">Current Price</div>
        <div class="sw-price">$${current.toFixed(2)}</div>
      </div>
      
      <div class="sw-analysis" style="background: ${color}22; border-left: 3px solid ${color};">
        ${analysis}
      </div>
      
      <div class="sw-stats">
        <div class="sw-stat">
          <span>Lowest Seen:</span>
          <strong>$${lowest.toFixed(2)}</strong>
        </div>
        <div class="sw-stat">
          <span>Highest Seen:</span>
          <strong>$${highest.toFixed(2)}</strong>
        </div>
        <div class="sw-stat">
          <span>Tracking For:</span>
          <strong>${history.length} day${history.length !== 1 ? 's' : ''}</strong>
        </div>
      </div>
      
      <button class="sw-btn">📈 View Full History</button>
    </div>
  `;
  
  document.body.appendChild(widget);
  
  // Event listeners
  widget.querySelector('.sw-close').addEventListener('click', () => {
    widget.remove();
  });
  
  widget.querySelector('.sw-btn').addEventListener('click', () => {
    let msg = '📊 PRICE HISTORY\n\n';
    history.slice().reverse().forEach(h => {
      const date = new Date(h.timestamp).toLocaleDateString();
      msg += `${date}: $${h.price.toFixed(2)}\n`;
    });
    alert(msg);
  });
}

// Initialize
function init() {
  // Only run on product pages
  if (!window.location.href.includes('/dp/')) {
    console.log('Not a product page');
    return;
  }
  
  // Wait for page to be ready
  if (document.readyState !== 'complete') {
    window.addEventListener('load', init);
    return;
  }
  
  console.log('Initializing ShopWise...');
  
  // Small delay to ensure price is loaded
  setTimeout(saveProduct, 1500);
}

// Run
init();
