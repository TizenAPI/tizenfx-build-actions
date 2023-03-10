const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('token');
    const workflowName = core.getInput('workflow');
    const workflowFile = core.getInput('workflow-file');
    const workflowRef = core.getInput('ref');
    const workflowInputs = core.getInput('inputs');

    const octokit = github.getOctokit(token);

    let workflowId = workflowFile;
    if (!workflowId && workflowName) {
      const resp = await octokit.rest.actions.listRepoWorkflows({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
      });
      const workflow = resp.data.workflows.find((x) => x.name == workflowName);
      if (workflow) {
        workflowId = workflow.id;
      }
    }

    if (!workflowId) {
      throw new Error('Can not find a workflow.');
    }

    const resp = await octokit.rest.actions.createWorkflowDispatch({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      workflow_id: workflowId,
      ref: workflowRef,
      inputs: JSON.parse(workflowInputs),
    });

    core.setOutput('status', resp.status);
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

run();
