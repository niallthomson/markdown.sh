# Markdown.sh

Its common for educational content to be authored using Markdown files, and for some types of content these can contain large amounts of scripts and commands to be executed by the learner. Protecting this type of content from breaking changes, regressions and atrophy over time can be challenging to do in an automated fashion.

This framework can consume a set of Markdown documents, parse out the `code` blocks and execute these as a suite of unit tests.

````
---
title: "My Educational Content"
weight: 10
---

# My Educational Content

Lets execute this is a command-line:

```bash
ls -la
```
````

Output from testing might look like:

```
✔ Generating test cases
✔ Building Mocha suites

Executing tests...


  My Educational Content
    ✔ My Educational Content


  1 passing (13ms)

success
```

Its features include:
- Recursively parse all Markdown documents in a directory structure
- Order complex sets of content correctly with Frontmatter metadata (`weight`)
- Additional flags to control test behavior, such as timeouts
- A hook mechanism to plug in 'before' and 'after' actions for each test
- Ability to run subset of tests with globs (`chapter1/**`)
- Support for JUnit report output format

## Installing

You can get started using `markdown-sh` either from NPM:

```
npm install -g @niallthomson/markdown-sh

markdown-sh --help
```

Or using the Docker image:

```
docker run -it niallthomson/markdown-sh:latest --help
```

## Usage

Basic usage:

```
markdown-sh <path to content>
```

Where the structure of the content directory might look something like this:

```
├── _index.md
├── chapter1
│   ├── _index.md
│   └── introduction.md
├── chapter2
│   ├── _index.md
│   └── introduction.md
└── chapter3
    ├── _index.md
    └── introduction.md
```

You can test a specific subsets of the Markdown using the `--glob` parameter:

```
markdown-sh --glob {chapter1,chapter3}/* .
```

See [test-content](./test-content) for a concrete example.

Theres a chance `markdown-sh` can run on your existing Markdown content unmodified, but it may need some help.

First, make sure that all the code blocks specify `bash` as a language:

````
```
echo "This won't get run"
```

```bash
echo "This will get run"
```
````

If there are `bash` segments you do not want to run you can indicate they should be skipped:

````
```bash test=false
echo "This won't get run"
```
````

For cases where theres a concerned a script might run for too long or not finish, you can specify a timeout in seconds (default is 60 seconds):

````
```bash timeout=120
echo "This test case will fail"
sleep 150
```
````

## How does it work?

The tool recursively walks the content directory looking for Markdown files, which are parsed using the `unified` and `remark` libraries. Metadata about the pages (title, weight) are extracted, along with any `code` block that indicates `bash` as the language.

This data is used to programmatically generate a set of tests using the Mocha testing framework, with each "chapter" being modelled as a separate Mocha test suite. These tests are order using the `weight` metadata from Frontmatter if it exists, otherwise it is in alphabetical order.

When the test suites run the commands from the `code` blocks are executed in a persistent shell session, which allows it to maintain things like environment variables set using `export` for the life of the tests.