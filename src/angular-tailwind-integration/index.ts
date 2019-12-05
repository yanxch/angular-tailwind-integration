import { apply, branchAndMerge, chain, mergeWith, move, Rule, SchematicContext, Tree, url, MergeStrategy } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { addPackageJsonDependency, NodeDependencyType as DepType } from '@schematics/angular/utility/dependencies';

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function angularTailwindIntegration(_options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {


    // 1) add dependencies
    const webpackBuilderDependency =  { type: DepType.Dev, name: '@angular-builders/custom-webpack', version: '^8.4.0', overwrite: true };
    const tailwindDependency = { type: DepType.Dev, name: 'tailwindcss', version: '^1.1.4', overwrite: true };
    addPackageJsonDependency(tree, webpackBuilderDependency);
    addPackageJsonDependency(tree, tailwindDependency);
    _context.logger.log('info', `✅️ Added dev dependency to package.json: "${webpackBuilderDependency.name}", version: ` + webpackBuilderDependency.version);
    _context.logger.log('info', `✅️ Added dev dependency to package.json: "${tailwindDependency.name}", version: ` + tailwindDependency.version);

    // 2) Install Package
    _context.addTask(new NodePackageInstallTask());
    _context.logger.log('info', `✅️ Triggered npm install.`);

    // 3) copy config files
    const configFiles = apply(url('./files'), [
      move('./tailwind')
    ]);
    _context.logger.log('info', `✅️ Copied tailwind configuration`);
   


    // 4) adjust angular.json
    const angular_json = JSON.parse(tree.read('./angular.json')!.toString());

    const project = angular_json.projects[_options.project || angular_json.defaultProject];
    
    const currentBuild = project.architect.build;

    project.architect['build'] = {
        ...currentBuild,
        builder: '@angular-builders/custom-webpack:browser',
        options: {
          ...currentBuild.options,
          styles: [...currentBuild.options.styles, 'tailwind/tailwind.css'],
          customWebpackConfig: {
            path: 'tailwind/tailwind.webpack.js'
          }
        }
    }

    const currentServe = project.architect.serve;
    project.architect['serve'] = {
      ...currentServe,
      builder: '@angular-builders/custom-webpack:dev-server',
      options: {
        ...currentServe.options,
        customWebpackConfig: {
          path: 'tailwind/tailwind.webpack.js'
        }
      }
    };

    tree.overwrite('angular.json', JSON.stringify(angular_json, null, 2));
    _context.logger.log('info', `✅️ angular.json adjusted.`);

    return branchAndMerge(chain([
      mergeWith(configFiles)
    ]));
  };
}
