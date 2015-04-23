/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var perf = angular.module("perf", ['ui.router', 'ui.bootstrap', 'treeherder']);

perf.factory('isReverseTest', [ function() {
  return function(testName) {
    var reverseTests = ['dromaeo_dom', 'dromaeo_css', 'v8_7', 'canvasmark'];
    var found = false;
    reverseTests.forEach(function(rt) {
      if (testName.indexOf(rt) >= 0) {
        found = true;
      }
    });
    return found;
  }
}]);

perf.factory('getSeriesSummary', [ function() {
  return function(signature, signatureProps, optionCollectionMap) {
    var platform = signatureProps.machine_platform + " " +
      signatureProps.machine_architecture;
    var e10s = (signatureProps.job_group_symbol === "T-e10s");
    var testName = signatureProps.test;
    var subtestSignatures;
    if (testName === undefined) {
      testName = "summary";
      subtestSignatures = signatureProps.subtest_signatures;
    }
    var name = signatureProps.suite + " " + testName;
    var options = [ optionCollectionMap[signatureProps.option_collection_hash] ];
    if (e10s) {
      options.push("e10s");
    }
    name = name + " " + options.join(" ");

    return { name: name, signature: signature, platform: platform,
             options: options, subtestSignatures: subtestSignatures };
  };
}]);


perf.factory('getCounterMap', [ 'isReverseTest',
  function(isReverseTest) {
    return function(testName, originalData, newData) {
      var cmap = {'originalGeoMean': NaN, 'originalRuns': 0, 'originalStddev': NaN,
                  'newGeoMean': NaN, 'newRuns': 0, 'newStddev': NaN,
                  'delta': NaN, 'deltaPercentage': NaN, 'isEmpty': false,
                  'isRegression': false, 'isImprovement': false, 'isMinor': true};

      if (originalData) {
         cmap.originalGeoMean = originalData.geomean;
         cmap.originalRuns = originalData.runs;
         cmap.originalStddev = originalData.stddev;
         cmap.originalStddevPct = ((originalData.stddev / originalData.geomean) * 100).toFixed(2);
      }
      if (newData) {
         cmap.newGeoMean = newData.geomean;
         cmap.newRuns = newData.runs;
         cmap.newStddev = newData.stddev;
         cmap.newStddevPct = ((newData.stddev / newData.geomean) * 100).toFixed(2);
      }

      if ((cmap.originalRuns == 0 && cmap.newRuns == 0) ||
          (testName == 'tp5n summary opt')) {
        // We don't generate numbers for tp5n, just counters
        cmap.isEmpty = true;
      } else {
        cmap.delta = (cmap.newGeoMean - cmap.originalGeoMean).toFixed(2);
        cmap.deltaPercentage = (cmap.delta / cmap.originalGeoMean * 100).toFixed(2);
        if (cmap.deltaPercentage > 2.0) {
          cmap.isMinor = false;
          isReverseTest(testName) ? cmap.isImprovement = true : cmap.isRegression = true;
        } else if (cmap.deltaPercentage < -2.0) {
          cmap.isMinor = false;
          isReverseTest(testName) ? cmap.isRegression = true : cmap.isImprovement = true;
        }
      }
      return cmap;
    }
}]);

perf.factory('calculateStats', [ 'math', function(math) {
  return function(perfData, resultSetID) {
    var geomeans = [];
    var total = 0;
    _.where(perfData, { result_set_id: resultSetID }).forEach(function(pdata) {
      //summary series have geomean, individual pages have mean
      if (pdata.geomean === undefined) {
        geomeans.push(pdata.mean);
      } else {
        geomeans.push(pdata.geomean);
      }
    });

    geomeans.forEach(function(mean) { total += mean; });

    var avg = total / geomeans.length;
    var sigma = math.stddev(geomeans, avg);
    return {geomean: avg.toFixed(2), stddev: sigma.toFixed(2), runs: geomeans.length};
  }
}]);


