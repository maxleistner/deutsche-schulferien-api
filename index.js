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

// Favicon route - serve embedded favicon content
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  // Use the SVG emoji favicon from your HTML
  const svgFavicon = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏫</text></svg>`;
  res.send(Buffer.from(svgFavicon, 'utf8'));
});

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
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getFancyHomePage());
});

// Fancy home page function - embedded HTML content (from public/index.html)
function getFancyHomePage() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deutsche Schulferien API</title>
    <meta name="description" content="Kostenlose API für deutsche Schulferien - alle Bundesländer, Jahre 2022-2027, mit erweiterten Filtermöglichkeiten">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏫</text></svg>">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #222;
            background: #fff;
            min-height: 100vh;
            font-weight: 400;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            overflow-x: hidden;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem 0 1.5rem 0;
            border-bottom: 1px solid #000;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 0.8rem;
            font-weight: 400;
            letter-spacing: -1px;
        }
        
        .header p {
            font-size: 1.1rem;
            color: #555;
            font-weight: 400;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .section {
            margin-bottom: 3rem;
            padding: 1.5rem 0;
        }
        
        .section:not(:last-child) {
            border-bottom: 1px solid #ddd;
        }
        
        .section-title {
            font-size: 1.8rem;
            font-weight: 500;
            margin-bottom: 1.5rem;
            text-align: center;
            letter-spacing: -0.5px;
            color: #111;
        }
        
        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 3rem;
            margin: 3rem 0;
        }
        
        .api-version {
            border: 1px solid #ccc;
            padding: 2.5rem;
            position: relative;
            background: #fff;
        }
        
        .api-version::before {
            content: '';
            position: absolute;
            top: -1px;
            left: -1px;
            right: -1px;
            bottom: -1px;
            background: #f5f5f5;
            z-index: -1;
            transform: translate(8px, 8px);
        }
        
        .version-badge {
            display: inline-block;
            padding: 0.4rem 1rem;
            border: 1px solid #000;
            font-size: 0.8rem;
            font-weight: 500;
            text-transform: uppercase;
            margin-bottom: 1.5rem;
            background: #fff;
            letter-spacing: 1px;
        }
        
        .api-version h3 {
            font-size: 1.4rem;
            font-weight: 600;
            margin-bottom: 1rem;
            letter-spacing: -0.5px;
            color: #111;
        }
        
        .api-version p {
            margin-bottom: 1.5rem;
            color: #555;
            font-weight: 400;
            line-height: 1.5;
        }
        
        .feature-list {
            list-style: none;
            margin: 1.5rem 0;
        }
        
        .feature-list li {
            padding: 0.6rem 0;
            position: relative;
            padding-left: 1.5rem;
            border-bottom: 1px solid #f0f0f0;
            font-weight: 400;
            color: #444;
        }
        
        .feature-list li:last-child {
            border-bottom: none;
        }
        
        .feature-list li:before {
            content: '—';
            position: absolute;
            left: 0;
            font-weight: 600;
            color: #666;
        }
        
        .endpoint {
            background: #f5f5f5;
            color: #333;
            padding: 1rem 1.5rem;
            margin: 1rem 0;
            font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
            border: 1px solid #ccc;
            font-size: 0.9rem;
            line-height: 1.4;
            overflow-x: auto;
            font-weight: 500;
            border-radius: 4px;
        }
        
        .example {
            background: #f8f8f8;
            color: #222;
            padding: 1rem 1.5rem;
            margin: 1rem 0;
            font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
            overflow-x: auto;
            border: 1px solid #ddd;
            font-weight: 500;
            border-radius: 4px;
        }
        
        .cta-section {
            text-align: center;
            padding: 3rem 2rem;
            border: 1px solid #000;
            position: relative;
            background: #fff;
        }
        
        .cta-section::before {
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
        
        .btn {
            display: inline-block;
            padding: 1rem 2.5rem;
            margin: 0.5rem;
            border: 1px solid #000;
            text-decoration: none;
            font-weight: 400;
            transition: all 0.2s ease;
            background: #fff;
            color: #000;
            position: relative;
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
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }
        
        .stat {
            text-align: center;
            padding: 1.5rem 1rem;
            border: 1px solid #ccc;
        }
        
        .stat-number {
            font-size: 2.2rem;
            font-weight: 600;
            color: #111;
            margin-bottom: 0.3rem;
        }
        
        .stat-label {
            font-size: 0.8rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 500;
        }
        
        .grid-2 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
            margin: 2rem 0;
        }
        
        .grid-item {
            padding: 1rem 0;
            position: relative;
        }
        
        
        .grid-item h4 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.8rem;
            border-bottom: 1px solid #ddd;
            padding-bottom: 0.5rem;
            color: #222;
        }
        
        .grid-item p {
            color: #555;
            font-weight: 400;
            line-height: 1.5;
        }
        
        .examples-list {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .example-item {
            padding: 1rem 0;
            border-bottom: 1px solid #eee;
            font-size: 1rem;
            line-height: 1.5;
        }
        
        .example-item:last-child {
            border-bottom: none;
        }
        
        .example-item strong {
            color: #222;
            font-weight: 600;
        }
        
        .example-item code {
            background: #f5f5f5;
            color: #333;
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
            font-size: 0.9rem;
            margin-left: 0.5rem;
        }
        
        .footer {
            text-align: center;
            margin-top: 3rem;
            padding: 2rem 0;
            border-top: 1px solid #000;
            color: #555;
        }
        
        .footer p {
            font-weight: 400;
            margin-bottom: 0.5rem;
        }
        
        .footer a {
            color: #222;
            text-decoration: none;
            border-bottom: 1px solid #222;
            font-weight: 500;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2.2rem;
            }
            
            .container {
                padding: 1rem;
            }
            
            .api-grid {
                grid-template-columns: 1fr;
                gap: 2rem;
            }
            
            .api-version::before {
                transform: translate(4px, 4px);
            }
            
            .cta-section::before {
                transform: translate(4px, 4px);
            }
            
            .example {
                margin: 1rem 0;
                padding: 1rem;
            }
            
            .endpoint {
                margin: 1rem 0;
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Deutsche Schulferien API</h1>
            <p>Kostenlose API für alle deutschen Schulferien — einfach, schnell und zuverlässig</p>
        </div>

        <div class="cta-section">
            <h2 class="section-title">Jetzt loslegen</h2>
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">16</div>
                    <div class="stat-label">Bundesländer</div>
                </div>
                <div class="stat">
                    <div class="stat-number">6</div>
                    <div class="stat-label">Jahre verfügbar</div>
                </div>
                <div class="stat">
                    <div class="stat-number">100%</div>
                    <div class="stat-label">Kostenlos</div>
                </div>
                <div class="stat">
                    <div class="stat-number">24/7</div>
                    <div class="stat-label">Verfügbar</div>
                </div>
            </div>
            <a href="/docs" class="btn btn-primary">API Dokumentation</a>
            <a href="/api/v2/2024?states=BY" class="btn">Beispiel testen</a>
        </div>

        <div class="section">
            <div class="api-grid">
                <div class="api-version">
                    <span class="version-badge">V1 - BEWÄHRT</span>
                    <h3>Klassische API</h3>
                    <p>Die ursprüngliche, bewährte API für alle, die bereits bestehende Integrationen haben.</p>
                    
                    <ul class="feature-list">
                        <li>Einfache Abfragen nach Jahr</li>
                        <li>Filterung nach Bundesland</li>
                        <li>100% Abwärtskompatibilität</li>
                        <li>Bewährt und stabil</li>
                    </ul>

                    <div class="endpoint">GET /api/v1/2024/
GET /api/v1/2024/BY</div>
                </div>

                <div class="api-version">
                    <span class="version-badge">V2 - ERWEITERT</span>
                    <h3>Erweiterte API</h3>
                    <p>Die neue Generation mit mächtigen Filtermöglichkeiten und zusätzlichen Features.</p>
                    
                    <ul class="feature-list">
                        <li>Erweiterte Filterung (Datum, Typ, Bundesländer)</li>
                        <li>Aktuelle und kommende Ferien</li>
                        <li>Suche und Statistiken</li>
                        <li>Datumsabfragen</li>
                        <li>Jahresvergleiche</li>
                        <li>Flexible Feldauswahl</li>
                    </ul>

                    <div class="endpoint">GET /api/v2/2024?type=sommerferien&states=BY,BW
GET /api/v2/current
GET /api/v2/search?q=sommer</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Praktische Beispiele</h2>
            <p style="text-align: center; margin-bottom: 2rem; color: #555; font-weight: 400;">Hier sind einige häufig verwendete Abfragen:</p>

            <div class="examples-list">
                <div class="example-item">
                    <strong>Aktuelle Ferien abrufen:</strong> <code>GET /api/v2/current</code>
                </div>
                <div class="example-item">
                    <strong>Sommerferien für Bayern und Baden-Württemberg:</strong> <code>GET /api/v2/2024?type=sommerferien&states=BY,BW</code>
                </div>
                <div class="example-item">
                    <strong>Ist heute ein Ferientag?</strong> <code>GET /api/v2/date/2024-07-25</code>
                </div>
                <div class="example-item">
                    <strong>Suche nach allen Osterferien:</strong> <code>GET /api/v2/search?q=oster</code>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Verfügbare Daten</h2>
            <div class="grid-2">
                <div class="grid-item">
                    <h4>Jahre</h4>
                    <p>2022, 2023, 2024, 2025, 2026, 2027</p>
                </div>
                <div class="grid-item">
                    <h4>Bundesländer</h4>
                    <p>Alle 16 deutschen Bundesländer (BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH)</p>
                </div>
                <div class="grid-item">
                    <h4>Ferientypen</h4>
                    <p>Winter-, Oster-, Pfingst-, Sommer-, Herbst-, Weihnachtsferien</p>
                </div>
                <div class="grid-item">
                    <h4>System</h4>
                    <p>Gesundheitschecks, Status, Überwachung</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Warum diese API?</h2>
            <div class="grid-2">
                <div class="grid-item">
                    <h4>Kostenlos</h4>
                    <p>Komplett kostenlos, ohne API-Keys oder Registrierung</p>
                </div>
                <div class="grid-item">
                    <h4>Schnell</h4>
                    <p>Optimiert für niedrige Latenz mit In-Memory-Caching</p>
                </div>
                <div class="grid-item">
                    <h4>Zuverlässig</h4>
                    <p>99.9% Verfügbarkeit mit umfassenden Tests</p>
                </div>
                <div class="grid-item">
                    <h4>Dokumentiert</h4>
                    <p>Vollständige interaktive API-Dokumentation</p>
                </div>
            </div>
        </div>

        <div class="cta-section">
            <h2 class="section-title">Ressourcen</h2>
            <p style="margin-bottom: 2rem; color: #555; font-weight: 400;">Alles, was Sie für den Einstieg benötigen:</p>
            <a href="/docs" class="btn btn-primary">Swagger UI — Interaktive Dokumentation</a>
            <a href="/health" class="btn">API Gesundheitsstatus</a>
            <a href="/status" class="btn">Detaillierter Systemstatus</a>
            <a href="https://github.com/maxleistner/schulferien-api" class="btn">GitHub Repository</a>
        </div>

        <div class="footer">
            <p>Made with care for the German developer community</p>
            <p>© 2024 Maximilian Leistner • <a href="https://maxleistner.de">maxleistner.de</a></p>
        </div>
    </div>
</body>
</html>`;
}

// 404 handler
app.use((req, res, next) => {
  res.status(404);
  
  if (req.path.startsWith('/api')) {
    res.json({
      error: {
        message: `API endpoint ${req.method} ${req.url} not found`,
        statusCode: 404,
        documentation: '/docs'
      }
    });
  } else {
    res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <title>404 | Deutsche Schulferien API</title>
        <style>
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
            <h1>404</h1>
            <p>Die angeforderte Seite existiert nicht.</p>
            <a href="/">Startseite</a>
            <a href="/docs">API Dokumentation</a>
        </div>
    </body>
    </html>
    `);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  
  if (req.path.startsWith('/api')) {
    res.json({
      error: {
        message: err.message,
        statusCode: err.status || 500,
        documentation: '/docs'
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