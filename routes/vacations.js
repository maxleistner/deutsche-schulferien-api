const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
//const data = fs.readFileSync(path.join(__dirname, "./vacations.json"));

// Filter to get all vacs depending on the year
const getAllVacationsByYear = async (req, res, next) => {
  
  try {
    const dataY = fs.readFileSync(
      path.join(__dirname, "./years/" + req.params.year + ".json")
    );
    const vacs = JSON.parse(dataY);
    if (!vacs) {
      const err = new Error(
        "No vacations found for this filter settings. Please check documentation. Example route would be /v1/2022 "
      );
      err.status = 404;
      throw err;
    }
    
    res.json(vacs);
  } catch (e) {
    next(e);
  }
};

router.route("/api/v1/:year").get(getAllVacationsByYear);

// Filter to get all vacs depending on the year and/or state
const getAllVacationsByYearAndState = async (req, res, next) => {
  
  try {
    const dataY = fs.readFileSync(
      path.join(__dirname, "./years/" + req.params.year + ".json")
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
    
    res.json(vacations);
  } catch (e) {
    next(e);
  }
};

router.route("/api/v1/:year/:state").get(getAllVacationsByYearAndState);

module.exports = router;
