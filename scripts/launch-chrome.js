const spawn = require('child_process').spawn;
const through2 = require('through2');

class OSX {
  constructor() {
    const LSREGISTER = "/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister";
    this.dump(LSREGISTER);
  }
  dump(lsregister) {
    this.lsregisterdump = spawn(this._lsregister, ['-dump']);
    this.lsregisterdump.stderr.pipe(process.stderr);
    this.lsregisterdump.stdout.pipe(this.filter())
  }
  filter() {
    return through2(function(chunk, env, cb) {
      chunk
        .toString()
        .split(/\r?\n/)
        .forEach(line => {
          if (filterChrome(line)) {
            this.push(line.split(':')[1].trim());
          }
        });

      cb();
    });
  }
  _filterChrome(data) {
    return data.toLowerCase().trim().match('^path: (.*)google chrome canary.app$');
  }
}

function osx() {
  const LSREGISTER =
  const lsregisterDump = spawn(LSREGISTER, ['-dump']);

  lsregisterDump.stdout.pipe(through2(function (chunk, enc, cb) {

  })).pipe(process.stdout);

  lsregisterDump.stderr.pipe(process.stderr);

  function filterChrome(data) {

  }
}

if (require.main === module) {
  osx();
}
