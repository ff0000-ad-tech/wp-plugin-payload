const hooks = require('./hooks.js');
const environments = require('./environments.js');

const debug = require('debug');
var log = debug('wp-plugin-settings:settings');


// read each hook source
function refreshSettings(source, deploy) {
	const settings = hooks.readSettings(source);
	log('Settings (compilation.settings):');
	log(settings);
	return settings;
}

function refreshDeploy(settings, deploy) {
	// requested environment
	environments.getRequested(
		settings, deploy
	);
	// deploy paths
	environments.setPaths(
		settings, deploy
	);
	return deploy;
}


module.exports = {
	refreshSettings,
	refreshDeploy
};