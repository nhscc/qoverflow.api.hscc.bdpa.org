// * https://www.npmjs.com/package/npm-check-updates#configuration-files

// TODO: remove outdated deps and exceptions (below) when externalizing libs to
// TODO: packages

module.exports = {
  reject: [
    // ? Pin the CJS version of execa
    'execa',
    // ? Pin the CJS version of node-fetch (and its types)
    'node-fetch',
    '@types/node-fetch',
    // ? Pin the CJS version of find-up
    'find-up',
    // ? Pin the CJS version of find-up
    'chalk',
    // ? Pin this until it gets unbroken... or maybe we'll just fork it
    'request-ip'
  ]
};
