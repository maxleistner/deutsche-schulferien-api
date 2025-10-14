const mixpanel = require('mixpanel');

const TOKEN = process.env.MIXPANEL_TOKEN || '1584facf326d548bc26be8daf9aa6b3e';
let mp; // re-used across cold starts

// Debug logging
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

function log(message, data = null) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[MIXPANEL ${timestamp}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[MIXPANEL ${timestamp}] ${message}`);
    }
  }
}

function getMixpanel() {
  if (!mp) {
    log(`Initializing Mixpanel with token: ${TOKEN.substring(0, 8)}...${TOKEN.substring(TOKEN.length - 4)}`);
    try {
      mp = mixpanel.init(TOKEN, {
        protocol: 'https',          // required for Vercel
        keepAlive: false,           // essential for serverless
        geolocate: false,           // disable to avoid DNS lookups
        debug: DEBUG,               // enable debug only in development
        // Serverless optimizations
        host: 'api.mixpanel.com',   // explicit host
        path: '/track/'             // explicit path
      });
      log('Mixpanel client initialized successfully');
    } catch (error) {
      log('Failed to initialize Mixpanel client', { error: error.message });
      throw error;
    }
  }
  return mp;
}

function track(event, props = {}) {
  log(`Attempting to track event: ${event}`, props);
  
  // Always log in production for verification (minimal)
  if (!DEBUG) {
    console.log(`[MIXPANEL-PROD] Event: ${event} | Props: ${Object.keys(props).length}`);
  }
  
  // Return a promise to allow proper async handling in serverless
  return new Promise((resolve) => {
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      log(`⏰ Track timeout for: ${event}`);
      resolve(); // Resolve anyway to not block API
    }, 3000); // 3 second timeout
    
    try {
      const client = getMixpanel();
      const startTime = Date.now();
      
      client.track(event, props, (err) => {
        clearTimeout(timeout); // Cancel timeout since we got a response
        const duration = Date.now() - startTime;
        
        if (err) {
          const errorMsg = err.message || err.toString() || 'Unknown Mixpanel error';
          log(`❌ Track failed after ${duration}ms`, { event, error: errorMsg });
          // Don't log errors in production to reduce noise - they're not critical
        } else {
          log(`✅ Track successful after ${duration}ms`, { event, propsCount: Object.keys(props).length });
          // Minimal success log in production
          if (!DEBUG) {
            console.log(`[MIXPANEL-PROD] ✅ ${event} sent`);
          }
        }
        // Always resolve - don't let tracking errors break the API
        resolve();
      });
    } catch (e) {
      clearTimeout(timeout);
      log(`❌ Track exception`, { event, error: e.message });
      // Don't log exceptions in production - they're not critical
      resolve(); // Always resolve even on exception
    }
  });
}

function flush() {
  // Mixpanel Node.js library doesn't have a flush method
  // Events are sent immediately when track() is called
  log('✅ No flush needed - events sent immediately');
  return Promise.resolve();
}

module.exports = {
  getMixpanel,
  track,
  flush
};