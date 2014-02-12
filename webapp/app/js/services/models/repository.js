treeherder.factory('thRepos',
                   ['$http', 'thUrl', '$rootScope', '$log',
                   function($http, thUrl, $rootScope, $log) {

    // get the repositories (aka trees)
    // sample: 'resources/menu.json'
    var byName = function(name) {
        if ($rootScope.repos !== undefined) {
            for (var i = 0; i < $rootScope.repos.length; i++) {
                var repo = $rootScope.repos[i];
                if (repo.name === name) {
                    return repo;
                }
            }
        } else {
            $log.warn("Repos list has not been loaded.");
        }
        $log.warn("'" + name + "' not found in repos list.");
        return null;
    };

    return {
        // load the list of repos into $rootScope, and set the current repo.
        load: function(name) {
            return $http.get(thUrl.getRootUrl("/repository/")).
                success(function(data) {
                    $rootScope.repos = data;
                    if (name) {
                        $rootScope.currentRepo = byName(name)
                    }
                });
        },
        // return the currently selected repo
        getCurrent: function() {
            return $rootScope.currentRepo;
        },
        // set the current repo to one in the repos list
        setCurrent: function(name) {
            $rootScope.currentRepo = byName(name)
        },
        // get a repo object without setting anything
        getRepo: function(name) {
            return byName(name);
        }
    };
}]);
