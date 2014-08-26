'use strict';

treeherder.factory('ThJobGroupModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

    // ThJobGroupModel is the js counterpart of job_group

    var ThJobGroupModelModel = function(data) {
        // creates a new instance of ThJobGroupModelModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobGroupModelModel.get_uri = function(){
        var url = thUrl.getRootUrl("/jobgroup/");
        $log.log(url);
        return url;
    };

    ThJobGroupModelModel.get_list = function(options) {
        // a static method to retrieve a list of ThJobGroupModelModel
        options = options || {};
        var query_string = $.param(options);
        return $http.get(ThJobGroupModelModel.get_uri()+"?"+query_string)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThJobGroupModelModel(elem));
                });
                return item_list;
        });
    };

    ThJobGroupModelModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobGroupModelModel
        return $http.get(ThJobGroupModelModel.get_uri()+pk).then(function(response) {
            return new ThJobGroupModelModel(response.data);
        });
    };

    return ThJobGroupModelModel;
}]);
