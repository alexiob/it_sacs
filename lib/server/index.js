'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        telnet = require("./telnet")
        ;

    var api = {
            server: {
                clients: []
            }
        },
        serverType = app.config.get("server.type")
        ;

    _.merge(app.api, api);

    if (serverType === "telnet") {
        return telnet.create(app);
    } else {
        app.api.log("server.error: unknown server type=%s", serverType);
        process.exit(1);
    }
};