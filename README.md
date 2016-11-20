# Schedex

Scheduler for node-red which allows you to enter on/off times as 24hr clock (e.g. 01:10) or suncalc events (e.g. goldenHour).
It also allows you to offset times and randomise the time within the offset.

Inspired by Pete Scargill's [BigTimer](http://tech.scargill.net/big-timer/)


# Installation
 
Change directory to your node red installation:

    $ npm install node-red-contrib-schedex
 
# Configuration 

## Suspending scheduling

The 'Suspend scheduling' checkbox allows you to disable time scheduling. If scheduling is suspended, 
Schedex will only generate output events upon receipt of input 'on' and 'off' events (see below).

This setting is provided for the situation where you temporarily don't want time based activation 
and don't want to rewire your Node-RED flow.
    
## Times
    
The times can be a 24 hour time or a [suncalc](https://github.com/mourner/suncalc) event:


| Time        | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `00:00 ... 23:59`       | 24hr time                     |
| `sunrise`       | sunrise (top edge of the sun appears on the horizon)                     |
| `sunriseEnd`    | sunrise ends (bottom edge of the sun touches the horizon)                |
| `goldenHourEnd` | morning golden hour (soft light, best time for photography) ends         |
| `solarNoon`     | solar noon (sun is in the highest position)                              |
| `goldenHour`    | evening golden hour starts                                               |
| `sunsetStart`   | sunset starts (bottom edge of the sun touches the horizon)               |
| `sunset`        | sunset (sun disappears below the horizon, evening civil twilight starts) |
| `dusk`          | dusk (evening nautical twilight starts)                                  |
| `nauticalDusk`  | nautical dusk (evening astronomical twilight starts)                     |
| `night`         | night starts (dark enough for astronomical observations)                 |
| `nadir`         | nadir (darkest moment of the night, sun is in the lowest position)       |
| `nightEnd`      | night ends (morning astronomical twilight starts)                        |
| `nauticalDawn`  | nautical dawn (morning nautical twilight starts)                         |
| `dawn`          | dawn (morning nautical twilight ends, morning civil twilight starts)     |


## Offsets

The on and off time can have an offset. This is specified in minutes:

 - -ve number brings the time forward. E.g. if the time is dusk and offset is -60, a message will be generated 60 minutes before dusk.
 - +ve number delays the time by the specified number of minutes

## Randomisation of times

Both on and off times can be randomised by ticking "Use random time within offset period". For example, if you specify dusk with
an offset of -60 minutes, every day a message will be generated at a random time in a 60 minute window before dusk.
  
## Inputs
  
You can wire inject nodes to the input of this node. To turn on manually, simply send a payload of 'on'. To turn off manually,
send a payload of 'off'. Injecting on or off causes this node emit the configured topic and payload. The manual mode is reset when the next on or off time is reached.

## Programmatic Control
  
This node supports programmatic time control as well as configuration via the NodeRED UI. 

**It is very important to note that properties set programmatically in this manner are transient. They will not persist over a NodeRED restart 
or redeploy!**

You can set the following:
 
| Property        | Type                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `msg.payload.ontime` | String value as specified in the table above for time configuration |
| `msg.payload.offtime` | String value as specified in the table above for time configuration |
| `msg.payload.suspended` | Boolean: true will suspend scheduling, false will resume schduling |
 
 
Alternatively, you can send msg.payload as a string with the following values 

| Example msg.payload        | Description|
| --------------- | ------------------------------------------------------------------------ |
| `ontime 12:00` | Time as specified in the table above for time configuration |
| `offtime dusk` | Time as specified in the table above for time configuration |
| `suspended true` | true will suspend scheduling, false will resume schduling |

