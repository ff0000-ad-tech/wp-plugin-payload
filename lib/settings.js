const hooks = require('./hooks.js');
const environments = require('./environments.js');

const debug = require('debug');
var log = debug('wp-plugin-settings:settings');


// read each hook source
function refreshSettings(source, deploy) {
	log('Refreshing Settings');
	return hooks.readSettings(source);
}

function refreshDeploy(settings, deploy) {
	log('Refreshing Deploy');
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