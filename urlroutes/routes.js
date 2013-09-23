﻿/**
 * @author: Thomas Stockx
 * @copyright: OKFN Belgium
 */

/**
 * Returns a list of Routes starting or ending at a Spot
 * @param spot_id id of the Spot
 * @return json representation of the Routes
 */
exports.findRoutesStartingAtSpot = function (request, response) {
    // declare external files
    var utils = require("../utils");
    var querystring = require('querystring');
    var mongojs = require('mongojs');
    var config = require('../auth/dbconfig');
    var server = require('../server');

    // check for url parameters, spot_id should be defined
    if (typeof request.query.spot_id !== undefined) {

        // parse spot_id to an integer to avoid malicious attempts
        var spot_id_safe = parseInt(request.query.spot_id);

        // find all routes which have item x as starting point
        server.mongoConnectAndAuthenticate(function (err, conn, db) {
            console.log("ROUTES: connected to DB, finding routes...");
             //var db = mongojs(config.dbname);
            var collection = db.collection(config.collection);
            collection.find({ 'points.0': { item: request.query.spot_id } })
                .toArray(function (err, docs) {
                    // the list of routes starting at Spot is stored in the docs array
                    if (err) {
                        response.send({
                            "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the MongoDB: " + err),
                            "response": {}
                        });
                    }
                    else {
                        // find all routes which have item x as ending point
                        collection.find({ $where: 'this.points[this.points.length-1].item == ' + spot_id_safe })
                            .toArray(function (err, docs2) {
                                if (err) {
                                    response.send({
                                        "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the MongoDB: " + err),
                                        "response": {}
                                    });
                                } else {
                                    // the list of routes ending at Spot is stored in the docs2 array
                                    // concat these arrays, and return the JSON.
                                    var resultDocs = docs;
                                    resultDocs.concat(docs2);
                                    response.send({
                                        "meta": utils.createOKMeta(),
                                        "response": { "routes": resultDocs }
                                    });
                                }
                            });
                    }
                });
        });
    }
    else {
        // bad request
        response.send({
            "meta": utils.createErrorMeta(400, "X_001", "The 'spot_id' has no data and doesn't allow a default or null value."),
            "response": {}
        });
    }
}

/**
 * Store a generated route in the database based on the given parameters
 * @param channelname name of the channel to use for generation
 * @param token bearer_token of the session
 * @param latitude latitude of the location
 * @param longitude longitude of the location
 * @param spot_id id of the starting spot
 * @param radius radius to search for each next spot (in km)
 * @return json representation of the generated route.
 */
exports.generateRoute = function (request, response) {
    // declare external files
    var spotsFile = require("./spots");
    var minimumGroupSize = request.query.minGroupSize;
    var maximumGroupSize = request.query.maxGroupSize;
    var startDate = request.query.startdate;
    var endDate = request.query.enddate;
    if (minimumGroupSize == null) {
        minimumGroupSize = 1;
    }; 
    // check for invalid request
    if (typeof request.query.token !== undefined && typeof request.query.latitude !== undefined && typeof request.query.longitude !== undefined && typeof request.query.spot_id !== undefined && typeof request.query.radius !== undefined) {

        // start the route with an array containing the starting spot
        jsonResult = [{
            "item": "" + parseInt(request.query.spot_id)
        }];
        // this function contains the algorithm to generate the route
        spotsFile.findSpotByChannel(request.query.latitude, request.query.longitude, request.params.channelname, request.query.radius, minimumGroupSize, maximumGroupSize, startDate, endDate, jsonResult, response);
    } else {
        // bad request
        response.send({
            "meta": utils.createErrorMeta(400, "X_001", "The 'spot_id', 'token', 'latitude', 'longitude' or 'radius' has no data and doesn't allow a default or null value."),
            "response": {}
        });
    }
}


/**
 * Store a generated route in the database based on the given parameters
 * @param channels array of channel names to use for generation, concatenated with a | symbol
 * @param token bearer_token of the session
 * @param latitude latitude of the location
 * @param longitude longitude of the location
 * @param spot_id id of the starting spot
 * @param radius radius to search for each next spot (in km)
 * @return json representation of the generated route.
 */
exports.generateRouteFromChannelArray = function (request, response) {
    // declare external files
    var spotsFile = require("./spots");

    var minimumGroupSize = request.query.minGroupSize;
    var maximumGroupSize = request.query.maxGroupSize;
    var startDate = request.query.startdate;
    var endDate = request.query.enddate;
    if (minimumGroupSize == null) {
        minimumGroupSize = 1;
    }; 

    // check for invalid request
    if (typeof request.query.token !== undefined && typeof request.query.latitude !== undefined && typeof request.query.longitude !== undefined && typeof request.query.spot_id !== undefined && typeof request.query.radius !== undefined && typeof request.query.channels !== undefined) {
        // start the route with an array containing the starting spot
        jsonResult = [{
            "item": "" + parseInt(request.query.spot_id)
        }];
        // this function contains the algorithm to generate the route
        spotsFile.findSpotByChannel(request.query.latitude, request.query.longitude, request.query.channels, request.query.radius, minimumGroupSize, maximumGroupSize, startDate, endDate, jsonResult, response);
    } else {
        // bad request
        response.send({
            "meta": utils.createErrorMeta(400, "X_001", "The 'spot_id', 'token', 'latitude', 'longitude' or 'radius' has no data and doesn't allow a default or null value."),
            "response": {}
        });
    }

}

