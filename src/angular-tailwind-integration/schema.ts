export interface AddSchema {
  project?: string;
  tailwindVersion: string;
  customWebpackVersion: string;
  styleExtension: 'css' | 'scss';
  overwrite: boolean;
}
