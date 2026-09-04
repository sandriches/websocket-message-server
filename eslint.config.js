const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
	{ ignores: ['node_modules/', 'db/', 'coverage/'] },
	js.configs.recommended,
	{
		files: ['server/**/*.js', 'eslint.config.js'],
		languageOptions: { sourceType: 'commonjs', globals: globals.node },
	},
	{
		files: ['test/**/*.js'],
		languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.mocha } },
	},
	{
		files: ['app/**/*.js'],
		languageOptions: { sourceType: 'script', globals: { ...globals.browser, io: 'readonly' } },
	},
];
