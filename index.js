const _ = require('lodash');
const path = require('path');

const deployManager = require('wp-deploy-manager');
const importer = require('./lib/importer.js');


const debug = require('debug');
var log = debug('wp-plugin-payload');


function WpPluginPayload(deploy) {
	this.deploy = deploy;

  this.startTime = Date.now();
  this.prevTimestamps = {};
};


WpPluginPayload.prototype.apply = function(compiler) {


	
	// on compiler compilation
	compiler.plugin('entry-option', (compilation, callback) => {
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
			imports += importer.buildImports(
				this.deploy.settings.assets.images.map((path) => {
					return './images/' + path;
				})
			);
			// // build font imports
			// imports += importer.buildImports(
			// 	this.settings.assets.fonts.map((path) => {
			// 		return '../_adlib/common/fonts/' + path;
			// 	})
			// );

			// write payload entry target
			importer.writeEntry(
				compiler.options.entry.payload,
				imports
			);
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






module.exports = WpPluginPayload;
