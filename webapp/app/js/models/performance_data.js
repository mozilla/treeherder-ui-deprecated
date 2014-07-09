'use strict';

treeherder.factory('ThPerformanceDataModel', [
    '$http', '$q', '$timeout', 'thUrl',
    function($http, $q, $timeout, thUrl) {

    var ThPerformanceDataModel = function() {
    };

    ThPerformanceDataModel.get_uri = function(){return thUrl.getProjectUrl('/performance-data/0');};

    ThPerformanceDataModel.prototype.get_from_signatures = function (signatures, timeInterval) {
       return $http.get(ThPerformanceDataModel.get_uri() + '/get_performance_data',{
            params: {
                signatures: JSON.stringify(signatures),
                interval_seconds: timeInterval || 1209600
            }
        });
    };

    ThPerformanceDataModel.prototype.get_signatures_from_property_list = function (properties) {
        return $http.get(ThPerformanceDataModel.get_uri() + '/get_signatures_from_properties',{
            params: {
                properties: properties
            }
        });
    };

    return ThPerformanceDataModel;
}]);
