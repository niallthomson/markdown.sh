#!/usr/bin/env node

import Mocha from 'mocha'
import { expect } from 'chai'

import util from 'util'
import path from 'path'
import child_process from 'child_process'
import ora from 'ora';
import { cleanEnv, str, bool, num } from 'envalid'
import GlobToRegExp from 'glob-to-regexp'

import gatherer from './lib/gatherer.js'

const exec = util.promisify(child_process.exec);

const env = cleanEnv(process.env, {
  CONTENT_PATH:    str(),
  PATH_FILTER:     str({default: ''}),
  GLOBAL_TIMEOUT:  num({default: 200000}),
  SKIP_COMMANDS:   bool({default: false}),
  DEBUG_MODE:      bool({default: false}),
})

const Test = Mocha.Test;

const suiteInstance = Mocha.Suite;

const mocha = new Mocha({
  timeout: env.GLOBAL_TIMEOUT
});

const newSuite = (suiteName = 'Suite Name') => suiteInstance.create(mocha.suite, suiteName);

const runMochaTests = () => {
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures) reject('at least one test is failed, check detailed execution report')
      resolve('success')
    });
  });
}

async function main() {
  let spinner = ora('Generating test cases').start();
  let tests = await gatherer(env.CONTENT_PATH)
  spinner.succeed()

  spinner = ora("Building Mocha suites").start();
  await buildTestSuites(tests.children[0], newSuite("Root"))
  spinner.succeed()

  try {
    console.log("\nExecuting tests...")
    const result = await runMochaTests()
    console.log(result);
  }
  catch (e) { 
    console.log(e) 
    process.exit(1)
  }
}

async function buildTestSuites(record, parentSuite) {
  let suite = suiteInstance.create(parentSuite, record.title);

  var addTests = true;

  if(record.path !== undefined && env.PATH_FILTER !== '') {
    var relativePath = path.relative(path.resolve(env.CONTENT_PATH), record.path)
    var re = GlobToRegExp(env.PATH_FILTER, { extended: true });

    if(!re.exec(relativePath)) {
      addTests = false;
    }
  }

  if(addTests) {
    var sortedTests = record.tests.sort(function(a, b) {
      return a.weight - b.weight
    })

    for(const test in sortedTests) {
      await buildTest(sortedTests[test], suite)
    }
  }

  var sortedChildren = record.children.sort(function(a, b) {
    return a.weight - b.weight
  })

  for(const child in sortedChildren) {
    await buildTestSuites(sortedChildren[child], suite)
  }

  return suite;
}

async function buildTest(test, suite) {
  suite.addTest(new Test(test.title, async function () {
    if(test.cases.length == 0) {
      this.skip();
      return
    }

    for(const i in test.cases){
      let testCase = test.cases[i]

      if(this.failed === undefined) {
        this.failed = false
      }
      
      if(this.failed === false) {
        try {
          if(env.DEBUG_MODE) {
            console.log(`Running command: ${testCase.command}`)
          }

          if (!env.SKIP_COMMANDS) {
            hook(testCase, 'before')

            const { stdout, stderr } = await exec('set -Eeuo pipefail\n'+testCase.command, {
              timeout: testCase.timeout * 1000,
              shell: '/bin/bash'
            });

            hook(testCase, 'after')
          }

          if(testCase.wait > 0) {
            await sleep(testCase.wait * 1000)
          }
        } catch (e) {
          console.log(`Error running command ${testCase.command}: ${e}`)
          this.failed = true
          if(e.code !== undefined && e.code) {
            console.log(`Command returned error code ${e.code}`)
            console.log(`stdout: ${e.stdout}`)
            console.log(`stderr: ${e.stderr}`)
            expect(e.code).to.equal(0);
          }
          else {
            console.log('Command probably timed out')
            expect(testCase.timeout + 1).to.lessThanOrEqual(testCase.timeout)
          }
        }
      }
      else {
        this.skip()
      }
    }
  }));
}

async function hook(testCase, hook) {
  if(testCase.hook) {
    await exec(`bash ${testCase.dir}/tests/hook-${testCase.hook}.sh ${hook}`, {
      timeout: 120000,
      shell: '/bin/bash'
    });
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await main()
