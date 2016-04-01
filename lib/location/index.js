'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        locationsList = [
            require("./lobby"),
            require("./registration"),
            require("./accounting")
        ]
        ;
    var locations = {}
        ;

    _.forEach(locationsList, function(location) {
        location.create(app, locations);
    });

    app.api.location = {};

    app.api.location.list = function() {
        return _.keys(locations);
    };

    app.api.location.get = function(name) {
        return _.get(locations, name);
    };

    app.api.location.enter = function(name, userId) {
        var system = app.api.user.get(userId),
            location = app.api.location.get(name),
            res = false
            ;

        if (_.isObject(location) && system.location.current !== location) {
            res = app.api.location.exit(userId)
                .return(location.enter(system))
                .then(function(result) {
                    if (result === true) {
                        system.location.current = location;
                        location.describe(system);
                    }
                    return result;
                });
        }

        return PromiseA.resolve(res).tap(function(res) {
            app.api.log("location.enter:", userId, name, res);
        });
    };

    app.api.location.describe = function(name, userId) {
        var system = app.api.user.get(userId),
            location = app.api.location.get(name)
            ;

            if (_.isObject(location)) {
                location.describe(system);
            }
    };

    app.api.location.exit = function(userId) {
        var system = app.api.user.get(userId),
            res = true
            ;

        if (_.isObject(system.location.current)) {
            res = PromiseA.resolve(system.location.current.exit(system))
                .then(function(result) {
                    if (result === true) {
                        system.location.current = undefined;
                    }
                });
        }

        return PromiseA.resolve(res).tap(function(res) {
            app.api.log("location.exit:", userId, _.get(system, "location.name"), res);
        });
    };

    app.api.location.say = function(locationName, message, fromUserId) {
        _.forEach(app.api.parser.parser.env.users, function(user, userId) {
            if (user.location.current &&  user.location.current.name === locationName) {
                if (userId !== fromUserId) {
                    user.screen.echo(message);
                }
            }
        });
    };
};