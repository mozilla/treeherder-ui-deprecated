treeherder.factory('thJobs', ['$http', 'thUrl', function($http, thUrl) {

    return {
        getJobs: function(offset, count, joblist) {
            offset = typeof offset == 'undefined'?  0: offset;
            count = typeof count == 'undefined'?  10: count;
            var params = {
                offset: offset,
                count: count,
                format: "json"
            }

            if (joblist) {
                _.extend(params, {
                    offset: 0,
                    count: joblist.length,
                    id__in: joblist.join()
                })
            }
            return $http.get(thUrl.getProjectUrl("/jobs/"),
                             {params: params}
            );
        }
    }
}]);
