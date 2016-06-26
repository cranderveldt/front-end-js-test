/*
*
* For you consideration:
*
* One of my strengths is picking up on patterns in code written by other people
* and following the spirit of those patterns in future code.
*
* In a few situations below, I had the choice of picking between (what I consider)
* two bad options: either 
*
* 1) getting all the data at once and storing it in the client (in a service),
* then passing it around the various components or
*
* 2) making a new request to the db every time as data is requested, this way
* any time a component needed to lookup data on an object (i.e. an appointment 
* needs to get more information based on its patient_id), it just makes a new
* GET request and pulls out the relevant data
*
* Option 1 is bad because with component-designed architecture you want your
* blocks to be modular, not relying on controller- or service-specific data.
*
* Option 2 is bad because a SPA making so many server requests is an unnecessary
* load on the server. This code test uses a simple data, but if the objects had
* more attributes and more relationships, it could get really nasty really fast.
*
* There's obviously a best practice in there somewhere, very likely outside the 
* two options I outlined above. I have no problem writing the components one way
* or the other, I just wanted to make it clear I was aware of the difference and
* that there may be a better way.
*
* Thanks for taking the time to review my code. I'm really excited for the 
* opportunity to work with you!
*
*                                                                   -Trevor Moore
*/


// Define the app
var CLINIKO_APP = angular.module("cliniko-test", []);

// This is the creatively named 'helperService' which contains things that many of our
// components need to use like the loaded data and helper functions for getting names
// and objects from IDs.
CLINIKO_APP.factory('helperService', ['$http', function($http) {
  var service = this;

  service.error = {
    exists: false
    , message: ""
  };

  service.data = {
    patients: []
    , practitioners: []
    , appointments: []
  };

  // Gets the full name of any person, taking into account their title if they have one
  // Handles receiving an undefined person as a param so getFullNameByID fails gracefully
  service.getFullName = function(person) {
    var name = "";

    if (!angular.isUndefined(person)) {
      if (person.title) {
        name = name + person.title + " ";
      }
      name = name + person.first_name + " " + person.last_name
    }

    return name;
  };

  // Shorthand helper method for returning a fullname by an array and id
  service.getFullNameByID = function(array, id) {
    var person = service.getPersonByID(array, id);
    return service.getFullName(person);
  };

  // Helper method for more modular markup
  service.getPatientNameByID = function(id) {
    var person = service.getPersonByID(service.data.patients, id);
    return service.getFullName(person);
  };

  // Helper method for more modular markup
  service.getPractitionerNameByID = function(id) {
    var person = service.getPersonByID(service.data.practitioners, id);
    return service.getFullName(person);
  };

  // Generic get object by ID. Takes an array and an ID to look it up
  // If nothing is found, undefined is returned
  service.getPersonByID = function(array, id) {
    return _.findWhere(array, { id: id });
  };

  // Standardizes date formatting throughout the app
  service.displayDate = function(date) {
    return moment(date).format("MMMM Do YYYY");
  };

  // Loads patients from API
  service.loadPatientData = function() {
    $http.get("http://localhost:3001/patients").then(function(response) {
      service.data.patients = response.data;
      service.loadPractitionersData();
    }, function(data) {
      service.triggerError("There was an error getting patient data.");
    });
  };

  // Loads practitioners from API
  service.loadPractitionersData = function() {
    $http.get("http://localhost:3001/practitioners").then(function(response) {
      service.data.practitioners = response.data;
      service.loadAppointmentsData();
    }, function(data) {
      service.triggerError("There was an error getting practitioners data.");
    });
  };

  // Loads appointments from API
  service.loadAppointmentsData = function() {
    $http.get("http://localhost:3001/appointments").then(function(response) {
      service.data.appointments = response.data;
    }, function(data) {
      service.triggerError("There was an error getting appointments data.");
    });
  };

  // Triggers error in console and for user
  service.triggerError = function(message) {
    service.error.exists = true;
    service.error.message = message;
    console.log(message);
  };

  return service;
}]);

// This person filter takes an array and search string.
// We search on each word of the string, so we split it on whitespace into "terms"
// Then we compare the terms to the given person's full name
// If any term is included in the full name string, the person is considered a match
CLINIKO_APP.filter('person', ['helperService', function(helperService) {
  return function(array, search) {
    var terms = search.toLowerCase().split(" ");
    return _.filter(array, function(person) {
      var is_match = false;
      var name = helperService.getFullName(person).toLowerCase();
      
      for (var t in terms) {
        if (name.includes(terms[t])) {
          is_match = true;
        }
      }
      return is_match;
    });
  };
}]);

