const fs = require('fs');
const diff = require('diff');
const core = require('@actions/core');
const github = require('@actions/github');

const LABEL_ACR_REQUIRED = 'ACR Required';
const LABEL_INTERNAL_API_CHANGED = 'Internal API Changed';

async function run() {
  try {
    // Inputs
    const token = core.getInput('token');
    const repo = core.getInput('repo');
    const issueNumber = core.getInput('issue-number');
    const inputPath = core.getInput('path');

    const repoArr = repo.split('/');
    if (repoArr.length !== 2) {
      throw new Error(`Invalid repo: ${repo}`);
    }

    // Read the comparison result
    const result = fs.readFileSync(inputPath);
    const comp = JSON.parse(result);

    // Get octokit
    const octokit = github.getOctokit(token);

    // Create comment
    if (comp.totalChanged) {
      const report = makeReport(comp);
      await octokit.rest.issues.createComment({
        owner: repoArr[0],
        repo: repoArr[1],
        issue_number: issueNumber,
        body: report,
      });
    }

    // Set Labels
    const labels = await octokit.issues.listLabelsOnIssue({
      owner: repoArr[0],
      repo: repoArr[1],
      issue_number: issueNumber,
    });

    const labelSet = new Set(labels.data.map((i) => i.name));
    comp.publicChanged ? labelSet.add(LABEL_ACR_REQUIRED) :
                         labelSet.delete(LABEL_ACR_REQUIRED);
    comp.internalChanged ? labelSet.add(LABEL_INTERNAL_API_CHANGED) :
                           labelSet.delete(LABEL_INTERNAL_API_CHANGED);

    await octokit.issues.setLabels({
      owner: repoArr[0],
      repo: repoArr[1],
      issue_number: issueNumber,
      labels: Array.from(labelSet),
    });
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

function makeReport(comp) {
  const report = [];

  if (comp.publicChanged) {
    report.push('## Public API Changed');
    report.push('**Please follow the ACR process for the changed API below.**');
    if (comp.publicChanged > 100) {
      report.push(makeSummaryLine(
          comp.addedPublicKeys,
          comp.removedPublicKeys,
          comp.changedPublicKeys) + '\n');
    } else {
      report.push(...makeReportDetail(comp,
          comp.addedPublicKeys,
          comp.removedPublicKeys,
          comp.changedPublicKeys));
    }
  }

  if (comp.internalChanged) {
    report.push('## Internal API Changed');
    if (comp.internalChanged > 100) {
      report.push(makeSummaryLine(
          comp.addedInternalKeys,
          comp.removedInternalKeys,
          comp.changedInternalKeys) + '\n');
    } else {
      report.push(...makeReportDetail(comp,
          comp.addedInternalKeys,
          comp.removedInternalKeys,
          comp.changedInternalKeys));
    }
  }

  return report.join('\n');
}

function makeReportDetail(comp, added, removed, changed) {
  const details = [];
  details.push('<details>');
  details.push('<summary>' +
               makeSummaryLine(added, removed, changed) +
               '</summary>\n');
  if (added.length) {
    details.push('### Added');
    details.push('```diff');
    added.forEach((i) => {
      details.push(...printInfo(comp.newItems[i]).map((v) => `+ ${v}`));
      details.push('');
    });
    details.push('```');
  }
  if (removed.length) {
    details.push('### Removed');
    details.push('```diff');
    removed.forEach((i) => {
      details.push(...printInfo(comp.oldItems[i]).map((v) => `- ${v}`));
      details.push('');
    });
    details.push('```');
  }
  if (changed.length) {
    details.push('### Changed');
    details.push('```diff');
    changed.forEach((i) => {
      const oldStr = printInfo(comp.oldItems[i]).join('\n');
      const newStr = printInfo(comp.newItems[i]).join('\n');
      diff.diffLines(oldStr, newStr).forEach((p) => {
        const prefix = p.added ? '+ ' : p.removed ? '- ' : '';
        details.push(`${prefix}${p.value.trim()}`);
      });
      details.push('');
    });
    details.push('```');
  }
  details.push('</details>\n');

  return details;
}

function makeSummaryLine(add, rem, ch) {
  return `Added: ${add.length}, Removed: ${rem.length}, Changed: ${ch.length}`;
}

function printInfo(info) {
  const lines = [];
  info.Privileges && info.Privileges.forEach((v) => {
    lines.push(`/// <privilege>${v}</privilege`);
  });
  info.Features && info.Features.forEach((v) => {
    lines.push(`/// <privilege>${v}</privilege`);
  });
  info.Since && lines.push(`/// <since_tizen>${info.Since}</since_tizen`);
  info.IsObsolete && lines.push('[Obsolete]');
  info.IsHidden && lines.push('[EditorBrowsable(EditorBrowsableState.Never)]');
  lines.push(`${info.IsStatic ? 'static ' : ''}${info.Signature}`);
  return lines;
}

run();
