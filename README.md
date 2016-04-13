Ethereum Network Stats
============
[![Build Status][travis-image]][travis-url] [![dependency status][dep-image]][dep-url]

This is a visual interface for tracking Decred network status. It uses WebSockets to receive stats from running Decred daemon and output them through an angular interface.

![Screenshot](https://raw.githubusercontent.com/cubedro/eth-netstats/master/src/images/screenshot.jpg?v=0.0.6 "Screenshot")

## Prerequisite
* node
* npm

## Installation
Make sure you have node.js and npm installed.

Clone the repository and install the dependencies

```bash
git clone https://github.com/Dyrk/eth-netstats
cd eth-netstats
npm install
sudo npm install -g grunt-cli
```

##Build the resources
In order to build the static files you have to run grunt tasks which will generate dist directory with the static js and css files, fonts and images.


To build the full version run
```bash
grunt
```

##Run

Change your credentials in `lib/utils/config.json`
You need to set user, password and full path to the rpc.cert

Install pm2 package globally
```
npm install -g pm2
```

And run application
```
pm2 startOrRestart package.json --env=production
```

see the interface at http://localhost:3000