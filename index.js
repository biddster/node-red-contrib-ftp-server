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

    var moment = require('moment');
    var SunCalc = require('suncalc');
    var _ = require("lodash");
    var fmt = 'YYYY-MM-DD HH:mm';

    RED.nodes.registerType('schedex', function (config) {
        RED.nodes.createNode(this, config);
        var node = this,
            on = setupEvent('on', 'dot'),
            off = setupEvent('off', 'ring');
        on.inverse = off;
        off.inverse = on;

        node.on('input', function (msg) {
            var handled = false;
            if (_.isString(msg.payload)) {
                // TODO - with these payload options, we can't support on and ontime etc.
                if (msg.payload === 'on') {
                    handled = true;
                    send(on, true);
                } else if (msg.payload === 'off') {
                    handled = true;
                    send(off, true);
                }
                if (msg.payload.indexOf('suspended') !== -1) {
                    handled = true;
                    var match = /.*suspended\s+(\S+)/.exec(msg.payload);
                    config.suspended = (match[1] === 'true');
                    bootstrap();
                }
                if (msg.payload.indexOf('ontime') !== -1) {
                    handled = true;
                    var match = /.*ontime\s+(\S+)/.exec(msg.payload);
                    on.time = match[1];
                    bootstrap();
                }
                if (msg.payload.indexOf('offtime') !== -1) {
                    handled = true;
                    var match = /.*offtime\s+(\S+)/.exec(msg.payload);
                    off.time = match[1];
                    bootstrap();
                }
            } else {
                if (msg.payload.hasOwnProperty('suspended')) {
                    handled = true;
                    config.suspended = !!msg.payload.suspended;
                    bootstrap();
                }
                if (msg.payload.hasOwnProperty('ontime')) {
                    handled = true;
                    on.time = msg.payload.ontime;
                    bootstrap();
                }
                if (msg.payload.hasOwnProperty('offtime')) {
                    handled = true;
                    off.time = msg.payload.offtime;
                    bootstrap();
                }
            }
            if (!handled) {
                node.status({fill: 'red', shape: 'dot', text: 'Unsupported input'});
            }
        });

        node.on('close', suspend);

        function setupEvent(eventName, shape) {
            var filtered = _.pickBy(config, function (value, key) {
                return key && key.indexOf(eventName) === 0;
            });
            var event = _.mapKeys(filtered, function (value, key) {
                return key.substring(eventName.length).toLowerCase();
            });
            event.name = eventName.toUpperCase();
            event.shape = shape;
            event.callback = function () {
                send(event);
                schedule(event);
            };
            return event;
        }

        function send(event, manual) {
            node.send({topic: event.topic, payload: event.payload});
            node.status({
                fill: manual ? 'blue' : 'green',
                shape: event.shape,
                text: event.name + (manual ? ' manual' : ' auto') + (config.suspended ? ' - scheduling suspended' : (' until ' + event.inverse.moment.format(fmt)))
            });
        }

        function schedule(event, isInitial) {
            var now = moment();
            var matches = new RegExp(/(\d+):(\d+)/).exec(event.time);
            if (matches && matches.length) {
                // Don't use 'now' here as hour and minute mutate the moment.
                event.moment = moment().hour(matches[1]).minute(matches[2]);
            } else {
                var sunCalcTimes = SunCalc.getTimes(new Date(), config.lat, config.lon);
                var date = sunCalcTimes[event.time];
                if (date) {
                    event.moment = moment(date);
                }
            }
            if (event.moment) {
                event.moment.seconds(0);
                if (!isInitial || isInitial && now.isAfter(event.moment)) {
                    event.moment.add(1, 'day');
                }
                if (event.offset) {
                    var adjustment = event.offset;
                    if (event.randomoffset) {
                        adjustment = event.offset * Math.random();
                    }
                    event.moment.add(adjustment, 'minutes');
                }

                var delay = event.moment.diff(now);
                if (event.timeout) {
                    clearTimeout(event.timeout);
                }
                event.timeout = setTimeout(event.callback, delay);
            } else {
                node.status({fill: 'red', shape: 'dot', text: 'Invalid time: ' + event.time});
            }
        }

        function suspend() {
            clearTimeout(on.timeout);
            clearTimeout(off.timeout);
            node.status({fill: 'grey', shape: 'dot', text: 'Scheduling suspended - manual mode only'});
        }

        function resume() {
            schedule(on, true);
            schedule(off, true);
            var firstEvent = on.moment.isBefore(off.moment) ? on : off;
            var message = firstEvent.name + ' ' + firstEvent.moment.format(fmt) + ', ' +
                firstEvent.inverse.name + ' ' + firstEvent.inverse.moment.format(fmt);
            node.status({fill: 'yellow', shape: 'dot', text: message});
        }

        function bootstrap() {
            if (config.suspended) {
                suspend();
            } else {
                resume();
            }
        }

        bootstrap();
    });
};