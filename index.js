const express = require("express");
const bodyParser = require("body-parser");
const logger = require("morgan");
const cors = require("cors");
const path = require("path");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.set("port", PORT);
app.set("env", NODE_ENV);

app.use(cors());
app.use(logger("tiny"));
app.use(bodyParser.json());

// Vercel Analytics - Track API usage (optional, safe fallback)
try {
  if (process.env.VERCEL) {
    console.log('✓ Running on Vercel, initializing analytics...');
    const { track } = require('@vercel/analytics/server');
    console.log('✓ Analytics package imported successfully');
    
    app.use((req, res, next) => {
      try {
        const path = req.path.toLowerCase();
        console.log(`🔍 Checking path: ${path}`);
        
        // Track API endpoint hits with detailed metrics
        if (path.startsWith('/api/')) {
          console.log(`🎯 API endpoint detected: ${path}`);
          
          // Extract year and state from API paths
          const v1Match = path.match(/\/api\/v1\/(\d{4})(?:\/([a-z]{2}))?/);
          const v2Match = path.match(/\/api\/v2\/(\d{4})(?:\/([a-z]{2}))?/) || 
                         path.match(/\/api\/v2\/(current|search|stats|compare|date|next)/);
          
          console.log(`V1 Match: ${v1Match ? 'Yes' : 'No'}, V2 Match: ${v2Match ? 'Yes' : 'No'}`);
          
          let trackingData = {
            method: req.method,
            endpoint: req.path,
            userAgent: req.get('User-Agent') || 'unknown',
            referer: req.get('Referer') || 'direct'
          };
          
          if (v1Match) {
            trackingData = {
              ...trackingData,
              version: 'v1',
              year: v1Match[1],
              state: v1Match[2] ? v1Match[2].toUpperCase() : 'ALL'
            };
          } else if (v2Match) {
            trackingData = {
              ...trackingData,
              version: 'v2',
              endpoint_type: v2Match[1] || 'year_query'
            };
            
            // Add query parameters for v2
            if (req.query.type) trackingData.vacation_type = req.query.type;
            if (req.query.states) trackingData.states = req.query.states;
            if (req.query.year) trackingData.year = req.query.year;
          }
          
          console.log(`📈 Tracking data:`, JSON.stringify(trackingData, null, 2));
          
          // Track the event (async, non-blocking)
          track('api_request', trackingData)
            .then(() => {
              console.log('✅ Analytics tracking successful');
            })
            .catch(err => {
              console.error('❌ Analytics tracking failed:', err.message);
              console.error('Full error:', err);
            });
        } else {
          console.log(`⏭️ Skipping non-API path: ${path}`);
        }
      } catch (analyticsError) {
        console.error('❌ Analytics middleware error:', analyticsError.message);
        console.error('Full error:', analyticsError);
      }
      
      next();
    });
  } else {
    console.log('⚠️ Not running on Vercel, analytics disabled');
  }
} catch (analyticsInitError) {
  console.error('❌ Analytics initialization failed:', analyticsInitError.message);
  console.error('Full error:', analyticsInitError);
  console.log('Continuing without analytics...');
}

// Serve static files
app.use(express.static('public'));

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

// Serve index page explicitly
app.get('/', (req, res) => {
  try {
    // Always serve the HTML file (both locally and on Vercel)
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to serve homepage'
    });
  }
});

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
