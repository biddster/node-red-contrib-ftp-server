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
    'use strict';

    var _ = require('lodash'),
        FtpServer = require('ftpd').FtpServer,
        ip = require('ip');

    RED.nodes.registerType('ftp-server', function (config) {
        RED.nodes.createNode(this, config);

        var node = this;

        var address = ip.address();
        node.log('Starting ftp server using ip: ' + address);

        var server = new FtpServer(address, {
            getInitialCwd: function () {
                return '/';
            },
            getRoot: function () {
                return process.cwd();
            },
            useWriteFile: true,
            useReadFile: true
        });

        server.on('client:connected', function (connection) {
            var remoteClient = connection.socket.remoteAddress + ':' + connection.socket.remotePort,
                usr = '';
            node.log('Client connected: ' + remoteClient);
            node.status({fill: 'green', shape: 'ring', text: remoteClient});


            connection.on('command:user', function (user, success, failure) {
                if (!user || user !== node.credentials.username) {
                    return failure();
                }
                usr = user;
                remoteClient += ' - ' + usr;
                success();
            });

            connection.on('command:pass', function (pass, success, failure) {
                if (!pass || pass !== node.credentials.password) {
                    return failure();
                }
                node.status({fill: 'green', shape: 'dot', text: remoteClient});
                success(usr, newFSHandler());
            });

            // TODO connection.on('close' ...) doesn't work
            connection._onClose = function () {
                node.log('Client disconnected: ' + remoteClient);
                indicateIdle();
            };

            connection.on('error', function (error) {
                node.error('remoteClient %s had an error: %s', remoteClient, error.toString());
            });
        });

        server.listen(config.port);

        node.on('close', function () {
            server.close();
        });

        indicateIdle();

        // FUNCTIONS

        function indicateIdle() {
            node.status({fill: 'blue', shape: 'ring', text: address + ':' + config.port + ' - IDLE'});
        }

        function newFSHandler() {
            var handler = {
                writeFile: function (id, file, callback) {
                    node.log(String.fromCharCode.apply(null, file));
                    node.send({
                        topic: id,
                        payload: file
                    });
                    callback();
                },
                stat: function () {
                    _.nthArg(-1)(null, {
                        mode: '0777',
                        isDirectory: function () {
                            return true;
                        },
                        size: 1,
                        mtime: 1
                    });
                },
                readdir: function (dir, callback) {
                    callback(null, []);
                }
            };
            ['readFile', 'unlink', 'mkdir', 'open', 'close', 'rmdir', 'rename'].forEach(function (method) {
                handler[method] = function () {
                    node.log(method + ' called');
                    _.nthArg(-1)(new Error(method + ' not implemented'));
                }
            });
            return handler;
        }
    }, {
        credentials: {
            username: {type: 'text'},
            password: {type: 'password'}
        }
    });
};