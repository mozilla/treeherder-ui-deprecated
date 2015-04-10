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


var comparetalos = angular.module("perf", ['ui.router', 'ui.bootstrap']);

/* Copied from providers.js */
comparetalos.provider('thServiceDomain', function() {
    this.$get = function() {
        if (window.thServiceDomain) {
            return window.thServiceDomain;
        } else {
            return "";
        }
    };
});

comparetalos.factory('getSeriesSummary', [ function() {
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
        return {};
    }
    if (e10s && (name.indexOf('e10s') <= 0)) {
        return {};
    } else if (!e10s && (name.indexOf('e10s') > 0)) {
        return {};
    }

    //TODO: pgo is linux/windows only- what about osx and android
    if (pgo && (name.indexOf('pgo') <= 1)) {
        return {};
    } else if (!pgo && (name.indexOf('pgo') > 0)) {
        return {};
    }

    return { name: name, signature: signature, platform: platform,
             subtestSignatures: subtestSignatures };
  };
}]);

comparetalos.controller('CompareCtrl', [ '$state', '$stateParams', '$scope', '$rootScope', '$location',
                              '$modal', 'thServiceDomain', '$http', '$q', '$timeout', 'getSeriesSummary',
  function CompareCtrl($state, $stateParams, $scope, $rootScope, $location, $modal,
                    thServiceDomain, $http, $q, $timeout, getSeriesSummary) {

    var availableColors = [ 'red', 'green', 'blue', 'orange', 'purple' ];

    function displayComparision() {
//TODO: why do we need so much history?
      $scope.timeRange = 2592000; // last 30 days
      $scope.testList = [];

//TODO: how to input these variables
$scope.e10s = false;
$scope.pgo = false;

      var signatureURL = thServiceDomain + '/api/project/' + $scope.originalProject + 
          '/performance-data/0/get_performance_series_summary/?interval=' +
          $scope.timeRange;

      $http.get(signatureURL).then(
        function(response) {
          var data = response.data;
          var seriesList = [];
          var selectedSignatures = [];

          var selectedSignaturesCount = 0;
          Object.keys(data).forEach(function(signature) {
            var seriesSummary = getSeriesSummary(signature,
                                                 data[signature],
                                                 optionCollectionMap,
                                                 $scope.pgo,
                                                 $scope.e10s);

            if (seriesSummary == {}) {
              return;
            }

            var testname = seriesSummary.name;
            if ($scope.testList.indexOf(testname) === -1) {
              $scope.testList.push(testname);
            }

            // Bug 1153301, query too long
            if (seriesSummary.signature !== undefined && selectedSignaturesCount < 20) {
              seriesList.push(seriesSummary);
              selectedSignatures.push(seriesSummary.signature);
              selectedSignaturesCount++;
            }
          });
          $scope.testList.sort();

          var compareResultsMap = {};

          // find summary results for all tests/platforms for the original rev
          var uri2 = thServiceDomain + '/api/project/' +
              $scope.originalProject + '/performance-data/0/' +
              'get_performance_data/?interval_seconds=' + $scope.timeRange;
          selectedSignatures.forEach(function(signature) {
            uri2 += ('&signatures=' + signature);
          });

          // TODO: figure how how to reduce these maps
          var rawResultsMap = {};

          $http.get(uri2).then(function(response) {
            response.data.forEach(function(data) {
              var perfData = data.blob;
              var geomeans = [];
              var total = 0;
              for (var i=0; i < perfData.length; i++) {
                if (perfData[i].result_set_id != $scope.originalResultSetID) {
                  continue;
                }

                geomeans.push(perfData[i].geomean);
                total += perfData[i].geomean;
              }

              var avg = total / geomeans.length;
              var sigma = stddev(geomeans, avg);
              rawResultsMap[data.series_signature] = {'geomean': avg, 'variation': 2*sigma, 'runs': geomeans.length};
            });


            //ok, now get the new revision
            signatureURL = thServiceDomain + '/api/project/' + $scope.newProject + 
              '/performance-data/0/get_performance_series_summary/?interval=' +
              $scope.timeRange;

            $http.get(signatureURL).then(function(response) {
              var data = response.data;
              var new_seriesList = [];
              var new_selectedSignatures = [];
              var new_selectedSignaturesCount = 0;
              Object.keys(data).forEach(function(signature) {
                var seriesSummary = getSeriesSummary(signature,
                                                     data[signature],
                                                     optionCollectionMap,
                                                     $scope.pgo,
                                                     $scope.e10s);

                if (seriesSummary == {}) {
                  return;
                }

                if (seriesSummary.signature !== undefined && new_selectedSignaturesCount < 20) {
                  new_seriesList.push(seriesSummary);
                  new_selectedSignatures.push(seriesSummary.signature);
                  new_selectedSignaturesCount++;
                }
              });

              // find summary results for all tests/platforms for the original rev
              uri2 = thServiceDomain + '/api/project/' +
                     $scope.newProject + '/performance-data/0/' +
                     'get_performance_data/?interval_seconds=' + $scope.timeRange;
              new_selectedSignatures.forEach(function(signature) {
                uri2 += ('&signatures=' + signature);
              });

              // TODO: figure how how to reduce these maps
              var new_rawResultsMap = {};

              $http.get(uri2).then(function(response) {
                response.data.forEach(function(data) {

                  var perfData = data.blob;
                  var geomeans = [];
                  var total = 0;
                  for (var i=0; i < perfData.length; i++) {
                    if (perfData[i].result_set_id != $scope.newResultSetID) {
                      continue;
                    }

                    geomeans.push(perfData[i].geomean);
                    total += perfData[i].geomean;
                  }

                  var avg = total / geomeans.length;
                  var sigma = stddev(geomeans, avg);
                  new_rawResultsMap[data.series_signature] = {'geomean': avg, 'variation': 2*sigma, 'runs': geomeans.length};
                });




              var counter = 0;
              for (var t in $scope.testList) {
                // Remove previous header if we have no data
                if (counter > 0 && compareResultsMap[(counter-1)].isHeader) {
                  counter--;
                }

                //TODO: figure out a cleaner method for making the names a header row
                compareResultsMap[counter++] = {'name': $scope.testList[t], 'isHeader': true};
                //TODO; shouldn't this be on new_seriesList and is idx from above == idx here?
                for (var idx in seriesList) {
                  if (seriesList[idx].name != $scope.testList[t]) {
                    continue;
                  }

                  var cmap = {}
                  if (seriesList[idx].signature in rawResultsMap) {
                     cmap['originalGeoMean'] = rawResultsMap[seriesList[idx].signature].geomean.toFixed(2);
                     cmap['originalRuns'] = new_rawResultsMap[new_seriesList[idx].signature].runs;
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
              }
              $scope.compareResults = Object.keys(compareResultsMap).map(function(k) {
                return compareResultsMap[k];
              });


              });
            });
          });
        }
      );
    }

    function verifyOriginalRevision() {
      $scope.originalResultSetID = '';
      var uri = thServiceDomain + '/api/project/' + $scope.originalProject +
          '/resultset/?format=json&full=false&with_jobs=false&revision=' + 
          $scope.originalRevision;

      $http.get(uri).then(function(response) {
        var results = response.data.results;
        if (results.length > 0) {
          $scope.originalResultSetID = results[0].id;
        }
      });
    }

    function verifyNewRevision() {
      $scope.newResultSetID = '';
      var uri = thServiceDomain + '/api/project/' + $scope.newProject +
          '/resultset/?format=json&full=false&with_jobs=false&revision=' + 
          $scope.newRevision;

      $http.get(uri).then(function(response) {
        var results = response.data.results;
        if (results.length > 0) {
          $scope.newResultSetID = results[0].id;
        }
      });
    }

    function updateURL() {
      $state.transitionTo('comparetalos', { 'originalProject': $scope.originalProject,
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
        
        if ($stateParams.originalProject) {
          $scope.originalProject = $stateParams.originalProject;
        } else {
          $scope.originalProject = '';
        }

        if ($stateParams.originalRevision) {
          $scope.originalRevision = $stateParams.originalRevision;
          if ($scope.originalProject != '') {
            verifyOriginalRevision();
          }
        } else {
          $scope.originalRevision = '';
        }

        if ($stateParams.newProject) {
          $scope.newProject = $stateParams.newProject;
        } else {
          $scope.newProject = '';
        }

        if ($stateParams.newRevision) {
          $scope.newRevision = $stateParams.newRevision;
          if ($scope.newProject != '') {
            verifyNewRevision();
          }
        } else {
          $scope.newRevision = '';
        }

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

              displayComparision();
              updateURL();
            });
          };
        });

      displayComparision();
      });
  }]);

comparetalos.controller('CompareChooserCtrl', function($scope, $modalInstance,
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

comparetalos.config(function($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.deferIntercept(); // so we don't reload on url change

  $stateProvider.state('comparetalos', {
    templateUrl: 'partials/perf/comparectrl.html',
    url: '/comparetalos?originalProject&originalRevision&newProject&newRevision',
    controller: 'CompareCtrl'
  });

  $urlRouterProvider.otherwise('/comparetalos');
})
  // define the interception
  .run(function ($rootScope, $urlRouter, $location, $state) {
    $rootScope.$on('$locationChangeSuccess', function(e, newUrl, oldUrl) {
      // Prevent $urlRouter's default handler from firing
      e.preventDefault();
      if ($state.current.name !== 'comparetalos') {
        // here for first time, synchronize
        $urlRouter.sync();
      }
    });

    // Configures $urlRouter's listener *after* custom listener
    $urlRouter.listen();
  })


