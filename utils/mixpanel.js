const mixpanel = require('mixpanel');

const TOKEN = process.env.MIXPANEL_TOKEN || '1584facf326d548bc26be8daf9aa6b3e';
let mp; // re-used across cold starts

function getMixpanel() {
  if (!mp) {
    mp = mixpanel.init(TOKEN, {
      protocol: 'https',          // default
      keepAlive: false,           // safer for Vercel
      batchSize: 1,               // send immediately
      flushInterval: 0            // no buffering
    });
  }
  return mp;
}

function track(event, props = {}) {
  try {
    getMixpanel().track(event, props, (err) => {
      if (err) {
        console.error('Mixpanel track error:', err);
      }
    });
  } catch (e) {
    console.error('Mixpanel init/track failed:', e);
  }
}

function flush() {
  return new Promise((resolve) => {
    getMixpanel().flush((err) => {
      if (err) {
        console.error('Mixpanel flush error:', err);
      }
      resolve();
    });
  });
}

module.exports = {
  getMixpanel,
  track,
  flush
};