/*** @author Mathias Raets* @copyright OFKN Belgium */// the list of spots that are used when creating the routevar spots = [];/**show the routebuilder using the spots[] variable*/function showRouteBuilder()  {    $("#aside").show();    acquireSuggestedSpots(spots[0]);    //acquireRecommendedSpots(spots[0].link.params.id);    $.each(spots, function (index, value) {        var toAdd = "<li id='spot_" + value.link.params.id + "' class='ui-state-default'>" + value.title + "</li>";        $("#sortable").append(toAdd);    });    $("#routes").hide();        /**    Form to add a name and description for the new route    */    $("#sortableInput").html("<table><tr><td>Route Name:</td> <td><input type='text' id='routeName' value='NewRoute1'/></td></tr>" +    "<tr><td> Route Description:</td> <td><textarea id='routeDescription' value='New Awesome Route'/></td></tr>" +    "<tr><td>Minimum group size:</td><td><input type='number' id='minGroupSize' min='1'/> </td></tr>" +    "<tr><td>Maximum group size:</td><td><input type='number' id='maxGroupSize' min='1'/> </td></tr></table>" +    "<p><input type='button' onclick = 'addNewRoute()' value='Add this new route'/></p>");        $("#routeBuilder").show();    $("#searchform").show();    $("#tabs").show();};/*** @param spotID the ID of the first spot* sets a spot as startspot*/function routeBuilderSetFirstSpot(spotID){    var startSpot;    $.each(spots, function(index,value){        if(value.link.params.id == spotID)            startSpot = value;    });    spots = [];    spots.push(startSpot);};/*** find relevant matches for a location using the citylife API* @param spot the spot you want to find relevant matches for*/function acquireSuggestedSpots(spot){    var latitude = spot.meta_info.latitude;    var longitude = spot.meta_info.longitude;    var url =  "http://" + config_serverAddress + "/spots/relevant/?token=" + $.cookie("token") + "&latitude=" + latitude + "&longitude=" + longitude;        $("#suggestions").html("");    $("#tabs-1-loader").show();        // send a request to the nodeJS API to acquire the relevant spots for a profile    // parameters: bearer token, latitude and longitude    // returns: list of relevant spots        $.ajax({       type: 'GET',       crossDomain:true,        url: url,        cache: false,        success: onGetSuggestedSpots,        cache: false,        error: function(jqXHR, errorstatus, errorthrown) {           alert(errorstatus + ": " + errorthrown);        }    });  };/** * find relevant spots for a location and a search term * @param latitude he latitude of the location * @param longitude the longitude of the location * @param searchTerm the search term */ function acquireSuggestedSpotsBySearch( latitude, longitude, searchTerm) {    var url = "http://" + config_serverAddress + "/spots/search/?token=" + $.cookie("token") + "&latitude=" + latitude + "&longitude=" + longitude + "&search_term=" + searchTerm;        $("#searchresults").html("");    $("#tabs-3-loader").show();        // send a request to the nodeJS API to acquire the suggested spots based on a search query    // parameters: latitude and longitude, bearer token and a search term    // returns: list of spots            $.ajax({        type: 'GET',        crossDomain:true,        url: url,        cache: false,        success: onGetSearchedSpots,        error: function(jqXHR, errorstatus, errorthrown) {            alert(errorstatus + ": " + errorthrown);        }    }); }/*** find relevant matches for a location* @param latitude the latitude of the location* @param longitude the longitude of the location*/function acquireSuggestedSpotsByLatLong( latitude, longitude){    var url =  "http://" + config_serverAddress + "/spots/relevant/?token=" + $.cookie("token") + "&latitude=" + latitude + "&longitude=" + longitude;        $("#suggestions").html("");    $("#tabs-1-loader").show();        // send a request to the nodeJS API to acquire the relevant spots    // parameters: latitude and longitude, bearer token    // returns: list of spots        $.ajax({       type: 'GET',       crossDomain:true,        url: url,        cache: false,        success: onGetSuggestedSpots,        error: function(jqXHR, errorstatus, errorthrown) {           alert(errorstatus + ": " + errorthrown);        }    });  };/** * callback function after acquiring a list of searched spots */function onGetSearchedSpots(data, textStatus, jqXHR) {            if (data.meta.code == 200) {        // clear the searched list        $("#searchresults").html("");        $("#tabs-3-loader").hide();        $.each(data.response.data.items, function(index,value) {            $("#searchresults").append("<li onclick='addSearchedSpot(" + index + ")' id='searchedSpot_" + value.link.params.id + "'>" +                "<span class='ui-icon ui-icon-plus'></span> " + value.title + "<br/>" + value.description + "</li>");        });    } else {        alertAPIError(data.meta.message);    }};/*** callback function ater acquiring a list of relevant spots*/function onGetSuggestedSpots(data, textStatus, jqXHR) {    if (data.meta.code == 200) {        $("#suggestions").html("");        $("#tabs-1-loader").hide();        $.each(data.response.data.items,function(index,value){                        $("#suggestions").append("<li onclick='addSuggestedSpot(" + index + ")' id='suggestedSpot_" + value.link.params.id + "'>" +                    "<span class='ui-icon ui-icon-plus'></span> " + value.description);            $("#suggestedSpot_" + value.link.params.id).append("</li>");            // add latlong data to the DOM elements (prevent requesting the spotinfo again)            $("#suggestedSpot_" + value.link.params.id).data('latlong',{latitude: value.meta_info.latitude, longitude: value.meta_info.longitude});        });    } else {        alertAPIError(data.meta.message);    }};/** * add a searched spot as next stop in the route * @param the position in the list of searched spots */function addSearchedSpot( listID ) {    var listitems = document.getElementById("searchresults").getElementsByTagName("li");    var sortItems = document.getElementById("sortable").getElementsByTagName("li");          if (sortItems.length >= 10) {        alert("The current API allows maximum 8 intermediate points.");    } else {        var spotID = listitems[listID].id.split('_')[1];        var spotName = listitems[listID].innerHTML;        var toAdd = "<li id='spot_" + spotID + "' class='ui-state-default'>" + spotName + "<span onclick=deleteItem('spot_" + spotID + "');>delete</span></li>";        $("#sortable").append(toAdd);        //acquireRecommendedSpots(spotID);        acquireRelevantSpotsFromSearch(spotID);    }    $("#searchresults").html("");};/*** get relevant spots based on a spot found by search* @param: the ID of the spot on which the relevance is based*/function acquireRelevantSpotsFromSearch(spotID) {    // we need the lat long information to get relevant spots. first acquire spot info    var url = "http://" + config_serverAddress + "/spots/" + spotID;        // send a request to the nodeJS API to get information about a spot    // parameters: the spot id    // returns: information about the spot        $.ajax({        type: 'GET',        crossDomain:true,        url: url,        cache: false,        success: onGetRelevantSpotsFromSearch,        error: function(jqXHR, errorstatus, errorthrown) {           alert(errorstatus + ": " + errorthrown);        }    });     };/*** callback function after getting information about a spot* now the lat long is known, the relevant spot can be found**/function onGetRelevantSpotsFromSearch(data, textStatus, jqXHR) {    data = JSON.parse(data);    if (data.meta.code == 200) {        acquireSuggestedSpotsByLatLong(data.response.latitude, data.response.longitude);    } else {        alertAPIError(data.meta.message);    }};/*** add a suggested spot as next stop in the route* @param the position in the list of suggested spots*/function addSuggestedSpot( listID ) {    var listitems = document.getElementById("suggestions").getElementsByTagName("li");      var sortItems = document.getElementById("sortable").getElementsByTagName("li");          if (sortItems.length >= 10) {        alert("The current API allows maximum 8 intermediate points.");    } else {        var spotID = listitems[listID].id.split('_')[1] ;        var spotName = listitems[listID].innerHTML;        var toAdd = "<li id='spot_" + spotID + "' class='ui-state-default'>" + spotName + "<span onclick=deleteItem('spot_" + spotID + "');>delete</span></li>";        //$("#sortable").append("<li id='spot_" + spotID + "'>" + spotName + "</li>");        $("#sortable").append(toAdd);        var latlong = $("#" + listitems[listID].id).data("latlong");        acquireSuggestedSpotsByLatLong(latlong.latitude, latlong.longitude);        //acquireRecommendedSpots(spotID);    }    };/*** remove an item when building a list* @param the DOM id of the item to be removed*/function deleteItem(itemID){    $('#' + itemID).remove();};/*** Get a recommended spot based on the VikingPatterns API* @param the spot ID*/function acquireRecommendedSpots(spotID) {    var url = config_WhatsNextAddress + $.cookie("token") + "/whatsnext/" +spotID + "/";    $("#recommended").html("");    $("#tabs-2-loader").show();        // send a request to the WhatsNext API to acquire the recommended spots    // parameters: spotID and bearer token    // returns: list of recommendedspots        $.ajax({       type: 'GET',        url: url,        success: onGetRecommendedSpots,        dataType:"json",        error: function(jqXHR, errorstatus, errorthrown) {           alert("The what's next API is having some problems");        }    });  };/*** callback function after requesting recommended spots*/function onGetRecommendedSpots(data, textStatus, jqXHR) {    if (data.meta.code == 200) {        $("#recommended").html("");        $("#tabs-2-loader").hide();        if (data.response.count > 0) {                        $.each(data.response.spots,function(index,value){                            $("#recommended").append("<li onclick='addRecommendedSpot(" + index + ")' id='recommendedSpot_" + value.id + "'>" +                        "<span class='ui-icon ui-icon-plus'></span> " + value.name);                                $("#recommendedSpot_" + value.id).append("</li>");                // add latlong data to the DOM elements (prevent requesting the spotinfo again)                $("#recommendedSpot_" + value.id).data('latlong',{latitude: value.latitude, longitude: value.longitude});            });        }        else            $("#recommended").html("There are no recommended spots for this spot.");            } else {        alertAPIError(data.meta.message);    }};/*** add a the selected recommended spot to the list* @param the id of the selected spot*/function addRecommendedSpot( listID ) {    var listitems = document.getElementById("recommended").getElementsByTagName("li");      var sortItems = document.getElementById("sortable").getElementsByTagName("li");          if (sortItems.length >= 10) {        alert("The current API allows maximum 8 intermediate points.");    } else {        var spotID = listitems[listID].id.split('_')[1] ;        var spotName = listitems[listID].innerHTML;        var toAdd = "<li id='spot_" + spotID + "' class='ui-state-default'>" + spotName + "<span onclick=deleteItem('spot_" + spotID + "');>delete</span></li>";        $("#sortable").append(toAdd);        var latlong = $("#" + listitems[listID].id).data("latlong");        acquireSuggestedSpotsByLatLong(latlong.latitude, latlong.longitude);        //acquireRecommendedSpots(spotID);    }   };/**Add a spot for the routeBuilder*/function routeBuilderAddSpot( spot ){    spots.push(spot);};/**clear the routebuilder spots*/function routeBuilderClearSpots() {    spots.length = 0;     $("#sortable").html("");};/**add a new route to the database*/function addNewRoute() {    var minGroupSize = parseInt($("#minGroupSize").val());    var maxGroupSize = parseInt($("#maxGroupSize").val());    if (minGroupSize != null && maxGroupSize != null && minGroupSize > maxGroupSize) {        alert("Minimum group cannot be larger than maximum group size!");    } else {        var items = document.getElementById("sortable").getElementsByTagName("li");             var points = [];        $.each(items, function (index, value) {                                if (index <= 10 ){ // API allows max. 8 waypoints                                    var id = parseInt((value.id.split('_')[1]));                                    points.push({'item': id});                                                               }                            });            var newRoute = {                    name: $("#routeName").val(),                    description: $("#routeDescription").val(),                    points: points,                    minimumGroupSize: minGroupSize,                     maximumGroupSize: maxGroupSize                };        var url =  "http://" + config_serverAddress + "/routes/";            // send a POST to the nodeJS API to save a route        // parameters: the route information: the name , description and a list of points in JSON format        // returns: the route ID        $.ajax({            url: url,            data: newRoute,            success: onRouteAdded,            dataType: "json",            type: "POST"        });    }};/**callback function after adding a route*/function onRouteAdded(data, textStatus, jqXHR) {    console.log(data);    if (data.meta.code == 200)    {        selectRoute(data.response.id);        $("#routeBuilder").hide();        $("#searchform").hide();        $("#sortableInput").html("");        $("#sortable").html("");        $("#suggestions").html("");        $("#recommended").html("");        $("#searchresults").html("");        $("#tabs").hide();    } else {        alertAPIError(data.meta.message);    }    };function search(){    var searchTerm = $("#searchTerm").val();    navigator.geolocation.getCurrentPosition( function (position) {                    acquireSuggestedSpotsBySearch( position.coords.latitude, position.coords.longitude, searchTerm);                });};