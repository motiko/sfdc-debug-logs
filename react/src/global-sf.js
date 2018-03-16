import SF from './api/sf'

function getParam(s) {
  const url = new window.URL(window.location.href)
  return url.searchParams.get(s)
}

const globalSf = new SF(
  getParam('host'),
  getParam('sid'),
  getParam('uid'),
  getParam('oid')
)

export default globalSf