/**
 * Returns the details of of a route, including details of each Spot on the Route.
 * @param id the id of a Route
 * @return json representation of the Route
 */
exports.findById = function (request, response) {
    var mongojs = require('mongojs');
    var ObjectId = mongojs.ObjectId;
    // search the route in the database and don't edit anything.
    searchById(ObjectId(request.params.id), response, true);
}

/**
 * Search for routes by an id.
 * @param id id of the route
 * @param response allows this function to return the response to the original request
 * @param returnResponse true if normal call, false if the static map png still needs to be generated and added
 */
searchById = function(id, response, returnResponse)
{
    // declare external files
    var utils = require("../utils");
    var mongojs = require('mongojs');
    var config = require('../auth/dbconfig');
    var citylife = require('../auth/citylife');
    var querystring = require('querystring');
    var https = require('https');
    var requestlib = require('request');
    var server = require('../server');
    
    var resultAmount = 0;

    // find the route by its id.
    server.mongoConnectAndAuthenticate(function (err, conn, db) {
        //var db = mongojs(config.dbname);
        var collection = db.collection(config.collection);
        collection.find({ '_id': id })
            .each(function (err, docs) {
                if (err) {
                    response.send({
                        "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the MongoDB: " + err),
                        "response": {}
                    });
                } else if (!docs) {
                    // we visited all docs in the collection
                    // if docs is empty
                    if (resultAmount == 0) {
                        response.send({
                            "meta": utils.createErrorMeta(400, "X_001", "The ID was not found. " + id),
                            "response": {}
                        });
                    }
                } else {
                    // increase resultAmount so on next iteration the algorithm knows the id was found.
                    resultAmount++;
                    // this contains the JSON array with spots
                    var spotArray = docs.points;
                    // initialize parse variables
                    var count = 0;
                    var resultArray = [];
                    var spotsIdArray = [];

                    // create a array containing the spot urls in the right order
                    for (var i = 0; i < spotArray.length; ++i) {
                        spotsIdArray[i] = parseInt(spotArray[i].item);
                    }

                    // for each spot, do a query to the CityLife API for more info about that spot
                    for (var i = 0; i < spotArray.length; ++i) {
                        requestlib({
                            uri: citylife.getSpotByIdCall + spotArray[i].item,
                            method: "GET",
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }, function (error, responselib, body) {
                            if (responselib.statusCode != 200 || error) {
                                response.send({
                                    "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the CityLife API " + error),
                                    "response": {}
                                });
                            } else {
                                // for each spot, parse the result
                                parseRouteSpots(error, responselib, body, resultArray, spotArray, spotsIdArray, count, docs, response, returnResponse);
                                count++;
                            }
                        });
                    }
                }
            });
    });
};

/**
 * Callback for query of Google Maps Direction API
 * @param error standard callback variable of request library
 * @param responselib standard callback variable of request library
 * @param body standard callback variable of request library
 * @param resultArray array that will be filled with all spot data
 * @param markers contains all markers for the creation of a static map
 * @param docs result of the route query in mongoDB
 * @param response used to create a response to the client
 */
parseDirectionResults = function (error, responselib, body, resultArray, markers, docs, response, returnResponse) {
    // declare external files
    var polyline = require('polyline');
    var gm = require('../lib/googlemaps');
    var config = require('../auth/dbconfig');
    var mongojs = require('mongojs');
    var server = require('../server');
    var utils = require('../utils');

    // parse the result of the Google Directions API to a JSON object
    var jsonResult = JSON.parse(body);

    // decode the polyline representation of the route to a readable array of lat and longs.
    var points = polyline.decodeLine(jsonResult.routes[0].overview_polyline.points);
    var paths = [];
    paths[0] = { 'points': points };

    // if normal request, send the response to the user
    if (returnResponse) {
        response.send({
            "meta": utils.createOKMeta(),
            "response": {
                "name": docs.name,
                "id": docs._id,
                "description": docs.description,
                "spots": resultArray,
                "png": docs.png
            }
        });
    }
    else {
        // The static map png still has to be generated first

        // find the route by its id, generate a static map png and add it to the database
        server.mongoConnectAndAuthenticate(function (err, conn, db) {
            //var db = mongojs(config.dbname);
            var collection = db.collection(config.collection);
            var ObjectId = mongojs.ObjectId;
            collection.update(
                { '_id': docs._id },
                {
                    $set: {
                        'png': gm.staticMap(
                            '',
                            '',
                            '250x250',
                            false,
                            false,
                            'roadmap',
                            markers,
                            null,
                            paths)
                    }
                },
                { multi: true },
                function (err, docs2) {
                    if (err) {
                        response.send({
                            "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the MongoDB: " + err),
                            "response": {}
                        });
                    } else {
                        // return the route including its png
                        response.send({
                            "meta": utils.createOKMeta(),
                            "response": {
                                "name": docs.name,
                                "id": docs._id,
                                "description": docs.description,
                                "spots": resultArray,
                                "png": gm.staticMap(
                                    '',
                                    '',
                                    '250x250',
                                    false,
                                    false,
                                    'roadmap',
                                    markers,
                                    null,
                                    paths)
                            }
                        });
                    }
                });
        });
    }
}

