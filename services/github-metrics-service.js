const { Octokit } = require('@octokit/rest');

const cache = new Map();

/**
 * Requests data using the provided request function and caches the result.
 * If the data is already in the cache, returns the cached data.
 * Handles rate limiting by waiting and retrying when necessary.
 *
 * @param {string} cacheKey - The key to use for storing and retrieving the data from the cache.
 * @param {function} requestFn - An async function that makes the API request and returns the data.
 * @returns {Promise} - A promise that resolves to the requested data.
 */
async function requestWithCache(cacheKey, requestFn) {
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const data = await requestFn();
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (
      error.status === 403 &&
      error.headers['x-ratelimit-remaining'] === '0'
    ) {
      const resetTime = parseInt(error.headers['x-ratelimit-reset'], 10);
      const delay = resetTime * 1000 - Date.now() + 1000;

      console.log(
        `Rate limited. Retrying in ${Math.ceil(delay / 1000)} seconds.`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      return await requestWithCache(cacheKey, requestFn);
    }

    console.error('Error during API request:', error);
    throw error;
  }
}

class GithubMetricsService {
  constructor(repoOwner, repoName, authKey) {
    this.octokit = new Octokit({
      auth: authKey,
    });
    this.repoOwner = repoOwner;
    this.repoName = repoName;
  }

  /**
   * Retrieves the pull request and review data, calculates various metrics for the pull request,
   * and returns an object containing these metrics.
   *
   * @param {number} pullRequestNumber - The pull request number to retrieve metrics for.
   * @returns {Object} An object containing approvalToMergeTime, cycleTime, pickupTime, reviewTime, and size metrics.
   */
  async getPullRequestMetrics(pullRequestNumber) {
    const cacheKey = `pullRequestMetrics:${pullRequestNumber}`;

    return await requestWithCache(cacheKey, async () => {
      try {
        const pullRequest = await this.octokit.pulls.get({
          owner: this.repoOwner,
          repo: this.repoName,
          pull_number: pullRequestNumber,
        });

        const reviewList = await this.octokit.pulls.listReviews({
          owner: this.repoOwner,
          repo: this.repoName,
          pull_number: pullRequestNumber,
        });

        const cycleTime = this.getPullRequestCycleTimeFromData(pullRequest);
        const pickupTime = this.getPullRequestPickupTimeFromData(
          pullRequest,
          reviewList
        );
        const reviewTime = this.getPullRequestReviewTimeFromData(
          pullRequest,
          reviewList
        );
        const size = this.getPullRequestSizeFromData(pullRequest);

        const approvalToMergeTime = this.getPullRequestApprovalToMergeTime(
          pullRequest,
          reviewList
        );

        const commentCount = this.getPullRequestCommentsCount(pullRequest);
        const reviewCount = this.getPullRequestReviewCommentsCount(pullRequest);

        return {
          approvalToMergeTime,
          cycleTime,
          commentCount,
          pickupTime,
          reviewTime,
          reviewCount,
          size,
        };
      } catch (error) {
        console.error('Error fetching pull request and review data:', error);
        throw error;
      }
    });
  }

  /**
   * Retrieves the number of comments on a pull request.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @returns {number} The number of comments on the pull request.
   */
  getPullRequestCommentsCount(pullRequest) {
    return pullRequest.data.comments;
  }

  /**
   * Retrieves the number of comments on a pull request.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @returns {number} The number of comments on the pull request.
   */
    getPullRequestReviewCommentsCount(pullRequest) {
      return pullRequest.data.review_comments;
    }

  /**
   * Calculates the cycle time for a pull request from its creation to its merge.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @returns {number} The cycle time in seconds.
   */
  getPullRequestCycleTimeFromData(pullRequest) {
    const createdAt = new Date(pullRequest.data.created_at);
    const mergedAt = new Date(pullRequest.data.merged_at);
    const cycleTimeInSeconds = (mergedAt - createdAt) / 1000;
    return cycleTimeInSeconds;
  }

