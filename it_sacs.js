'use strict';

function main() {
    var config = require("./lib/config"),
        email = require("./lib/email"),
        user = require("./lib/user"),
        messages = require("./lib/messages"),
        location = require("./lib/location"),
        reports = require("./lib/reports"),
        parser = require("./lib/parser"),
        server = require("./lib/server")
        ;

    var app = {
            api: {
                log: console.log
            }
        }
        ;

    config.create(app);
    email.create(app);
    user.create(app);
    reports.create(app);
    messages.create(app);
    parser.create(app);
    location.create(app);
    server.create(app);

    app.api.server.start();
}

main();