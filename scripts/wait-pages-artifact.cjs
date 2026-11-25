// Use the same artifact service as deploy-pages, before it creates a deployment.
async function waitForPagesArtifact({listArtifacts, artifactId, attempts = 12,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  if (!/^[1-9][0-9]*$/.test(String(artifactId))) throw Error('Missing uploaded Pages artifact ID');
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await listArtifacts();
    if (!Array.isArray(result.artifacts)) throw Error('Invalid artifact service response');
    const matches = result.artifacts.filter(artifact => artifact.name === 'github-pages');
    if (matches.length > 1) throw Error('Ambiguous Pages artifacts; refusing deployment');
    if (matches.length === 1) {
      if (String(matches[0].id) !== String(artifactId)) throw Error('Pages artifact ID mismatch; refusing deployment');
      if (!(matches[0].size > 0)) throw Error('Empty Pages artifact; refusing deployment');
      return matches[0];
    }
    if (attempt + 1 < attempts) await sleep(5000);
  }
  throw Error('Uploaded Pages artifact is still unavailable; keeping the current deployment');
}
// The official Pages endpoint accepts the verified upload ID directly. Avoid a
// second name lookup by a different bundled client after successful verification.
async function publishPages({request, getIDToken, repository, sha, artifactId,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), maxPolls = 120}) {
  if (!/^[1-9][0-9]*$/.test(String(artifactId)) || !Number.isSafeInteger(Number(artifactId))) throw Error('Missing uploaded Pages artifact ID');
  const [owner, repo] = repository.split('/');
  const common = {owner, repo, request: {timeout: 15000}};
  // Never retry creation: an uncertain response must not create duplicates.
  const {data: deployment} = await request('POST /repos/{owner}/{repo}/pages/deployments', {
    ...common, artifact_id: Number(artifactId), pages_build_version: sha,
    oidc_token: await getIDToken()
  });
  const deploymentId = deployment.id || deployment.status_url?.split('/').pop();
  if (!deploymentId) throw Error('Missing Pages deployment ID');
  const target = {...common, deployment_id: deploymentId};
  const finalErrors = new Set(['deployment_failed','deployment_perms_error',
    'deployment_content_failed','deployment_cancelled','deployment_lost']);
  let errors = 0;
  for (let poll = 0; poll < maxPolls; poll++) {
    await sleep(5000);
    let status;
    try {
      ({data: {status}} = await request('GET /repos/{owner}/{repo}/pages/deployments/{deployment_id}', target));
    } catch {
      if (++errors < 3) continue;
      break;
    }
    if (status === 'succeed') {
      if (!deployment.page_url?.startsWith('https://')) throw Error('Missing published Pages URL');
      return deployment.page_url;
    }
    if (finalErrors.has(status)) throw Error('Pages deployment failed: ' + status);
  }
  await request('POST /repos/{owner}/{repo}/pages/deployments/{deployment_id}/cancel', target);
  throw Error('Pages deployment verification timed out or failed; deployment cancelled');
}
module.exports = {waitForPagesArtifact, publishPages};