// Appointment search only takes search terms because we already know which array to search in.
// In this search we compare each term to the patients' and practitioners' full names
CLINIKO_APP.filter('appointment', ['helperService', function(helperService) {
  return function(search) {
    var terms = search.toLowerCase().split(" ");
    return _.filter(helperService.data.appointments, function(appointment) {
      var is_match = false;

      var patient = helperService.getFullNameByID(helperService.data.patients, appointment.patient_id).toLowerCase();
      var practitioner = helperService.getFullNameByID(helperService.data.practitioners, appointment.practitioner_id).toLowerCase();
      
      for (var t in terms) {
        if (patient.includes(terms[t]) || practitioner.includes(terms[t])) {
          is_match = true;
        }
      }
      return is_match;
    });
  };
}]);


// Single "Main" controller
CLINIKO_APP.controller("Main", ["$scope", "$http", "$timeout", "helperService", "personFilter", "appointmentFilter", 
  function ($scope, $http, $timeout, helperService, personFilter, appointmentFilter) {

  $scope.data = helperService.data;
  $scope.error = helperService.error;
  $scope.current_view = "Patients";
  $scope.views = [
    "Patients"
    , "Practitioners"
    , "Appointments"
  ];
  $scope.search = {
    searching: false
    , term: ""
    , timeout: false
    , results: []
  };
  $scope.selected_item = null;
  $scope.current_date = moment().format();
  $scope.new_appointment_practitioner = 1;

  // This is the theoretical POST function for adding a new appointment but since
  // there's no endpoint set up for adding a new apointment this is just an approximation
  $scope.addAppointment = function(patient, practitioner_id) {
    var practitioner = helperService.getPractitionerNameByID(practitioner_id);
    if (!angular.isUndefined(practitioner)) {
      $http.post("http://localhost:3001/appointment/new", {
        id: $scope.getNewAppointmentID()
        , date: moment($scope.current_date).format()
        , practitioner_id: practitioner_id
        , patient_id: patient.id
      }).then(function(response) {
        console.log(response);
      }, function(data) {
        helperService.triggerError("There was an error adding new appointment. The endpoint doesn't exist.");
      });
    }
  };

  // We need these two functions in the view, so we copy them from the service
  $scope.displayDate = helperService.displayDate;
  $scope.getFullName = helperService.getFullName;

  // Because the views share common objects for searching and selected_item
  // we reset them when we change the view
  $scope.changeView = function(name) {
    $scope.search.term = "";
    $scope.search.results = [];
    $scope.current_view = name;
    $scope.selected_item = null;
  };

  // Generates new appointment ID based on the last appointment ID
  $scope.getNewAppointmentID = function() {
    return helperService.data.appointments[helperService.data.appointments.length - 1].id + 1;
  };

  // The shared guts of the search logic
  // If the term is over 2 chars and it's been 500ms since the last search,
  // you can search again. At the end of 500s if the term has changed (i.e. someone
  // was typing during the timeout), perform another search to update the results
  $scope.genericSearch = function(closure) {
    if ($scope.search.term.length > 2 && !$scope.search.timeout) {
      
      // Only search every 500ms
      var search_term = $scope.search.term;
      $scope.search.timeout = true;
      $scope.search.searching = true;
      $timeout(function() {
        $scope.search.timeout = false;
        if (search_term !== $scope.search.term) {
          $scope.genericSearch(closure);
        }
      }, 500);

      $scope.search.results = closure();
      $scope.search.searching = false;
    }
  };

  // Regular search which compares search terms to each object's properties 
  // in a given source array
  $scope.onSearch = function(source) {
    $scope.genericSearch(function() {
      return personFilter(source, $scope.search.term);
    });
  };

  // Need a separate search just for appointments because it has to deep search
  // which requires different logic
  $scope.onAppointmentSearch = function() {
    $scope.genericSearch(function() {
      return appointmentFilter($scope.search.term);
    });
  };

  // Helper function for more modular markup
  $scope.onPatientSearch = function() {
    $scope.onSearch(helperService.data.patients);
  };

  // Helper function for more modular markup
  $scope.onPractitionerSearch = function() {
    $scope.onSearch(helperService.data.patients);
  };

  // Selects a patient for the detail view section
  $scope.selectPatient = function(patient) {
    $scope.selected_item = patient;
    $scope.selected_item.appointments = _.where(helperService.data.appointments, { patient_id: patient.id });
  };

  // Selects a practitioner for the detail view section
  $scope.selectPractitioner = function(practitioner) {
    $scope.selected_item = practitioner;
    $scope.selected_item.appointments = _.where(helperService.data.appointments, { practitioner_id: practitioner.id });
  };

  // Grab all the data on page load
  // This has issues at much larger scale > 100k results 
  // But in that case you'd probably use a backend for running the search
  // And call the backend search endpoint from the frontend
  $scope.onPageLoad = function() {
    helperService.loadPatientData();
  };

  $scope.onPageLoad();

}]);