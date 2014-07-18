'use strict';

treeherder.factory('ThPerformanceArtifactModel', [
    '$http', 'ThLog', 'thUrl',
    function($http, ThLog, thUrl) {

    // ThPerformanceArtifactModel is the js counterpart of performance_artifact

    var ThPerformanceArtifactModel = function(data) {
        // creates a new instance of ThPerformanceArtifactModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThPerformanceArtifactModel.get_uri = function(){return thUrl.getProjectUrl("/performance_artifact/");};

    ThPerformanceArtifactModel.get_list = function(options, config) {
        // a static method to retrieve a list of ThPerformanceArtifactModel
        // the timeout configuration parameter is a promise that can be used to abort
        // the ajax request
        config = config || {};
        var timeout = config.timeout || null;

        return $http.get(ThPerformanceArtifactModel.get_uri(),{
            params: options,
            timeout: timeout
        })
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThPerformanceArtifactModel(elem));
                });
                return item_list;
        });
    };

    ThPerformanceArtifactModel.get = function(pk) {
        // a static method to retrieve a single instance of ThPerformanceArtifactModel
        return $http.get(ThPerformanceArtifactModel.get_uri()+pk).then(function(response) {
            return new ThPerformanceArtifactModel(response.data);
        });
    };

    return ThPerformanceArtifactModel;
}]);
