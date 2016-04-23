# Slap reviews

Post your latest android and ios app reviews on slack.

# How it works

A script that html scraps the google play store for your android app reviews and uses
apple's json feed for your ios app reviews.

The latest reviews are posted to slack using a
[custom integration incoming webhook](https://slack.com/apps/A0F7XDUAZ-incoming-webhooks).

# Installation

**git clone** this repository and copy [config.example.json](config.example.json) to config.json.

Edit config.json to add your slack webhook url. Add your android and ios apps to config.json

**Note:** Each app name must be unique even between platforms in config.json.
You can't have an app named X for android and X for ios.
Instead name the android app "X android" and the ios app "X ios" in config.json.

# Usage

    $> node index.js

This will run the script and post your latest reviews to slack.

Setup a cron job to run the script every so often.

# License

[GPL 3](LICENSE)
