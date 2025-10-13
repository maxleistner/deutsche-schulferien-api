const fs = require('fs');
const path = require('path');

class DataLoader {
  constructor() {
    this.cache = new Map();
    this.availableYears = this._getAvailableYears();
  }

  _getAvailableYears() {
    const yearsDir = path.join(__dirname, '../routes/years');
    try {
      const files = fs.readdirSync(yearsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => parseInt(file.replace('.json', '')))
        .filter(year => !isNaN(year))
        .sort();
    } catch (error) {
      console.error('Error reading years directory:', error);
      return [];
    }
  }

  getAvailableYears() {
    return [...this.availableYears];
  }

  loadYearData(year) {
    const yearStr = String(year);
    
    // Return cached data if available
    if (this.cache.has(yearStr)) {
      return this.cache.get(yearStr);
    }

    try {
      const filePath = path.join(__dirname, '../routes/years', `${year}.json`);
      const fileData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileData);
      
      // Cache the data
      this.cache.set(yearStr, data);
      
      return data;
    } catch (error) {
      throw new Error(`Data for year ${year} not found or invalid`);
    }
  }

  getAllData() {
    const allData = [];
    for (const year of this.availableYears) {
      try {
        const yearData = this.loadYearData(year);
        allData.push(...yearData);
      } catch (error) {
        console.error(`Error loading data for year ${year}:`, error.message);
      }
    }
    return allData;
  }

  clearCache() {
    this.cache.clear();
  }

  isHealthy() {
    try {
      // Test loading at least one year
      if (this.availableYears.length === 0) {
        return false;
      }
      
      const testYear = this.availableYears[0];
      this.loadYearData(testYear);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
const dataLoader = new DataLoader();

module.exports = dataLoader;