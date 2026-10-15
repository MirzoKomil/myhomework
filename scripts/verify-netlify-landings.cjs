// Read-only production verification. Never sends a valid lead payload.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../integrations/netlify-landings');
const sites = {domwork:'domwork.uz', homework:'homeworkuz.uz'};
const siteIds = {domwork:'9eb3075a-2bcb-4c86-86b5-3905c6598cc1',homework:'c4073b5f-94b6-442d-9ed2-33bb7f3742d9'};
async function verify(source, domain) {
  const publicDir = path.join(root, source, 'public');
  const expectedHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const expectedScript = fs.readFileSync(path.join(publicDir, 'crm-lead.js'), 'utf8');
  const origin = 'https://' + domain;
  const html = await fetch(origin + '/?crm-deploy-verification=20261014', {signal:AbortSignal.timeout(20000)});
  const htmlText = await html.text();
  // Netlify may append its existing public HUD. Only this exact site-bound
  // suffix is accepted; arbitrary content differences must still fail.
  const hud = '<script async src="/.netlify/scripts/hud?variant=public" data-nf-variant="public" data-netlify-site-id="'+siteIds[source]+'" data-app-host="app.netlify.com"></script>';
  const netlifyHudOnly=htmlText.startsWith(expectedHtml)&&htmlText.slice(expectedHtml.length).trim()===hud;
  const script = await fetch(origin + '/crm-lead.js', {signal:AbortSignal.timeout(20000)});
  const scriptText = await script.text();
  const endpoint = origin + '/.netlify/functions/lead';
  const get = await fetch(endpoint, {signal:AbortSignal.timeout(20000)});
  const post = body => fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json', Origin:origin}, body:JSON.stringify(body), signal:AbortSignal.timeout(20000)});
  const probe = await post({probe:true});
  const probeBody = await probe.json();
  const invalid = await post({name:''});
  const foreign = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({probe:true}),signal:AbortSignal.timeout(20000)});
  const result = {source,domain,pageStatus:html.status,scriptStatus:script.status,
    pageMatchesArtifact:createHash('sha1').update(htmlText).digest('hex')===createHash('sha1').update(expectedHtml).digest('hex'),
    netlifyHudOnly,pageContentMatchesArtifact:htmlText===expectedHtml||netlifyHudOnly,
    scriptMatchesArtifact:createHash('sha1').update(scriptText).digest('hex')===createHash('sha1').update(expectedScript).digest('hex'),
    formConnected:htmlText.includes('src="/crm-lead.js"'),noPublicSecret:!htmlText.includes('LEADS_WEBHOOK_SECRET')&&!scriptText.includes('LEADS_WEBHOOK_SECRET'),
    getStatus:get.status,probeStatus:probe.status,crmConnected:probeBody.ok===true&&probeBody.crmConnected===true,
    invalidPayloadStatus:invalid.status,untrustedOriginStatus:foreign.status};
  result.passed=result.pageStatus===200&&result.scriptStatus===200&&result.pageContentMatchesArtifact&&result.scriptMatchesArtifact&&result.formConnected&&result.noPublicSecret&&result.getStatus===405&&result.probeStatus===200&&result.crmConnected&&result.invalidPayloadStatus===400&&result.untrustedOriginStatus===403;
  return result;
}
Promise.all(Object.entries(sites).map(([source,domain])=>verify(source,domain))).then(results=>{
  console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
}).catch(()=>{console.error('Read-only production verification failed; no credential details displayed');process.exitCode=1;});
