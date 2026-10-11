// Opening Lightning Experience in the e2e flow. frontdoor.jsp on the org's
// my.salesforce.com host redirects to *.lightning.force.com (Home) or
// *.my.salesforce-setup.com (Setup), sometimes taking over a minute, and
// Lightning pages never go network-idle (they keep connections open), so
// waiting for "networkidle2" on the first navigation timed out now and then.
//
// gotoLightning waits for what the test needs instead: the page on the
// Lightning domain, and Lightning's app shell (soft: a missing shell element
// is logged, not fatal, since Salesforce renames them). If the redirect
// doesn't land in time, it navigates once more.

// Elements of Lightning's shell: the global header and the app navigation.
export const LIGHTNING_SHELL = [
  'one-appnav',
  'one-app-nav-bar',
  '.slds-global-header',
  'header.oneHeader',
  '.oneContent',
  'force-aloha-page'
].join(', ')

const hostOf = page => {
  try {
    return new URL(page.url()).host
  } catch {
    return '?'
  }
}

export async function gotoLightning(
  page,
  url,
  domain,
  { attempts = 2, landTimeout = 75000, shellTimeout = 30000, log = () => {} } = {}
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // "domcontentloaded" of the first document is enough to start; the
    // redirect chain continues and is waited for below.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: landTimeout }).catch(e => {
      log(`attempt ${attempt}: navigation: ${e.message.split('\n')[0]}`)
    })
    const landed = await page
      .waitForFunction(
        d => location.hostname.endsWith(d) && document.readyState !== 'loading',
        { timeout: landTimeout },
        domain
      )
      .then(
        () => true,
        () => false
      )
    if (!landed) {
      log(`attempt ${attempt}: still on ${hostOf(page)} after ${landTimeout} ms`)
      if (attempt === attempts) {
        throw new Error(`did not reach *${domain} after ${attempts} attempts (on ${hostOf(page)})`)
      }
      continue
    }
    const shell = await page.waitForSelector(LIGHTNING_SHELL, { timeout: shellTimeout }).then(
      () => true,
      () => false
    )
    if (!shell) log(`on ${hostOf(page)}, but no Lightning shell element (${LIGHTNING_SHELL}) appeared`)
    log(`on ${hostOf(page)} after ${attempt} attempt(s)`)
    return { attempt, shell }
  }
}
