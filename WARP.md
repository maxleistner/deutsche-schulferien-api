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

## Data Maintenance

When updating vacation data:
1. School holiday dates are set by individual German states
2. Data sources typically come from state education ministries
3. Some states have variable holiday periods that change annually
4. Dates should be verified against official state calendars