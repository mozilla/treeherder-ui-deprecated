/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


// -------------------------------------------------------------------------
// Utility Functions
// -------------------------------------------------------------------------


/**
 * Compute the standard deviation for an array of values.
 * 
 * @param values
 *        An array of numbers.
 * @param avg
 *        Average of the values.
 * @return a number (the standard deviation)
 */
function stddev(values, avg) {
  if (values.length <= 1) {
    return 0;
  }

  return Math.sqrt(
    values.map(function (v) { return Math.pow(v - avg, 2); })
          .reduce(function (a, b) { return a + b; }) / (values.length - 1));
}


// -------------------------------------------------------------------------
// End Utility Functions
// -------------------------------------------------------------------------


var compare = angular.module("compare", ['ui.router', 'ui.bootstrap', 'treeherder']);

compare.factory('getSeriesSummary', [ function() {
  return function(signature, signatureProps, optionCollectionMap, pgo, e10s) {
    var platform = signatureProps.machine_platform + " " +
      signatureProps.machine_architecture;
    var extra = "";
    if (signatureProps.job_group_symbol === "T-e10s") {
      extra = " e10s";
    }
    var testName = signatureProps.test;
    var subtestSignatures;
    if (testName === undefined) {
      testName = "summary";
      subtestSignatures = signatureProps.subtest_signatures;
    }
    var name = signatureProps.suite + " " + testName +
      " " + optionCollectionMap[signatureProps.option_collection_hash] + extra;

    //Only keep summary signatures, filter in/out e10s and pgo
    if (name.indexOf('summary') <= 0) {
        return null;
    }
    if (e10s && (name.indexOf('e10s') <= 0)) {
        return null;
    } else if (!e10s && (name.indexOf('e10s') > 0)) {
        return null;
    }

    //TODO: pgo is linux/windows only- what about osx and android
    if (pgo && (name.indexOf('pgo') <= 1)) {
        return null;
    } else if (!pgo && (name.indexOf('pgo') > 0)) {
        return null;
    }

    return { name: name, signature: signature, platform: platform,
             subtestSignatures: subtestSignatures };
  };
}]);

