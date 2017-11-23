function getParam(s) {
  const url = new URL(location.href)
  return url.searchParams.get(s)
}

export {getParam}
