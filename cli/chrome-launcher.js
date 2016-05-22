const child_process = require('child_process');
const fs = require('fs');
const osxchrome = require('./osx-chrome');
const inquirer = require('inquirer');
const net = require('net');

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

    process.on('SIGINT', () => {
      this.kill();
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
        this.chromeInstances.push(chrome);

        fs.writeSync(this.pidFile, chrome.pid.toString());

        chrome.on('exit', _ => {
          this.kill();
        });

        chrome.unref();

        console.log('chrome running with pid = ', chrome.pid);
        return this.poll(0).then(_ => chrome.pid);
      });
  }

  poll(retries) {
    return new Promise((resolve, reject) => {
      if (retries > 10) return reject(new Error('Polling stopped'));
      const client = net.createConnection(9222);
      client.on('error', poll(retries + 1));
      client.on('connect', resolve);
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
    process.nextTick(_ => this.destroyTmp());
  }
  destroyTmp() {
    console.log(`Removing TMPDIR: ${this.TMP_PROFILE_DIR}`);
    execSync(`rm -rf ${this.TMP_PROFILE_DIR}`);
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
