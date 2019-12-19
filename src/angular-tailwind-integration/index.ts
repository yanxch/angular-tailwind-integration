import {WorkspaceSchema} from '@angular-devkit/core/src/experimental/workspace';
import {apply, chain, forEach, mergeWith, move, noop, Rule, SchematicContext, SchematicsException, Tree, url, template} from '@angular-devkit/schematics';
import {NodePackageInstallTask, RunSchematicTask} from '@angular-devkit/schematics/tasks';
import {getWorkspace, updateWorkspace} from '@schematics/angular/utility/config';
import {addPackageJsonDependency, NodeDependencyType as DepType, removePackageJsonDependency} from '@schematics/angular/utility/dependencies';
import {AddSchema} from './schema';
import {Builders} from '@schematics/angular/utility/workspace-models';


export function addDependencies(options: AddSchema): Rule {
  return (tree: Tree, context: SchematicContext) => {

    const customWebpack = {
      type: DepType.Dev,
      name: '@angular-builders/custom-webpack',
      version: options.customWebpackVersion || '^8.4.0',
      overwrite: true
    };
    
    const tailwind = {
      type: DepType.Dev,
      name: 'tailwindcss',
      version: options.tailwindVersion || '^1.1.4',
      overwrite: true
    };

    addPackageJsonDependency(tree, customWebpack);
    addPackageJsonDependency(tree, tailwind);

    const installTaskId = context.addTask(new NodePackageInstallTask());

    context.addTask(new RunSchematicTask('ng-add-setup', options), [installTaskId]);
  };
}

// this is the ng-add-setup schematic
export function addTailwind(options: AddSchema): Rule {
  return (tree: Tree, context: SchematicContext) => {

    const workspace = getWorkspace(tree);
    const project = getProject(options, workspace);
    const architect = workspace.projects[project].architect;

    if (!architect) throw new SchematicsException(`Expected node projects/${project}/architect in angular.json`);
    if (!architect.build) throw new SchematicsException(`Expected node projects/${project}/architect/build in angular.json`);
    if (!architect.serve) throw new SchematicsException(`Expected node projects/${project}/architect/serve in angular.json`);

    architect.build.builder =  <any> '@angular-builders/custom-webpack:browser';
    architect.serve.builder = <any> '@angular-builders/custom-webpack:dev-server';

    const buildOptions = <any> architect.build.options;
    const serveOptions = <any> architect.serve.options;

    addWebpackOption(tree, buildOptions, context);
    addWebpackOption(tree, serveOptions, context);
    

    addStylesOption(tree, buildOptions, options);
    
    return chain([
      copyTailwindConfig(options),
      renameStyles(options),
      updateWorkspace(workspace)
    ]);
  };
}

function copyTailwindConfig(options: AddSchema): Rule {
  return (tree: Tree, context: SchematicContext) => {   
    const styleExtension = getStyleExtension(tree, options);
    const configFiles = apply(url('./files'), [
      template({ styleExtension }),
      move('./tailwind'),
      options.overwrite ? overwriteIfExists(tree) : noop()
    ]);
    return mergeWith(configFiles)(tree, context);
  };
}

function renameStyles(options: AddSchema): Rule {
  return (tree: Tree, context: SchematicContext) => {  
    const styleExtension = getStyleExtension(tree, options); 
    if (styleExtension === 'scss') {
      tree.rename('/tailwind/tailwind.css', '/tailwind/tailwind.scss');
    }
    return tree;
  };
}

function getProject(options: AddSchema, workspace: WorkspaceSchema) {
  return options.project || workspace.defaultProject || Object.keys(workspace.projects)[0];
}

function overwriteIfExists(host: Tree): Rule {
  return forEach(fileEntry => {
    if (host.exists(fileEntry.path)) {
      host.overwrite(fileEntry.path, fileEntry.content);
      return null;
    }
    return fileEntry;
  });
}

function addWebpackOption(tree: Tree, options: any, context: SchematicContext) {
  if (options.customWebpackConfig) {

    // TODO: Log content of tailwind.webpack.js
    const source = `module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            {
              loader: 'postcss-loader',
              options: {
                ident: 'postcss',
                plugins: [
                  require("postcss-import"),
                  require('tailwindcss')('./tailwind.config.js'),
                  require('autoprefixer')
                ]
              }
            }
          ]
        }
      ]
    }`;    
    context.logger.warn(`You are already using a customWebpackConfig in your angular.json. \nWe copied all necessary files to the tailwind folder in the root of your project. \nTake a look at the tailwind.webpack.js configuration and merge it with the existing webpack configuration manually. \nThat should be the only thing you'll have to do manually, all other tailwind configuration steps are already done.\n\n`);
    context.logger.warn(`Please add following configuration manually to your custom webpack configuration: `);
    context.logger.warn(`======= WEBPACK CONFIG =======`);
    context.logger.warn(source);
    context.logger.warn(`===============================`);
  } else {
    options.customWebpackConfig = {
      path: 'tailwind/tailwind.webpack.js'
    };
  }
}

function addStylesOption(tree: Tree, options: any, schemaOptions: AddSchema) {
  const styleExtension = getStyleExtension(tree, schemaOptions);

  if (!options.styles.includes(`tailwind/tailwind.${styleExtension}`)) {
    options.styles = [ ...options.styles, `tailwind/tailwind.${styleExtension}`];
  }
}

function getStyleExtension(tree: Tree, options: AddSchema) {
  const css = tree.exists('/src/styles.css') && 'css';
  const scss = tree.exists('/src/styles.scss') && 'scss';

  return css || scss || options.styleExtension || 'css';
} 

export function removeTailwind(options: AddSchema): Rule {
  return (tree: Tree, context: SchematicContext) => {

    removePackageJsonDependency(tree, '@angular-builders/custom-webpack');
    removePackageJsonDependency(tree, 'tailwindcss');
    
    context.addTask(new NodePackageInstallTask());

    const workspace = getWorkspace(tree);
    const project = getProject(options, workspace);
    const architect = workspace.projects[project].architect;

    architect.build.builder = Builders.Browser;
    architect.serve.builder = Builders.DevServer;

    removeCustomWebpackConfig(architect.build.options);
    removeCustomWebpackConfig(architect.serve.options);

    removeTailwindStyles(architect.build.options, getStyleExtension(tree, options));

    tree.delete('/tailwind');

    return updateWorkspace(workspace);
  };
}

function removeCustomWebpackConfig(options: any) {
  if (options.customWebpackConfig.path === 'tailwind/tailwind.webpack.js') {
    delete options.customWebpackConfig; 
  }
}

function removeTailwindStyles(options: any, styleExtension: string) {
  options.styles =  options.styles.filter((style: string) => style !== `tailwind/taiwind.${styleExtension}`);
}
