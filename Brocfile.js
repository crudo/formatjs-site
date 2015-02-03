'use strict';

var autoprefixer     = require('autoprefixer-core');
var compileJSX       = require('broccoli-react');
var compileModules   = require('broccoli-es6-module-transpiler');
var concatTree       = require('broccoli-concat');
var customProperties = require('postcss-custom-properties');
var mergeTrees       = require('broccoli-merge-trees');
var postcss          = require('./broccoli/postcss');
var unwatchedTree    = require('broccoli-unwatched-tree');
var Funnel           = require('broccoli-funnel');

var config = require('./config');

// -----------------------------------------------------------------------------

function copy(tree, mappings) {
    var trees = Object.keys(mappings).map(function (srcDir) {
        var destDir = mappings[srcDir];
        return new Funnel(tree, {srcDir: srcDir, destDir: destDir});
    });

    return mergeTrees(trees);
}

// -- Shared -------------------------------------------------------------------

var shared = compileJSX('shared/');

// -- Server -------------------------------------------------------------------

var server = compileModules(shared, {
    description: 'ServerModules',
    formatter  : 'commonjs',
    output     : 'server/'
});

// -- Client -------------------------------------------------------------------

var node_modules = unwatchedTree('node_modules/');

var vendor = new Funnel('public/vendor/', {
    srcDir : '/',
    destDir: '/vendor'
});

// Create list of locale data filenames for all of the locales the app supports,
// which is a small subset of all the locales Format.js libs support.
var localeDataFiles = config.availableLocales.map(function (locale) {
    return locale.split('-')[0] + '.js';
});

// Create a roll-up file of locale data for the locales the app supports for
// each integration lib.
var formatjsLocaleData = mergeTrees([
    'dust-intl',
    'handlebars-intl',
    'react-intl'
].map(function (integration) {
    return concatTree(new Funnel(node_modules, {
        srcDir : integration + '/dist/locale-data',
        destDir: '/',
        files  : localeDataFiles
    }), {
        inputFiles: ['*.js'],
        outputFile: '/vendor/formatjs/' + integration + '-locale-data.js'
    });
}));

vendor = mergeTrees([
    copy(node_modules, {
        'es6-shim'            : '/vendor/es6-shim',
        'dustjs-linkedin/dist': '/vendor/dust',
        'handlebars/dist'     : '/vendor/handlebars',
        'react/dist'          : '/vendor/react',

        'dust-intl/dist'      : '/vendor/dust-intl',
        'handlebars-intl/dist': '/vendor/handlebars-intl',
        'react-intl/dist'     : '/vendor/react-intl'
    }),

    vendor,
    formatjsLocaleData
], {overwrite: true});

var pubRoot = new Funnel('public/', {
    srcDir : '/',
    destDir: '/',
    include: [/^[^/.]+\..+$/]
});

var css = new Funnel('public/css/', {
    srcDir : '/',
    destDir: '/css'
});

css = postcss(css, {
    processors: [
        customProperties(),
        autoprefixer()
    ]
});

var img = new Funnel('public/img/', {
    srcDir : '/',
    destDir: '/img'
});

var js = new Funnel('public/js/', {
    srcDir : '/',
    destDir: '/js'
});

js = compileModules(mergeTrees([shared, js]), {
    description: 'ClientModules',
    formatter  : 'bundle',
    output     : '/js/app.js',
    sourceRoot : '/public/'
});

var client = new Funnel(mergeTrees([vendor, pubRoot, css, img, js]), {
    srcDir : '/',
    destDir: 'client'
});

// -----------------------------------------------------------------------------

module.exports = mergeTrees([server, client]);
