import { parseArgs } from 'jsr:@std/cli/parse-args';
import { join, resolve } from 'jsr:@std/path';

/**
 * Quick way to create new Potami module.
 *
 * Use with `new-module.ts --name=mymodule`.
 *
 * Result will be a new folder in the CWD with name `mymodule`, prefilled
 * with the handy starter files for a new module.
 */
async function main() {
  const { name, version = '0.1.0' } = parseArgs(Deno.args);

  if (!name) {
    throw new Error('No name provided. You must provide a name flag specifying the name of the module.');
  }

  console.log('Creating new module...');

  const newModulePath = resolve(Deno.cwd(), name);

  const rootDenoJsonPath = resolve(Deno.cwd(), 'deno.json');
  const rootDenoJsonContents = JSON.parse(new TextDecoder().decode(await Deno.readFile(rootDenoJsonPath)));
  const newRootDenoJsonContents = JSON.stringify(
    { ...rootDenoJsonContents, workspace: [...rootDenoJsonContents.workspace, `./${name}`] },
    null,
    2
  );

  const encoder = new TextEncoder();

  await Deno.writeFile(rootDenoJsonPath, encoder.encode(newRootDenoJsonContents));
  await Deno.mkdir(newModulePath);
  await Deno.writeFile(
    join(newModulePath, 'deno.json'),
    encoder.encode(`{
  "name": "@potami/${name}",
  "version": "${version}",
  "exports": "./mod.ts",
  "license": "MIT"
}`)
  );
  await Deno.writeFile(join(newModulePath, 'mod.ts'), encoder.encode(''));
  await Deno.writeFile(join(newModulePath, 'readme.md'), encoder.encode(`# @potami/${name}`));
  await Deno.writeFile(
    join(newModulePath, 'changelog.md'),
    encoder.encode(`# ${version}

- Released package.
`)
  );

  console.log('%cModule created', 'color: lightgreen');
}

await main();
