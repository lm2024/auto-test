var trustedPolicy = {
  createScriptURL: (url) => url,
  createHTML: (string, sink) => string,
  createScript: string => string,
}

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  trustedPolicy = window.trustedTypes.createPolicy('default2', trustedPolicy);
}
