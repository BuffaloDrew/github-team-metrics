const express = require('express');
const { formatDistance } = require('date-fns');
const getTeamStats = require('../helpers/fetch-team-stats');

const router = express.Router();

function formatDuration(durationInSeconds) {
  const durationInMinutes = durationInSeconds / 60;
  const roundedDuration = Math.round(durationInMinutes);
  return formatDistance(0, roundedDuration * 60 * 1000, {
    includeSeconds: true,
  });
}

router.get('/', async (_, res) => {
  res.render('index', {
    startDate: null,
    endDate: null,
    team: null,
    formatDuration,
    teamStats: null,
    teams: Object.keys(JSON.parse(process.env.TEAMS)),
  });
});

router.post('/', async (req, res) => {
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  const team = req.body.team;

  const teamStats = await getTeamStats(team, startDate, endDate);
  res.render('index', {
    teamStats,
    startDate,
    endDate,
    team,
    formatDuration,
    teams: Object.keys(JSON.parse(process.env.TEAMS)),
  });
});

module.exports = router;
