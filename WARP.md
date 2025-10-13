# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Setup and Installation
```bash
# Use LTS Node.js version (preferred for best support)
nvm install --lts && nvm use

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
- **Entry Point**: `index.js` - Express server with middleware setup
- **Routes**: `routes/vacations.js` - API endpoint handlers
- **Data Storage**: `routes/years/*.json` - One JSON file per year containing all German states' school holidays

### API Endpoints
- `GET /api/v1/:year` - Returns all school holidays for all German states in the given year
- `GET /api/v1/:year/:state` - Returns school holidays for a specific state in the given year

### Data Loading Strategy
- JSON files are loaded dynamically using `fs.readFileSync()`
- Each request reads the appropriate year file from disk
- No caching is implemented - files are read on each request
- New year files are automatically discoverable without code changes

### Middleware Stack
- **CORS**: Enabled for all origins
- **Morgan**: HTTP request logging ("tiny" format)
- **Body Parser**: JSON request parsing
- **Error Handling**: Custom 404 and global error handlers

## Key Development Notes

### Data Structure
Each vacation record contains:
```json
{
  "start": "2024-07-25T00:00Z",
  "end": "2024-09-08T00:00Z", 
  "year": 2024,
  "stateCode": "BW",
  "name": "sommerferien",
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

### Date Format
All dates use ISO 8601 format with UTC timezone: `YYYY-MM-DDTHH:mmZ`

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
- **Analytics**: Tracks API usage, endpoint performance, and user metrics
- **Environment Variables**: Set in Vercel dashboard for production/preview

### Environment Setup
1. `vercel login` - Authenticate with Vercel
2. `vercel link` - Link project to Vercel dashboard
3. `vercel pull` - Sync environment variables locally
4. `vercel dev` - Run locally with Vercel functions

## Monitoring

### Vercel Analytics Dashboard
Access monitoring data at: https://vercel.com/dashboard

**Available Metrics:**
- **Function Invocations**: Request counts per endpoint
- **Performance**: Response times and cold start metrics
- **Errors**: Failed requests and error rates
- **Geographic**: Request distribution by location
- **Custom Events**: API usage tracking with details:
  - API version (v1/v2)
  - German state codes (BY, BW, etc.)
  - Vacation types (sommerferien, winterferien, etc.)
  - Query parameters and filters

### Key Analytics Features
- **Real-time Dashboard**: Live usage statistics
- **Custom Event Tracking**: Detailed API usage patterns
- **Performance Monitoring**: Function execution times
- **Error Tracking**: Failed requests with context
- **User Journey**: Request patterns and popular endpoints

### Monitoring Endpoints
- `GET /health` - Health check endpoint
- `GET /status` - API status and version info
- `GET /ready` - Readiness probe

### Usage Insights
The analytics track:
- Most requested German states (Bayern, NRW, etc.)
- Popular vacation types (Sommerferien peak usage)
- API version adoption (v1 vs v2)
- Seasonal traffic patterns
- Geographic usage distribution

### Troubleshooting
- **Function Logs**: Available in Vercel dashboard → Functions → Logs
- **Performance Issues**: Check cold start times and optimization opportunities
- **Error Analysis**: Review failed requests with full context
- **Analytics Debugging**: Custom events visible in Web Analytics → Events

## Data Maintenance

When updating vacation data:
1. School holiday dates are set by individual German states
2. Data sources typically come from state education ministries
3. Some states have variable holiday periods that change annually
4. Dates should be verified against official state calendars
