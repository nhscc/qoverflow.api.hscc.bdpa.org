'use strict';
// * Every now and then, we adopt best practices from CRA
// * https://tinyurl.com/yakv4ggx

const debug = require('debug')(`${require('./package.json').name}:babel-config`);

// * https://babeljs.io/docs/babel-preset-react
const sharedReactConfig = {
  runtime: 'automatic',
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  development: !process.env.NODE_ENV?.startsWith('production')
};

// ? Next.js-specific Babel settings
const nextBabelPreset = [
  'next/babel',
  {
    'preset-env': {
      targets: 'defaults',

      // ? If users import all core-js they're probably not concerned with
      // ? bundle size. We shouldn't rely on magic to try and shrink it.
      useBuiltIns: false,

      // ? Do not transform modules to CJS
      // ! MUST BE FALSE (see: https://nextjs.org/docs/#customizing-babel-config)
      modules: false,

      // ? Exclude transforms that make all code slower
      exclude: ['transform-typeof-symbol']
    },
    'preset-typescript': {
      allowDeclareFields: true
    },
    'preset-react': sharedReactConfig
  }
];

module.exports = {
  comments: false,
  parserOpts: { strictMode: true },
  generatorOpts: { importAttributesKeyword: 'with' },
  assumptions: { constantReexports: true },
  plugins: [
    // {@symbiote/notExtraneous @babel/plugin-proposal-export-default-from}
    '@babel/plugin-proposal-export-default-from'
  ],
  // ? Sub-keys under the "env" config key will augment the above
  // ? configuration depending on the value of NODE_ENV and friends. Default
  // ? is: development
  env: {
    // * Used by Jest and `npm test`
    test: {
      sourceMaps: 'both',
      presets: [
        ['@babel/preset-env', { targets: { node: true } }],
        ['@babel/preset-react', sharedReactConfig],
        ['@babel/preset-typescript', { allowDeclareFields: true }]
        // ? We don't care about minification
      ],
      plugins: [
        // ? Only active when testing, the plugin solves the following problem:
        // ? https://stackoverflow.com/q/40771520/1367414
        'explicit-exports-references'
      ]
    },
    // * Used by Vercel, `npm start`, and `npm run build`
    production: {
      // ? Source maps are handled by Next.js and Webpack
      presets: [nextBabelPreset]
      // ? Minification is handled by Webpack
    },
    // * Used by `npm run dev`; is also the default environment
    development: {
      // ? Source maps are handled by Next.js and Webpack
      presets: [nextBabelPreset]
      // ? We don't care about minification
    }
  }
};

debug('exports: %O', module.exports);
