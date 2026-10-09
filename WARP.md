# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Setup and Installation
```bash
# Use Node.js 24 (same as Vercel)
nvm install 24 && nvm use 24

# Install dependencies
npm install
```

### Development
```bash
# Start the server (production mode)
npm start

# Start with automatic restart on changes (development mode)
npm run dev
```

### Testing the API
```bash
# Get all vacations for a specific year
curl "http://localhost:3000/api/v1/2024/"

# Get vacations for a specific year and state (Bayern/Bavaria)
curl "http://localhost:3000/api/v1/2024/BY/"

# Alternative: Schleswig-Holstein
curl "http://localhost:3000/api/v1/2024/SH/"
```

### Adding New Year Data
To add vacation data for a new year:
1. Create a new JSON file: `routes/years/YYYY.json` 
2. Follow the existing data structure (see Key Development Notes)
3. The API will automatically recognize and serve the new year data

## Architecture and Structure

### Application Layout
- **Entry Point**: `index.js` - Express 5 app (index page, `/docs`, caching, 404/error handlers); exported for Vercel and tests
- **Routes**: `routes/v1/index.js` (legacy), `routes/v2/index.js` (filtering, search, stats), `routes/system.js` (health/status)
- **Shared logic**: `lib/dataLoader.js` (year files + cache), `lib/filters.js` (validation, filters, state names), `lib/ical.js` (iCalendar export for `/api/v2/ical/:state.ics`), `lib/openapi-spec.js` (served at `/docs/openapi.json`)
- **Index page**: `public/index.html` with `{{YEARS}}`-style placeholders filled from the available data
- **Data Storage**: `routes/years/*.json` - One JSON file per year containing all German states' school holidays

### API Endpoints
- `GET /api/v1/:year` - Returns all school holidays for all German states in the given year
- `GET /api/v1/:year/:state` - Returns school holidays for a specific state in the given year
- `GET /api/v2/...` - See README.md and `/docs`

### Data Loading Strategy
- `lib/dataLoader.js` discovers `routes/years/*.json` at startup and only ever reads those files
- Year files are cached in memory after the first read
- API responses are cached on the Vercel CDN (`s-maxage`); a new deployment purges that cache
- New year files are automatically discoverable without code changes

### Middleware Stack
- **CORS**: Enabled for all origins
- **Morgan**: HTTP request logging ("tiny" format)
- **Cache-Control**: CDN caching for `/api` (shorter for `/api/v2/current` and `/api/v2/next`)
- **Error Handling**: Custom 404 and global error handlers; errors with `status` < 500 are shown to the client, everything else becomes a generic 500

## Key Development Notes

### Data Structure
Each vacation record contains:
```json
{
  "start": "2024-07-25T00:00Z",
  "end": "2024-09-07T23:59Z", 
  "year": 2024,
  "stateCode": "BW",
  "name": "sommerferien",
  "name_cp": "Sommerferien",
  "slug": "sommerferien-2024-BW"
}
```

### German State Codes
- **BW**: Baden-Württemberg
- **BY**: Bayern (Bavaria)
- **BE**: Berlin
- **BB**: Brandenburg
- **HB**: Bremen
- **HH**: Hamburg
- **HE**: Hessen
- **MV**: Mecklenburg-Vorpommern
- **NI**: Niedersachsen
- **NW**: Nordrhein-Westfalen
- **RP**: Rheinland-Pfalz
- **SL**: Saarland
- **SN**: Sachsen
- **ST**: Sachsen-Anhalt
- **SH**: Schleswig-Holstein
- **TH**: Thüringen

### Vacation Types (German names used in data)
- `winterferien` - Winter holidays
- `osterferien` - Easter holidays  
- `pfingstferien` - Whitsun/Pentecost holidays
- `sommerferien` - Summer holidays
- `herbstferien` - Autumn holidays
- `weihnachtsferien` - Christmas holidays
- `fruehjahrsferien` - Accepted as filter for compatibility, no longer used in data (Hamburg spring holidays are `osterferien`, following the KMK column)
- `variabler_ferientag` - Brandenburg only: default holiday unless the school decides otherwise (slug uses hyphens: `variabler-ferientag-2026-BB`)
- Single days get the type of the KMK column they are listed in (Friday after Ascension = `pfingstferien`)

### Date Format
All dates use ISO 8601 format with UTC timezone: `YYYY-MM-DDTHH:mmZ`

**Important:** The `end` date is **inclusive** and represents the last day of vacation at 23:59Z (UTC). This was corrected from the previous format where end dates showed the day after vacation ended at 00:00Z.

### Filtering Logic
- Year filtering: Matches `req.params.year` against `vac.year` property
- State filtering: Matches `req.params.state` against `vac.stateCode` property
- Returns 404 if no matching records found

### Environment Variables
- `PORT` - Server port (defaults to 3000)
- `NODE_ENV` - Environment mode (defaults to "development")

## Deployment

### Vercel Deployment
This API is configured for deployment on Vercel with built-in monitoring.

```bash
# Deploy to Vercel
npx vercel

# Deploy to production
npx vercel --prod

# Local development with Vercel functions
npx vercel dev
```

### Deployment Configuration
- **vercel.json**: Configures Express.js app as serverless function
- **Environment Variables**: Set in Vercel dashboard for production/preview

### Environment Setup
1. `vercel login` - Authenticate with Vercel
2. `vercel link` - Link project to Vercel dashboard
3. `vercel pull` - Sync environment variables locally
4. `vercel dev` - Run locally with Vercel functions

## Monitoring

### System Endpoints
- `GET /health` - Health check endpoint
- `GET /status` - API status and version info
- `GET /ready` - Readiness probe

### Troubleshooting
- **Function Logs**: Available in Vercel dashboard → Functions → Logs
- **Performance Issues**: Check cold start times and optimization opportunities
- **Error Analysis**: Review failed requests with full context

## Data Maintenance

When updating vacation data:
1. School holiday dates are set by individual German states
2. Data sources typically come from state education ministries
3. Some states have variable holiday periods that change annually
4. Dates should be verified against official state calendars
