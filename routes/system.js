const express = require('express');
const dataLoader = require('../lib/dataLoader');

const router = express.Router();

// Store server start time
const startTime = Date.now();

// GET /health - Basic health check
router.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  res.json({
    status: 'ok',
    uptime: uptime,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0'
  });
});

// GET /ready - Readiness check for load balancers
router.get('/ready', (req, res) => {
  try {
    // Check if data loader is healthy
    const isHealthy = dataLoader.isHealthy();
    const availableYears = dataLoader.getAvailableYears();
    
    if (!isHealthy || availableYears.length === 0) {
      return res.status(503).json({
        status: 'not ready',
        error: 'Data not available',
        availableYears: availableYears.length
      });
    }
    
    res.json({
      status: 'ready',
      availableYears: availableYears,
      cacheStatus: 'warm'
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});

// GET /status - Comprehensive status page
router.get('/status', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  try {
    const isHealthy = dataLoader.isHealthy();
    const availableYears = dataLoader.getAvailableYears();
    
    const status = {
      service: 'German School Holidays API',
      version: process.env.npm_package_version || '2.0.0',
      status: isHealthy ? 'operational' : 'degraded',
      uptime: uptime,
      timestamp: new Date().toISOString(),
      endpoints: {
        v1: {
          status: 'operational',
          description: 'Legacy API endpoints'
        },
        v2: {
          status: isHealthy ? 'operational' : 'degraded',
          description: 'Enhanced API endpoints with advanced filtering'
        }
      },
      data: {
        availableYears: availableYears,
        totalYears: availableYears.length,
        yearRange: availableYears.length > 0 ? 
          `${Math.min(...availableYears)} - ${Math.max(...availableYears)}` : 'None',
        cacheStatus: 'enabled'
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      service: 'German School Holidays API',
      version: process.env.npm_package_version || '2.0.0',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;