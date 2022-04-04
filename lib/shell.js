import child_process from 'child_process'
import treeKill from 'tree-kill'

export class PersistentShell {
  constructor(workDir) {
    this.workDir = workDir;
  }

  start() {
    this.child = child_process.spawn('bash', {
      cwd: this.workDir
    })
  }

  clearListeners() {
    this.child.stdout.removeAllListeners()
    this.child.stderr.removeAllListeners()
  }

  async exec(command) {
    return new Promise((resolve, reject) => {
      var buf = Buffer.alloc(0)
      this.child.stdout.on('data', (d) => {
        buf = Buffer.concat([buf, d])
        if(buf.includes('ERRORCODE')) {
          this.clearListeners();
          resolve(String(buf))
        }
      })
      this.child.stderr.on('data', d => {
        buf = Buffer.concat([buf, d])
        this.clearListeners();
        reject({
          code: 1, // Can't get actual error code yet
          output: String(buf)
        });
      })
      this.child.stdin.write(`${command}\necho ERRORCODE=$?\n`)
    })
  }

  async execWithTimeout(command, timeout) {
    let promise = this.exec(command)
    let timer = null

    return Promise.race([
      promise.then((value) => {
        clearTimeout(timer);
        return value;
      }),
      new Promise(function(_, reject){
        timer = setTimeout(function() {
          reject("timeout");
        }, timeout);
      })
    ]);
  }

  reset() {
    this.end();
    this.start();
  }

  end() {
    if(this.child) {
      treeKill(this.child.pid, 'SIGKILL');
      this.child = undefined
    }
  }
}