const express = require("express");
const bodyParser = require("body-parser");
const logger = require("morgan");
const cors = require("cors");
const path = require("path");
const https = require("https");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();

// Get port from command line args, environment, or default to 3000
const PORT = process.argv[2] || process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.set("port", PORT);
app.set("env", NODE_ENV);

app.use(cors());
app.use(logger("tiny"));
app.use(bodyParser.json());

// Mixpanel Analytics Setup
const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN;
const trackingEnabled = !!MIXPANEL_TOKEN;

// Function to send events to Mixpanel via HTTPS (Vercel serverless compatible)
function trackMixpanelEvent(eventName, properties) {
  if (!trackingEnabled) {
    console.log(`[MIXPANEL-HTTP] Tracking disabled - no token provided`);
    return;
  }
  
  console.log(`[MIXPANEL-HTTP] Event: ${eventName} | Props: ${Object.keys(properties).length}`);
  
  try {
    const data = {
      event: eventName,
      properties: {
        token: MIXPANEL_TOKEN,
        time: Math.floor(Date.now() / 1000),
        ...properties
      }
    };
    
    const dataString = Buffer.from(JSON.stringify(data)).toString('base64');
    const path = `/track/?data=${encodeURIComponent(dataString)}`;
    
    console.log(`[MIXPANEL-HTTP] Sending to: https://api.mixpanel.com${path.substring(0, 50)}...`);
    
    // Use Node.js HTTPS module for better Vercel compatibility
    const req = https.request({
      hostname: 'api.mixpanel.com',
      port: 443,
      path: path,
      method: 'GET',
      timeout: 5000,  // 5 second timeout
      headers: {
        'User-Agent': 'Schulferien-API/2.0'
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[MIXPANEL-HTTP] ✅ Event sent successfully: ${eventName}`);
      } else {
        console.log(`[MIXPANEL-HTTP] ❌ Event failed with status: ${res.statusCode}`);
      }
    });
    
    req.on('error', (error) => {
      console.log(`[MIXPANEL-HTTP] ❌ Network error:`, error.message);
    });
    
    req.on('timeout', () => {
      console.log(`[MIXPANEL-HTTP] ❌ Request timeout for: ${eventName}`);
      req.destroy();
    });
    
    req.end();
    
  } catch (error) {
    console.log(`[MIXPANEL-HTTP] ❌ Exception:`, error.message);
  }
}

// API Analytics Middleware
app.use((req, res, next) => {
  // Only track API endpoints
  if (req.path.startsWith('/api/') && trackingEnabled) {
    const pathParts = req.path.split('/');
    const apiVersion = pathParts[2]; // v1, v2, etc.
    const thirdPart = pathParts[3];
    const fourthPart = pathParts[4];
    
    // Determine endpoint type based on complete endpoint patterns
    let endpointType = 'unknown';
    let year = null;
    let state = null;
    
    // V1 Endpoints
    if (req.path.match(/^\/api\/v1\/\d{4}$/)) {
      endpointType = 'v1_year_all_states';
      year = thirdPart;
    } else if (req.path.match(/^\/api\/v1\/\d{4}\/[A-Z]{2}$/)) {
      endpointType = 'v1_year_state';
      year = thirdPart;
      state = fourthPart;
    }
    
    // V2 Named Endpoints
    else if (req.path === '/api/v2/current') {
      endpointType = 'v2_current_holidays';
    } else if (req.path.match(/^\/api\/v2\/next\/\d+$/)) {
      endpointType = 'v2_next_days';
    } else if (req.path.match(/^\/api\/v2\/date\/[\d-]+$/)) {
      endpointType = 'v2_date_lookup';
    } else if (req.path === '/api/v2/search') {
      endpointType = 'v2_search';
    } else if (req.path.match(/^\/api\/v2\/stats\/\d{4}$/)) {
      endpointType = 'v2_stats';
      year = thirdPart;
    } else if (req.path.match(/^\/api\/v2\/compare\/\d{4}\/\d{4}$/)) {
      endpointType = 'v2_compare';
    }
    
    // V2 Year Endpoints (must be last to avoid conflicts)
    else if (req.path.match(/^\/api\/v2\/\d{4}$/)) {
      endpointType = 'v2_year_filtered';
      year = thirdPart;
    } else if (req.path.match(/^\/api\/v2\/\d{4}\/[A-Z]{2}$/)) {
      endpointType = 'v2_year_state_filtered';
      year = thirdPart;
      state = fourthPart;
    }
    
    // System Endpoints
    else if (req.path === '/health') {
      endpointType = 'system_health';
    } else if (req.path === '/ready') {
      endpointType = 'system_ready';
    } else if (req.path === '/status') {
      endpointType = 'system_status';
    }
    
    // Prepare tracking data
    const trackingData = {
      distinct_id: req.ip || 'anonymous',
      endpoint: req.path,
      method: req.method,
      endpoint_type: endpointType,
      api_version: apiVersion || 'system',
      year: year || null,
      state: state ? state.toUpperCase() : null,
      has_query_params: Object.keys(req.query).length > 0,
      user_agent: req.get('User-Agent') || 'unknown',
      referer: req.get('Referer') || 'direct',
      country: req.headers['cf-ipcountry'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
    };
    
    // Add specific query params for interesting endpoints
    if (req.query.type) trackingData.vacation_type = req.query.type;
    if (req.query.states) trackingData.filter_states = req.query.states;
    if (req.query.q) trackingData.search_query = req.query.q;
    
    // Track the event using our HTTP function
    trackMixpanelEvent('API Request', trackingData);
  }
  
  next();
});

// Serve static files (serverless-safe)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, // Don't serve index.html automatically
  fallthrough: true
}));

// Import routers
const v1Router = require("./routes/v1/index.js");
const v2Router = require("./routes/v2/index.js");
const systemRouter = require("./routes/system");

// Setup Swagger documentation
let openApiSpec = null;

// Try to load OpenAPI spec from file first
try {
  const possiblePaths = [
    path.join(__dirname, 'docs', 'openapi.yaml'),
    path.join(__dirname, 'docs/openapi.yaml'),
    path.join(process.cwd(), 'docs', 'openapi.yaml'),
    path.join(process.cwd(), 'docs/openapi.yaml')
  ];
  
  for (const docsPath of possiblePaths) {
    if (fs.existsSync(docsPath)) {
      try {
        openApiSpec = yaml.load(fs.readFileSync(docsPath, 'utf8'));
        console.log(`✅ OpenAPI spec loaded from ${docsPath}`);
        break;
      } catch (readError) {
        console.warn(`Failed to read ${docsPath}:`, readError.message);
      }
    }
  }
  
  if (!openApiSpec) {
    console.warn('⚠️  OpenAPI file not found, using complete fallback spec');
    // Load the complete OpenAPI specification from our module
    openApiSpec = require('./lib/openapi-spec');
  }
  
  // Setup Swagger UI with the spec (either from file or fallback)
  // Use CDN-hosted assets for better compatibility with serverless environments
  const swaggerOptions = {
    customCssUrl: 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css',
    customJs: [
      'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js',
      'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js'
    ],
    swaggerOptions: {
      url: null,
      spec: openApiSpec
    }
  };
  
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerOptions));
  console.log('✅ Swagger documentation setup completed');
  
} catch (error) {
  console.warn('❌ Could not setup Swagger documentation:', error.message);
  
  // Final fallback - simple documentation page
  app.get('/docs', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Documentation | Deutsche Schulferien API</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #000; padding-bottom: 1rem; }
            .endpoint { background: #f5f5f5; padding: 1rem; margin: 1rem 0; border-left: 4px solid #000; }
            .method { font-weight: bold; color: #0066cc; }
            .path { font-family: monospace; background: #e8e8e8; padding: 0.2rem 0.5rem; }
            .description { color: #666; margin-top: 0.5rem; }
            .example { background: #fff; border: 1px solid #ddd; padding: 0.5rem; margin-top: 0.5rem; font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>Deutsche Schulferien API Documentation</h1>
        <p>Willkommen zur API Dokumentation für deutsche Schulferien.</p>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/v1/{year}</div>
            <div class="description">Alle Ferien für ein bestimmtes Jahr abrufen</div>
            <div class="example">Beispiel: <a href="/api/v1/2024">/api/v1/2024</a></div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/v1/{year}/{state}</div>
            <div class="description">Ferien für ein Jahr und Bundesland abrufen</div>
            <div class="example">Beispiel: <a href="/api/v1/2024/BY">/api/v1/2024/BY</a></div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/v2/{year}?type={type}&states={states}</div>
            <div class="description">Erweiterte Filterung nach Ferientyp und Bundesländern</div>
            <div class="example">Beispiel: <a href="/api/v2/2024?type=sommerferien&states=BY,BW">/api/v2/2024?type=sommerferien&states=BY,BW</a></div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/v2/current</div>
            <div class="description">Aktuelle Ferien abrufen</div>
            <div class="example">Beispiel: <a href="/api/v2/current">/api/v2/current</a></div>
        </div>
        
        <p><a href="/">← Zurück zur Startseite</a></p>
    </body>
    </html>
    `);
  });
}

// Mount specific routes first (before catch-all)
app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
app.use("/", systemRouter);

// Serve index page explicitly (serverless-safe)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  try {
    // Try to read and serve the actual index.html content
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(indexContent);
  } catch (error) {
    console.warn('Could not read index.html, using fallback:', error.message);
    // Fallback to inline HTML if index.html is not accessible
    res.send(getDefaultHomePage());
  }
});

