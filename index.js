/* eslint-disable prefer-spread */
/* eslint-disable no-underscore-dangle */
/**
 The MIT License (MIT)

 Copyright (c) 2016 @biddster

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the 'Software'), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

module.exports = function (RED) {
    const _ = require('lodash');
    const { FtpServer } = require('ftpd');
    const ip = require('ip');
    const memfs = require('memfs');

    RED.nodes.registerType(
        'ftp-server',
        function (config) {
            RED.nodes.createNode(this, config);

            const node = this;
            const address = config.ip || ip.address();
            const dynauth = !node.credentials.username;
            const pasvPortRange = (config.passiveportrange || '').split('-');
            const pasvPortRangeStart = (pasvPortRange[0] || '').trim() || undefined;
            const pasvPortRangeEnd = (pasvPortRange[1] || '').trim() || pasvPortRangeStart;
            const globalConfig = {
                debug: false,
            };

            function getGlobalConfig() {
                return _.assign(globalConfig, node.context().global.get('ftp-server'));
            }

            function debug() {
                if (getGlobalConfig().debug) node.log.apply(node, arguments);
            }

            function indicateIdle() {
                node.status({
                    fill: 'blue',
                    shape: 'ring',
                    text: `${address}:${config.port} - IDLE`,
                });
            }

            function newFSHandler() {
                const vol = memfs.Volume.fromJSON({});
                const handler = {
                    writeFile(fileName, file, options, callback) {
                        debug(`writeFile: ${fileName}`);
                        node.send([
                            {
                                topic: fileName,
                                payload: file,
                            },
                            null,
                        ]);
                        vol.writeFile(fileName, file, callback);
                        // Keep our memory usage as low as possible for devices like an older Pi by unlinking
                        // (deleting) files after 5 seconds.
                        setTimeout(function () {
                            vol.unlink(fileName, function (err) {
                                if (err && err.code !== 'ENOENT') {
                                    node.error(err);
                                } else {
                                    debug(`Unlinked: ${fileName}`);
                                }
                            });
                        }, 5000);
                    },
                    stat(file, callback) {
                        // It streamlines the process of uploading images if we respond that every directory
                        // exists and silently create the directory when it doesn't.
                        debug(`stat: ${file}`);
                        vol.mkdirp(file, function (err1) {
                            if (err1) {
                                callback(err1);
                            } else {
                                vol.stat(file, callback);
                            }
                        });
                    },
                    mkdir(dir, opts, callback) {
                        debug(`mkdir: ${dir}`);
                        vol.mkdirp(dir, callback);
                    },
                };
                ['open', 'close', 'rename', 'unlink', 'readdir', 'rmdir', 'readFile'].forEach(
                    function (method) {
                        handler[method] = function (arg) {
                            debug(`${method}: ${arg}`);
                            vol[method].apply(vol, arguments);
                        };
                    }
                );
                return handler;
            }

            debug(`Starting ftp server: ${address}:${config.port}`);

            const server = new FtpServer(address, {
                getInitialCwd() {
                    return '';
                },
                getRoot() {
                    return '';
                },
                useWriteFile: true,
                useReadFile: true,
                pasvPortRangeStart,
                pasvPortRangeEnd,
            });

            server._logIf = function (verbosity, message) {
                debug(`ftpd: ${message}`);
            };

            // Based upon this https://github.com/stjohnjohnson/mqtt-camera-ftpd/blob/master/server.js
            server.on('client:connected', function (connection) {
                let remoteClient = `${connection.socket.remoteAddress}:${connection.socket.remotePort}`;
                let usr = '';
                debug(`Remote connection: ${remoteClient}`);
                node.status({
                    fill: 'green',
                    shape: 'ring',
                    text: remoteClient,
                });

                connection.on('command:user', function (user, success, failure) {
                    if (!dynauth && (!user || user !== node.credentials.username)) {
                        debug(`Invalid username: ${user}`);
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: `Invalid username: ${user}`,
                        });
                        failure();
                    } else {
                        usr = user;
                        remoteClient += ` - ${usr}`;
                        debug(`Connecting as user: ${usr}`);
                        success();
                    }
                });

                connection.on('command:pass', function (pass, success, failure) {
                    const authenticate = function (authenticated) {
                        if (authenticated) {
                            node.status({
                                fill: 'green',
                                shape: 'dot',
                                text: remoteClient,
                            });
                            debug(`Connected as user: ${usr}`);
                            success(usr, newFSHandler());
                        } else {
                            debug(`Invalid username or password for user: ${usr}`);
                            node.status({
                                fill: 'red',
                                shape: 'dot',
                                text: `Invalid login for user: ${usr}`,
                            });
                            failure();
                        }
                    };

                    if (!dynauth) {
                        if (!pass || pass !== node.credentials.password) {
                            debug(`Invalid password for user: ${usr}`);
                            node.status({
                                fill: 'red',
                                shape: 'dot',
                                text: `Invalid password for user: ${usr}`,
                            });
                            failure();
                        } else {
                            authenticate(true);
                        }
                    } else {
                        node.send([
                            null,
                            {
                                payload: {
                                    username: usr,
                                    password: pass,
                                },
                                authenticate,
                            },
                        ]);
                    }
                });

                const defaultOnClose = connection._onClose;
                // eslint-disable-next-line no-param-reassign
                connection._onClose = function (hadError) {
                    const _onClose = defaultOnClose.bind(this);
                    _onClose(hadError);
                    debug(`Client disconnected: ${remoteClient}`);
                    indicateIdle();
                };

                connection.on('error', function (error) {
                    node.error(
                        'remoteClient %s had an error: %s',
                        remoteClient,
                        error.toString()
                    );
                    node.status({
                        fill: 'red',
                        shape: 'dot',
                        text: error.toString(),
                    });
                });
            });

            server.listen(config.port);

            node.on('close', function () {
                debug('Closing down ftp server');
                server.close();
            });

            indicateIdle();
            // FUNCTIONS
        },
        {
            credentials: {
                username: {
                    type: 'text',
                },
                password: {
                    type: 'password',
                },
            },
        }
    );
};
