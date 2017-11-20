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


WpPluginPayload.prototype.apply = function (compiler) {


	// on compiler compilation
	compiler.plugin('entry-option', (compilation, callback) => {
		log('THIS SHOULD ONLY HAPPEN ONCE');
		this.deploy.payload.recompile = true;

		// check to create payload-imports
		importer.updatePayloadImports(
			compiler.options.entry.payload, 
			this.deploy
		);

		// check to create inline-imports
		importer.updateInlineImports(
			compiler.options.entry.inline, 
			this.deploy
		);
	});



	// on compiler emit
	compiler.plugin('emit', (compilation, callback) => {
		log('Watching...');

		// updates to settings: may result in new payload-imports
		this.watchSettings(compiler, compilation);

		// updates to payload-imports: may add/remove payload-modules 
		this.refreshPayloadModules(compiler, compilation);

		// updates to payload-modules: require recompile of payload
		this.watchPayloadModules(compiler, compilation);

		// return to webpack flow
		this.prevTimestamps = compilation.fileTimestamps;
		callback();
	});
};




/* -- WATCH SETTINGS ----
 *
 */
WpPluginPayload.prototype.watchSettings = function (compiler, compilation) {
	for (var watchFile in compilation.fileTimestamps) {
		const settingsPath = path.resolve(
			`${global.appPath}/${this.deploy.context.build}/${this.deploy.paths.ad.context}/${this.deploy.ad.index}`
		);
		if (this.hasUpdate(compilation, watchFile, settingsPath)) {
			log(`${this.deploy.ad.index} has changed`);
			
			// deploy settings may be affected
			this.deploy = deployManager.refresh(this.deploy);

			// payload entry may be affected
			importer.updatePayloadImports(
				compiler.options.entry.payload, 
				this.deploy
			);

			// inline entry may be affected
			importer.updateInlineImports(
				compiler.options.entry.inline, 
				this.deploy
			);
			return;
		}
	}
}



/* -- WATCH PAYLOAD-MODULES ----
 *
 *	If any of the payload-modules have been updated, the payload needs to be recompiled
 */
WpPluginPayload.prototype.watchPayloadModules = function (compiler, compilation) {
	for (var watchFile in compilation.fileTimestamps) {
		for (var i in this.deploy.payload.modules) {
			if (this.hasUpdate(compilation, watchFile, this.deploy.payload.modules[i].userRequest)) {
				log(`payload modules have changed - RECOMPILE`);
				this.deploy.payload.recompile = true;
				return; // only one change is needed to flag recompile
			}
		}
	}
}



/* -- UTILITIES ----
 *
 */
// utility for determining if a watch file has been updated
WpPluginPayload.prototype.hasUpdate = function (compilation, watchFile, requestFile) {
	if (watchFile == requestFile) {
		const prevTimestamp = this.prevTimestamps[watchFile] || this.startTime;
		const fileTimestamp = compilation.fileTimestamps[watchFile] || Infinity;
		if (prevTimestamp < fileTimestamp) {
			return true;
		}		
	}
}

// utility to rebuild payload dependencies list
WpPluginPayload.prototype.refreshPayloadModules = function (compiler, compilation) {
	if (!compiler.options.entry.payload) { return; }

	log('Refreshing payload modules');
	this.deploy.payload.modules = [];
	const dependencies = compilation._modules[compiler.options.entry.payload].dependencies;
	dependencies.forEach((dependency) => {
		if (dependency.constructor.name == 'HarmonyImportDependency') {
			// log(module.module._source)
			this.deploy.payload.modules.push(
				dependency.module
			);
		}
	});	
}




module.exports = WpPluginPayload;
