'use strict';

var _ = require("lodash"),
    PromiseA = require("bluebird"),
    asciimo = require('asciimo').Figlet,
    colors = require('colors')
    ;

module.exports.banner = function(text, font) {
    return new PromiseA(function(resolve) {
        asciimo.write(text, font, function(art) {
            resolve(art);
        });
    });
};