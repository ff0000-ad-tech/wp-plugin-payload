const _ = require('lodash');
const path = require('path');
const hooksRegex = require('hooks-regex');
const requireFromString = require('require-from-string');

const debug = require('debug');
var log = debug('wp-plugin-settings');

function WpPluginSettings(deploy) {
	this.deploy = deploy;
	this.settings = {};

  this.startTime = Date.now();
  this.prevTimestamps = {};
};


WpPluginSettings.prototype.apply = function(compiler) {
	// gather the settings prior to compile
	compiler.plugin('after-plugins', (compilation, callback) => {
		log('LOAD INDEX:')
	});

	// check to update the settings on emit
	compiler.plugin('emit', (compilation, callback) => {
		var shouldUpdate = true;

		// if requested asset has not been loaded
		if (!(this.options.asset in compilation.assets)) {
			log(`Asset not found: ${this.options.asset}`);
			shouldUpdate = false;
		}

		// if asset has not been updated
		for(var watchfile in compilation.fileTimestamps) {
			if (path.basename(watchfile) == this.options.asset) {
				const prevTimestamp = this.prevTimestamps[watchfile] || this.startTime;
				const fileTimestamp = compilation.fileTimestamps[watchfile] || Infinity;
				if (prevTimestamp >= fileTimestamp) {
					shouldUpdate = false;
					log(`${this.options.asset} has not changed`);
				}
			}
		}
		this.prevTimestamps = compilation.fileTimestamps;

		// update Settings
		if (shouldUpdate) {
			log(`Processing ${this.options.asset} for settings (compilation.settings):`);
			// proceed to parse each settings object from the asset source
			this.settings = updateSettings(
				compilation.assets[this.options.asset].source(),
				this.settings
			);
		}

		// add settings to compilation graph to make available to other plugins
		compilation.settings = this.settings;
		log(compilation.settings);

		// return to webpack flow
		callback();
	});
};


// define expected model with the hook-ids
var hooks = {
	adParams: 'ad_params',
	assets: 'assets',
	environments: 'environments',
	includes: 'includes',
	externalIncludes: 'external_includes',
	runtimeIncludes: 'runtime_includes'
};

function updateSettings(source, settings) {
	for (var key in hooks) {
		settings[key] = parse(source, hooks[key], key);
	}
	return settings;
}

function parse(source, hookParamId, key) {
	var matches = source.match(
		hooksRegex.get('Red', 'Settings', hookParamId)
	);
	if (matches) {
		return requireFromString(
			`${matches.groups.content} module.exports = ${key};`
		);
	}
}

module.exports = WpPluginSettings;
