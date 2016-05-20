const spawn = require('child_process').spawn;
const through2 = require('through2');

function filterChromeOsx(data) {
  return data.toLowerCase().trim().match('^path: (.*)google chrome canary.app$');
}

function osx() {
  const LSREGISTER = "/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister";
  const dump = spawn(LSREGISTER, ['-dump']);

  dump.stderr.pipe(process.stderr);
  dump.stdout.pipe(through2(function(chunk, enc, cb) {
    chunk
      .toString()
      .split(/\r?\n/)
      .forEach(line => {
        if (filterChromeOsx(line)) {
          this.push(line.split(':')[1].trim());
          this.end();
        }
      });

    cb();
  })).pipe(process.stdout);
}

if (require.main === module) {
  osx();
}