// Default home page function
function getDefaultHomePage() {
  return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Deutsche Schulferien API</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico">
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                padding: 2rem; 
                max-width: 900px; 
                margin: 0 auto;
                line-height: 1.6;
                background: #f8f9fa;
            }
            .header { 
                text-align: center; 
                background: white; 
                padding: 2rem; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 2rem;
            }
            h1 { 
                color: #333; 
                margin-bottom: 0.5rem;
                font-size: 2.5rem;
            }
            .subtitle {
                color: #666;
                font-size: 1.2rem;
                margin-bottom: 2rem;
            }
            .endpoints {
                display: grid;
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .endpoint { 
                background: white; 
                padding: 1.5rem; 
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                border-left: 4px solid #007acc;
            }
            .method { 
                font-weight: bold; 
                color: #007acc; 
                font-size: 0.9rem;
                text-transform: uppercase;
            }
            .path { 
                font-family: 'Monaco', 'Menlo', monospace; 
                background: #f1f3f4; 
                padding: 0.3rem 0.6rem;
                border-radius: 4px;
                margin: 0.5rem 0;
                display: inline-block;
            }
            .description { 
                color: #555; 
                margin: 0.5rem 0;
            }
            .example a { 
                color: #007acc; 
                text-decoration: none;
                font-family: monospace;
            }
            .example a:hover { 
                text-decoration: underline;
            }
            .footer {
                text-align: center;
                padding: 2rem;
                color: #666;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .analytics-info {
                background: #e3f2fd;
                padding: 1rem;
                border-radius: 6px;
                border-left: 4px solid #2196f3;
                margin: 1rem 0;
                font-size: 0.9rem;
                color: #1565c0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🏫 Deutsche Schulferien API</h1>
            <div class="subtitle">Comprehensive German School Holiday API</div>
            <div class="analytics-info">
                📊 This API includes comprehensive analytics tracking via Mixpanel
            </div>
        </div>
        
        <div class="endpoints">
            <div class="endpoint">
                <div class="method">GET</div>
                <div class="path">/api/v1/{year}</div>
                <div class="description">Get all school holidays for a specific year</div>
                <div class="example">Example: <a href="/api/v1/2024">/api/v1/2024</a></div>
            </div>
            
            <div class="endpoint">
                <div class="method">GET</div>
                <div class="path">/api/v1/{year}/{state}</div>
                <div class="description">Get holidays for a specific year and German state</div>
                <div class="example">Example: <a href="/api/v1/2024/BY">/api/v1/2024/BY</a> (Bavaria)</div>
            </div>
            
            <div class="endpoint">
                <div class="method">GET</div>
                <div class="path">/api/v2/current</div>
                <div class="description">Get currently active school holidays</div>
                <div class="example">Example: <a href="/api/v2/current">/api/v2/current</a></div>
            </div>
            
            <div class="endpoint">
                <div class="method">GET</div>
                <div class="path">/api/v2/{year}?type={type}&states={states}</div>
                <div class="description">Advanced filtering by holiday type and states</div>
                <div class="example">Example: <a href="/api/v2/2024?type=sommerferien&states=BY,BW">/api/v2/2024?type=sommerferien&states=BY,BW</a></div>
            </div>
            
            <div class="endpoint">
                <div class="method">GET</div>
                <div class="path">/docs</div>
                <div class="description">Complete API documentation</div>
                <div class="example">Example: <a href="/docs">/docs</a></div>
            </div>
        </div>
        
        <div class="footer">
            <p>🚀 <strong>Optimized for Vercel Serverless</strong> | 📊 <strong>Analytics Enabled</strong></p>
            <p>Built with ❤️ for German education system</p>
        </div>
    </body>
    </html>
  `;
}

// Mount specific routes first (before catch-all)
app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
app.use("/", systemRouter);

app.use((req, res, next) => {
  // Enhanced 404 handler with helpful information
  res.status(404);
  
  // Check if it's an API request (starts with /api)
  if (req.path.startsWith('/api')) {
    res.json({
      error: {
        message: `API endpoint ${req.method} ${req.url} not found`,
        statusCode: 404,
        documentation: {
          swagger: '/docs',
          v1_examples: [
            '/api/v1/2024',
            '/api/v1/2024/BY'
          ],
          v2_examples: [
            '/api/v2/2024?type=sommerferien',
            '/api/v2/current',
            '/api/v2/search?q=sommer',
            '/api/v2/date/2024-07-25'
          ]
        },
        system_endpoints: {
          health: '/health',
          status: '/status',
          ready: '/ready'
        }
      }
    });
  } else {
    // For non-API requests, send HTML 404 page
    res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Seite nicht gefunden | Deutsche Schulferien API</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #fff;
                color: #000;
                text-align: center;
                padding: 2rem;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1.6;
            }
            .container {
                max-width: 600px;
                border: 1px solid #000;
                padding: 4rem 2rem;
                position: relative;
                background: #fff;
            }
            .container::before {
                content: '';
                position: absolute;
                top: -1px;
                left: -1px;
                right: -1px;
                bottom: -1px;
                background: #000;
                z-index: -1;
                transform: translate(8px, 8px);
            }
            h1 { 
                font-size: 4rem; 
                margin-bottom: 1rem; 
                font-weight: 300;
                letter-spacing: -2px;
            }
            h2 { 
                font-size: 1.5rem; 
                margin-bottom: 2rem; 
                font-weight: 300;
            }
            p {
                margin-bottom: 3rem;
                color: #666;
            }
            .links {
                display: grid;
                gap: 1rem;
                margin-top: 2rem;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
            }
            .btn {
                display: inline-block;
                padding: 1rem 2rem;
                background: #fff;
                color: #000;
                text-decoration: none;
                font-weight: 400;
                transition: all 0.2s ease;
                border: 1px solid #000;
            }
            .btn:hover {
                background: #000;
                color: #fff;
            }
            .btn-primary {
                background: #000;
                color: #fff;
            }
            .btn-primary:hover {
                background: #fff;
                color: #000;
            }
            .note {
                margin-top: 3rem;
                font-size: 0.9rem;
                color: #666;
                border-top: 1px solid #eee;
                padding-top: 2rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>404</h1>
            <h2>Seite nicht gefunden</h2>
            <p>Die angeforderte Seite existiert nicht, aber wir können Ihnen helfen!</p>
            
            <div class="links">
                <a href="/" class="btn btn-primary">Startseite</a>
                <a href="/docs" class="btn">API Dokumentation</a>
                <a href="/api/v2/2024?states=BY" class="btn">API Beispiel testen</a>
                <a href="/health" class="btn">API Status</a>
            </div>
            
            <div class="note">
                Besuchen Sie <strong>/docs</strong> für die vollständige API-Dokumentation
            </div>
        </div>
    </body>
    </html>
    `);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  
  if (req.path.startsWith('/api')) {
    res.json({
      error: {
        message: err.message,
        statusCode: err.status || 500,
        documentation: '/docs',
        support: {
          github: 'https://github.com/maxleistner/schulferien-api',
          website: 'https://maxleistner.de'
        }
      },
    });
  } else {
    res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <title>Fehler | Deutsche Schulferien API</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #fff; color: #000; text-align: center; padding: 2rem;
                min-height: 100vh; display: flex; align-items: center; justify-content: center;
            }
            .container {
                max-width: 500px; border: 1px solid #000; padding: 3rem 2rem;
                position: relative; background: #fff;
            }
            .container::before {
                content: ''; position: absolute; top: -1px; left: -1px;
                right: -1px; bottom: -1px; background: #000; z-index: -1;
                transform: translate(6px, 6px);
            }
            h1 { font-size: 2rem; margin-bottom: 2rem; font-weight: 300; }
            p { margin-bottom: 2rem; color: #666; }
            a {
                display: inline-block; padding: 1rem 2rem; background: #000;
                color: #fff; text-decoration: none; border: 1px solid #000;
                transition: all 0.2s ease;
            }
            a:hover { background: #fff; color: #000; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Ein Fehler ist aufgetreten</h1>
            <p>${err.message}</p>
            <a href="/">Zurück zur Startseite</a>
        </div>
    </body>
    </html>
    `);
  }
});

// Export app for Vercel
module.exports = app;

// Only listen when not running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      `Express Server started on Port ${app.get(
        "port"
      )} | Environment : ${app.get("env")}`
    );
  });
}
