const _ = require('lodash');
const path = require('path');

const deployManager = require('wp-deploy-manager');
const importer = require('./lib/importer.js');


const debug = require('debug');
var log = debug('wp-plugin-payload');


function WpPluginPayload(DM, options) {
	this.DM = DM;
	this.options = options;
	/* TODO: Document options
			{
				settings: {} // see `preparePayload()`
			}
	*/
  this.startTime = Date.now();
  this.prevTimestamps = {};
};


WpPluginPayload.prototype.apply = function (compiler) {

	// on compiler entry (happens once)
	compiler.plugin('entry-option', (compilation, callback) => {
		// init
		this.preparePayload(compiler);

		// update payload-imports
		this.updatePayloadImports(compiler);
	});


	// check settings for updates (happens after each compile)
	compiler.plugin('should-emit', (compilation) => {
		// updates to settings may result in new payload-imports
		if (this.settingsHaveUpdate(compiler, compilation)) {
			log('\nSETTINGS have changed - will recompile to get the latest payload-modules');

			// refresh settings
			this.DM.ad.refresh();

			// update payload-imports
			this.updatePayloadImports(compiler);
			this.prevTimestamps = compilation.fileTimestamps;
			return false;
		}
		return true;
	});


	// on compiler emit (happens on dependency-updates)
	compiler.plugin('emit', (compilation, callback) => {
		log('\nPROCESSING COMPILER EMIT');

			// updates store with requested payload-modules 
			this.refreshPayloadStore(compiler, compilation);

			// updates to payload-modules: require recompile of payload
			this.watchPayloadModules(compiler, compilation);

			this.shouldEmit = true;


		// return to webpack flow
		this.prevTimestamps = compilation.fileTimestamps;
		callback();
	});

};






/* -- WATCH SETTINGS ----
 *
 */
WpPluginPayload.prototype.settingsHaveUpdate = function (compiler, compilation) {
	for (var watchFile in compilation.fileTimestamps) {
		for (var i in this.options.watchPaths) {
			if (this.hasUpdate(compilation, watchFile, this.options.watchPaths[i])) {
				log(`Change detected: ${this.options.watchPaths[i]}`);
				return true;
			}
		}
	}
}



/* -- WATCH PAYLOAD-MODULES ----
 *
 *	If any of the payload-modules have been updated:
 *	 the fba-payload needs to be recompiled / the assets need to be re-copied
 */
WpPluginPayload.prototype.watchPayloadModules = function (compiler, compilation) {
	// each payload entry
	this.options.entries.forEach((entry) => {
		const payload = this.DM.payload.store.get(entry.name);
		//
		for (var watchFile in compilation.fileTimestamps) {
			// for each entry-module
			for (var m in payload.modules) {
				if (this.hasUpdate(compilation, watchFile, payload.modules[m].userRequest)) {
					log(`'${entry.name}' modules have changed - RECOMPILE`);
					this.DM.payload.store.update({
						name: entry.name,
						dirty: true
					});
					return; // only one change is needed to flag dirty for this entry
				}
			}
		}			
	});
}



/* -- UTILITIES ----
 *
 */

// preparePayload
WpPluginPayload.prototype.preparePayload = function (compiler) {
	log('\nPreparing payload management...');
	/** options
			watchPaths: [], // paths on which to watch for asset declarations to change
			entries: [],
			output: {
				path: `${DM.model.deploy.output.context}/${DM.model.deploy.source.size}`,
				filename: 'fba-payload.png'
			}
	 */
	if (!this.options) {
		log(`Error: No (options) object defined.`);
		return;
	}
	/** options.watchPaths 
			Give the plugin an external source to watch for updates
	 */
	if (!this.options.watchPaths || !this.options.watchPaths.length) {
		log(`Warning: no options.watchPaths defined -- if assets are added/removed, webpack will not know to recompile!`);
	}

	/** options.ENTRIES
			name: 'image',
			assets: {
				source: this.deploy.ad.assets.images,
				importPath: `./${this.deploy.env.paths.ad.images}`,
				// inline-specific
				requestPath: // this is the request path where the ad loads this asset - it should match exactly for `InlineSrc` to link the inlined-data properly
			},
			type: 'fbAi', // 'fbAf', 'inline'
			// target - set by plugin: full path to entry
			// disabled - set by plugin if settings are wrong or (options.output[entry.name].disabled) is requested
	 */
	this.options.entries = this.options.entries || [];
	this.DM.payload.store.reset();

	// map entry-target to each request
	for (var i in this.options.entries) {
		var entry = this.options.entries[i];

		// validate entry-targets exist on compiler
		if (!(entry.name in compiler.options.entry)) {
			log(`Entry '${entry.name}' cannot watch/compile!! No entry specified on 'compiler.options.entry.${entry.name}'`);
			// turn off compiling for this type/entry
			entry.disabled = true;
		}
		// prepare target: the full path to the entry
		entry.target = compiler.options.entry[entry.name]

		this.createPayload(compiler, entry);
	}
}




// update imports
WpPluginPayload.prototype.updatePayloadImports = function (compiler) {
	log('\nUpdating payload-imports');
	this.options.entries.forEach((entry) => {
		// update payload-imports
		if (entry.type.match(/^fbA/i)) {
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




// utility to rebuild payload dependencies list on store-object
WpPluginPayload.prototype.refreshPayloadStore = function (compiler, compilation) {
	log('Refreshing modules in payload store:');

	this.options.entries.forEach((entry) => {
		var modules = [];
		var depLog = '';
		if (entry.disabled) {
			// this is just for purposes of sensible output
			modules = entry.assets.get().filter((dependency) => {
				depLog += `  ${dependency}`;
				return true;
			});
		}
		else {
			// store all modules data for this entry, which exist in the webpack dependency graph due to payload-imports
			const dependencies = compilation._modules[entry.target].dependencies;
			dependencies.forEach((dependency) => {
				if (dependency.constructor.name == 'HarmonyImportDependency') {
					depLog += `  ${dependency.module.rawRequest}\n`;
					modules.push(
						dependency.module
					);
				}
			});
		}

		var existingPayload = this.DM.payload.store.get(entry.name);
		if (existingPayload) {
			log(` updating existing payload for '${entry.name}'`);
			log(depLog);
			// adding/removing modules dirties the whole payload
			var dirty = existingPayload.dirty || false;
			if (existingPayload.modules.length != modules.length) {
				dirty = true;
			}
			// update store
			this.DM.payload.store.update({
				name: entry.name,
				modules: modules,
				dirty: dirty
			});
		}
		// presumably this won't happen at runtime, but...
		else {
			log(` creating a new payload for '${entry.name}'`);
			this.createPayload(compiler, entry, modules);
		}
	});
}



// store payload
WpPluginPayload.prototype.createPayload = function (compiler, entry, modules) {
	// if entry is disabled, store piped-assets as a payload
	if (entry.disabled) {
		log(` Entry '${entry.name}' assets will be copied to deploy`);
		this.DM.payload.store.add({
			name: entry.name,
			type: 'copy',
			dirty: true,
			modules: entry.assets.get()
		});	
	}
	// else prepare a payload for later update of watched-modules
	else {
		if (entry.type == 'inline') {
			log(` Entry '${entry.name}' assets will be inlined`);
		}	else {
			log(` Entry '${entry.name}' assets will be fba-compiled`);
		}
		this.DM.payload.store.add({
			name: entry.name,
			// propagate the type
			type: entry.type,
			// force initial compile to happen
			dirty: true,
			// store webpack-loaded modules for compiling
			modules: modules || []
		});
	}
}


module.exports = WpPluginPayload;
