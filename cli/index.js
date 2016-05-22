#!/usr/bin/env node
/**
 * @license
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const meow = require('meow');
const log = require('../src/lib/log.js');
const semver = require('semver');
const Printer = require('./printer');

const chromeLauncher = require('./chrome-launcher');
const lighthouse = require('../');

// node 5.x required due to use of ES2015 features
if (semver.lt(process.version, '5.0.0')) {
  console.error('Lighthouse requires node version 5.0 or newer');
  process.exit(1);
}

const formatOptions = Object.values(Printer.OUTPUT_MODE).join(', ');

const cli = meow(`
Usage:
    lighthouse [url]

Basic:
    --help             Show this help
    --version          Current version of package

Logging:
    --verbose          Displays verbose logging
    --quiet            Displays no progress or debug logs

Run Configuration:
    --mobile           Emulates a Nexus 5X (default=true)
    --load-page        Loads the page (default=true)
    --save-trace       Save the trace contents to disk
    --save-artifacts   Generate network dependency graph

Output:
    --output           Reporter for the results
                       Reporter options: ${formatOptions}  (default=pretty)
    --output-path      The file path to output the results (default=stdout)
                       Example: --output-path=./lighthouse-results.html
`);

const url = cli.input[0] || 'https://platform-status.mozilla.org/';
const outputMode = cli.flags.output || Printer.OUTPUT_MODE.pretty;
const outputPath = cli.flags.outputPath || 'stdout';
const flags = cli.flags;

// If the URL isn't https or localhost complain to the user.
if (url.indexOf('https') !== 0 && url.indexOf('http://localhost') !== 0) {
  log.warn('Lighthouse', 'The URL provided should be on HTTPS');
  log.warn('Lighthouse', 'Performance stats will be skewed redirecting from HTTP to HTTPS.');
}

// set logging preferences
flags.logLevel = 'info';
if (cli.flags.verbose) {
  flags.logLevel = 'verbose';
} else if (cli.flags.quiet) {
  flags.logLevel = 'error';
}

function run(retries) {
  return lighthouse(url, flags)
    .then(results => {
      return Printer.write(results, outputMode, outputPath);
    })
    .then(status => {
      outputPath !== 'stdout' && log.info('printer', status);
    })
    .catch(err => {
      if (err.code === 'ECONNREFUSED') {
        if (retries > 0) {
          console.error('Unable to Connect to chrome remote debugger.');
        } else {
          console.log('Starting Chrome...');
          return chromeLauncher
            .run()
            .then(() => {
              console.log('Attempting to run again...');
              return run(retries + 1);
            })
            .then(() => chromeLauncher.kill());
        }
      } else {
        console.error('Runtime error encountered:', err);
        console.error(err.stack);
      }
    });
}

// kick off a lighthouse run
run(0);