compare.controller('CompareCtrl', [ '$state', '$stateParams', '$scope', '$rootScope', '$location',
                              '$modal', 'thServiceDomain', '$http', '$q', '$timeout', 'getSeriesSummary',
  function CompareCtrl($state, $stateParams, $scope, $rootScope, $location, $modal,
                    thServiceDomain, $http, $q, $timeout, getSeriesSummary) {

    function displayComparision() {
      //TODO: why do we need so much history?
      $scope.timeRange = 2592000; // last 30 days
      $scope.testList = [];

      var signatureURL = thServiceDomain + '/api/project/' + $scope.originalProject + 
          '/performance-data/0/get_performance_series_summary/?interval=' +
          $scope.timeRange;

      $http.get(signatureURL).then(
        function(response) {
          var seriesList = [];

          Object.keys(response.data).forEach(function(signature) {
            var seriesSummary = getSeriesSummary(signature,
                                                 response.data[signature],
                                                 optionCollectionMap,
                                                 $stateParams.pgo,
                                                 $stateParams.e10s);

            if (seriesSummary != null && seriesSummary.signature !== undefined) {
              seriesList.push(seriesSummary);

              var testname = seriesSummary.name;
              if ($scope.testList.indexOf(testname) === -1) {
                $scope.testList.push(testname);
              }
            }
          });
          $scope.testList.sort();

          // find summary results for all tests/platforms for the original rev
          var signatureURL = thServiceDomain + '/api/project/' +
              $scope.originalProject + '/performance-data/0/' +
              'get_performance_data/?interval_seconds=' + $scope.timeRange;

          // TODO: figure how how to reduce these maps
          var rawResultsMap = {};

          $q.all(seriesList.map(function(series) {
            return $http.get(signatureURL + "&signatures=" + series.signature).then(function(response) {
              response.data.forEach(function(data) {
                rawResultsMap[data.series_signature] = calculateStats(data.blob, $scope.originalResultSetID);
              });
            });
          })).then(function () {

            // find summary results for all tests/platforms for the original rev
            var signatureURL = thServiceDomain + '/api/project/' +
                           $scope.newProject + '/performance-data/0/' +
                           'get_performance_data/?interval_seconds=' + $scope.timeRange;

            //ok, now get the new revision
            var signatureListURL = thServiceDomain + '/api/project/' + $scope.newProject + 
              '/performance-data/0/get_performance_series_summary/?interval=' +
              $scope.timeRange;

            // TODO: figure how how to reduce these maps
            var new_rawResultsMap = {};
            var new_seriesList = [];


            $http.get(signatureListURL).then(function(response) {
              Object.keys(response.data).forEach(function(signature) {
                var seriesSummary = getSeriesSummary(signature,
                                                     response.data[signature],
                                                     optionCollectionMap,
                                                     $stateParams.pgo,
                                                     $stateParams.e10s);

                if (seriesSummary != null && seriesSummary.signature !== undefined) {
                  new_seriesList.push(seriesSummary);
                }
              });


              $q.all(new_seriesList.map(function(series) {
                return $http.get(signatureURL + "&signatures=" + series.signature).then(function(response) {
                  response.data.forEach(function(data) {
                    new_rawResultsMap[data.series_signature] = calculateStats(data.blob, $scope.newResultSetID);
                  });
                });
              })).then(function () {
                displayResults(seriesList, rawResultsMap, new_seriesList, new_rawResultsMap);
              });
            });
          });
        }
      );
    }

    function calculateStats(perfData, resultSetID) {
      var geomeans = [];
      var total = 0;
      perfData.forEach(function(pdata) {
        if (pdata.result_set_id != resultSetID) {
          return null;
        }

        geomeans.push(pdata.geomean);
        total += pdata.geomean;
      });

      var avg = total / geomeans.length;
      var sigma = stddev(geomeans, avg);
      return {'geomean': avg, 'variation': 2*sigma, 'runs': geomeans.length};
    }

    function displayResults(seriesList, rawResultsMap, new_seriesList, new_rawResultsMap) {
      var counter = 0;
      var compareResultsMap = {};

      $scope.testList.forEach(function(testName) {
        if (counter > 0 && compareResultsMap[(counter-1)].isHeader) {
          counter--;
        }

        //TODO: figure out a cleaner method for making the names a header row
        compareResultsMap[counter++] = {'name': testName, 'isHeader': true};

        //TODO: need to figure out how to iterate through the old and new series list
        //      Ideally a seriesList.forEach(...)
        for (var idx in seriesList) {
          if (seriesList[idx].name != testName) {
            continue;
          }

          var cmap = {};
          cmap['originalGeoMean'] = rawResultsMap;
          cmap['newGeoMean'] = new_rawResultsMap;

          if (seriesList[idx].signature in rawResultsMap) {
             cmap['originalGeoMean'] = rawResultsMap[seriesList[idx].signature].geomean.toFixed(2);
             cmap['originalRuns'] = rawResultsMap[seriesList[idx].signature].runs;
//TODO: \b1 doesn't print out the +- character
//                     cmap['originalVariation'] = "\B1" + rawResultsMap[seriesList[idx].signature].variation
             cmap['originalVariation'] = "+/- " + rawResultsMap[seriesList[idx].signature].variation.toFixed(2);
          }
          if (new_seriesList[idx].signature in new_rawResultsMap) {
             cmap['newGeoMean'] = new_rawResultsMap[new_seriesList[idx].signature].geomean.toFixed(2);
             cmap['newRuns'] = new_rawResultsMap[new_seriesList[idx].signature].runs;
//TODO: \b1 doesn't print out the +- character
//                     cmap['newVariation'] = "\B1" + rawResultsMap[seriesList[idx].signature].variation
             cmap['newVariation'] = "+/- " + rawResultsMap[new_seriesList[idx].signature].variation.toFixed(2);
          }

          if (new_seriesList[idx].signature in new_rawResultsMap && 
              seriesList[idx].signature in rawResultsMap) {
             cmap['delta'] = (cmap['newGeoMean'] - cmap['originalGeoMean']).toFixed(2);
             cmap['deltaPercentage'] = (cmap['delta'] / cmap['originalGeoMean'] * 100).toFixed(2) + ' %';

            cmap.type = 'data';
            //TODO: some tests are reverse, figure out how to account for that
            if (cmap.delta < 0) {
              cmap.type = 'improvement';
            } else if (cmap.delta > 1) {
              cmap.type = 'regression';
            }

            //TODO: zoom?  >1 highlighted revision?
            var originalSeries = encodeURIComponent(JSON.stringify(
                          { project: $scope.originalProject,
                            signature: seriesList[idx].signature,
                            visible: true}));

            var newSeries = encodeURIComponent(JSON.stringify(
                          { project: $scope.newProject,
                            signature: new_seriesList[idx].signature,
                            visible: true}));

            var detailsLink = thServiceDomain + '/perf.html#/graphs?timerange=' +
                $scope.timeRange + '&series=' + newSeries;

            if (seriesList[idx].signature != new_seriesList[idx].signature) {
              detailsLink += '&series=' + originalSeries;
            }

            detailsLink += '&highlightedRevision=' + $scope.newRevision;

            cmap.detailsLink = detailsLink;
            cmap.name = seriesList[idx].platform;
            cmap.isHeader = false;
            compareResultsMap[counter++] = cmap;
          }

        };
      });
      $scope.compareResults = Object.keys(compareResultsMap).map(function(k) {
        return compareResultsMap[k];
      });
    }

    function verifyRevision(project, revision, rsid) {
      if ((revision != null && revision != '') &&
          (project != null && project != '')) {

        var uri = thServiceDomain + '/api/project/' + project +
            '/resultset/?format=json&full=false&with_jobs=false&revision=' + 
            revision;

        $http.get(uri).then(function(response) {
          var results = response.data.results;
          if (results.length > 0) {

            //TODO: remove this hack so we can return the value
            if (rsid == 'original') {
              $scope.originalResultSetID = results[0].id;
            } else {
              $scope.newResultSetID = results[0].id;
            }
          }
        });
      }
    }

    function updateURL() {
      $state.transitionTo('compare', { 'originalProject': $scope.originalProject,
                            'originalRevision': $scope.originalRevision,
                            'newProject': $scope.newProject,
                            'newRevision': $scope.newRevision},
                {location: true, inherit: true, notify: false, relative: $state.$current});
    }

    var optionCollectionMap = {};

    $http.get(thServiceDomain + '/api/optioncollectionhash').then(
      function(response) {
        response.data.forEach(function(dict) {
          optionCollectionMap[dict.option_collection_hash] =
            dict.options.map(function(option) {
              return option.name; }).join(" ");
        });
      }).then(function() {
        if ($stateParams.e10s) {
          $stateParams.e10s = true;
        } else {
          $stateParams.e10s = false;
        }

        if ($stateParams.pgo) {
          $stateParams.pgo = true;
        } else {
          $stateParams.pgo = false;
        }

        // TODO: validate projects and revisions
        $scope.originalProject = '';
        if ($stateParams.originalProject) {
          $scope.originalProject = $stateParams.originalProject;
        }

        $scope.newProject = '';
        if ($stateParams.newProject) {
          $scope.newProject = $stateParams.newProject;
        }

        $scope.newRevision = '';
        if ($stateParams.newRevision) {
          $scope.newRevision = $stateParams.newRevision;
        }

        $scope.originalRevision = '';
        if ($stateParams.originalRevision) {
          $scope.originalRevision = $stateParams.originalRevision;
        }

        verifyRevision($scope.originalProject, $scope.originalRevision, "original");
        verifyRevision($scope.newProject, $scope.newRevision, "new");

        $http.get(thServiceDomain + '/api/repository/').then(function(response) {
          $scope.projects = response.data;

          $scope.addCompareData = function() {
            $scope.compareResults = null
            var defaultProjectName;

            var modalInstance = $modal.open({
              templateUrl: 'partials/perf/comparedatachooser.html',
              controller: 'CompareChooserCtrl',
              resolve: {
                projects: function() {
                  return $scope.projects;
                },
                optionCollectionMap: function() {
                  return optionCollectionMap;
                },
                defaultProjectName: function() { return defaultProjectName; }
              }
            });

            modalInstance.opened.then(function () {});

            modalInstance.result.then(function(originalProject, originalRevision,
                                               newProject, newRevision) {
              $scope.originalProject = originalProject;
              $scope.originalRevision = originalRevision;
              $scope.newProject = newProject;
              $scope.newRevision = newRevision;

              updateURL();
            });
          };
        });
      displayComparision();
      });
  }]);

