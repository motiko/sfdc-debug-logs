// Minimal stand-ins for the Salesforce pages the extension's content scripts
// enhance, with the same DOM ids and classes they look for (see
// react/src/extension/*.ts): the classic debug log page, the debug log list,
// the Apex class list, a record page with Edit/Save buttons, and Lightning
// Home and Setup. Just enough Salesforce-like styling (a white page, a header,
// Salesforce's link color) for screenshots to look like the real context.
// Every value is HTML-escaped: log text is untrusted here too.

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const STYLE = `
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; background: #f3f3ec; }
  #AppBodyHeader { background: #1797c0; color: #fff; padding: 10px 16px; font-size: 16px; font-weight: bold; }
  #bodyTable { width: 100%; border-collapse: collapse; }
  #bodyTable > tbody > tr > td { vertical-align: top; padding: 12px; }
  .oLeft { width: 0; }
  .oRight { background: #fff; }
  a { color: #015ba7; }
  .bPageTitle h1 { font-size: 20px; margin: 0 0 12px; }
  .pbHeader table { width: 100%; }
  .pbTitle h2 { font-size: 14px; margin: 0; }
  .btn { font-size: 11px; padding: 2px 6px; margin-right: 4px; }
  table.list { width: 100%; border-collapse: collapse; background: #fff; }
  table.list th, table.list td { border-bottom: 1px solid #e0e3e5; padding: 4px 6px; text-align: left; }
  .headerRow th { background: #f2f3f3; font-size: 11px; }
  .detailList td { padding: 2px 8px; }
  pre { font-size: 12px; }
`

function page({ title, body, bodyClass = 'setupTab' }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)} ~ Salesforce - Developer Edition</title>
<style>${STYLE}</style></head>
<body class="${bodyClass}">
<div id="AppBodyHeader">Salesforce (mock org)</div>
${body}
</body></html>`
}

export function logDetailPage(log, body) {
  return page({
    title: 'Debug Log Detail',
    body: `<table id="bodyTable"><tbody><tr>
<td class="oLeft"><pre class="codeBlock">${escapeHtml(body)}</pre></td>
<td class="oRight" id="bodyCell">
  <div class="bPageTitle"><h1>Debug Log Detail</h1></div>
  <table class="detailList"><tbody>
    <tr><td>User</td><td><a href="/${escapeHtml(log.LogUserId)}">${escapeHtml(log.LogUser.Name)}</a></td>
        <td>Request Type</td><td>${escapeHtml(log.Request)}</td></tr>
    <tr><td>Operation</td><td>${escapeHtml(log.Operation)}</td><td>Status</td><td>${escapeHtml(log.Status)}</td></tr>
    <tr><td>Duration (ms)</td><td>${escapeHtml(log.DurationMilliseconds)}</td>
        <td>Log Size (bytes)</td><td>${escapeHtml(log.LogLength)}</td></tr>
  </tbody></table>
</td></tr></tbody></table>`
  })
}

function logRow(log) {
  return `<tr class="dataRow">
<td class="dataCell actionColumn"><a class="actionLink" href="/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${escapeHtml(log.Id)}">View</a> | <a class="actionLink" href="/servlet/servlet.FileDownload?file=${escapeHtml(log.Id)}">Download</a> | <a class="actionLink" href="#">Delete</a></td>
<td class="dataCell"><a href="/${escapeHtml(log.LogUserId)}">${escapeHtml(log.LogUser.Name)}</a></td>
<td class="dataCell">${escapeHtml(log.Request)}</td>
<td class="dataCell">${escapeHtml(log.Application)}</td>
<td class="dataCell">${escapeHtml(log.Operation)}</td>
<td class="dataCell">${escapeHtml(log.Status)}</td>
<td class="dataCell">${escapeHtml(log.DurationMilliseconds)}</td>
<td class="dataCell">${escapeHtml(log.LogLength)}</td>
<td class="dataCell">${escapeHtml(new Date(log.StartTime).toLocaleString('en-US'))}</td>
</tr>`
}

export function logListPage(logs, traceFlags, user) {
  const flags = traceFlags
    .map(
      f =>
        `<tr class="dataRow"><td class="dataCell"><a href="/${escapeHtml(f.TracedEntityId)}">${escapeHtml(
          f.TracedEntityId === user.Id ? user.Name : f.TracedEntityId
        )}</a></td><td class="dataCell">${escapeHtml(f.LogType)}</td><td class="dataCell">${escapeHtml(
          f.ExpirationDate
        )}</td></tr>`
    )
    .join('')
  return page({
    title: 'Debug Logs',
    body: `<table id="bodyTable"><tbody><tr><td class="oRight" id="bodyCell">
