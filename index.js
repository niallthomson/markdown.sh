#!/usr/bin/env node

import Mocha from 'mocha'
import { expect } from 'chai'

import util from 'util'
import path from 'path'
import child_process from 'child_process'
import ora from 'ora';
import GlobToRegExp from 'glob-to-regexp'

import gatherer from './lib/gatherer.js'
import { PersistentShell } from './lib/shell.js'
import { Command } from 'commander'

const program = new Command();
program
  .description('Automated test framework for Markdown that contains bash scripts')
  .arguments('<path>', 'file path to Markdown content', '.')
  .option('-g, --glob <pattern>', 'Glob for tests to include ex. content/chapter1/*', '')
  .option('-d, --debug', 'Enable debug output')
  .option('--dry-run', 'Run test but do not execute scripts')
  .option('-t, --timeout <timeout>', 'Timeout for the test run', 200000)
  .option('-w, --work-dir <path>', 'Path to ');

program.parse();

const options = program.opts();

const Test = Mocha.Test;

const suiteInstance = Mocha.Suite;
const shell = new PersistentShell(options.workDir);

const mocha = new Mocha({
  timeout: options.timeout
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
  let tests = await gatherer(program.processedArgs[0])
  spinner.succeed()

  spinner = ora("Building Mocha suites").start();
  await buildTestSuites(tests, )
  spinner.succeed()

  try {
    shell.start();
    console.log("\nExecuting tests...")
    const result = await runMochaTests()
    console.log(result);
  }
  catch (e) {
    shell.end();

    console.log(e) 
    process.exit(1)
  }
  
  shell.end();
}

async function buildTestSuites(record, parentSuite) {
  var suite
  
  if(!parentSuite) {
    suite = newSuite(record.title)
  }
  else {
    suite = suiteInstance.create(parentSuite, record.title);
  }

  if(!record.run) {
    return suite;
  }

  var addTests = true;

  if(record.path !== undefined && options.glob !== '') {
    var relativePath = path.relative(path.resolve(program.processedArgs[0]), record.path)
    var re = GlobToRegExp(options.glob, { extended: true });

    if(!re.exec(relativePath)) {
      addTests = false;
    }
  }

  if(addTests) {
    var sortedTests = record.tests.sort(function(a, b) {
      return a.weight - b.weight
    })

    for(const test in sortedTests) {
      await buildTests(sortedTests[test], suite)
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

async function buildTests(test, suite) {
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
          if(options.debug) {
            console.log(`Running script: \n${testCase.command}`)
          }

          if (!options.dryRun) {
            hook(testCase, 'before')

            await shell.execWithTimeout(testCase.command, testCase.timeout * 1000)

            hook(testCase, 'after')

            if(testCase.wait > 0) {
              await sleep(testCase.wait * 1000)
            }
          }
        } catch (e) {
          console.log(`Error running command ${testCase.command}: ${e}`)
          this.failed = true
          if(e.code !== undefined && e.code) {
            console.log(`Command returned error code ${e.code}`)
            console.log(`Output: ${e.output}`)
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
    await shell.execWithTimeout(`bash ${testCase.dir}/tests/hook-${testCase.hook}.sh ${hook}`, 120000);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await main()