/**
 * Callback for query of Google Maps Direction API
 * @param error standard callback variable of request library
 * @param responselib standard callback variable of request library
 * @param body standard callback variable of request library
 * @param resultArray array that will be filled with all spot data
 * @param markers contains all markers for the creation of a static map
 * @param docs result of the route query in mongoDB
 * @param response used to create a response to the client
 */
parseDirectionResults = function (error, responselib, body, resultArray, markers, docs, response, returnResponse) {
    // declare external files
    var polyline = require('polyline');
    var gm = require('../lib/googlemaps');
    var config = require('../auth/dbconfig');
    var mongojs = require('mongojs');
    var server = require('../server');
    var utils = require('../utils');

    var db = mongojs(config.dbname);
    var collection = db.collection(config.collection);

    // parse the result of the Google Directions API to a JSON object
    var jsonResult = JSON.parse(body);

    // decode the polyline representation of the route to a readable array of lat and longs.
    var points = polyline.decodeLine(jsonResult.routes[0].overview_polyline.points);
    var paths = [];
    paths[0] = { 'points': points };

    // if normal request, send the response to the user
    if (returnResponse) {
        response.send({
            "meta": utils.createOKMeta(),
            "response": {
                "name": docs.name,
                "id": docs._id,
                "description": docs.description,
                "spots": resultArray,
                "png": docs.png
            }
        });
    }
    else {
        // The static map png still has to be generated first
        var db = mongojs(config.dbname);
        var collection = db.collection(config.collection);
        var ObjectId = mongojs.ObjectId;

        // find the route by its id, generate a static map png and add it to the database
        require('mongodb').connect(server.mongourl, function (err, conn) {
            collection.update(
                { '_id': docs._id },
                {
                    $set: {
                        'png': gm.staticMap(
                            '',
                            '',
                            '250x250',
                            false,
                            false,
                            'roadmap',
                            markers,
                            null,
                            paths)
                    }
                },
                { multi: true },
                function (err, docs2) {
                    if (err) {
                        response.send({
                            "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the MongoDB: " + err),
                            "response": {}
                        });
                    } else {
                        // return the route including its png
                        response.send({
                            "meta": utils.createOKMeta(),
                            "response": {
                                "name": docs.name,
                                "id": docs._id,
                                "description": docs.description,
                                "spots": resultArray,
                                "png": gm.staticMap(
                                    '',
                                    '',
                                    '250x250',
                                    false,
                                    false,
                                    'roadmap',
                                    markers,
                                    null,
                                    paths)
                            }
                        });
                    }
                });
        });
    }
}



/**
 * Add a route to the mongoDB database
 * @param a list of ids of spots
 * @param a name for the route
 * @param a description for the route
 @return the route id
 */
exports.addRoute = function (request, response) {
    // declare external files
    var mongojs = require('mongojs');
    var config = require('../auth/dbconfig');
    var server = require('../server');
    var utils = require('../utils');

    server.mongoConnectAndAuthenticate(function (err, conn, db) {
        //var db = mongojs(config.dbname);
        var collection = db.collection(config.collection);
        var minimumGroupSize = request.body.minimumGroupSize;
        var maximumGroupSize = request.body.maximumGroupSize;
        if (minimumGroupSize == null) {
            minimumGroupSize = 1;
        }; 

        // insert the route in the database
        collection.insert({
            "name": request.body.name,
            "description": request.body.description,
            "points": request.body.points,
            "minimumGroupSize": minimumGroupSize,
            "maximumGroupSize": maximumGroupSize
        }, function (err, docs) {
            if (err) {
                response.send({
                    "meta": utils.createErrorMeta(500, "X_001", "Something went wrong with the MongoDB: " + err),
                    "response": {}
                });
            } else {
                // this function returns a result to the user, but a boolean is set so the static map png will be generated first.
                searchById(docs[0]._id, response, false);
            }
        });
    });
};

// searchById should be usable from other files
exports.searchById = searchById;