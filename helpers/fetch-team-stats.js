const GithubMetricsService = require('../services/github-metrics-service');

const githubMetricsService = new GithubMetricsService(
  process.env.REPO_OWNER,
  process.env.REPO_NAME,
  process.env.GITHUB_API_TOKEN
);

async function fetchTeamStats(teamName, teamMembers, startDate, endDate) {
  let totalPRs = 0;
  let totalCycleTime = 0;
  let totalPickupTime = 0;
  let totalReviewTime = 0;
  let totalApprovalToMergeTime = 0;
  let totalSize = 0;
  let totalFiles = 0;
  const pullRequests = [];

  for (const member of teamMembers) {
    const mergedPullRequests = await githubMetricsService.getMergedPullRequests(
      member,
      startDate,
      endDate
    );
    totalPRs += mergedPullRequests.length;

    for (const pr of mergedPullRequests) {
      const { approvalToMergeTime, cycleTime, pickupTime, reviewTime, reviewCount, size, commentCount } =
        await githubMetricsService.getPullRequestMetrics(pr.id);
      totalApprovalToMergeTime += approvalToMergeTime;
      totalCycleTime += cycleTime;
      totalSize += size.total;
      totalPickupTime += pickupTime;
      totalFiles += size.changedFiles;
      totalReviewTime += reviewTime;

      pullRequests.push({...pr, approvalToMergeTime, cycleTime, commentCount, pickupTime, reviewTime, reviewCount, size});
    }
  }

  return {
    teamName,
    teamMembers,
    pullRequests: pullRequests.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt)),
    metrics: {
      totalPRs,
      avgCycleTime: totalCycleTime / totalPRs,
      avgPickupTime: totalPickupTime / totalPRs,
      avgReviewTime: totalReviewTime / totalPRs,
      avgApprovalToMergeTime: totalApprovalToMergeTime / totalPRs,
      avgSize: totalSize / totalPRs,
      avgFiles: totalFiles / totalPRs,
    },
  };
}

async function getTeamStats(team, startDate, endDate) {
  const members = JSON.parse(process.env.TEAMS)[team];

  const teamStats = await fetchTeamStats(
    team,
    members,
    startDate,
    endDate
  );

  return teamStats;
}

module.exports = getTeamStats;
