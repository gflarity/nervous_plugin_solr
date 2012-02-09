//config 
var interval = 10*1000;
var stats_url = 'http://localhost:8983/solr/admin/stats.jsp';

//deps
var request = require('request');
var parser = require('xml2json');
var util = require('util');

//code

module.exports = function( axon ) {

    //state goes here
    var query_stats_previous;    
    /*var query_stats_previous = { handlerStart: '1327940116118',
      requests: '709008',
      errors: '1244',
      timeouts: '0',
      totalTime: '973918',
      avgTimePerRequest: '1.3736347',
      avgRequestsPerSecond: '0.8067507',
      _timestamp: 1328818960000 };
    */  
    //var update_stats_prevous;

    var check_stats = function() { 
        request( stats_url, function (error, response, body) {
          
            if ( error || ! response.statusCode == 200 ) {
              
                //emit error
                if ( error ) {
                    axon.emit( 'error', error );
                }
                else {
                    axon.emit( 'error', 'statusCode not 200?');
                }
                return;
            }
            try {
                        
                var json = JSON.parse( parser.toJson( body ) ); 
                var solr_info = json['solr']['solr-info']
                var now = json['solr']['now'];
                
                var query_handler_entries = solr_info['QUERYHANDLER']['entry'];
                
                var update_handler_entry = solr_info['UPDATEHANDLER']['entry'];
                
                var query_stats = query_stats_helper( query_handler_entries );            
                //var update_stats = update_stats_handler( update_handler_entry );
        
                //set our own timestamp for use in the deltas
                query_stats._timestamp = new Date(json['solr']['now']).getTime();
        
                var average_requests_per_second, average_time_per_request, average_errors_per_second;
                
                //if we have some state info then we can publish relative data
                if ( query_stats_previous ) {
        
                    var delta = query_stats._timestamp - query_stats_previous._timestamp;
        
                    //get the average for this interval
                    var new_requests = parseInt(query_stats.requests);
                    var old_requests =  parseInt(query_stats_previous.requests);
                    var requests = new_requests-old_requests;        
        
                    average_requests_per_second = requests / delta * 1000;                
                   
                    var previous_handler_start = parseInt( query_stats_previous.handlerStart );            
                    var handler_start = parseInt( query_stats.handlerStart );
                    var old_average_time_per_request = parseFloat( query_stats_previous.avgTimePerRequest );
                    var new_average_time_per_request = parseFloat( query_stats.avgTimePerRequest );      
                    
                    //total_time
                    var t = query_stats._timestamp - previous_handler_start;
                    //interval_time
                    var i = query_stats._timestamp - query_stats_previous._timestamp;
                    //previous_interval_time
                    var p = query_stats_previous._timestamp - previous_handler_start;
                    
                     //extrapolate 
                    average_time_per_request = ( new_average_time_per_request * t 
                                                - old_average_time_per_request * p ) / i ;
        
                    //console.log( average_time_per_request );
                    //console.log( (( average_time_per_request*i) +  (old_average_time_per_request*p)) / t )
                    //console.log( t );            
                    //console.log( i );            
                    //console.log( p );            
                    //console.log(new_average_time_per_request);
                    //console.log(old_average_time_per_request);
                    
                    var new_errors = parseInt( query_stats.errors );
                    var old_errors = parseInt( query_stats_previous.errors );
                    average_errors_per_second = ( new_errors - old_errors ) / delta * 1000;            
                    
                }        
                else { 
                    average_requests_per_second = parseFloat( query_stats.avgRequestsPerSecond );            
                    average_time_per_request = parseFloat( query_stats.avgTimePerRequest );
        
                    var handler_start = parseInt( query_stats.handlerStart );
                    var timestamp = query_stats._timestamp;
                    var delta = timestamp - handler_start;
                    var errors = parseInt( query_stats.errors );
                    average_errors_per_second = errors / delta * 1000;                                    
                }
          
                
                //console.log( query_stats );
                //console.log( average_requests_per_second );
                //console.log( average_time_per_request );        
                //console.log( average_errors_per_second );
                var nervous_timestamp = Math.round( query_stats._timestamp/1000 ); 
                axon.emit( 'data', 'average_requests_per_second', average_requests_per_second, nervous_timestamp );
                axon.emit( 'data', 'average_time_per_request_in_ms', average_time_per_request, nervous_timestamp );
                axon.emit( 'data', 'average_errors_per_second', average_errors_per_second, nervous_timestamp );                    
                
            } catch ( e ) {        
                //emit error   
                axon.emit( 'error',  e );
            }
        
        });
    };
            
    setInterval( check_stats, interval );
};



function update_stats_handler ( update_handler_entry ) {

    if ( ! update_handler_entry ) {
        throw "update handler entry missing";
    }
    else {
        
        //emit data    
        var stats_array = update_handler_entry.stats.stat;
       
        var update_stats  = {};
        for ( var i = 0; i < stats_array.length; i++ ) {
            var stat = stats_array[i];
            update_stats[stat.name] = stat['$t'];
        }                               
        return update_stats;
    }

}

function query_stats_helper( query_handler_entries ) {

        var standard_query_entry;    
        for ( var i = 0; i < query_handler_entries.length; i++ ) {
            var entry = query_handler_entries[i];
            if ( entry.name == 'standard' ) {
                standard_query_entry = entry;
            }
        }
        
        if ( ! standard_query_entry ) {
            throw "standard handler entry missing";
        }
        else {
            
            //emit data    
            var stats_array = standard_query_entry.stats.stat;
           
            var query_stats  = {};
            for ( var i = 0; i < stats_array.length; i++ ) {
                var stat = stats_array[i];
                query_stats[stat.name] = stat['$t'];
            }                 
            
            return query_stats;
        }

}