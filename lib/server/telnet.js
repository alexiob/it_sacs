'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        telnet = require("telnet2"),
        Screen = require("../screen"),
        uuid = require("node-uuid")
        ;

    var server,
        screen
        ;

    server = telnet(app.config.get("server.options"), function(client) {
        client.userId = uuid.v4();

        app.api.log("server.client.open:", client.userId);

        screen = Screen.create(app, client);
        client.screen = screen;
        app.api.server.clients.push(client);

        app.api.user.connect(client.userId, {client:client, screen:screen});

        client.on('term', function(terminal) {
            app.api.log("server.client.terminal:", client.userId);
            screen.setTerminal(terminal);
            screen.render();
            screen.startPrompt();
            app.api.location.enter(app.config.get("locations.start"), client.userId)
                .then(function(/*res*/) {
                });
        });

        client.on('size', function(width, height) {
            client.columns = width;
            client.rows = height;
            client.emit('resize');
        });

        client.on('close', function() {
            app.api.log("server.client.close:", client.userId);

            app.api.user.disconnect(client.userId);

            screen.destroy();

            client.screen = undefined;
            _.remove(app.api.server.clients, client);
        });

        client.on('debug', function(msg) {
            app.api.log("server.telnet.debug: %s", msg);
        });

        screen.setup();
    });

    app.api.server.instance = server;
    app.api.server.start = function() {
        server.listen(app.config.get("server.options.port"));
        app.api.log("server.telnet.start: listening on port %s", app.config.get("server.options.port"));
    };

    return server;
};