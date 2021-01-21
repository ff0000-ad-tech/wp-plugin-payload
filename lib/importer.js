const fs = require('fs')
const path = require('path')
const varname = require('varname')

const debug = require('@ff0000-ad-tech/debug')
var log = debug('wp-plugin-payload:importer')

/* -- INLINE IMPORTS -----------------------------
 *
 *
 */
const updateInlineImports = (entry) => {
	log('Updating inline-imports')
	const assetPaths = entry.assets.get() || []
	let imports = `import { InlineSrc } from '@ff0000-ad-tech/ad-assets'\n` + `window.InlineSrc = InlineSrc\n\n`
	// build preloader-image imports
	assetPaths.forEach((assetPath) => {
		imports += buildInlineImports(assetPath)
	})
	// write payload entry target
	writeEntry(entry.target, imports)
}

const buildInlineImports = (assetPath) => {
	const assetName = varname.camelback(path.basename(assetPath).split('.')[0])
	return `import ${assetName} from '${assetPath}?inline=true'\n` + `InlineSrc.add('${assetPath}', ${assetName})\n`
}

const writeEntry = (path, contents) => {
	log(' writing entry:', path)
	try {
		fs.writeFileSync(path, contents)
	} catch (err) {
		log(err)
	}
}

module.exports = {
	updateInlineImports
}
