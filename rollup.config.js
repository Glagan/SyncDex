import typescript from '@rollup/plugin-typescript';
// import { uglify } from 'rollup-plugin-uglify';

export default {
	input: 'src/index.ts',
	output: {
		file: 'build/SyncDex.js',
		format: 'iife',
		sourcemap: true
	},
	plugins: [
		typescript()
		// uglify()
	]
};
