const child_process = require('child_process');
const fs = require('fs');
const osxchrome = require('./osx-chrome');
const inquirer = require('inquirer');

const spawn = child_process.spawn;
const execSync = child_process.execSync;

function defaults(val, def) {
  return typeof val !== 'undefined' ? val : def;
}

class Launcher {
  constructor(opts) {
    opts = opts || {};
    // choose the first one (default)
    this.head = defaults(opts.head, true);
    this.osxExecPath = defaults(opts.osxExecPath, '/Contents/MacOS/Google Chrome Canary');

    switch (process.platform) {
      case 'darwin':
      this.TMP_PROFILE_DIR = execSync('mktemp -d -t lighthouse').toString().trim();
      this.run = this.spawnOsx.bind(this);
      break;
      case 'linux':
      this.TMP_PROFILE_DIR = execSync('mktemp -d -t lighthouse.XXXXXXX').toString().trim();
      this.run = this.spawnLinux.bind(this);
      default:
      throw new Error('Platform not supported');
    }

    this.outFile = fs.openSync(`${this.TMP_PROFILE_DIR}/chrome-out.log`, 'a');
    this.errFile = fs.openSync(`${this.TMP_PROFILE_DIR}/chrome-err.log`, 'a');
    this.pidFile = fs.openSync(`${this.TMP_PROFILE_DIR}/chrome.pid`, 'w');

    // instances
    this.chromeInstances = [];

    this.destroyTmp = this.destroyTmp.bind(this);
    process.on('SIGINT', () => {
      this.kill();
      this.destroyTmp();
    });

    this.flags = [
      '--remote-debugging-port=9222',
      '--no-first-run',
      `--user-data-dir=${this.TMP_PROFILE_DIR}`
    ];

    console.log(`created ${this.TMP_PROFILE_DIR}`);
  }
  spawnOsx() {
    return osxchrome
      .getChrome()
      .then(installations => this.head ? installations[0] : this.inquire(installations))
      .then(chromePath => {
        const chromeExecPath = chromePath + this.osxExecPath;
        const chrome = spawn(
          chromeExecPath,
          this.flags,
          {
            detached: true,
            stdio: ['ignore', this.outFile, this.errFile]
          }
        );
        fs.writeSync(this.pidFile, chrome.pid.toString());
        chrome.on('exit', _ => {
          chrome.kill();
          this.destroyTmp();
        });
        this.chromeInstances.push(chrome);

        console.log('chrome running with pid = ', chrome.pid);
        return new Promise(resolve => {
          let nMessages =  0;
          process.nextTick(_ => {
            if (nMessages === 0) {
              chrome.unref();
              resolve(chrome.pid);
            }
            nMessages++;
          });
        });
      });
  }

  spawnLinux() {
    // TODO
  }

  kill() {
    console.log('Killing all Chrome Instances');
    this.chromeInstances.forEach(chrome => {
      chrome.kill();
    });
  }
  destroyTmp() {
    console.log(`Removing TMPDIR: ${this.TMP_PROFILE_DIR}`);
    execSync(`rm -r ${this.TMP_PROFILE_DIR}`);
  }

  inquire(arr) {
    const name = 'chrome';
    return inquirer.prompt([{
      type: 'list',
      name,
      message: 'Choose a Chrome Installation to use with lighthouse',
      choices: arr
    }]).then(i => i[name]);
  }
}

module.exports = new Launcher();
