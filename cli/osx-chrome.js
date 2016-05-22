const spawn = require('child_process').spawn;
const through2 = require('through2');

class LsRegisterError extends Error {
  constructor(code, desc) {
    super(`LsRegister exited with ${code}`);
    this.code = code;
    this.desc = desc;
  }
}

class OsxChrome {
  constructor() {
    this.LSREGISTER
      = "/System/Library/Frameworks/CoreServices.framework"
      + "/Versions/A/Frameworks/LaunchServices.framework"
      + "/Versions/A/Support/lsregister";
    this.CHROME_REGEX = /^path: (.*)google chrome canary.app$/;
    this.isLsRegisterError = err => err instanceof LsRegisterError;
  }
  getChrome() {
    return new Promise((resolve, reject) => {
      const dump = spawn(this.LSREGISTER, ['-dump']);
      const chromeInstances = [], errors = [];

      dump.stdout.pipe(this.extractChrome()).on('data', chunk => {
        chromeInstances.push(chunk.toString());
      });

      dump.stderr.on('data', err => {
        errors.push(err);
      });

      dump.on('error', reject);

      dump.on('close', code => {
        if (code !== 0) {
          const err = new LsRegisterError(code, errors.join('\n'));
          reject(err);
        } else {
          resolve(chromeInstances);
        }
      });
    });
  }
  extractChrome() {
    // var that = this;
    const CHROME_REGEX = this.CHROME_REGEX;
    return through2(function(chunk, enc, callback) {
      chunk
        .toString()
        .split(/\r?\n/)
        .forEach(line => {
          if (CHROME_REGEX.test(line.toLowerCase().trim())) {
            this.push(line.split(':')[1].trim());
          }
        });
      callback();
    });
  }
}

module.exports = new OsxChrome();
