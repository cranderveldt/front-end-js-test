// Define the app
var CLINIKO_APP = angular.module("cliniko-test", []);

// This is the creatively named 'helperService' which contains things that many of our
// components need to use like helper functions for getting names and displaying date
CLINIKO_APP.factory('helperService', ['$http', '$q', function($http, $q) {
  var service = this;

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

  // Standardizes date formatting throughout the app
  service.displayDate = function(date) {
    return moment(date).format("MMMM Do YYYY");
  };

  return service;
}]);

// Single "Main" controller
CLINIKO_APP.controller("Main", ["$scope", "$http", "$timeout", "appointmentFilter", 
  function ($scope, $http, $timeout, appointmentFilter) {

  $scope.error = {
    exists: false
    , message: ""
  };

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
    $scope.getFullNameByID("practitioners", practitioner_id, function(name) {
      if (!angular.isUndefined(name)) {
        $http.post("http://localhost:3001/appointments/", {
          date: moment($scope.current_date).format()
          , practitioner_id: practitioner_id
          , patient_id: patient.id
        }).then(function(response) {
          response.data.full_name = name;
          $scope.selected_item.appointments.push(response.data);
        }, function(data) {
          $scope.triggerError("There was an error adding new appointment. The endpoint doesn't exist.");
        });
      }
    });
  };

  $scope.loadRelationalAppointmentData = function(appointments, path, key) {
    var query = {id: []};
    query.id = appointments.map(function(appointment) {
      return appointment[key];
    });
    $scope.loadCollection(path, query, function(people) {
      for (var a in appointments) {
        var person = _.findWhere(people, { id: appointments[a][key] });
        appointments[a][path.slice(0, -1) + "_name"] = helperService.getFullName(person);
      }
    });
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

      closure();
    }
  };

  $scope.onPersonSearch = function(path) {
    $scope.genericSearch(function() {
      $scope.loadCollection(path, { q: $scope.search.term }, function(data) {
        $scope.search.results = data;
        $scope.search.searching = false;
      });
    });
  };

  // query: appointments where patient or practitioner names = search term
  // I tried using relational queries provided by the API but they didn't seem to work
  // So instead we have to do several queries
  // patients where names = search term + practitioners wher name = search term
  // then plucking their respective IDs and search appointments twice for each list
  // then we combine the two arrays, getting rid of any duplicates
  $scope.onAppointmentSearch = function() {
    $scope.genericSearch(function() {
      var practitioner_ids = [];
      var patient_ids = [];
      $scope.loadCollection('patients', { q: $scope.search.term }, function(patients_data) {
        patient_ids = patients_data.map(function(p) { return p.id; });
        $scope.loadCollection('practitioners', { q: $scope.search.term }, function(practitioners_data) {
          practitioner_ids = practitioners_data.map(function(p) { return p.id; });
          $scope.loadCollection('appointments', { patient_id: patient_ids, _sort: "date" }, function(patient_appointments) {
            $scope.loadCollection('appointments', { practitioner_id: practitioner_ids, _sort: "date" }, function(practitioner_appointments) {
              $scope.search.results = _.union(patient_appointments, practitioner_appointments);
              
              if ($scope.search.results.length > 0) {
                $scope.loadRelationalAppointmentData($scope.search.results, "patients", "patient_id");
                $scope.loadRelationalAppointmentData($scope.search.results, "practitioners", "practitioner_id");
              }

              $scope.search.searching = false;
            });
          });
        });
      });
    });
  };

  // Selects a person for the detail view section
  $scope.selectPerson = function(person, query, relation_key) {
    $scope.selected_item = person;
    $scope.search.term = "";
    $scope.search.results = [];
    
    // Grab all appointments, all practitioners for each appointment
    $scope.loadCollection("appointments", query, function(appointments) {
      $scope.selected_item.appointments = appointments;
      if (appointments.length > 0) {
        $scope.loadRelationalAppointmentData($scope.selected_item.appointments, relation_key + "s", relation_key + "_id");
      }
    });
  };

  // Helper method for more modular view
  $scope.selectPatient = function(person) {
    $scope.selectPerson(person, { patient_id: person.id, _sort: "date" }, "practitioner");

    // Need a list of all practictioners for the add new appointment select element
    $scope.loadCollection('practitioners', undefined, function(data) {
      $scope.practitioners = data;
    });
  };

  // Helper method for more modular view
  $scope.selectPractitioner = function(person) {
    $scope.selectPerson(person, { practitioner_id: person.id, _sort: "date" }, "patient");
  };

  // Generic get object by ID. Takes an array and an ID to look it up
  // If nothing is found, undefined is returned
  $scope.getPersonByID = function(path, id) {
    return $q(function(resolve, reject) {
      $http.get("http://localhost:3001/" + path + "/" + id).then(function(response) {
        resolve(response.data);
      }, function(data) {
        $scope.triggerError("There was an error getting " + path + " data at id " + id + ".");
        reject();
      });
    });
  };

  // Shorthand helper method for returning a fullname by an array and id
  $scope.getFullNameByID = function(path, id, closure) {
    $scope.getPersonByID(path, id).then(function(person) {
      closure($scope.getFullName(person));
    }, closure);
  };


  $scope.buildQueryURL = function(path, query) {
    var url = "http://localhost:3001/" + path;

    if (!angular.isUndefined(query)) {
      url = url + "?";
      for (var q in query) {
        if (!angular.isArray(query[q])) {
          query[q] = [query[q]];
        }
        for (var a in query[q]) {
          url = url + q + "=" + query[q][a] + "&";
        }
      }
      url = url.slice(0, -1)
    }

    return url;
  };

  // Loads patients from API
  $scope.loadCollection = function(path, query, closure) {
    closure = closure || angular.noop;
    var url = $scope.buildQueryURL(path, query);
    
    $http.get(url).then(function(response) {
      closure(response.data);
    }, function(data) {
      $scope.triggerError("There was an error getting patient data.");
    });
  };

  // Triggers error in console and for user
  $scope.triggerError = function(message) {
    $scope.error.exists = true;
    $scope.error.message = message;
    console.log(message);
  };

}]);