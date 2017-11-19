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

  this.payloadModules = [];
};


WpPluginPayload.prototype.apply = function (compiler) {


	
	// on compiler compilation
	compiler.plugin('entry-option', (compilation, callback) => {
		log('THIS SHOULD ONLY HAPPEN ONCE');

		// no payload entry!! must be specified for binary-compiling
		if (!compiler.options.entry.payload) {
			log('Cannot compile images & fonts!! No binary payload specified (compiler.options.entry.payload)');
			this.deploy.compile.images = false;
			this.deploy.compile.fonts = false;
		}
		// build payload entry target
		else {
			updatePayloadImports(compiler, this.deploy);
		}
	});



	// on compiler emit
	compiler.plugin('emit', (compilation, callback) => {
		log('PAYLOAD PLUGIN EMIT has been called');
		//log(compilation);

		// updates to settings: may result in new payload-imports
		this.watchSettings(compiler, compilation);

		// updates to payload-imports: may add/remove payload-modules 
		this.watchPayloadImports(compiler, compilation);

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
			log('SHOULD REFRESH DEPLOY & PAYLOAD');
			
			// deploy settings may be affected
			this.deploy = deployManager.refresh(this.deploy);

			// payload assets may be affected
			updatePayloadImports(compiler, this.deploy);

			return;
		}
	}
}





/* -- WATCH PAYLOAD-IMPORTS ----
 *
 */
WpPluginPayload.prototype.watchPayloadImports = function (compiler, compilation) {
	for (var watchFile in compilation.fileTimestamps) {
		// settings are assumed to be in entry.initial
		if (this.hasUpdate(compilation, watchFile, compiler.options.entry.payload)) {
			log('.payload-imports HAS UPDATE +++++++++++++++++++++=');
			this.payloadModules = [];
			compilation._modules[watchFile].dependencies.forEach((dependency) => {
				if (dependency.constructor.name == 'HarmonyImportDependency') {
					// log(dependency.module._source)
					this.payloadModules.push(
						dependency.module
					);
				}
			});
			return;
		}
	}
}




/* -- WATCH PAYLOAD-MODULES ----
 *
 */
WpPluginPayload.prototype.watchPayloadModules = function (compiler, compilation) {
	for (var watchFile in compilation.fileTimestamps) {
		for (var i in this.payloadModules) {
			if (this.hasUpdate(compilation, watchFile, this.payloadModules[i].userRequest)) {
				log('PAYLOAD MODULE IS UPDATED:', watchFile);
			}
		}
	}
}




WpPluginPayload.prototype.hasUpdate = function (compilation, watchFile, requestFile) {
	if (watchFile == requestFile) {
		const prevTimestamp = this.prevTimestamps[watchFile] || this.startTime;
		const fileTimestamp = compilation.fileTimestamps[watchFile] || Infinity;
		if (prevTimestamp < fileTimestamp) {
			return true;
		}		
	}
}


function updatePayloadImports(compiler, deploy) {
	log('Updating payload-imports');
	var imports = '';

	// build image imports
	imports += importer.buildImports(
		deploy.settings.assets.images.map((path) => {
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


module.exports = WpPluginPayload;