compare.controller('CompareChooserCtrl', function($scope, $modalInstance,
                                            $http, projects, optionCollectionMap,
                                            thServiceDomain,
                                            getSeriesSummary, defaultProjectName) {
  $scope.projects = projects;
  if (defaultProjectName) {
    $scope.originalProject = _.findWhere(projects, {name: defaultProjectName});
  } else {
    $scope.originalProject = projects[0];
  }

  if (defaultProjectName) {
    $scope.newProject = _.findWhere(projects, {name: defaultProjectName});
  } else {
    $scope.newProject = 'Try';
  }

  $scope.loadingCompareData = false;
  $scope.originalRevision = '';
  $scope.newRevision = '';

  $scope.addCompareData = function () {
    $modalInstance.close($scope.orignalProject, $scope.originalRevision,
                         $scope.newProject, $scope.newRevision);
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
});

compare.config(function($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.deferIntercept(); // so we don't reload on url change

  $stateProvider.state('compare', {
    templateUrl: 'partials/perf/comparectrl.html',
    url: '/compare?originalProject&originalRevision&newProject&newRevision',
    controller: 'CompareCtrl'
  });

  $urlRouterProvider.otherwise('/compare');
})
  // define the interception
  .run(function ($rootScope, $urlRouter, $location, $state) {
    $rootScope.$on('$locationChangeSuccess', function(e, newUrl, oldUrl) {
      // Prevent $urlRouter's default handler from firing
      e.preventDefault();
      if ($state.current.name !== 'compare') {
        // here for first time, synchronize
        $urlRouter.sync();
      }
    });

    // Configures $urlRouter's listener *after* custom listener
    $urlRouter.listen();
  })