perf.factory('getSeriesLists', [ '$http', 'getSeriesSummary', 'thServiceDomain',
  function($http, getSeriesSummary, thServiceDomain) {
  return function(projectName, timeRange, optionMap, userOptions) {
    var signatureURL = thServiceDomain + '/api/project/' + projectName + 
      '/performance-data/0/get_performance_series_summary/?interval=' +
      timeRange;
    var e10s = false;
    var pgo = false;
    var summaryOnly = false;
    var targetSignature = '';

    if (userOptions.e10s != undefined)
      e10s = userOptions.e10s;

    if (userOptions.pgo != undefined)
      pgo = userOptions.pgo;

    if (userOptions.targetSignature != undefined)
      targetSignature = userOptions.targetSignature;

    if (userOptions.summaryOnly != undefined)
      summaryOnly = userOptions.summaryOnly;

    return $http.get(signatureURL).then(function(response) {
      var seriesList = [];
      var platformList = [];
      var testList = [];
      var subtestSignatures = null;
      var suiteName = "";

      if (targetSignature != '') {
          var summary = _.find(Object.keys(response.data), function(signature) { 
                   return signature == targetSignature;
                 });
          if (summary) {
            var seriesSummary = getSeriesSummary(targetSignature,
                                                 response.data[targetSignature],
                                                 optionMap);
              subtestSignatures = seriesSummary.subtestSignatures;
              suiteName = seriesSummary.name;
          }
      }

      Object.keys(response.data).forEach(function(signature) {
        var seriesSummary = getSeriesSummary(signature,
                                             response.data[signature],
                                             optionMap);

        // Only keep summary signatures, filter in/out e10s and pgo
        if (summaryOnly && !subtestSignatures && 
            !seriesSummary.subtestSignatures ||
            (e10s && !_.contains(seriesSummary.options, 'e10s')) ||
            (!e10s && _.contains(seriesSummary.options, 'e10s')) ||
            (pgo && !_.contains(seriesSummary.options, 'pgo')) ||
            (!pgo && _.contains(seriesSummary.options, 'pgo'))) {
            return;
        } else {
          // if we have input a summary signature, filter out the subtestSignatures
          if (subtestSignatures && targetSignature) {
            var subsig = _.find(subtestSignatures, function(subsig) { 
                     return signature == subsig;
                   });
            if (subtestSignatures && !subsig) {
              return;
            }
          }

          seriesList.push(seriesSummary);

          // add test/platform to lists if not yet present
          if (!_.contains(platformList, seriesSummary.platform)) {
            platformList.push(seriesSummary.platform);
          }
          if (!_.contains(testList, seriesSummary.name)) {
            testList.push(seriesSummary.name);
          }
        }
      });

      // In the case where we pass in a summary and collect the pages, keep the test name
      if (targetSignature != '') {
        testList = [suiteName];
      }

      return {
        seriesList: seriesList,
        platformList: platformList,
        testList: testList
      };
    });
  };
}]);


perf.factory('getResultsMap', [ '$q', '$http', 'thServiceDomain', 'calculateStats',
  function($q, $http, thServiceDomain, calculateStats) {
  return function(projectName, seriesList, timeRange, resultSetId) {
    var baseURL = thServiceDomain + '/api/project/' +
      projectName + '/performance-data/0/' +
      'get_performance_data/?interval_seconds=' + timeRange;

    var resultsMap = {};
    return $q.all(seriesList.map(function(series) {
      return $http.get(baseURL + "&signatures=" + series.signature).then(
        function(response) {
          response.data.forEach(function(data) {
            resultsMap[data.series_signature] = calculateStats(
              data.blob, resultSetId);
            resultsMap[data.series_signature].name = series.name;
            resultsMap[data.series_signature].platform = series.platform;
          });
        })
    })).then(function() {
      return resultsMap;
    });
  }
}]);

perf.factory('math', [ function() {
  return {
    /**
     * Compute the standard deviation for an array of values.
     *
     * @param values
     *        An array of numbers.
     * @param avg
     *        Average of the values.
     * @return a number (the standard deviation)
     */
    stddev: function(values, avg) {
      if (values.length <= 1) {
        return 0;
      }

      return Math.sqrt(
        values.map(function (v) { return Math.pow(v - avg, 2); })
          .reduce(function (a, b) { return a + b; }) / (values.length - 1));
    }
  };
}]);
