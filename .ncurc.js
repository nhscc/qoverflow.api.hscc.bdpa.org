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
    // ? Pin the CJS version of chalk
    'chalk',
    // ? Pin the CJS version of auto-bind
    'auto-bind',
    // ? Pin the CJS version of inquirer
    'inquirer'
  ]
};
