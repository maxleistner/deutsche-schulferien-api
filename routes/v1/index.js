const express = require("express");
const dataLoader = require("../../lib/dataLoader");
const { parseYear } = require("../../lib/filters");

const router = express.Router();

// Filter to get all vacs depending on the year
const getAllVacationsByYear = (req, res) => {
  const year = parseYear(req.params.year);
  res.json(dataLoader.loadYearData(year));
};

router.route("/:year").get(getAllVacationsByYear);

// Filter to get all vacs depending on the year and/or state
const getAllVacationsByYearAndState = (req, res) => {
  const year = parseYear(req.params.year);
  const vacations = dataLoader.loadYearData(year).filter((vac) => {
    return vac.stateCode === String(req.params.state) && vac.year === year;
  });

  if (vacations.length === 0) {
    const err = new Error(
      "No vacations found for this filter settings. Please check documentation. Example route would be /api/v1/2026/BY"
    );
    err.status = 404;
    throw err;
  }

  res.json(vacations);
};

router.route("/:year/:state").get(getAllVacationsByYearAndState);

module.exports = router;
