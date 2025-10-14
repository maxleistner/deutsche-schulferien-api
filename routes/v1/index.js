const express = require("express");
const fs = require("fs");
const path = require("path");
const { track, flush } = require("../../utils/mixpanel");

const router = express.Router();
//const data = fs.readFileSync(path.join(__dirname, "./vacations.json"));

// Filter to get all vacs depending on the year
const getAllVacationsByYear = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const dataY = fs.readFileSync(
      path.join(__dirname, "../years/" + req.params.year + ".json")
    );
    const vacs = JSON.parse(dataY);
    if (!vacs) {
      const err = new Error(
        "No vacations found for this filter settings. Please check documentation. Example route would be /v1/2022 "
      );
      err.status = 404;
      throw err;
    }
    
    // Track successful API call (serverless-safe)
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      try {
        await track('V1 API Request', {
          endpoint: req.originalUrl,
          method: req.method,
          year: req.params.year,
          state: null,
          status_code: res.statusCode,
          success: res.statusCode < 400,
          response_time_ms: duration,
          result_count: vacs.length
        });
        await flush();
      } catch (error) {
        // Silently fail - don't affect API response
        console.error('[MIXPANEL] Tracking error:', error.message);
      }
    });
    
    res.json(vacs);
  } catch (e) {
    // Track error (serverless-safe)
    const duration = Date.now() - startTime;
    try {
      // Fire and forget - don't wait for tracking in error case
      track('V1 API Error', {
        endpoint: req.originalUrl,
        method: req.method,
        year: req.params.year,
        state: null,
        error: e.message,
        status_code: e.status || 500,
        response_time_ms: duration
      }).catch(() => {}); // Silently ignore tracking errors
      flush().catch(() => {});
    } catch (trackingError) {
      // Ignore tracking errors completely
    }
    next(e);
  }
};

router.route("/:year").get(getAllVacationsByYear);

// Filter to get all vacs depending on the year and/or state
const getAllVacationsByYearAndState = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const dataY = fs.readFileSync(
      path.join(__dirname, "../years/" + req.params.year + ".json")
    );
    const vacs = JSON.parse(dataY);
    const vacations = vacs.filter((vac) => {
      return (
        vac.stateCode === String(req.params.state) &&
        vac.year === Number(req.params.year)
      );
    });
    if (!vacations || vacations.length === 0) {
      const err = new Error(
        "No vacations found for this filter settings. Please check documentation. Example route would be /v1/2022/BY "
      );
      err.status = 404;
      throw err;
    }
    
    // Track successful API call (serverless-safe)
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      try {
        await track('V1 API Request', {
          endpoint: req.originalUrl,
          method: req.method,
          year: req.params.year,
          state: req.params.state,
          status_code: res.statusCode,
          success: res.statusCode < 400,
          response_time_ms: duration,
          result_count: vacations.length
        });
        await flush();
      } catch (error) {
        // Silently fail - don't affect API response
        console.error('[MIXPANEL] Tracking error:', error.message);
      }
    });
    
    res.json(vacations);
  } catch (e) {
    // Track error
    const duration = Date.now() - startTime;
    track('V1 API Error', {
      endpoint: req.originalUrl,
      method: req.method,
      year: req.params.year,
      state: req.params.state,
      error: e.message,
      status_code: e.status || 500,
      response_time_ms: duration
    });
    flush();
    next(e);
  }
};

router.route("/:year/:state").get(getAllVacationsByYearAndState);

module.exports = router;
