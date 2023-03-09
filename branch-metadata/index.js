const yaml = require('js-yaml');
const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    // Inputs
    const token = core.getInput('token');
    const repo = core.getInput('repo');
    const path = core.getInput('path');
    const ref = core.getInput('ref');
    const prop = core.getInput('prop');

    // Load Branch Metadata File
    const content = await downloadMetadata(token, repo, path);
    const metadata = yaml.load(content);

    // Set Output
    let branch = ref;
    const upperRef = (ref || '').toUpperCase();
    if (upperRef.startsWith('REFS/HEADS/')) {
      branch = ref.substring('refs/heads/'.length);
    }

    const branchInfo = metadata[branch];
    if (branchInfo) {
      if (prop) {
        core.setOutput('data', JSON.stringify(branchInfo[prop]));
      } else {
        core.setOutput('data', JSON.stringify(branchInfo));
        Object.keys(branchInfo).forEach((k) => {
          const v = branchInfo[k];
          if (typeof(v) === 'object') {
            core.setOutput(k, JSON.stringify(branchInfo[k]));
          } else {
            core.setOutput(k, branchInfo[k]);
          }
        });
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function downloadMetadata(token, repo, path) {
  const repoArr = repo.split('/');
  const octokit = github.getOctokit(token);
  const res = await octokit.rest.repos.getContent({
    owner: repoArr[0],
    repo: repoArr[1],
    path,
  });
  if (res.status !== 200) {
    throw new Error(`Can not read a metadata file. ${repo}/${path}`);
  }
  return Buffer.from(res.data.content, 'base64').toString('utf8');
}

run();
