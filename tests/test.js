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

const assert = require('assert');
const PromiseFtp = require('promise-ftp');
const mock = require('node-red-contrib-mock-node');
const nodeRedModule = require('../index.js');

describe('ftp-server', function () {
    this.timeout(15000);
    it('should be tested', function (done) {
        const node = mock(
            nodeRedModule,
            {
                port: 7002,
            },
            {
                username: 'uname',
                password: 'pword',
            }
        );
        node.context().global.set('ftp-server', { debug: true });

        const ftp = new PromiseFtp();
        ftp.connect({
            host: 'localhost',
            user: 'uname',
            password: 'pword',
            port: 7002,
        })
            // This rather odd sequencing is to match the observed behaviours of some IP cameras.
            .then(function () {
                return ftp.cwd('/20171007/images/');
            })
            .then(function () {
                return ftp.cwd('/20171007/images/');
            })
            .then(function () {
                return ftp.mkdir('/20171007/images/');
            })
            .then(function () {
                return ftp.mkdir('/20171007/images/');
            })
            .then(function () {
                return ftp.put('File content', 'test.remote-copy.txt');
            })
            // .then(function () {
            //     return ftp.list('/20171007/images/');
            // })
            .then(function () {
                // console.log(listed);

                const msg = node.sent(0)[0];
                assert.strictEqual(
                    String.fromCharCode.apply(null, msg.payload),
                    'File content'
                );
                assert.strictEqual('/20171007/images/test.remote-copy.txt', msg.topic);
                return ftp.end().then(() => {
                    // Files are unlinked (deleted) after 5 seconds so we wait
                    // 6 seconds so that can happen. We don't currently test that
                    // the file has gone, but we do at least see it in the
                    // test coverage.
                    console.log('Waiting for unlink');
                    setTimeout(() => {
                        node.emit('close');
                        done();
                    }, 6000);
                });
            })
            .catch(function (error) {
                return ftp.end().then(function () {
                    done(error);
                });
            });
    });
});
