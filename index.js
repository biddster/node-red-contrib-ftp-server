/**
 The MIT License (MIT)

 Copyright (c) 2016 @biddster

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
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
            var client = connection.socket.remoteAddress + ':' + connection.socket.remotePort,
                identifier = '';
            node.log('Client %s connected', client);

            connection.on('command:user', function (user, success, failure) {
                if (!user) {
                    return failure();
                }
                identifier = user;
                success();
            });

            connection.on('command:pass', function (pass, success, failure) {
                if (!pass) {
                    return failure();
                }
                success(identifier, {
                    writeFile: function (id, file, callback) {
                        node.log(String.fromCharCode.apply(null, file));
                        node.send({
                            topic: id,
                            payload: file
                        });
                        callback();
                    },
                    readFile: noop(),
                    unlink: noop(),
                    readdir: noop(),
                    mkdir: noop(),
                    open: noop(),
                    close: noop(),
                    rmdir: noop(),
                    rename: noop(),
                    stat: function () {
                        _.nthArg(-1)(null, {
                            mode: '0777',
                            isDirectory: function () {
                                return true;
                            },
                            size: 1,
                            mtime: 1
                        });
                    }
                });
            });

            connection.on('close', function () {
                node.log('client %s disconnected', client);
            });

            connection.on('error', function (error) {
                node.error('client %s had an error: %s', client, error.toString());
            });
        });

        server.listen(7002);

        node.on('close', function () {
            server.close();
        });

    });

    function noop() {
        return function () {
            _.nthArg(-1)(new Error('Not implemented'));
        };
    }
};