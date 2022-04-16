import child_process from 'child_process'
import treeKill from 'tree-kill'

export class PersistentShell {
  constructor(workDir, debug) {
    this.workDir = workDir;
    this.debug = debug;
  }

  start() {
    this.child = child_process.spawn('bash', {
      cwd: this.workDir,
      shell: true
    })
  }

  clearListeners() {
    this.child.stdout.removeAllListeners()
    this.child.stderr.removeAllListeners()
  }

  cleanupCommand(buf) {
    let output = String(buf)
    if(this.debug) {
      console.log(`Output: \n${output}`)
    }
    this.clearListeners();

    return output
  }

  async exec(command, expectError) {
    if(this.debug) {
      console.log(`Running script: \n${command}`)
    }

    return new Promise((resolve, reject) => {
      var buf = Buffer.alloc(0)
      this.child.stdout.on('data', (d) => {
        buf = Buffer.concat([buf, d])
        if(buf.includes('ERRORCODE')) {    
          if(this.debug) {
            console.log('Resolving command')
          }

          let output = this.cleanupCommand(buf)
          resolve(output)
        }
      })
      this.child.stderr.on('data', d => {
        buf = Buffer.concat([buf, d])
        
        if(expectError) {
          if(this.debug) {
            console.log('Ignoring error since its expected')
          }
        }
        else {
          if(this.debug) {
            console.log('Rejecting command')
          }

          let output = this.cleanupCommand(buf)

          reject({
            code: 1, // Can't get actual error code yet
            output
          });
        }
      })
      this.child.stdin.write(`${command}\necho ERRORCODE=$?\n`)
    })
  }

  async execWithTimeout(command, timeout, expectError) {
    let promise = this.exec(command, expectError)
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