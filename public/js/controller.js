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

// TODO: make sure we're sorting correctly


// Define the app
var CLINIKO_APP = angular.module("cliniko-test", []);

// This is the creatively named 'helperService' which contains things that many of our
// components need to use like the loaded data and helper functions for getting names
// and objects from IDs.
CLINIKO_APP.factory('helperService', ['$http', '$q', function($http, $q) {
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
  service.getFullNameByID = function(path, id, closure) {
    service.getPersonByID(path, id).then(function(person) {
      closure(service.getFullName(person));
    }, closure);
  };

  // Generic get object by ID. Takes an array and an ID to look it up
  // If nothing is found, undefined is returned
  service.getPersonByID = function(path, id) {
    return $q(function(resolve, reject) {
      $http.get("http://localhost:3001/" + path + "/" + id).then(function(response) {
        resolve(response.data);
      }, function(data) {
        service.triggerError("There was an error getting " + path + " data at id " + id + ".");
        reject();
      });
    });
  };

  // Standardizes date formatting throughout the app
  service.displayDate = function(date) {
    return moment(date).format("MMMM Do YYYY");
  };

  // This adds an extra & at the end of the string but it doesn't affect the data
  service.buildQueryURL = function(path, query) {
    var url = "http://localhost:3001/" + path;

    if (!angular.isUndefined(query)) {
      url = url + "?";
      for (var q in query) {
        url = url + q + "=" + query[q] + "&";
      }
    }
    return url;
  };

  // Loads patients from API
  service.loadCollection = function(path, query, closure) {
    closure = closure || angular.noop;
    var url = service.buildQueryURL(path, query);
    
    $http.get(url).then(function(response) {
      service.data[path] = response.data;
      closure(response.data);
    }, function(data) {
      service.triggerError("There was an error getting patient data.");
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


      var patient = helperService.getFullName(_.findWhere(helperService.data.patients, { id: appointment.patient_id })).toLowerCase();
      var practitioner = helperService.getFullName(_.findWhere(helperService.data.practitioners, { id: appointment.practitioner_id })).toLowerCase();

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
    helperService.getFullNameByID("practitioners", practitioner_id, function(name) {
      if (!angular.isUndefined(name)) {
        $http.post("http://localhost:3001/appointments/", {
          id: $scope.getNewAppointmentID()
          , date: moment($scope.current_date).format()
          , practitioner_id: practitioner_id
          , patient_id: patient.id
        }).then(function(response) {
          helperService.data.appointments.push(response.data);
          response.data.full_name = name;
          $scope.selected_item.appointments.push(response.data);
        }, function(data) {
          helperService.triggerError("There was an error adding new appointment. The endpoint doesn't exist.");
        });
      }
    });
  };

  $scope.loadRelationalAppointmentData = function(appointments, path, key) {
    var loadOneRelationship = function(index) {
      helperService.getFullNameByID(path, appointments[index][key], function(name) {
        appointments[index].full_name = name;
        index = index + 1;
        if (index < appointments.length) {
          loadOneRelationship(index);
        }
      });
    };
    loadOneRelationship(0);
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
    helperService.loadCollection(name.toLowerCase());
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
  $scope.onPersonSearch = function(source) {
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
    $scope.onPersonSearch(helperService.data.patients);
  };

  // Helper function for more modular markup
  $scope.onPractitionerSearch = function() {
    $scope.onPersonSearch(helperService.data.practitioners);
  };

  // Selects a person for the detail view section
  $scope.selectPerson = function(person, query, relation_key) {
    $scope.selected_item = person;
    $scope.search.term = "";
    $scope.search.results = [];
    
    // Grab all appointments, all practitioners for each appointment
    helperService.loadCollection("appointments", query, function(appointments) {
      $scope.selected_item.appointments = appointments;
      if (appointments.length > 0) {
        $scope.loadRelationalAppointmentData($scope.selected_item.appointments, relation_key + "s", relation_key + "_id")
      }
    });
  };

  // Helper method for more modular view
  $scope.selectPatient = function(person) {
    $scope.selectPerson(person, { patient_id: person.id }, "practitioner");
  };

  // Helper method for more modular view
  $scope.selectPractitioner = function(person) {
    $scope.selectPerson(person, { practitioner_id: person.id }, "patient");
  };

  // Grab all the data on page load
  // This has issues at much larger scale > 100k results 
  // But in that case you'd probably use a backend for running the search
  // And call the backend search endpoint from the frontend
  $scope.onPageLoad = function() {
    helperService.loadCollection($scope.current_view.toLowerCase());
  };

  $scope.onPageLoad();

}]);