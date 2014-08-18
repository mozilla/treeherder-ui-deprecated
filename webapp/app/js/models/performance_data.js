'use strict';

treeherder.factory('ThPerformanceDataModel', [
    '$http', '$q', '$timeout', 'thUrl',
    function($http, $q, $timeout, thUrl) {

    var ThPerformanceDataModel = function() {
    };

    ThPerformanceDataModel.get_uri = function(){return thUrl.getProjectUrl('/performance-data/0');};

    ThPerformanceDataModel.prototype.get_from_signatures = function (signatures, timeInterval) {
       return $http.get(ThPerformanceDataModel.get_uri() + '/get_performance_data/',{
            params: {
                signatures: signatures,
                interval_seconds: timeInterval || 1209600
            }
        });
    };

    ThPerformanceDataModel.prototype.get_signatures_from_property_list = function (params) {
        return $http.get(ThPerformanceDataModel.get_uri() + '/get_signatures_from_properties/',{
            params: params
        });
    };

    ThPerformanceDataModel.prototype.get_from_property_list = function (params, timeInterval) {
        var deferred = $q.defer();
        var _this = this;

        this.get_signatures_from_property_list(params)
                .then(function (signatureData) {
            signatureData = signatureData.data;
            var signatures = [];

            for (var i in signatureData) {
                if (!signatureData.hasOwnProperty(i)) continue;
                signatures.push(i);
            }

            _this.get_from_signatures(signatures, timeInterval)
                    .then(function (performanceData) {
                deferred.resolve({
                    performanceData: performanceData,
                    signatureData: signatureData
                });
            });
        });

        return deferred.promise;
    };

    return ThPerformanceDataModel;
}]);
