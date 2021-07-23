const importer = require('./lib/importer.js')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-payload')

const pluginName = 'FAT Payload Plugin'

function WpPluginPayload(scope, DM, options) {
	this.scope = scope
	this.DM = DM
	this.options = options
	/* TODO: Document options
			{
				settings: {} // see `preparePayload()`
			}
	*/
	this.startTime = Date.now()
	this.prevTimestamps = new Map()
}

WpPluginPayload.prototype.apply = function (compiler) {
	// on compiler entry (happens once)
	compiler.hooks.entryOption.tap(pluginName, (compilation) => {
		// init
		this.preparePayload(compiler)
		// update payload-imports
		this.updatePayloadImports(compiler)
	})

	// check settings for updates (happens after each compile)
	compiler.hooks.shouldEmit.tap(pluginName, (compilation) => {
		// updates to settings may result in new payload-imports
		if (this.settingsHaveUpdate(compiler, compilation)) {
			log('SETTINGS have changed - will recompile to get the latest payload-modules')
			// refresh settings
			this.DM.adManager.applyIndexSettings(this.scope, this.DM.deploy.get())
			// update payload-imports
			this.updatePayloadImports(compiler)
			this.prevTimestamps = new Map(compilation.fileTimestamps)
			return false
		}
		return true
	})

	// on compiler emit (happens on dependency-updates)
	compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
		log('PROCESSING COMPILER EMIT')
		// return to webpack flow
		this.prevTimestamps = new Map(compilation.fileTimestamps)
		callback()
	})
}

/* -- WATCH SETTINGS ----
 *
 */
WpPluginPayload.prototype.settingsHaveUpdate = function (compiler, compilation) {
	for (var watchFile of compilation.fileTimestamps.keys()) {
		for (var i in this.options.watchPaths) {
			if (this.hasUpdate(compilation, watchFile, this.options.watchPaths[i])) {
				log(`Change detected: ${this.options.watchPaths[i]}`)
				return true
			}
		}
	}
}

/* -- UTILITIES ----
 *
 */

// preparePayload
WpPluginPayload.prototype.preparePayload = function (compiler) {
	log('Preparing payload management...')
	/** options
			watchPaths: [], // paths on which to watch for asset declarations to change
			entries: [],
			output: {
				path: `${DM.model.deploy.output.context}/${DM.model.deploy.source.size}`,
				filename: 'fba-payload.png'
			}
	 */
	if (!this.options) {
		throw `No (options) object defined.`
	}
	/** options.watchPaths 
			Give the plugin an external source to watch for updates
	 */
	if (!this.options.watchPaths || !this.options.watchPaths.length) {
		throw `No options.watchPaths defined -- if assets are added/removed, webpack will not know to recompile.`
	}
	log(this.options)

	/** options.ENTRIES
				name: 'image',
				assets: {
					get: function () {
						return DM.ad.get().settings.ref.assets.images;
					},
					set: function (result) {
						DM.ad.get().settings.res.assets.images = result;
					},
					importPath: `./${DM.ad.get().paths.ad.images}`
				},
				type: 'fbAi', // 'fbAf', 'inline'
				disabled: false // 
				// target - set by plugin: full path to entry
	 */
	this.options.entries = this.options.entries || []
	// map entry-target to each request
	for (var i in this.options.entries) {
		var entry = this.options.entries[i]

		// validate entry-targets exist on compiler
		if (!(entry.name in compiler.options.entry)) {
			throw `Entry [name='${entry.name}'] cannot watch/compile - No matching Webpack entry found on 'compiler.options.entry.${entry.name}'.`
		}
		// prepare target: the full path to the entry
		entry.target = compiler.options.entry[entry.name]

		// create/store a payload model
		// this.createPayload(compiler, entry)
	}
}

// update imports
WpPluginPayload.prototype.updatePayloadImports = function (compiler) {
	log('Updating payload-imports')
	this.options.entries.forEach((entry) => {
		// update payload-imports
		if (entry.type == 'inline') {
			// update inline-imports
			importer.updateInlineImports(entry)
		}
	})
}

// utility for determining if a watch file has been updated
WpPluginPayload.prototype.hasUpdate = function (compilation, watchFile, requestFile) {
	if (watchFile == requestFile) {
		const prevTimestamp = this.prevTimestamps.get(watchFile) || this.startTime
		const fileTimestamp = compilation.fileTimestamps.get(watchFile) || Infinity
		if (prevTimestamp < fileTimestamp) {
			return true
		}
	}
}

// utility to rebuild payload dependencies list on store-object
// WpPluginPayload.prototype.refreshPayloadStore = function(compiler, compilation) {
// 	log('Refreshing modules in payload store:')
// 	this.options.entries.forEach(entry => {
// 		var depLog = ''
// 		const moduleMatch = Object.keys(compilation._modules).filter(name => {
// 			if (name.indexOf(entry.target) > -1) {
// 				return name
// 			}
// 		})
// 		if (moduleMatch) {
// 			// store all modules data for this entry, which exist in the webpack dependency graph due to payload-imports
// 			const dependencies = compilation._modules[moduleMatch].dependencies
// 			for (var i in dependencies) {
// 				if (dependencies[i].module) {
// 					depLog += `  ${dependencies[i].module.rawRequest}`
// 					this.DM.payload.addBinaryAsset({
// 						chunkType: 'fbAi',
// 						path: dependencies[i].module.userRequest
// 					})
// 				}
// 			}
// 		}
// 	})
// }

module.exports = WpPluginPayload