  /**
   * Calculates the pickup time for a pull request, which is the time between its creation
   * and the first review submitted by someone other than the author.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @param {Object} reviewList - The list of reviews for the pull request.
   * @returns {number} The pickup time in seconds.
   */
  getPullRequestPickupTimeFromData(pullRequest, reviewList) {
    const createdAt = new Date(pullRequest.data.created_at);
    const prAuthor = pullRequest.data.user.login;

    // Find the first review submitted by someone other than the PR author
    const firstReview = reviewList.data.find(
      (review) => review.user?.login !== prAuthor
    );

    if (!firstReview) {
      return 0;
    }

    const firstReviewSubmittedAt = new Date(firstReview.submitted_at);
    const pickupTimeInSeconds = (firstReviewSubmittedAt - createdAt) / 1000;
    return pickupTimeInSeconds;
  }

  /**
   * Calculates the review time for a pull request, which is the time between the first
   * non-author review and the merge of the pull request.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @param {Object} reviewList - The list of reviews for the pull request.
   * @returns {number} The review time in seconds.
   */
  getPullRequestReviewTimeFromData(pullRequest, reviewList) {
    const mergedAt = new Date(pullRequest.data.merged_at);
    const prAuthor = pullRequest.data.user.login;

    // Filter out reviews submitted by the PR author
    const filteredReviewList = reviewList.data.filter(
      (review) => review.user?.login !== prAuthor
    );

    if (!filteredReviewList.length) {
      return 0;
    }

    const firstReviewSubmittedAt = new Date(filteredReviewList[0].submitted_at);
    const reviewTimeInSeconds = (mergedAt - firstReviewSubmittedAt) / 1000;
    return reviewTimeInSeconds;
  }

  /**
   * Extracts the size metrics from a pull request, including additions, deletions,
   * total changes, and the number of changed files.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @returns {Object} An object containing the size metrics.
   */
  getPullRequestSizeFromData(pullRequest) {
    const additions = pullRequest.data.additions;
    const deletions = pullRequest.data.deletions;
    const changedFiles = pullRequest.data.changed_files;
    return {
      additions,
      deletions,
      total: additions + deletions,
      changedFiles,
    };
  }

  /**
   * Calculates the time between the approval of a pull request and its merge.
   *
   * @param {Object} pullRequest - The pull request data object.
   * @param {Object} reviewList - The list of reviews for the pull request.
   * @returns {number} The time between approval and merge in seconds.
   */
  getPullRequestApprovalToMergeTime(pullRequest, reviewList) {
    const approvedReview = reviewList.data.find(
      (review) => review.state === 'APPROVED'
    );

    if (!approvedReview) {
      return 0;
    }

    const approvedAt = new Date(approvedReview.submitted_at);
    const mergedAt = new Date(pullRequest.data.merged_at);

    const approvalToMergeTimeInSeconds = (mergedAt - approvedAt) / 1000;

    return approvalToMergeTimeInSeconds;
  }

  /**
   * Retrieves a list of merged pull requests for a given user and date range, if both provided.
   *
   * @param {string} username - The GitHub username to search for merged pull requests.
   * @param {string} startDate - The start date for the search in ISO format (e.g., '2022-01-01').
   * @param {string} endDate - The end date for the search in ISO format (e.g., '2022-12-31').
   * @returns {Array} An array of merged pull request objects, each containing an id and title.
   */
  async getMergedPullRequests(username, startDate, endDate) {
    const cacheKey = `mergedPullRequests:${username}:${startDate}:${endDate}`;

    return await requestWithCache(cacheKey, async () => {
      const mergedPullRequests = [];
      let page = 1;
      const dateRangeQuery =
        startDate && endDate ? `merged:${startDate}..${endDate}` : '';
      const query = `repo:${this.repoOwner}/${this.repoName} is:pr is:merged author:${username} ${dateRangeQuery}`;

      while (true) {
        try {
          const searchResults = await this.octokit.search.issuesAndPullRequests(
            {
              q: query,
              sort: 'updated',
              order: 'desc',
              per_page: 100,
              page: page,
            }
          );

          if (searchResults.data.items.length === 0) {
            break;
          }

          for (const pr of searchResults.data.items) {
            mergedPullRequests.push(pr);
          }

          page++;
        } catch (error) {
          console.error('Error fetching pull requests using search:', error);
          throw error;
        }
      }

      return mergedPullRequests.map((pr) => ({
        id: pr.number,
        title: pr.title,
        url: pr.html_url,
        mergedAt: pr.pull_request.merged_at,
      }))
    });
  }
}

module.exports = GithubMetricsService;
