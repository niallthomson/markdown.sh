import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import path from 'path'
import fs from 'fs';
import YAML from 'yaml'

const TITLE_KEY = 'title',
      WEIGHT_KEY = 'weight',
      TIMEOUT_KEY = 'timeout',
      WAIT_KEY = 'wait',
      HOOK_KEY = 'hook',
      TEST_KEY = 'test',
      EXPECT_ERROR_KEY = 'expectError'

const index_page_names = ['_index.md', 'index.en.md', 'index.md']

export default async function gatherer(dir) {
  return await walk(dir, null)
}

async function walk(dir, data) {
  if(!data) {
    data = {title: 'Root', weight: 0, children: [], tests: [], run: true}
  }

  let files = fs.readdirSync(dir);

  for(const item of files) {
    let itemPath = path.join(dir, item);

    let stats = fs.statSync(itemPath);

    if(item === '.notest') {
      data.run = false
    }
    else if (stats.isDirectory()) {
      let child = {title: 'Unknown', children: [], tests: [], run: true}
      data.children.push(child);

      await walk(itemPath, child);

    } else if(item.endsWith(".md")) {
      let metadata = await read_markdown(itemPath, dir)

      if(metadata) {
        if(index_page_names.includes(item)) {
          data.title = metadata.title
          data.weight = metadata.weight
          data.path = itemPath

          metadata.weight = 1
        }

        data.tests.push(metadata)
      }
    }
  }

  return data;
};

async function read_markdown(file, dir) {
  const data = await fs.promises.readFile(file, 'utf8')

  let metadata = {title: '', cases: [], weight: 0}

  const parsed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    .parse(data)

  const { children } = parsed
  let child = children[0]

  if (child.type === 'yaml') {
    let value = child.value

    let obj = YAML.parse(value)
    metadata.title = obj[TITLE_KEY]

    if( obj[WEIGHT_KEY] !== undefined ) {
      metadata.weight = parseInt(obj[WEIGHT_KEY])
    }
  }
  else {
    return null;
  }

  const blocks = gather_blocks(parsed, dir)

  for(const block in blocks) {
    metadata.cases.push(blocks[block])
  }

  return metadata;
}

const gather_blocks = (tree, dir) => {
  
  const { children } = tree
  let data = []
  let i = -1
  let child

  while (++i < children.length) {
    child = children[i]

    if (child.type === 'code' && child.value) {
      if (child.lang === 'bash') {
        let meta = child.meta
        let add = true
        let wait = 0
        let timeout = 30
        let hook = null
        let expectError = false

        if(meta) {
          // TODO: Change this to regex https://regex101.com/r/uB4sI9/1
          let params = meta.split(' ')

          if(params) {
            params.forEach(function(param) {
              let parts = param.split("=")

              if(parts.length == 2) {
                let key = parts[0]
                let value = parts[1]

                switch (key) {
                  case WAIT_KEY:
                    wait = parseInt(value)
                    break;
                  case TIMEOUT_KEY:
                    timeout = parseInt(value)
                    break;
                  case TEST_KEY:
                    add = (value === "false") ? false : true;
                    break;
                  case EXPECT_ERROR_KEY:
                    expectError = (value === "true") ? true : false;
                    break;
                  case HOOK_KEY:
                      hook = value
                      break;
                  default:
                    console.log(`Warning: Unrecognized param ${key} in code block`);
                }
              }
            });
          }
        }

        if(add) {
          data.push({
            command: child.value,
            wait: wait,
            timeout: timeout,
            hook: hook,
            expectError: expectError,
            dir: dir
          });
        }
      }
    }
  }

  return data
}