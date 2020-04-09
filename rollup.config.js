import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const process = require('process');

const plugins = () => {
	let list = [typescript()];
	if (process.env.mode == 'prod' || process.env.mode == 'production') {
		list.push(terser());
	}
	return list;
};

export default [
	{
		input: 'src/index.ts',
		output: {
			file: 'build/SyncDex.js',
			format: 'es',
			sourcemap: true,
		},
		plugins: plugins(),
	},
	{
		input: 'background/index.ts',
		output: {
			file: 'build/SyncDex_background.js',
			format: 'es',
			sourcemap: true,
		},
		plugins: plugins(),
	},
	{
		input: 'options/index.ts',
		output: {
			file: 'build/SyncDex_options.js',
			format: 'es',
			sourcemap: true,
		},
		plugins: plugins(),
	},
];
