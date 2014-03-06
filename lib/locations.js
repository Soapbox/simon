var path = require('path');

module.exports = {
	hostsFile: process.platform === 'win32' ?
		"C:\\Windows\\system32\\drivers\\etc\\hosts" :
		"/etc/hosts",
	composerVendorFolder: path.join('vendor'),
	bowerComponentsFolder: path.join('bower_components')
};
