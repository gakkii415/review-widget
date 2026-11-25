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
      return;
    }
    if (attempt + 1 < attempts) await sleep(5000);
  }
  throw Error('Uploaded Pages artifact is still unavailable; keeping the current deployment');
}
module.exports = {waitForPagesArtifact};
