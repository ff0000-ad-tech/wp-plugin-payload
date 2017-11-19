const _ = require('lodash');
const path = require('path');

const deployManager = require('wp-deploy-manager');
const payload = require('./lib/payload.js');


const debug = require('debug');
var log = debug('wp-plugin-settings');


function WpPluginSettings(deploy) {
	this.deploy = deploy;

  this.startTime = Date.now();
  this.prevTimestamps = {};
};


WpPluginSettings.prototype.apply = function(compiler) {
	
	// on compiler compilation
	compiler.plugin('entry-option', (compilation, callback) => {
		log('Loading Settings, THIS SHOULD ONLY HAPPEN ONCE ---------------->');

		// no payload entry!! must be specified for binary-compiling
		if (!compiler.options.entry.payload) {
			log('Cannot compile images & fonts!! No binary payload specified (compiler.options.entry.payload)');
			this.deploy.compile.images = false;
			this.deploy.compile.fonts = false;
		}
		// build payload entry target
		else {
			log('Building imports for payload assets');
			var imports = '';

			// build image imports
			imports += payload.buildImports(
				this.deploy.settings.assets.images.map((path) => {
					return './images/' + path;
				})
			);
			// // build font imports
			// imports += payload.buildImports(
			// 	this.settings.assets.fonts.map((path) => {
			// 		return '../_adlib/common/fonts/' + path;
			// 	})
			// );

			// write payload entry target
			payload.writeEntry(
				compiler.options.entry.payload,
				imports
			);
			log('WRITE IS COMPLETE');
		}
	});



	// on compiler emit
	compiler.plugin('emit', (compilation, callback) => {
		log('SETTINGS PLUGIN EMIT has been called');
		var shouldRefresh = true;

		// if requested asset has not been loaded
		if (!(this.deploy.ad.index in compilation.assets)) {
			log(`Cannot update asset, not found: ${this.deploy.ad.index}`);
			shouldRefresh = false;
		}

		// if asset has not been updated
		for(var watchfile in compilation.fileTimestamps) {
			if (path.basename(watchfile) == this.deploy.ad.index) {
				const prevTimestamp = this.prevTimestamps[watchfile] || this.startTime;
				const fileTimestamp = compilation.fileTimestamps[watchfile] || Infinity;
				if (prevTimestamp >= fileTimestamp) {
					shouldRefresh = false;
					log(`${this.deploy.ad.index} has not changed`);
				}
			}
		}
		this.prevTimestamps = compilation.fileTimestamps;

		// refresh deploy profile
		if (shouldRefresh) {
			log('^^^^^^ SHOULD REFRESH');
			this.deploy = deployManager.refresh(this.deploy);
		}

		// return to webpack flow
		callback();
	});
};






module.exports = WpPluginSettings;
