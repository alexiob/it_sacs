'use strict';

/*
 * Configuration management.
 *
 * Configuration files inside the config folder are searched and merged in the following order:
 * - default.EXT
 * - default-{instance}.EXT
 * - {deployment}.EXT
 * - {deployment}-{instance}.EXT
 * - {short_hostname}.EXT
 * - {short_hostname}-{instance}.EXT
 * - {short_hostname}-{deployment}.EXT
 * - {short_hostname}-{deployment}-{instance}.EXT
 * - {full_hostname}.EXT
 * - {full_hostname}-{instance}.EXT
 * - {full_hostname}-{deployment}.EXT
 * - {full_hostname}-{deployment}-{instance}.EXT
 * - local.EXT
 * - local-{instance}.EXT
 * - local-{deployment}.EXT
 * - local-{deployment}-{instance}.EXT
 *
 * Where:
 * - EXT can be .yml, .yaml, .coffee, .cson, .properties, .json, .json5,
 *   .hjson or .js depending on the format you prefer (see below)
 * - {instance} is an optional instance name string for Multi-Instance Deployments
 * - {short_hostname} is your server name up to the first dot, from the $HOST or $HOSTNAME environment
 *   variable or os.hostname() (in that order).
 *   For example if your hostname is www.example.com then it would load www.EXT.
 * - {full_hostname} is your whole server name, you may use this when {short_hostname} collides with other machines.
 * - {deployment} is the deployment name, from the $NODE_ENV environment variable
 * - The default.EXT file is designed to contain all configuration parameters from which
 *   other files may overwrite. Overwriting is done on a parameter by parameter basis,
 *   so subsequent files contain only the parameters unique for that override.
 *
 * Then the environment variables specified in the "custom-environment-variables.EXT" are merged.
 * Then the command line arguments specified in the "custom-cli-variables.EXT" are merged.
 * Valid extensions for the two files above are .json and .js.
 */

var _ = require("lodash"),
    path = require("path"),
    minimist = require("minimist"),
    config
    ;

/**
 * Merges the contents of optional config files into the provided configuration object.
 *
 * @param  {Object}   cfg             dictionary with the original configuration options.
 * @param  {string}   cfgFilename     configuration file name to search and merge into config, without extensions.
 * @param  {string}   folder          folder path where to search for the configuration files to merge.
 * @param  {function} transformer     optional function(configObject) called before merging the loaded config.
 * @param  {Array}    validExtensions optional list of suprted configuration extensions, default is ["js", "json"].
 * @return {Object}                   the merged configuration Object.
 */
function mergeConfigFile(cfg, cfgFilename, folder, transformer, validExtensions) {
    var extNames = _.isUndefined(validExtensions) ? ['js', 'json'] : validExtensions
        ;

    _.forEach(extNames, function (extName) {
        var filename = path.join(folder, cfgFilename + '.' + extName),
            configObj = config.util.parseFile(filename)
            ;

        if (configObj) {
            if (_.isFunction(transformer)) {
                configObj = transformer(configObj);
            }
            config.util.extendDeep(cfg, configObj);
        }
    });

    return cfg;
}
module.exports.mergeConfigFile = mergeConfigFile;

/**
 * Returns the fodler from where the application configuration is read.
 *
 * @return {string}  folder path.
*/
function configDir() {
    if (process.env.NODE_CONFIG_DIR) {
        return process.env.NODE_CONFIG_DIR;
    }

    return path.join(process.cwd(), 'config');
}
module.exports.configDir = configDir;

/**
 * Loads and populates configuration parameters from the command line.

 * @param  {Object} argv command line options as returned by minimist.
 * @return {Object}      configuration object.
 */
function getCustomCLIVariables(argv) {
    var result = {}
        ;

    return mergeConfigFile(result, 'custom-cli-variables', configDir(), function(cfg) {
        return config.util.substituteDeep(cfg, argv);
    });
}

/**
 * Loads and prepares the configuration.
 * Configuration sources are applied in the following order:
 * - ./config/files
 * - ENV variables
 * - command line options
 * - custom configuration dictionay
 *
 * @param  {Object} argvOptions  minimist argv options object.
 * @param  {Object} customConfig optional custom configurations object.
 * @return {Object}              configuration object.
 */
function create(app, argvOptions, customConfig) {
    var argv = minimist(process.argv.slice(2), argvOptions)
        ;

    // if we have an "env" command line let's set the NODE_ENV
    if (_.isString(argv.env)) {
        process.env.NODE_ENV = argv.env;
    } else if (!_.isString(process.env.NODE_ENV)) {
        process.env.NODE_ENV = "dev";
    }

    // load the configs
    config = require("config");

    // extend config with command line variables
    config.util.extendDeep(config, getCustomCLIVariables(argv));

    // extend with optional custom config
    if (_.isObject(customConfig)) {
        config.util.extendDeep(config, customConfig);
    }

    module.exports.argv = argv;

    app.config = module.exports;

    return module.exports;
}
module.exports.create = create;

/**
 * Gets a configuration value.
 *
 * @param  {string} path         a dot.delimited.configuration path.
 * @param  {Object} defaultValue optional value to return if the config path is not found.
 * @return {Object|undefined}    the configuration value.
 */
module.exports.get = function(path, defaultValue) {
    return _.get(config, path, defaultValue);
};

/**
 * Checks if a configuration path is defined.
 *
 * @param  {string} path  a dot.delimited.configuration path.
 * @return {boolean}      true if the configuration path is defined.
 */
module.exports.has = function(path) {
    return _.has(config, path);
};