<div class="bPageTitle"><h1>Debug Logs</h1></div>
<div class="apexp"><div id="Apex_Trace_List:monitoredUsersForm">
  <div class="pbHeader"><table><tbody><tr><td class="pbTitle"><h2>User Trace Flags</h2></td>
  <td class="pbButton"><input class="btn" type="button" value="New"></td></tr></tbody></table></div>
  <table class="list"><thead><tr class="headerRow"><th>Name</th><th>Log Type</th><th>Expiration Date</th></tr></thead>
  <tbody>${flags}</tbody></table>
</div></div>
<div class="apexp"><form id="Apex_Trace_List:traceForm">
  <div class="pbHeader"><table><tbody><tr><td class="pbTitle"><h2>Debug Logs</h2></td>
  <td class="pbButton"><input class="btn" type="button" value="Delete All"></td></tr></tbody></table></div>
  <div id="Apex_Trace_List:traceForm:traceTable"><div class="mainTitle">Debug Logs</div>
  <table class="list"><thead><tr class="headerRow"><th>Action</th><th>User</th><th>Request Type</th><th>Application</th>
  <th>Operation</th><th>Status</th><th>Duration (ms)</th><th>Log Size (bytes)</th><th>Start Time</th></tr></thead>
  <tbody id="Apex_Trace_List:traceForm:traceTable:thetracetable:tb">${logs.map(logRow).join('')}</tbody></table>
  <div id="Apex_Trace_List:traceForm:traceTableNextPrev"><a href="#">Next Page</a></div></div>
</form></div>
</td></tr></tbody></table>`
  })
}

export function classListPage(classes) {
  const rows = classes
    .map(
      c => `<tr class="dataRow"><td class="dataCell actionColumn"><a href="#">Edit</a> | <a href="#">Del</a></td>
<th class="dataCell"><a href="/${escapeHtml(c.Id)}">${escapeHtml(c.Name)}</a></th>
<td class="dataCell">62.0</td><td class="dataCell">Active</td><td class="dataCell">${escapeHtml(c.size)}</td>
<td class="dataCell"><img src="/img/checkbox_unchecked.gif" alt="Not Checked" title="Not Checked" width="21" height="16"></td></tr>`
    )
    .join('')
  return page({
    title: 'Apex Classes',
    body: `<table id="bodyTable"><tbody><tr><td class="oRight" id="bodyCell">
<div class="bPageTitle"><h1>Apex Classes</h1></div>
<form id="all_classes_page:theTemplate:theForm"><table><tbody><tr><td>
<input class="btn" type="button" value="Developer Console"> <input class="btn" type="button" value="New">
</td></tr></tbody></table></form>
<table class="list"><thead><tr class="headerRow"><th>Action</th><th>Name</th><th>Api Version</th><th>Status</th>
<th>Size Without Comments</th><th>Has Trace Flags</th></tr></thead><tbody>${rows}</tbody></table>
</td></tr></tbody></table>`
  })
}

export function recordPage(title) {
  return page({
    title,
    body: `<table id="bodyTable"><tbody><tr><td class="oRight" id="bodyCell">
<div class="bPageTitle"><h1>${escapeHtml(title)}</h1></div>
<form id="editPage" onsubmit="return false"><div class="pbButton">
<input class="btn" type="button" name="edit" value="Edit" onclick="document.body.dataset.clicked='edit'">
<input class="btn" type="button" name="save" value="Save" onclick="document.body.dataset.clicked='save'">
</div><label>Account Name <input id="accountName" type="text" value="Acme"></label></form>
</td></tr></tbody></table>`
  })
}

export function lightningPage(title) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)} | Salesforce</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#b0c4df}
.slds-global-header{background:#fff;padding:12px 16px;box-shadow:0 2px 2px rgba(0,0,0,.1)}
one-appnav{display:block;background:#fff;padding:8px 16px;border-top:3px solid #0176d3}
main{padding:24px}</style></head>
<body><div class="slds-global-header" role="banner">Salesforce (mock org)</div>
<one-appnav aria-label="App navigation">${escapeHtml(title)}</one-appnav>
<main><div class="oneContent"><h1>${escapeHtml(title)}</h1></div></main></body></html>`
}
