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
				watchPaths: [
					paths to watch for updates affecting payloads
				]
				entries: [
					objects with settings to connect:
						settings/assets -> payload-imports (entries) -> output
				]
			}
	*/

  this.startTime = Date.now();
  this.prevTimestamps = {};
};


WpPluginPayload.prototype.apply = function (compiler) {


	// on compiler entry (happens once)
	compiler.plugin('entry-option', (compilation, callback) => {
		log('Preparing payload management...');

		// init
		this.init(compiler);

		// update payload-imports
		this.updatePayloadImports(compiler);
	});



	// on compiler emit (happens on update)
	compiler.plugin('emit', (compilation, callback) => {
		log('PROCESSING COMPILER EMIT');

		// updates to settings: may result in new payload-imports
		this.watchSettings(compiler, compilation);

		// updates to fba-imports: may add/remove payload-modules 
		this.refreshFbaModules(compiler, compilation);

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
			`${global.appPath}/${settings.source.context}`
			//`${global.appPath}/${this.deploy.env.context.build}/${this.deploy.env.paths.ad.context}/${this.deploy.target.index}`
		);
		var hasUpdate = false;
		for (var i in this.options.watchPaths) {
			if (this.hasUpdate(compilation, watchFile, this.options.watchPaths[i])) {
				log(`Change detected: ${this.options.watchPaths[i]}`);
				hasUpdate = true;
			}
		}
		if (hasUpdate) {
			// deploy settings may be affected
			deployManager.refresh(this.deploy);

			// update payload-imports
			this.updatePayloadImports(compiler);
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
		if (entry.disabled) return;

		for (var watchFile in compilation.fileTimestamps) {
			// for each entry-module
			for (var m in this.output[entry.name].modules) {
				if (this.hasUpdate(compilation, watchFile, this.output[entry.name].modules[m].userRequest)) {
					log(`'${entry.name}' modules have changed - RECOMPILE`);
					this.output[entry.name].recompile = true;
					return; // only one change is needed to flag recompile for this entry
				}
			}
		}			
	});
}



/* -- UTILITIES ----
 *
 */

// init
WpPluginPayload.prototype.init = function (compiler) {
	/** options.watchPaths 
			Give the plugin an external source to watch for updates
	 */
	if (!this.options.watchPaths || !this.options.watchPaths.length) {
		log(`Warning: no options.watchPaths defined -- if assets are added/removed, webpack will not know to recompile!`);
	}

	/** options.ENTRIES
			name: 'image',
			type: 'fba', // or 'inline'
			assets: {
				source: this.deploy.ad.assets.images,
				importPath: `./${this.deploy.env.paths.ad.images}`,
				// inline-specific
				requestPath: // this is the request path where the ad loads this asset - it should match exactly for `InlineSrc` to link the inlined-data properly
			},
			output: this.deploy.payload,			
			// target - set by plugin: full path to entry
			// disabled - set by plugin if settings are wrong or (options.output[entry.name].disabled) is requested
	 */

	/** payload 
			[entry.name]: {
				disabled: (input control), optional
				chunkType: (input control), see fba-compiler, 'fbAi'=images, 'fbAf'=fonts, default is 'fbAi'
				type: output, indicates the compile type: 'fba' or 'inline', default is 'fba'
				recompile: output, indicates if the modules have been updated
				modules: output, list of modules
			}
	 */
	this.options.entries = this.options.entries || [];

	// map entry-target to each request
	this.options.entries = this.options.entries.map((entry) => {
		// prepare output: to be consumed by wp-plugin-assets
		this.output = this.options.output || {};

		// validate entry-targets exist on compiler
		if (!(entry.name in compiler.options.entry)) {
			log(`Entry '${entry.name}' cannot watch/compile!! No entry specified on 'compiler.options.entry.${entry.name}'`);
			// turn off compiling for this type/entry
			entry.disabled = true;
		}
		else {
			// entry can also be disabled from the output object
			if (this.output[entry.name].disabled) {
				log(`Entry '${entry.name}' is disabled per (options.output.${entry.name}.disabled)`);
				entry.disabled = true;
			}
			else {
				this.output[entry.name] = this.output[entry.name] || {};
				// propagate the type
				this.output[entry.name].type = entry.type;
				// force initial compile to happen
				this.output[entry.name].recompile = true;
				// store webpack-loaded modules for compiling
				this.output[entry.name].modules = [];
				// prepare target: the full path to the entry
				entry.target = compiler.options.entry[entry.name];
			}
		}



		return entry;
	});

	log(this.options);
}


// update imports
WpPluginPayload.prototype.updatePayloadImports = function (compiler) {
	this.options.entries.forEach((entry) => {
		if (entry.disabled) return;

		// update payload-imports
		if (entry.type == 'fba') {
			importer.updateImports(entry);
		}

		// update inline-imports
		else if (entry.type == 'inline') {
			importer.updateInlineImports(entry);
		}
	});
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


// utility to rebuild payload dependencies list on output-object
WpPluginPayload.prototype.refreshFbaModules = function (compiler, compilation) {
	log('Refreshing payload modules:');
	this.options.entries.forEach((entry) => {
		if (entry.disabled) return;

		// isolate module data from dependency graph
		this.output[entry.name].modules = [];
		//
		const dependencies = compilation._modules[entry.target].dependencies;
		dependencies.forEach((dependency) => {
			if (dependency.constructor.name == 'HarmonyImportDependency') {
				// log(module.module._source)
				this.output[entry.name].modules.push(
					dependency.module
				);
			}
		});
	});
}




module.exports = WpPluginPayload;
