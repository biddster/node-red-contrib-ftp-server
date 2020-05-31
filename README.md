# FTP Server

FTP Server for Node-RED that currently only supports putting files. Uploaded files are emitted from this node via 
`msg.payload` of type Buffer.

Written for my Dad so he can wire his IP camera's motion detection directly into Node-RED. 

# Installation
 
    $ cd ~/.node-red
    $ npm install node-red-contrib-ftp-server
 
# Configure Node-RED

Drag the FTP Server node into your workspace and double click to configure:
 - Enter a free port on your Node-RED server
 - Enter a username of your choosing
 - Enter a password of your choosing


![NR ftp settings](https://raw.githubusercontent.com/biddster/node-red-contrib-ftp-server/develop/doc/NodeRED.png)

## Dynamic authentication
If you leave the username field empty the node uses the dynamic authentication mode. In this mode every login request has to be handled manually.
On each login attempt the node outputs an object containing the username, the password and an authenticate function on the "authenticate" output.
You can then manually validate the username and password and must call the authenticate function with the parameter true to accept the authentication or false to reject it.


Here is an example how an authenticate message would look like:
```
{
    payload: {
        username: "username",
        password: "password"
    },
    authenticate: <function>
}
```
Here is an example how to handle the login attempts in a function node:
```
msg.authenticate(
    msg.payload.username === 'username' &&
    msg.payload.password === 'password'
);
msg.payload = undefined;
return msg;
```

# Configure a device to use your Node-RED FTP server

Here's an example of configuring a Foscam IP camera to upload images into Node-RED:
 - Enter the IP address of your Node-RED server as the FTP server address
 - Enter the port, username and password that you chose when you configured the FTP node in Node-RED above.
 
Now you can configure the motion settings of your IP camera to upload images to FTP. 

The images are then emitted from this node as a buffer via `msg.payload`.
 
![Foscam ftp settings](https://raw.githubusercontent.com/biddster/node-red-contrib-ftp-server/develop/doc/Foscam.png)

### Enabling extra debugging

Install `node-red-contrib-config` and drag a config node into your workspace. Configure the node to set a global variable called `ftp-server` 
with a JSON value of `{"debug": true}`. Also make sure that the config tickbox for `active` is unchecked. Redeploy. Now click the button on the config node. 
This will trigger all instances of `ftp-server` to write extra logging to the os syslog next time they're invoked.

# TODO

- TLS support
- Proper testing