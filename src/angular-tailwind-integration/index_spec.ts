import {SchematicTestRunner, UnitTestTree} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import {concatMap} from 'rxjs/operators';
import {WorkspaceSchema} from '@schematics/angular/utility/workspace-models';


const collectionPath = path.join(__dirname, '../collection.json');


describe('angular-tailwind-integration', () => {
  let runner: SchematicTestRunner;
  let tree: UnitTestTree;

  beforeEach(async () => {
    runner = new SchematicTestRunner('schematics', collectionPath);
  });

  it('should update package.json', async () => {
    //
    // Given
    tree = await createWorkspace(runner);
    //
    // When
    tree = await runner.runSchematicAsync('ng-add', {}, tree).toPromise();
    //
    // Then
    const packageJson = JSON.parse(tree.readContent('/package.json'));
    const devDependencies = packageJson.devDependencies;
    const customWebpackDependency = devDependencies['@angular-builders/custom-webpack'];
    const tailwindDependency = devDependencies['tailwindcss'];

    expect(customWebpackDependency).toBe('^8.4.0');
    expect(tailwindDependency).toBe('^1.1.4');
  });

  it('should update the angular.json', async () => {
    // 
    // Given
    tree = await createWorkspace(runner);
    //
    // When
    tree = await runner.runSchematicAsync('ng-add-setup', {}, tree).toPromise();
    //
    // Then
    const workspace: WorkspaceSchema = JSON.parse(tree.readContent('/angular.json'));
    const project = workspace.defaultProject;
    const architect = workspace.projects[project].architect;

    expect(architect.build.builder).toBe('@angular-builders/custom-webpack:browser');
    expect(architect.serve.builder).toBe('@angular-builders/custom-webpack:dev-server');

    const expectedWepackOptions = {
      customWebpackConfig: {
        path: 'tailwind/tailwind.webpack.js'
      }
    };

    expect(architect.build.options).toEqual(jasmine.objectContaining(expectedWepackOptions));
    expect(architect.serve.options).toEqual(jasmine.objectContaining(expectedWepackOptions));

    const hasTailwindConfig = tree.exists('tailwind/tailwind.config.js');
    const hasTailwindCss = tree.exists('tailwind/tailwind.css');
    const hasTailwindWebpackConfig = tree.exists('tailwind/tailwind.webpack.js');

    expect(hasTailwindConfig).toBe(true, 'tailwind/tailwind.config.js is missing!');
    expect(hasTailwindCss).toBe(true, 'tailwind/tailwind.css is missing!');
    expect(hasTailwindWebpackConfig).toBe(true, 'tailwind/tailwind.webpack.js is missing!');
  })
});

//
// TODO: Move to custom file
export const defaultWorkspaceOptions = {
  name: 'workspace',
  newProjectRoot: 'projects',
  version: '8.0.0'
};

export const defaultAppOptions = {
  name: 'test-app',
  inlineStyle: false,
  inlineTemplate: false,
  viewEncapsulation: 'Emulated',
  routing: false,
  style: 'css',
  skipTests: false
};

function createWorkspace(runner: SchematicTestRunner) {
  return runner
    .runExternalSchematicAsync('@schematics/angular', 'workspace', defaultWorkspaceOptions)
    .pipe(concatMap(tree => runner.runExternalSchematicAsync('@schematics/angular', 'application', defaultAppOptions, tree)))
    .toPromise();
}