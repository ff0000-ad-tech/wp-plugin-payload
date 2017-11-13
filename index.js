const _ = require('lodash');
const path = require('path');
const settings = require('./lib/settings.js');

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
		log('LOAD INDEX: Need to create a module that imports all of the binary assets!!!!!!!!!!!!!!!!!');
	});

	// check to update the settings on emit
	compiler.plugin('emit', (compilation, callback) => {
		var shouldUpdate = true;

		// if requested asset has not been loaded
		if (!(this.deploy.ad.index in compilation.assets)) {
			log(`Cannot update asset, not found: ${this.deploy.ad.index}`);
			shouldUpdate = false;
		}

		// if asset has not been updated
		for(var watchfile in compilation.fileTimestamps) {
			if (path.basename(watchfile) == this.deploy.ad.index) {
				const prevTimestamp = this.prevTimestamps[watchfile] || this.startTime;
				const fileTimestamp = compilation.fileTimestamps[watchfile] || Infinity;
				if (prevTimestamp >= fileTimestamp) {
					shouldUpdate = false;
					log(`${this.deploy.ad.index} has not changed`);
				}
			}
		}
		this.prevTimestamps = compilation.fileTimestamps;

		// do update
		if (shouldUpdate) {
			// refresh settings
			this.settings = settings.refreshSettings(
				compilation.assets[this.deploy.ad.index].source(),
				this.deploy
			);			
			// refresh deploy paths
			this.deploy = settings.refreshDeploy(
				this.settings, this.deploy
			);
		}

		// add settings to compilation graph to make available to other plugins
		compilation.settings = this.settings;

		// return to webpack flow
		callback();
	});
};




module.exports = WpPluginSettings;
