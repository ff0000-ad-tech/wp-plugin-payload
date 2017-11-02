const _ = require('lodash');
const path = require('path');
const hooksRegex = require('hooks-regex');
const requireFromString = require('require-from-string');

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

	// define expected model with the hook-ids
	var settings = {
		adParams: 'ad_params',
		assets: 'assets',
		environments: 'environments',
		includes: 'includes',
		externalIncludes: 'external_includes',
		runtimeIncludes: 'runtime_includes'
	};

	compiler.plugin('emit', function(compilation, callback) {
		// if requested asset has been loaded
		if (self.options.asset in compilation.assets) {
			log(`Processing ${self.options.asset}`);
			// proceed to parse each settings object from the asset source
			const source = compilation.assets[self.options.asset].source();
			for (var key in settings) {
				settings[key] = parse(source, settings[key], key);
			}
			// add settings to compilation graph to make available to other plugins
			compilation.settings = settings;
			log(compilation.settings);
		}
		else {
			log(`Asset not found: ${self.options.asset}`);
		}
		// return to webpack flow
		callback();
	});
};

function parse(source, hookParamId, jsKey) {
	var matches = source.match(
		hooksRegex.get('Red', 'Settings', hookParamId)
	);
	if (matches) {
		return requireFromString(
			`${matches.groups.content} module.exports = ${jsKey};`
		);
	}
}

module.exports = ParseSettingsPlugin;