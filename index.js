const _ = require('lodash');
const path = require('path');
const redHooksRegex = require('red-hooks-regex');

const debug = require('debug');
var log = debug('parse-settings-plugin');

function ParseSettingsPlugin(options) {
	// default options
	this.options = _.extend({
    asset: 'config.js'
  }, options);
};

ParseSettingsPlugin.prototype.apply = function(compiler) {
	var self = this;

	compiler.plugin('emit', function(compilation, callback) {
		if (self.options.asset in compilation.assets) {
			const source = compilation.assets[self.options.asset].source();
			log(redHooksRegex.get('Red', 'Settings', 'assets'))
			const matches = source.match(redHooksRegex.get('Red', 'Settings', 'assets'));
			log(matches);
		}
		else {
			log('Asset "' + self.options.asset + '" not found.');
		}

		// Invokes webpack provided callback after functionality is complete.
		callback();
	});
};

module.exports = ParseSettingsPlugin;