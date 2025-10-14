const mixpanel = require('mixpanel');

const TOKEN = process.env.MIXPANEL_TOKEN || '1584facf326d548bc26be8daf9aa6b3e';
let mp; // re-used across cold starts

// Debug logging
const DEBUG = process.env.NODE_ENV !== 'production';

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
        protocol: 'https',          // default
        keepAlive: false,           // safer for Vercel
        batchSize: 1,               // send immediately
        flushInterval: 0,           // no buffering
        debug: DEBUG                // Enable Mixpanel's own debug logging
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
  try {
    const client = getMixpanel();
    const startTime = Date.now();
    
    client.track(event, props, (err) => {
      const duration = Date.now() - startTime;
      if (err) {
        log(`❌ Track failed after ${duration}ms`, { event, error: err.message, props });
      } else {
        log(`✅ Track successful after ${duration}ms`, { event, propsCount: Object.keys(props).length });
      }
    });
  } catch (e) {
    log(`❌ Track exception`, { event, error: e.message, props });
  }
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