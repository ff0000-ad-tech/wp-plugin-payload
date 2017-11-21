const _ = require('lodash');
const path = require('path');

const deployManager = require('wp-deploy-manager');
const importer = require('./lib/importer.js');


const debug = require('debug');
var log = debug('wp-plugin-payload');


function WpPluginPayload(deploy, options) {
	this.deploy = deploy;
	this.options = options;
	/* TODO: Document options
			{
				entries: [{
					entry: 'image',
					assets: {
						source: this.deploy.settings.assets.images,
						importPath: `./${deploy.env.paths.ad.images}`
					},
					target: (gets added by the plugin, from compiler.options.entry[entry.name])
				},{
					entry: 'font',
					assets: {
						source: this.deploy.settings.assets.images,
						importPath: `../${deploy.env.paths.common.context}/${deploy.env.paths.common.fonts}`
					},
					target: (gets added by the plugin, from compiler.options.entry[entry.name])
				}]
			}
	*/

  this.startTime = Date.now();
  this.prevTimestamps = {};
};


WpPluginPayload.prototype.apply = function (compiler) {


	// on compiler entry (happens once)
	compiler.plugin('entry-option', (compilation, callback) => {
		log('Preparing payload management...');

		// prepare options
		this.prepareOptions(compiler);

		// update payload-imports
		this.updatePayloadImports(compiler);
	});



	// on compiler emit (happens on update)
	compiler.plugin('emit', (compilation, callback) => {
		log('PROCESSING COMPILER EMIT');

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
			`${global.appPath}/${this.deploy.env.context.build}/${this.deploy.env.paths.ad.context}/${this.deploy.target.index}`
		);
		if (this.hasUpdate(compilation, watchFile, settingsPath)) {
			log(`${this.deploy.target.index} has changed`);
			
			// deploy settings may be affected
			this.deploy = deployManager.refresh(this.deploy);

			// update payload-imports
			this.updatePayloadImports(compiler);

			return;
		}
	}
}



/* -- WATCH PAYLOAD-MODULES ----
 *
 *	If any of the payload-modules have been updated, the payload needs to be recompiled
 */
WpPluginPayload.prototype.watchPayloadModules = function (compiler, compilation) {
	// each payload entry
	this.options.entries.forEach((entry) => {
		// if entry-modules have been determined
		if (this.options.output[entry.name].modules) {
			for (var watchFile in compilation.fileTimestamps) {
				// for each entry-module
				for (var m in this.options.output[entry.name].modules) {
					if (this.hasUpdate(compilation, watchFile, this.options.output[entry.name].modules[m].userRequest)) {
						log(`'${entry.name}' modules have changed - RECOMPILE`);
						this.options.output[entry.name].recompile = true;
						return; // only one change is needed to flag recompile for this entry
					}
				}
			}			
		}
	});
}



/* -- UTILITIES ----
 *
 */

// prepare options
WpPluginPayload.prototype.prepareOptions = function (compiler) {
	this.options.entries = this.options.entries || [];

	// validate entry-targets exist on compiler
	this.options.entries = this.options.entries.filter((entry) => {
		if (entry.name in compiler.options.entry) {
			return true;
		}
		else {
			log(`Cannot watch/compile '${entry.name}'!! No entry specified at 'compiler.options.entry.${entry.name}'`);
			this.options.payload[entry.name].compile = false;
		}
	})

	// map entry-target to each request
	.map((entry) => {
		// get the full path to the entry
		entry.target = compiler.options.entry[entry.name];

		// force initial compile to happen
		this.options.output[entry.name].recompile = true;
		this.options.output[entry.name].modules = [];

		return entry;
	});

	log(this.options);
}


// update imports
WpPluginPayload.prototype.updatePayloadImports = function (compiler) {
	// update payload-imports
	this.options.entries.forEach((entry) => {
		importer.updateImports(entry);
	});

	// update inline-imports
	importer.updateInlineImports(
		compiler.options.entry.inline, 
		this.deploy
	);
}

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
	log('Refreshing payload modules:');
	this.options.entries.forEach((entry) => {
		this.options.output[entry.name].modules = [];

		const dependencies = compilation._modules[entry.target].dependencies;
		dependencies.forEach((dependency) => {
			if (dependency.constructor.name == 'HarmonyImportDependency') {
				// log(module.module._source)
				this.options.output[entry.name].modules.push(
					dependency.module
				);
			}
		});

	});
}




module.exports = WpPluginPayload;
