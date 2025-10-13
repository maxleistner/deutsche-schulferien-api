const express = require('express');
const v1Router = require('./v1');
const v2Router = require('./v2');

const router = express.Router();

// Mount V1 routes (legacy API)
router.use('/api/v1', v1Router);

// Mount V2 routes (enhanced API)
router.use('/api/v2', v2Router);

module.exports = {
  v1: v1Router,
  v2: v2Router,
  combined: router
};