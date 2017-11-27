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

	// after first compile, check settings for updates
	compiler.plugin('should-emit', (compilation) => {
		// updates to settings may result in new payload-imports
		if (this.settingsHaveUpdate(compiler, compilation)) {
			this.DM.ad.refresh();
			// update payload-imports
			this.updatePayloadImports(compiler);

			this.prevTimestamps = compilation.fileTimestamps;

			log('\nSHOULD NOT EMIT!!');
			return false;
		}
		return true;
	});

	// on compiler emit (happens on dependency-updates)
	compiler.plugin('emit', (compilation, callback) => {
		log('\nPROCESSING COMPILER EMIT');

			// updates store with requested payload-modules 
			this.storePayloadModules(compiler, compilation);

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
 *	If any of the payload-modules have been updated, the fba-payload needs to be recompiled
 */
WpPluginPayload.prototype.watchPayloadModules = function (compiler, compilation) {
	// each payload entry
	this.options.entries.forEach((entry) => {
		if (entry.disabled) return;
		log('**** updating payload-modules?', entry.name);

		const payload = this.DM.payload.store.get(entry.name);
		log('+++++ found payload:', payload.name);
		//
		for (var watchFile in compilation.fileTimestamps) {
			// for each entry-module
			for (var m in payload.modules) {
				if (this.hasUpdate(compilation, watchFile, payload.modules[m].userRequest)) {
					log(`'${entry.name}' modules have changed - RECOMPILE`);
					// this.DM.payload.store.update({
					// 	name: entry.name,
					// 	recompile: true
					// });
					// return; // only one change is needed to flag recompile for this entry
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
		this.storePayload(compiler, entry);
	}
}



// update imports
WpPluginPayload.prototype.updatePayloadImports = function (compiler) {
	log('\nUpdating payload-imports');
	this.options.entries.forEach((entry) => {
		if (entry.disabled) return;

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
WpPluginPayload.prototype.storePayloadModules = function (compiler, compilation) {
	log('\nStoring payload modules:');
	this.DM.payload.store.reset();

	this.options.entries.forEach((entry) => {
		if (entry.disabled) {
			this.storePayload(compiler, entry);
		}
		else {
			// isolate module data from dependency graph
			modules = [];
			const dependencies = compilation._modules[entry.target].dependencies;
			dependencies.forEach((dependency) => {
				if (dependency.constructor.name == 'HarmonyImportDependency') {
					log('&&&&& pushing module for', dependency.module.userRequest);
					modules.push(
						dependency.module
					);
				}
			});
			// update store
			this.storePayload(compiler, entry, modules);
		}
	});
}



// store payload
WpPluginPayload.prototype.storePayload = function (compiler, entry, modules) {
	// if entry is disabled, store piped-assets as a payload
	if (entry.disabled) {
		log(`Entry '${entry.name}' is disabled per (options.entries[name='${entry.name}'].disabled)`);
		this.DM.payload.store.add({
			name: entry.name,
			type: 'copy',
			modules: entry.assets.get()
		});	
	}
	// else prepare a payload for later update of watched-modules
	else {
		// prepare target: the full path to the entry
		entry.target = compiler.options.entry[entry.name]

		this.DM.payload.store.add({
			name: entry.name,
			// propagate the type
			type: entry.type,
			// force initial compile to happen
			recompile: true,
			// store webpack-loaded modules for compiling
			modules: modules
		});
	}
}


module.exports = WpPluginPayload;
