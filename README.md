# Github PR Team Metrics

https://github.com/BuffaloDrew/github-team-metrics/assets/1747664/a6a9a67e-aa56-4c2f-9289-37eaad6e761d

## Getting Started

1. Install the dependencies
    
 ```bash
 npm install
 ```

2. Create a `.env` file in the root directory of the project and add the following environment variables:

```
REPO_OWNER=your_repo_owner
REPO_NAME=your_repo_name
GITHUB_API_TOKEN=your_github_api_token
TEAMS='{"team1":["username1","username2"], "team2":["username3","username4"]}'
```

Replace the following:

- `your_repo_owner` with the GitHub username or organization name that owns the repository
- `your_repo_name` with the name of the repository
- `your_github_api_token` with a personal access token you generate from your GitHub account (with the necessary permissions to access the repository data)
- The `TEAMS` value with a JSON string representing teams and their members (use the provided format)

3. Start the server
    
 ```bash
 npm start
 ```

4. Navigate to `localhost:3000` in your browser to view the dashboard
