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

module.exports = function(RED) {
    'use strict';

    var _ = require('lodash'),
        FtpServer = require('ftpd').FtpServer,
        ip = require('ip'),
        path = require('path'),
        memfs = require('memfs');

    RED.nodes.registerType(
        'ftp-server',
        function(config) {
            RED.nodes.createNode(this, config);

            var node = this,
                address = ip.address(),
                globalConfig = {
                    debug: false
                };

            function getGlobalConfig() {
                return _.assign(globalConfig, node.context().global.get('ftp-server'));
            }

            function debug() {
                if (getGlobalConfig().debug) node.log.apply(node, arguments);
            }

            debug('Starting ftp server: ' + address + ':' + config.port);

            var server = new FtpServer(address, {
                getInitialCwd: function() {
                    return '';
                },
                getRoot: function() {
                    return '';
                },
                useWriteFile: true,
                useReadFile: true
            });

            // Based upon this https://github.com/stjohnjohnson/mqtt-camera-ftpd/blob/master/server.js
            server.on('client:connected', function(connection) {
                var remoteClient =
                        connection.socket.remoteAddress + ':' + connection.socket.remotePort,
                    usr = '';
                debug('Remote connection: ' + remoteClient);
                node.status({
                    fill: 'green',
                    shape: 'ring',
                    text: remoteClient
                });

                connection.on('command:user', function(user, success, failure) {
                    if (!user || user !== node.credentials.username) {
                        debug('Invalid username: ' + user);
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: 'Invalid username: ' + user
                        });
                        return failure();
                    }
                    usr = user;
                    remoteClient += ' - ' + usr;
                    debug('Connecting as user: ' + usr);
                    success();
                });

                connection.on('command:pass', function(pass, success, failure) {
                    if (!pass || pass !== node.credentials.password) {
                        debug('Invalid password for user: ' + usr);
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: 'Invalid password for user: ' + usr
                        });
                        return failure();
                    }
                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: remoteClient
                    });
                    debug('Connected as user: ' + usr);
                    success(usr, newFSHandler());
                });

                // TODO connection.on('close' ...) doesn't work
                connection._onClose = function() {
                    debug('Client disconnected: ' + remoteClient);
                    indicateIdle();
                };

                connection.on('error', function(error) {
                    node.error(
                        'remoteClient %s had an error: %s',
                        remoteClient,
                        error.toString()
                    );
                    node.status({
                        fill: 'red',
                        shape: 'dot',
                        text: error.toString()
                    });
                });
            });

            server.listen(config.port);

            node.on('close', function() {
                debug('Closing down ftp server');
                server.close();
            });

            indicateIdle();

            // FUNCTIONS

            function indicateIdle() {
                node.status({
                    fill: 'blue',
                    shape: 'ring',
                    text: address + ':' + config.port + ' - IDLE'
                });
            }

            function newFSHandler() {
                var vol = memfs.Volume.fromJSON({});
                var handler = {
                    writeFile: function(fileName, file, callback) {
                        debug('writeFile: ' + fileName);
                        node.send({
                            topic: fileName,
                            payload: file
                        });
                        vol.writeFile(fileName, file, callback);
                        // Keep our memory usage as low as possible for devices like an older Pi by unlinking
                        // (deleting) files after 5 seconds.
                        setTimeout(function() {
                            vol.unlink(fileName, function(err) {
                                if (err && err.code !== 'ENOENT') {
                                    node.error(err);
                                } else {
                                    debug('Unlinked: ' + fileName);
                                }
                            });
                        }, 5000);
                    },
                    stat: function(file, callback) {
                        // It streamlines the process of uploading images if we respond that every directory
                        // exists and silently create the directory when it doesn't.
                        debug('stat: ' + file);
                        vol.mkdirp(file, function(err1) {
                            if (err1) {
                                return callback(err1);
                            }
                            vol.stat(file, callback);
                        });
                    },
                    mkdir: function(dir, opts, callback) {
                        debug('mkdir: ' + dir);
                        vol.mkdirp(dir, callback);
                    }
                };
                [
                    'open',
                    'close',
                    'rename',
                    'unlink',
                    'readdir',
                    'rmdir',
                    'readFile'
                ].forEach(function(method) {
                    handler[method] = function(arg) {
                        debug(method + ': ' + arg);
                        vol[method].apply(vol, arguments);
                    };
                });
                return handler;
            }
        },
        {
            credentials: {
                username: {
                    type: 'text'
                },
                password: {
                    type: 'password'
                }
            }
        }
    );
};
