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

    if ($ctrl.name === "appointment") {
      $ctrl.patient = _.findWhere(helperService.data.patients, { id: $ctrl.result.patient_id });
      $ctrl.practitioner = _.findWhere(helperService.data.practitioners, { id: $ctrl.result.practitioner_id });
    }
  }
  , template: '<div ng-include="$ctrl.getResultTemplateURL()"></div>'
});

CLINIKO_APP.component('ckAppointmentListing', {
  bindings: {
    person: '='
    , relationWith: '@'
  }
  , controller: function($scope, $element, $attrs, helperService) {
    var $ctrl = this;

    $ctrl.getFullNameByID = function(appointment) {
      var id = appointment[$ctrl.relationWith + "_id"];
      var array = helperService.data[$ctrl.relationWith + "s"];

      helperService.getFullNameByID($ctrl.relationWith + "s", id, function(name) {
        return name;
      });
    };
    
    $ctrl.displayDate = helperService.displayDate;
    $ctrl.getFullName = helperService.getFullName;
  }
  , templateUrl: "/components/appointment-list.html"
});