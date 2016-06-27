// This is the search component which houses the search input field, the info and 
// notice lines of text, and the outer housing for the results
CLINIKO_APP.component('ckSearch', {
  bindings: {
    name: '@'
    , search: '='
    , onResultClick: '='
    , onKeyup: '&'
  }
  , controller: function($scope, $element, $attrs) {
    var $ctrl = this;

    $ctrl.onResultClickPassthru = function(person) {
      $ctrl.onResultClick(person);
    };
  }
  , templateUrl: "/components/search.html"
});

// Component for results, since we need to handle two different types of results
// Appointment result and person result
CLINIKO_APP.component('ckSearchResult', {
  bindings: {
    name: '='
    , result: '='
    , onResultClick: '&'
    , getFullName: '&'
  }
  , controller: function($scope, $element, $attrs, helperService) {
    var $ctrl = this;

    $ctrl.displayDate = helperService.displayDate;
    $ctrl.getFullName = helperService.getFullName;

    $ctrl.getResultTemplateURL = function() {
      return $ctrl.name === "appointment" ? "/components/appointment-result.html" : "/components/person-result.html";
    };
  }
  , template: '<div ng-include="$ctrl.getResultTemplateURL()"></div>'
});

// Separately we need to show appointments listed for selected people
CLINIKO_APP.component('ckAppointmentListing', {
  bindings: {
    person: '='
    , relationalKey: '@'
  }
  , controller: function($scope, $element, $attrs, helperService) {
    var $ctrl = this;

    $ctrl.displayDate = helperService.displayDate;
    $ctrl.getFullName = helperService.getFullName;
  }
  , templateUrl: "/components/appointment-listing.html"
});